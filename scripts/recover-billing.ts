/** Operator reconciliation after an ambiguous creation response.
 * Usage: npm run billing:recover -- sub_PROVIDER_ID
 * Ownership and stored intent are verified against Razorpay before writing.
 */
import "dotenv/config";
import { syncSubscription } from "../lib/razorpay";
const id = process.argv[2];
if (!id || !/^sub_[a-zA-Z0-9]+$/.test(id)) throw new Error("Provide a Razorpay subscription ID.");
syncSubscription(id).then(() => console.log("Subscription reconciled.")).catch(() => { console.error("Reconciliation failed. Verify provider credentials, stored intent and subscription ownership."); process.exitCode = 1; });
