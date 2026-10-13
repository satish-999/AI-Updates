# AI Pulse — product foundation

Based on upstream `4a3ca53a5167a8428d4ad0381b0c133073a0916b`. Prepared as a separate GitHub change; production deployment is not yet verified.

## What works in this implementation

- `/updates`: new model, product and research stories; `/news`: funding, people, policy, business and unclassified stories. Both use the existing Story grouping, deterministic source selection, search, filters and pagination.
- The default route redirects to Updates. `/pulse` preserves the original importance-ranked view. Existing archive, model board, catch-up and story routes remain available.
- Headlines in the two new feeds open the selected publisher. The source with the highest configured weight is preferred, with publication time and article ID breaking ties. This is a representative source, not a claim to have identified the first original announcement. Summary & sources opens the grouped story.
- Feed checks show most recent successful collection, delayed sources, sources with errors and pending enrichment. A successful feed check is not proof of complete worldwide coverage. Unclassified stories remain in News until enrichment categorizes them.
- `/advisor`: deterministic matching against six reviewed application plans from three vendors. Category, monthly USD budget, browser/phone, commercial-use evidence and recurring-free requirements filter results. Results are price-ordered, not benchmark rankings. No model requests or quota usage are added.
- Brief text is incorporated into a workflow template and starter prompt. The first version does not interpret arbitrary project requirements semantically. It covers anime, video, graphics and voice/audio only. It does not generate the media.
- Catalog claims include a source and review date. Evidence expires after 30 days. Unknown commercial rights exclude a plan from commercial matches. One-time credits are distinct from recurring free allowances. Prices exclude tax, promotions and extra usage.
- Enrichment now saves entities and threads before setting `enriched_at`; failure leaves the story eligible for retry. This does not repair historical partial records or make multi-statement writes atomic.
- Responsive dashboard styles retain existing light/dark preference support. No runtime dependencies added. Auth still fails closed and all new database access is read-only and lazy.

## Catalog maintenance

`data/catalog.json` is a manually reviewed catalog. Edit records only after checking the linked official source; update `verifiedAt` only after a real review. The runtime never updates this timestamp. Do not mark unknown rights as allowed. A later worker can import versioned evidence into Postgres, but automated price/terms verification is not implemented here.

The catalog currently describes applications and plans rather than asserting an unsupported universal model winner. Anime workflows require sample testing for style and character consistency. Tools cover portions of the proposed workflow, and unlisted editing steps can add costs. A subscription to AI Pulse does not include third-party tool subscriptions.

## Verification

- 13 offline unit tests passed using `node tests/product.test.mjs`: URL safety, tab filters, bounded input, pagination encoding, budget boundaries, commercial licensing, recurring-free semantics, catalog evidence expiry, unknown tasks/devices and Date handling.
- `git diff --check` passed.
- Dependency download was blocked by the execution sandbox's connection to its network proxy (`EPERM`). `npm run typecheck` and `npm run build` could not run because `tsc` and `next` are unavailable. No database integration or browser rendering checks were possible.
- `.github/workflows/check.yml` adds install, tests, typecheck and a build with no application secrets on pull requests and main pushes. These CI checks have not run remotely.

Before deployment, run `npm ci`, `npm test`, `npm run typecheck` and `npm run build` with no application environment variables. Then test authenticated routes against the existing migrated database, including category boundaries, empty search, publisher links, pagination, stale feeds, an advisor brief and mobile layout.

No database migration is required for this increment. The existing migrations through 006 must already be applied. No credentials are included.

## Remaining before subscriptions

Customer identity and isolated saved projects; billing and subscription entitlements; per-user usage limits; commercially suitable hosting; automated catalog maintenance; expanded tools/models; email/push delivery; subscription value validation with actual users. The Model Board still has no automatic writer, and the saved-monitor pilot from the earlier conversation was not present in the upstream source.
