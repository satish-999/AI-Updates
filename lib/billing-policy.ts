import { createHmac, timingSafeEqual } from "node:crypto";
export type Subscription = { id: string; plan_id: string; status: string; paid_count: number; current_end: number | null; short_url?: string; notes?: Record<string, string> };
export function webhookValid(raw: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(createHmac("sha256", secret).update(raw).digest(), Buffer.from(signature, "hex"));
}
export function subscriptionPaidUntil(sub: Subscription, expectedPlan: string): string | null {
  if (sub.plan_id !== expectedPlan || !["active", "cancelled", "completed"].includes(sub.status) || !Number.isInteger(sub.paid_count) || sub.paid_count < 1 || !Number.isFinite(sub.current_end) || !sub.current_end || sub.current_end < 1) return null;
  const date = new Date(sub.current_end * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function checkoutUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && ["rzp.io", "checkout.razorpay.com"].includes(url.hostname) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function paidAccess(value: string | Date | null, now = Date.now()) {
  return !!value && new Date(value).getTime() > now;
}
export const PLAN_LIMITS = { free: { projects: 3, monitors: 3, aiDaily: 5 }, pro: { projects: 100, monitors: 20, aiDaily: 50 } } as const;
