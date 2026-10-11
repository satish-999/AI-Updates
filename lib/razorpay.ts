import { sqlClient } from "./db";
import { checkoutUrl, subscriptionPaidUntil, type Subscription } from "./billing-policy";

export function billingReady() {
  return process.env.BILLING_ENABLED === "true" && !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET && !!process.env.RAZORPAY_PLAN_ID && !!process.env.RAZORPAY_WEBHOOK_SECRET && !!process.env.SUPPORT_EMAIL && !!process.env.BUSINESS_NAME && !!process.env.REFUND_POLICY;
}
export async function razorpay<T>(path: string, body?: unknown): Promise<T> {
  const key = process.env.RAZORPAY_KEY_ID; const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new Error("Billing is not configured.");
  const response = await fetch("https://api.razorpay.com/v1/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"), "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("The payment provider could not complete this request.");
  return response.json() as Promise<T>;
}
export async function billingPlan() {
  if (!billingReady()) return null;
  const id = process.env.RAZORPAY_PLAN_ID!;
  if (!/^plan_[a-zA-Z0-9]+$/.test(id)) throw new Error("Invalid billing plan.");
  const plan = await razorpay<{ id: string; period: string; interval: number; item: { amount: number; currency: string; name: string } }>("plans/" + id);
  if (plan.id !== id || plan.period !== "monthly" || plan.interval !== 1 || plan.item.currency !== "INR" || !Number.isSafeInteger(plan.item.amount) || plan.item.amount <= 0) throw new Error("Configure a monthly INR plan.");
  return plan;
}
export async function syncSubscription(id: string, eventId?: string) {
  if (!/^sub_[a-zA-Z0-9]+$/.test(id)) throw new Error("Invalid subscription.");
  const sql = sqlClient();
  // Sequence allocated BEFORE network fetch prevents late responses overwriting newer syncs.
  const [{ version }] = await sql`select nextval('billing_sync_sequence')::text as version`;
  const sub = await razorpay<Subscription>("subscriptions/" + id);
  const [account] = await sql`select owner_id, intent_id, plan_id, subscription_id from billing_accounts
    where subscription_id = ${id} or intent_id::text = ${sub.notes?.intent_id ?? ""}`;
  if (!account) {
    const [previous] = await sql`select owner_id, intent_id from billing_history where subscription_id = ${id}`;
    if (previous && previous.owner_id === sub.notes?.owner_id && previous.intent_id === sub.notes?.intent_id) return sub;
  }
  if (!account || sub.id !== id || sub.notes?.intent_id !== account.intent_id || sub.notes?.owner_id !== account.owner_id ||
      sub.plan_id !== account.plan_id || (account.subscription_id && account.subscription_id !== id)) throw new Error("Subscription ownership could not be verified.");
  const until = subscriptionPaidUntil(sub, account.plan_id);
  const url = checkoutUrl(sub.short_url);
  // Event receipt and snapshot commit together; a failed fetch is retried by Razorpay.
  await sql`with updated as (
    update billing_accounts set subscription_id = ${id}, status = ${sub.status},
      paid_until = ${until}, checkout_url = ${url}, synced_at = now(), sync_version = ${version}
    where owner_id = ${account.owner_id} and intent_id = ${account.intent_id} and sync_version < ${version}
    returning subscription_id
  ) insert into billing_events(event_id, subscription_id)
    select ${eventId ?? "sync:" + version}, subscription_id from updated
    on conflict(event_id) do nothing`;
  return sub;
}
export async function startCheckout(ownerId: string) {
  const plan = await billingPlan();
  if (!plan) throw new Error("Subscriptions are not open yet.");
  const sql = sqlClient();
  // Archive a finished period before allowing a new subscription. Never replace a pending or ambiguous request.
  await sql`with terminal as (
    select * from billing_accounts where owner_id = ${ownerId}
      and status in ('cancelled','completed','expired') and coalesce(paid_until, now()) <= now()
      and subscription_id is not null for update
  ), archived as (
    insert into billing_history(subscription_id, owner_id, intent_id, plan_id, status, paid_until)
    select subscription_id, owner_id, intent_id, plan_id, status, paid_until from terminal
    on conflict(subscription_id) do nothing returning owner_id
  ) delete from billing_accounts where owner_id in (select owner_id from archived)`;
  const inserted = await sql`insert into billing_accounts(owner_id, plan_id)
    values (${ownerId}, ${plan.id}) on conflict(owner_id) do nothing returning intent_id`;
  if (!inserted.length) {
    const [row] = await sql`select checkout_url, status from billing_accounts where owner_id = ${ownerId}`;
    const url = checkoutUrl(row?.checkout_url);
    if (url && row.status === "created") return url;
    throw new Error("You already have a subscription request. Refresh billing status or contact support before starting another.");
  }
  const intent = inserted[0].intent_id;
  try {
    const sub = await razorpay<Subscription>("subscriptions", {
      plan_id: plan.id, total_count: 120, quantity: 1, customer_notify: true,
      notes: { owner_id: ownerId, intent_id: intent },
    });
    // Recoverable by webhook through intent_id if this write fails.
    await sql`update billing_accounts set subscription_id = ${sub.id}, checkout_url = ${checkoutUrl(sub.short_url)}, status = ${sub.status}
      where owner_id = ${ownerId} and subscription_id is null and sync_version = 0`;
    const url = checkoutUrl(sub.short_url);
    if (!url) throw new Error("Checkout URL is unavailable.");
    return url;
  } catch {
    // Never retry ambiguous creation automatically: provider may have created it.
    throw new Error("Checkout needs reconciliation. No second subscription was created. Contact support or refresh billing status.");
  }
}
