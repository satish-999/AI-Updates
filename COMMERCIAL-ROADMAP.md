# AI Pulse commercial rollout

The user's objective is subscription revenue, followed by business-opportunity
discovery. Revenue is a business goal, not a verified outcome.

## Implemented foundation

Three main tabs give users AI updates, AI news and creative tool recommendations.
Source links, dates, feed health, explicit uncertainty and practical free/paid
constraints make recommendations inspectable. Private account saves and monitors
provide reasons to return. Supabase handles identity; Razorpay handles Indian
subscription checkout; Neon stores private projects and subscription entitlements.

Free limits are 3 projects, 3 monitors and 5 AI requests/day. Pro limits are 100,
20 and 50 respectively, still subject to the global model budget. These are initial
product limits to validate. The actual selling price comes from the configured
monthly INR Razorpay plan. No price or willingness-to-pay has been assumed.

## Launch work

1. Configure staging services and verify real confirmation/recovery email delivery,
   customer separation and optional Google sign-in.
2. Run Razorpay test scenarios including renewal failures, cancellation, expiry,
   duplicate/delayed webhooks, refunds handled under the chosen operator policy and
   reconciliation after an ambiguous create response.
3. Verify actual source coverage, ingestion scheduling, database migrations and
   desktop/mobile accessibility. Review the catalog's official sources.
4. Complete business activation, commercial hosting, support contact, refund policy,
   privacy/terms review and an account-deletion procedure.
5. Pilot with creators/researchers and measure time saved, useful recommendations,
   saved-project reuse and monitor engagement. Test paid conversion before expanding.
6. Add opt-in digests, push notifications, automatic catalog-change detection and
   broader use cases only as validated demand supports their ongoing cost.

The code has not been pushed or deployed. DEPLOYMENT.md documents the concrete
remaining service setup. Automated tests are local and use synthetic identity and
payment providers; no live revenue or customer activity has been measured.
