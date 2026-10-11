/** Periodic reconciliation, never grants access from a browser callback. */
import "dotenv/config";
import { sqlClient } from "../lib/db";
import { syncSubscription } from "../lib/razorpay";
async function main() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) { console.log("Billing reconciliation is not configured."); return; }
  const sql = sqlClient();
  const rows = await sql`select subscription_id from billing_accounts where subscription_id is not null
    and status not in ('cancelled', 'completed', 'expired')
    order by synced_at asc nulls first limit 100`;
  let failed = 0;
  for (const row of rows) { try { await syncSubscription(row.subscription_id); } catch { failed++; } }
  await sql`delete from account_usage where day < (now() at time zone 'UTC')::date - 35`;
  await sql`delete from billing_events where processed_at < now() - interval '90 days'`;
  if (failed) throw new Error("Some subscription checks failed.");
  console.log("Reconciled " + rows.length + " subscriptions.");
}
main().catch(() => { console.error("Billing reconciliation incomplete; retry required."); process.exitCode = 1; });
