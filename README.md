# AI Pulse

AI Updates, AI News and a source-backed creative AI advisor, with individual
accounts and subscription infrastructure. Headlines open original publisher
articles; story pages group related coverage. The atom is a story, not an article.

## Product

- Updates: model/product releases, full-text search, latest/importance sorting.
- News: research, business, funding, policy and other coverage.
- Advisor: anime, video, voice, music, graphics and social workflows, filtered by
  budget, device, experience and commercial-use requirements. Eight reviewed
  catalog entries include official sources and plan limits. No media generation.
- Workspace: account-saved projects, downloads, monitors, reading history, cited
  archive answers, model observations and visible source coverage.
- Accounts: email/password registration, confirmation, recovery, password change,
  logout and optional Google OAuth through Supabase.
- Subscriptions: Free/Pro limits, Razorpay hosted checkout, signed webhooks,
  reconciliation, cancellation and expired-period resubscription.

## Setup

See DEPLOYMENT.md for the complete Supabase, Neon, Razorpay, SMTP, migration and
hosting setup. Copy .env.example to an ignored .env for local development. Never
commit credentials. The app uses Supabase's publishable key; no service-role key.

    npm ci
    npm run migrate
    npm run dev

Set APP_URL to your exact origin. AUTH_MODE defaults to Supabase. Preview mode is
explicit and restricted to loopback; it is not customer identity.
BILLING_ENABLED defaults to false. A plan price is read from Razorpay, never from
a hard-coded amount. No live subscription has been created by local development.

## Verification

    npm run typecheck
    npm test
    npm run build
    npm run test:integration
    npm run test:embedding
    npm run config:check

Builds require no database or provider credentials. The Next build uses webpack,
worker threads and the in-process TypeScript checker to work around Windows child
process restrictions; typechecking is not skipped.

The integration test uses the production Next server, real server actions, a local
PostgreSQL engine and synthetic auth/payment transports. It tests two-account
isolation, sign-in, checkout, webhook validation/replay, Pro upgrade, cancellation,
expiry and resubscription without external side effects.
The embedding smoke downloads the original public quantized MiniLM model and
checks dimensions/normalization and native dependency compatibility.
On restricted Windows hosts the unit suite can also run with:

    node --experimental-strip-types --experimental-test-isolation=none --test tests/*.test.ts tests/*.test.mjs

## Architecture

Next.js/React app, Neon PostgreSQL/pgvector, scheduled GitHub worker, Supabase Auth,
Razorpay subscription service. Application-derived story data is written by the
worker; request reads do not trigger enrichment. Explicit user mutations write
projects, monitor settings and read state. AI generation is explicit POST, never a
page-load side effect. Account limits and provider quota reservations happen before
model calls. All model calls remain in src/llm.ts.

Worker stages: fetch → embed → cluster → score → enrich → tidy → monitors → model
observations. Each stage resumes from stored state. Billing reconciliation runs
separately. Only verified account identity determines ownership, not a viewer ID
supplied by the browser.

## Limits and facts

Free: 3 projects, 3 monitors, 5 AI requests/day.
Pro: 100 projects, 20 monitors, 50 AI requests/day.
There is also a shared provider budget. Scheduled collection is not a real-time
guarantee or exhaustive global coverage. Recommendations exclude catalog facts
older than 30 days; editorial review is still necessary. Model observations do not
claim universal rankings, verified benchmark scores or inferred release dates.
Tool subscriptions and output rights remain separate from AI Pulse.

## Dependency compatibility

protobufjs is overridden to 7.6.6 and sharp to 0.35.5 to address inherited
advisories while preserving the existing Transformers 2.17.2 and MiniLM weights.
The local ONNX protobuf round-trip, sharp native encode/decode and actual embedding
smoke passed. Keep these overrides until upstream dependency ranges catch up and
repeat the compatibility smoke when changing them. npm audit reported zero known
vulnerabilities at delivery; this is not a guarantee of security.

## Deployment state

The code and tests are implemented locally. Supabase project/SMTP, real payment
activation, production secrets, migrations, hosting and provider end-to-end staging
verification remain operator setup. Nothing has been pushed or deployed by this
delivery. See IMPLEMENTATION-NOTES.md for exact validation and limitations.
