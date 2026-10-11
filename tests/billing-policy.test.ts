import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { webhookValid, subscriptionPaidUntil, paidAccess, checkoutUrl } from "../lib/billing-policy.ts";
import { limitedBody } from "../lib/http-input.ts";
test("webhook signatures cover exact raw bytes and reject malformed or tampered requests", () => {
  const raw = '{"event":"subscription.charged"}'; const secret = "synthetic-test-secret";
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(webhookValid(raw, signature, secret), true);
  for (const bad of [null, "", "xyz", signature.slice(1)]) assert.equal(webhookValid(raw, bad, secret), false);
  assert.equal(webhookValid(raw + " ", signature, secret), false);
  assert.equal(webhookValid(raw, signature, "different"), false);
});
test("paid access needs a paid cycle, the configured plan and an unexpired period", () => {
  const sub = { id: "sub_test", plan_id: "plan_test", status: "active", paid_count: 1, current_end: 2000000000 };
  assert.equal(subscriptionPaidUntil(sub, "plan_test"), new Date(2000000000000).toISOString());
  for (const status of ["created", "authenticated", "pending", "halted", "expired"]) assert.equal(subscriptionPaidUntil({ ...sub, status }, "plan_test"), null);
  assert.equal(subscriptionPaidUntil({ ...sub, paid_count: 0 }, "plan_test"), null);
  assert.equal(subscriptionPaidUntil(sub, "plan_other"), null);
  assert.equal(paidAccess("2026-01-01", Date.parse("2026-01-02")), false);
  assert.equal(paidAccess("invalid"), false);
  assert.ok(subscriptionPaidUntil({ ...sub, status: "cancelled" }, "plan_test"));
});
test("hosted checkout URLs cannot redirect to untrusted hosts", () => {
  assert.equal(checkoutUrl("https://rzp.io/rzp/abc"), "https://rzp.io/rzp/abc");
  for (const value of ["http://rzp.io/a", "https://rzp.io.evil.test", "https://user@rzp.io/a", "javascript:alert(1)", null]) assert.equal(checkoutUrl(value), null);
});
test("streamed request limits are enforced without trusting Content-Length", async () => {
  const req = new Request("https://example.test", { method: "POST", body: "123456" });
  await assert.rejects(() => limitedBody(req, 5), /too large/);
  assert.equal(await limitedBody(new Request("https://example.test", { method: "POST", body: "abc" }), 3), "abc");
});
