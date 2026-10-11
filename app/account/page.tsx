import Link from "next/link";
import { Shell } from "../shell";
import { requireIdentity } from "@/lib/identity";
import { entitlement } from "@/lib/entitlements";
import { billingPlan } from "@/lib/razorpay";
import { sqlClient } from "@/lib/db";
import { ymd } from "@/lib/format";
import { checkout, refreshBilling, cancelSubscription } from "./actions";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const user = await requireIdentity();
  const { error, notice } = await searchParams;
  let access = null; let account = null; let plan = null;
  try { access = await entitlement(user); } catch {}
  if (!user.preview) {
    try { const sql = sqlClient(); [account] = await sql`select status, paid_until, cancel_requested, subscription_id from billing_accounts where owner_id = ${user.id}`; } catch {}
    try { plan = await billingPlan(); } catch {}
  }
  return <Shell><div className="section-heading"><p className="eyebrow">YOUR WORKSPACE</p><h1>Account & subscription</h1><p>{user.email}</p></div>
    {error && <p role="alert" className="notice">We could not complete the billing request. Refresh your status before retrying. If checkout is pending, contact support to avoid a duplicate subscription.</p>}
    {notice && <p role="status" className="notice">{notice === "cancelled" ? "Cancellation is scheduled. Paid access continues until the current period ends." : "Subscription status checked with the payment provider."}</p>}
    <div className="pricing-grid"><section className="side-panel"><h2>{access?.name ?? "Status unavailable"}</h2><p>{access ? access.projects + " saved projects · " + access.monitors + " monitors · " + access.aiDaily + " AI requests per UTC day" : "We could not load your account limits. Please retry later."}</p><p>Source-backed tool recommendations and both news feeds are included. AI requests also depend on the shared provider budget.</p>{account && <><p>Billing status: {account.status}</p><p>Paid through: {ymd(account.paid_until)}</p>{account.cancel_requested && <p>Cancellation requested for the end of the billing period.</p>}</>}
    {!user.preview && <form action={refreshBilling}><button>Refresh billing status</button></form>}
    {account?.status === "active" && !account.cancel_requested && <details><summary>Cancel subscription</summary><p>Stops the next renewal. This does not issue a refund.</p><form action={cancelSubscription}><label><input type="checkbox" name="confirm" value="cancel" required /> Cancel at the end of this billing period</label><button>Confirm cancellation</button></form></details>}
    </section><section className="side-panel"><h2>Make room for more ideas.</h2><p>Pro includes 100 saved projects, 20 monitors and 50 AI requests per UTC day.</p>{plan ? <><p className="plan-price">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(plan.item.amount / 100)} / month</p><p>Monthly renewal for up to 120 billing cycles, unless cancelled. Review the exact payable total in Razorpay before authorising. AI-tool subscriptions are separate.</p><form action={checkout}><input type="hidden" name="amount" value={plan.item.amount} /><label><input type="checkbox" name="consent" value="yes" required /> I agree to the <Link href="/terms">terms and refund policy</Link> and monthly renewal.</label><button>Continue to secure checkout</button></form></> : <p>{user.preview ? "Payments are disabled in the local preview." : "Paid subscriptions are not open yet. You can use the Free plan once account services are connected."}</p>}</section></div>
    <section className="side-panel"><h2>Security & support</h2>{!user.preview && <Link href="/reset-password">Change password</Link>}<p>For billing questions or an account/data deletion request, {process.env.SUPPORT_EMAIL ? <a href={"mailto:" + process.env.SUPPORT_EMAIL}>{process.env.SUPPORT_EMAIL}</a> : "support contact will be published before subscriptions open"}.</p><p>Browser-only pilot saves are not automatically assigned to an account.</p></section></Shell>;
}
