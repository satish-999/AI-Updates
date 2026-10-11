# AI Pulse: connect and launch

The code uses Next.js, Neon for application data, Supabase Auth for customer
identity, Razorpay for Indian subscriptions, and GitHub Actions for collection.
The source is implemented locally. No production database or cloud service has
been configured by this delivery. Never paste secret values into chat or commit them.

## 1. Database and app

Use the existing Neon database after taking a backup, or a staging database first.
Set DATABASE_URL in the hosting provider's environment settings. Apply all numbered
migrations with npm run migrate, including 007, 008 and 009. Migrations are repeatable.
008 adds private projects, usage and billing tables. 009 adds model observation provenance.
Application DB access must remain server-side. No browser database credentials.

Set APP_URL to the exact public HTTPS origin. For local development, use
http://localhost:3000. AUTH_MODE defaults to Supabase; never deploy AUTH_MODE=preview.
The old APP_PASSWORD and AUTH_SECRET are needed only by an explicitly local preview.

## 2. New Supabase project

Create a Supabase project and copy its Project URL and publishable key into
SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the app environment. A service-role
key is NOT required. Supabase is used for identity; Neon remains the data store.

In Authentication:
- Enable Email and password sign-up, require email confirmation, set the minimum
  password length to at least 12, and configure rate limits/abuse protection.
- Set Site URL to APP_URL and allow exactly APP_URL/auth/callback and
  APP_URL/auth/callback?next=reset as redirects (include local equivalents only for development).
- Configure custom SMTP for real customer email delivery. Default development
  email delivery is not a production mailing service.
- Set the confirmation email link to:
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
- Set the password recovery email link to:
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
- Keep these templates consistent with this app. Confirmation uses a button POST
  so email scanners do not consume the token merely by opening its link.
- Optional Google sign-in: enable Google in Supabase and configure its OAuth
  client/secret there; use Supabase's displayed callback URI in Google Cloud.
  Then set GOOGLE_AUTH_ENABLED=true in the app. The app uses PKCE code exchange.

Verify with two real staging accounts: registration, inbox verification, sign-in,
sign-out, password recovery, password change, cross-device project isolation and
Google sign-in if enabled. The local automated suite uses synthetic providers;
it does not verify your provider settings or deliver real mail.

## 3. Razorpay subscriptions (India)

Create/activate your business account and enable subscriptions with Razorpay.
Start in TEST MODE. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET only on the server.
Create a monthly INR plan with quantity one and set RAZORPAY_PLAN_ID. The app reads
the price from that plan; there is no invented hard-coded selling price.

Create a webhook for APP_URL/api/billing/webhook with a distinct
RAZORPAY_WEBHOOK_SECRET. Subscribe to subscription lifecycle events, especially
subscription.activated, subscription.charged, subscription.pending,
subscription.halted, subscription.cancelled and subscription.completed.
The app checks the exact raw-body HMAC and fetches the current subscription from
Razorpay. An unsigned redirect or authenticated-only mandate never grants Pro.
A paid cycle and a valid period end are required. Processing is idempotent and
older concurrent responses cannot overwrite a newer subscription snapshot.

Complete BUSINESS_NAME, SUPPORT_EMAIL and REFUND_POLICY; review privacy/terms
and commercial hosting eligibility. Only then set BILLING_ENABLED=true for test
checkout. This flag is deliberately disabled by default. The app uses a hosted
Razorpay link, displays monthly renewal, and configures at most 120 monthly cycles.
Tool-provider fees are not included in AI Pulse's subscription.

Test: first payment, denied/abandoned checkout, duplicate and out-of-order webhook,
failed renewal, cancellation, expired access and starting a new subscription after
the old period ends. Monitor webhook failures in Razorpay. No live charge was made
by this implementation. Switch to live keys/plan/webhook only after testing and
business activation; test and live identifiers are not interchangeable.

An ambiguous create response is never automatically retried: this avoids double
subscriptions. Inspect the provider dashboard for the matching intent/owner notes;
run npm run billing:recover -- sub_PROVIDER_ID to reconcile that known subscription.
Do not delete a pending database row until the provider confirms no subscription
exists. Historical subscriptions are archived when a terminal period is replaced.

## 4. Scheduled jobs and live news

GitHub repository Actions secrets (not GitHub Environment-only secrets):
DATABASE_URL, GEMINI_API_KEY and/or GROQ_API_KEY. The existing workflow collects,
embeds, clusters, scores, enriches, tidies, checks monitors and materializes model
observations. Collection runs every 15 minutes, subject to GitHub scheduling delays.
Model observation rows are source-linked mentions, not benchmark rankings or
verified release dates. Check /coverage and actual workflow runs after rollout.

Billing reconciliation runs hourly. It needs DATABASE_URL, RAZORPAY_KEY_ID and
RAZORPAY_KEY_SECRET in repository Actions secrets too. Webhooks remain the primary
payment signal. Reconciliation repairs missed updates and cleans old usage/event
rows. Paid access automatically expires when paid_until passes even if a job is down.

Recommendation plans in lib/catalog.ts are editorially reviewed. Verify official
pricing/rights sources before changing reviewed dates. Facts older than 30 days
are excluded. Do not extend dates merely to make empty recommendations disappear.

## 5. Checks and release

npm ci
npm run typecheck
npm test
npm run build
npm run test:integration
npm run config:check

Builds require no database or provider credentials. The integration harness starts
a loopback production server with synthetic Supabase/Razorpay and embedded
PostgreSQL; it sends no real email, payment or model requests. It is not a substitute
for staging provider integration and browser/accessibility QA.

Preview archives are not deployed automatically. Push reviewed code, run GitHub CI,
apply staging migrations and deploy through the existing hosting project. Configure
a commercial-eligible hosting plan before accepting payment.

## Limits and ownership

Free: 3 account projects, 3 monitors, 5 AI requests/day.
Pro: 100 projects, 20 monitors, 50 AI requests/day.
AI calls also use the global pre-call quota fuse. Limits are maximum attempts, not
a promise of provider capacity. Search and editorial recommendations do not need
a model request. Usage resets at midnight UTC. Downgrading preserves existing
projects; monitor slots above the Free allowance stop being checked until upgraded.
Read history and monitors use the verified account ID, never a client-supplied ID.
Old browser-cookie data is not silently claimed by a customer account.

Support-led account deletion is the current process. Before launch, establish the
operator procedure for deleting Supabase identity and Neon projects, monitor/read
data and usage while retaining billing records only as legally required.

## Provider references

- Supabase server-side clients: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase password flows: https://supabase.com/docs/guides/auth/passwords
- Razorpay subscription creation: https://razorpay.com/docs/api/payments/subscriptions/create-subscription/
- Razorpay webhook validation: https://razorpay.com/docs/webhooks/validate-test/
