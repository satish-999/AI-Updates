/** Presence-only checks. Never prints secret values. */
import "dotenv/config";
const groups = {
  "Account sign-in": ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "APP_URL"],
  "News and private storage": ["DATABASE_URL"],
  "Razorpay billing": ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_PLAN_ID", "RAZORPAY_WEBHOOK_SECRET"],
  "Commercial information": ["BUSINESS_NAME", "SUPPORT_EMAIL", "REFUND_POLICY"],
};
let missing = false;
for (const [name, keys] of Object.entries(groups)) {
  const absent = keys.filter(k => !process.env[k]?.trim());
  console.log(name + ": " + (absent.length ? "missing " + absent.join(", ") : "present (not connectivity-verified)"));
  if (absent.length) missing = true;
}
console.log("AI provider: " + (process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY ? "present (not verified)" : "not configured; editorial advisor still works"));
console.log("Billing switch: " + (process.env.BILLING_ENABLED === "true" ? "enabled" : "disabled"));
console.log("Authentication mode: " + (process.env.AUTH_MODE === "preview" ? "local preview only — must not deploy" : "Supabase accounts"));
if (process.env.AUTH_MODE === "preview") missing = true;
if (missing) process.exitCode = 1;
