# AI Pulse application delivery — 11 October 2026

Base: main at 4a3ca53, local branch codex/subscription-monitor-pilot.
No code has been pushed, no production migration applied, and no live charge made.

## Implemented

- Separate AI Updates and AI News feeds, search/sort/pagination, original article
  headline links and honest source freshness/coverage status.
- Source-backed creative advisor for six goals, free/paid tool filtering,
  commercial conditions, workflows, prompt starters and downloadable plans.
- Individual Supabase email accounts: registration, confirmation, password
  recovery/change, logout and optional Google OAuth. Shared-password access is
  restricted to an explicitly selected loopback preview.
- Account-owned project saves, reading history and topic monitors. Free/Pro limits
  are checked on the server. Older browser saves are not silently claimed.
- Razorpay monthly INR subscription integration: actual configured price, hosted
  checkout, exact-body webhook signature verification, current-provider-state
  reconciliation, duplicate/stale event protection, cancellation and resubscription.
  Ambiguous creation is not auto-retried; a recovery command verifies stored intent.
- Per-account AI attempt limits alongside the existing service-wide quota fuse.
  Archive AI answers now require an explicit POST rather than a page load.
- A worker fills the model tracker from sourced model mentions in enriched release
  stories. It does not invent release dates or benchmark results.
- Deployment guide, presence-only configuration checker and synthetic end-to-end
  integration harness.

## Validation

- Production webpack build and TypeScript passed without database/provider secrets.
- 26 unit/SQL test entries passed, including actual SQL against embedded PostgreSQL.
- Production-server integration passed for signup/recovery/login server actions,
  two-account isolation, Free project limits, checkout retries, no access from a
  checkout redirect alone, webhook signature/replay, Pro upgrade, cancellation,
  expiry, resubscription and logout. Providers were synthetic; no email/charge sent.
- Actual original quantized MiniLM embedding smoke passed: 384 dimensions, unit
  vectors, identical-text similarity and unrelated-text separation.
- Native sharp image encode/decode and ONNX protobuf round-trip passed.
- Dependency overrides sharp 0.35.5 and protobufjs 7.6.6 removed the five inherited
  audit findings; npm audit reported zero known vulnerabilities.
- Browser automation was unavailable in this workspace (kernel asset creation
  failed). Visual/mobile/accessibility verification remains open.
- Real Supabase email/OAuth, Razorpay test/live services, Neon production queries,
  hosted app and GitHub workflows have not been exercised with your credentials.

## What is still required to launch

Follow DEPLOYMENT.md to create/configure Supabase Auth and SMTP, connect Neon and
apply migrations, configure GitHub repository secrets and activate/test Razorpay.
Set the public app origin and commercial hosting. Publish business/support/refund
details and complete legal/privacy review before enabling live payments.

This is implemented application code with tested integrations, not an already
operating subscription business. Customer accounts and payments cannot become live
without service configuration. Catalog facts need continuing editorial review.
The advisor recommends creative tools; media creation runs in those tools.
Push/email news alerts, universal model rankings and an automated model-price
crawler are not implemented and are not advertised as available.
Account deletion currently follows a support-led operator process.

## Artifacts

The source archive excludes Git history, local credentials, dependencies, downloaded
models and build output. The patch targets 4a3ca53. See README.md for commands.
