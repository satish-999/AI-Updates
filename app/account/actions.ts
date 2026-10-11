"use server";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/identity";
import { billingPlan, startCheckout, syncSubscription, razorpay } from "@/lib/razorpay";
import { sqlClient } from "@/lib/db";
export async function checkout(form: FormData) {
  const user = await requireIdentity();
  let destination = "/account?error=checkout";
  try {
    if (user.preview || form.get("consent") !== "yes") throw new Error("Account required");
    const plan = await billingPlan();
    if (!plan || String(plan.item.amount) !== form.get("amount")) throw new Error("Plan changed");
    destination = await startCheckout(user.id);
  } catch {}
  redirect(destination);
}
export async function refreshBilling() {
  const user = await requireIdentity();
  let ok = false;
  try {
    if (!user.preview) {
      const sql = sqlClient();
      const [row] = await sql`select subscription_id from billing_accounts where owner_id = ${user.id}`;
      if (row?.subscription_id) { await syncSubscription(row.subscription_id); ok = true; }
    }
  } catch {}
  redirect(ok ? "/account?notice=refreshed" : "/account?error=refresh");
}
export async function cancelSubscription(form: FormData) {
  const user = await requireIdentity();
  let ok = false;
  try {
    if (user.preview || form.get("confirm") !== "cancel") throw new Error("Confirm cancellation");
    const sql = sqlClient();
    const [row] = await sql`select subscription_id, status, cancel_requested from billing_accounts where owner_id = ${user.id}`;
    if (row?.subscription_id && row.status === "active") {
      if (!row.cancel_requested) await razorpay("subscriptions/" + row.subscription_id + "/cancel", { cancel_at_cycle_end: 1 });
      await sql`update billing_accounts set cancel_requested = true where owner_id = ${user.id}`;
      await syncSubscription(row.subscription_id); ok = true;
    }
  } catch {}
  redirect(ok ? "/account?notice=cancelled" : "/account?error=cancel");
}
