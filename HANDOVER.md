# AI Pulse — handover

Everything a new developer or agent needs to continue this project. Written to
be read **before** touching code, alongside `PLAN.md` (architecture decisions) and
`BUILD-RECORD.md` (what was built, in detail).

Current state: `main` at `07a0d49`. Phases 0–5 shipped and deployed. The
pipeline runs green every 15 minutes. The app is deployed but its
configuration is mid-migration — see §9.

> **This repository is public.** No credential value may ever appear in any
> tracked file, including `.env.example`. This has already gone wrong once
> (§10). Secrets live only in GitHub Actions secrets and Vercel environment
> variables.

---

## 1. Purpose

The owner follows AI news worldwide — model capabilities and comparisons,
executive moves, launches, funding, new startups — and was tired of manually
searching across articles, YouTube and Google, always arriving late. The goal
is one tool that pulls updates continuously, surfaces what actually matters
first, and lets them search everything down to minor details.

Constraints that shaped every decision:

- Must work from any device, any network, with the laptop closed.
- No tunnels, no local servers, no `npm run` needed to *use* it.
- Free hosting. **Zero recurring cost is a hard target, not an aspiration.**
- Originally single-user; now a small shared team on one password.

## 2. The core design decision

**The atom of this product is a Story, not an article.**

When a lab ships a model, 40 outlets write about it. That is ONE story with 40
sources — not 40 feed items. You read one line, not forty headlines.

Stories chain into **Threads** (e.g. "Anthropic model releases"), so every new
story shows what came before it. That is how "what's the history behind this
new thing" gets answered without searching.

Everything else follows from this: clustering exists to collapse coverage into
stories, importance exists to rank stories, enrichment exists to give a story
one readable line, and threads exist to give a story its history.

## 3. Surfaces

| Route | What it is |
|---|---|
| `/` | **Pulse** — top 12 stories ranked by importance, *never* by time. One line each, colour-tagged by category. Whole catch-up in 60 seconds. |
| `/story/[id]` | One event: what happened, all sources collapsed, entity chips, scoped agent, thread timeline below. |
| `/entity/[slug]` | Auto-built for every company/person/model detected. Tap "Mistral" → everything, chronological. Replaces Googling a name. |
| `/models` | **Model Board** — frontier models side by side. **Currently always empty, see §11.1.** |
| `/catchup` | After time away: "here are the things that mattered", not 400 unread items. Per-viewer. |
| `/ask` | Archive agent + matching stories, with clickable `[n]` citations. |
| `/login` | Shared-password gate. |

## 4. Stack

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js 16 App Router, TypeScript, React 19, on **Vercel Hobby** | non-commercial use only |
| DB | **Neon** Postgres 18 + `pgvector` | auto-suspends when idle |
| Worker | **GitHub Actions** cron `*/15 * * * *` | public repo = unlimited minutes |
| Embeddings | `@xenova/transformers` → `all-MiniLM-L6-v2`, 384-dim | CPU-local, no key, no quota |
| LLM | **Gemini** `gemini-3.5-flash-lite` primary, **Groq** `llama-3.3-70b-versatile` fallback | both free tier |
| Format | PWA (manifest; **no service worker yet**) | installs to home screen |

Runtime dependencies are deliberately few: `@neondatabase/serverless`,
`@xenova/transformers`, `rss-parser`, `dotenv`, `next`, `react`, `react-dom`.
Adding one needs a reason.

**Why free stays free:** embeddings run locally, so clustering and semantic
work cost nothing regardless of volume. Only stories above the importance
threshold ever trigger an LLM call — roughly 10–15 a day, not 400.

## 5. The pipeline — six resumable stages

Run by `.github/workflows/ingest.yml`. Every stage after the first uses
`if: always()`, so one broken feed cannot block the rest.

| # | Stage | File | Finds work by | Marks done by |
|---|---|---|---|---|
| 1 | fetch | `src/ingest.ts` | active sources, least-recently-succeeded first | `sources.last_ok_at` |
| 2 | embed | `src/embed.ts` | `embedding is null` | writes `articles.embedding` |
| 3 | cluster | `src/cluster.ts` | `clustered_at is null` | `articles.clustered_at` |
| 4 | score | `src/score.ts` | `last_seen_at` inside 72h | `stories.scored_at` |
| 5 | enrich | `src/enrich.ts` | `enriched_at is null and importance >= 0.5` | `stories.enriched_at` |
| 6 | tidy | `src/tidy.ts` | all entities; stories touched in 7d | idempotent, no marker |

**The resumability contract — do not break this.** Each stage finds its work
with a SQL predicate and records completion by writing a column. A crash costs
only the current batch; the next cycle picks up a bigger one. Any new stage
must follow the same shape.

Two specific traps already paid for:

- Stage 3 marks work with `clustered_at`, **not** `story_id`. Using `story_id
  is null` would retry the ~2,200-article backfilled archive every cycle
  forever, and each old post would become a singleton story that looks brand
  new and qualifies for an LLM call.
- Stage 4 recomputes importance every cycle while a story is inside the 72h
  window, then **freezes** it. Without the freeze, the Pulse reshuffles its
  whole history every 15 minutes and read-state stops meaning anything.

**Batch your writes.** The Neon HTTP driver costs a full round trip per
statement. Per-row updates made the first ingest take >10 minutes against a
12-minute timeout; batching into single `unnest()` statements took it to ~30s.
Stage 3's per-row skip updates cost 2,640 round trips and 17 minutes before
being batched. Expect this trap in any new stage.

## 6. The two formulas

### Clustering threshold — 0.75, measured not guessed
```
cosine_similarity >= 0.75  →  attach to existing story
otherwise                  →  create new story
```
`PLAN.md` originally said 0.82. **That was wrong** — it sits above every true
positive. On real coverage, genuine same-event pairs land at 0.767–0.802
(Sony/Warner sue Anthropic 0.802, Nvidia buys Hugging Face 0.791, the
OpenAI/Hugging Face incident 0.774). At 0.82 nothing merges at all, which is
the runaway that burns the LLM quota in stage 5.

Comparison is against each story's stored **centroid** inside a ±72h window —
one indexed nearest-neighbour query, not a scan over member articles. The
centroid updates incrementally and is renormalised to unit length.

**Research feeds are excluded from clustering** via `sources.clusterable`.
Unrelated arXiv papers sat at 0.762 while genuinely identical news sat at
0.767 — no single threshold separates them while research shares the pool.
Papers stay embedded and searchable; when one matters, the press coverage of
it clusters on its own.

Every comparison between 0.65 and 0.90 is logged to `cluster_debug` with both
titles. **Re-read that table against real news before moving the threshold.**

### Importance
```
score = 0.35 × max(source_weight in cluster)
      + 0.30 × min(log(1 + article_count) / log(20), 1)
      + 0.20 × entity_match        (1.0 followed, 0.5 known, 0 unknown)
      + 0.15 × exp(-hours_old / 24)
```
Coverage velocity carries the most weight deliberately: when 15 outlets write
the same thing within two hours, that *is* the importance signal. The log caps
it so a 60-outlet story doesn't own the Pulse for a week. Age comes from
`first_seen_at` (the event), not the newest follow-up — a story still
attracting coverage is already rewarded by the velocity term.

`entity_match` currently reads a hand-written seed list in `src/entities.ts`
(22 FOLLOWED @ 1.0, 38 KNOWN @ 0.5) rather than the real `story_entities`
table, because entities arrive a phase later than ranking. **Swapping the
lookup inside `entityMatch()` is the only change needed; the formula does not
move.** Word boundaries in that matcher are load-bearing — without them
"meta" fires inside "metadata" and "aws" inside "laws".

## 7. Schema

13 tables across 6 migrations in `db/`. All migrations are **idempotent**
(`if not exists`, guarded `alter`, `do $$` blocks), so `npm run migrate` is a
no-op when current. That is cheaper to maintain than a migrations table for a
project this size — keep new migrations idempotent too.

| Migration | Adds |
|---|---|
| `001_phase0.sql` | `sources`, `articles` |
| `002_phase1.sql` | `stories`, `story_articles`, `cluster_debug`, `articles.clustered_at` |
| `003_clusterable.sql` | `sources.clusterable`, false for arXiv |
| `004_phase3.sql` | `llm_calls`, `entities`, `story_entities`, `threads` |
| `005_phase5.sql` | `articles.search_full`, `stories.search_tsv`, `read_state`, `models`, `saved_questions`, `saved_question_hits`, `push_subscriptions` |
| `006_multi_viewer.sql` | `read_state.viewer_id`, PK → `(viewer_id, story_id)` |

Load-bearing details:

- **`articles.url` is UNIQUE** — the dedupe backstop when feeds republish.
- **`published_at` and `fetched_at` are stored separately.** Feeds lie about
  dates constantly; you will need the real one to debug.
- `stories.max_source_weight` is denormalised so ranking never joins back to
  `sources`.
- `stories.centroid` is the running mean of member embeddings — this is what
  makes clustering one indexed lookup.
- `entities.aliases[]` is what stops "QWEN", "Qwen 3.8 27B" and
  "Qwen3.8-27B-FP8" becoming three entity pages for one thing.
- `threads` is keyed `unique (entity_id, category)` — a stable narrative key,
  so no clustering-of-clusters is needed. The timeline is just the stories
  sharing a `thread_id`, ordered by `first_seen_at`.
- `llm_calls` is the quota fuse: one row per provider per UTC day.

## 8. Code rules — treat these as non-negotiable

### 8.1 The LLM wrapper rule
**All model calls go through `src/llm.ts`, which exposes exactly one function:**
```ts
generate(prompt: string, opts?: { json?: boolean; maxTokens?: number; uncapped?: boolean }): Promise<string>
```
Provider selection, retry and fallback live in that file **and nowhere else**.
Do not import a provider SDK anywhere else in the codebase. Free tiers change
terms and rate-limit without warning; swapping providers must stay a one-file
edit.

Inside it: Gemini primary → Groq fallback, one retry per provider on
429/500/502/503/504 only (a 400 fails identically however many times you ask).
`temperature: 0`. The Gemini key travels as an `x-goog-api-key` **header**,
never a query parameter, so it cannot land in a proxy log or error trace.

### 8.2 The quota fuse
`LLM_DAILY_CAP` (currently 200) is counted in `llm_calls` and throws
`QuotaExhausted`. It guards one specific failure: a clustering regression that
stops merging would produce hundreds of singleton stories, each looking novel
and important, and would drain the day's free tier overnight. **Note:** the
slot is reserved *before* the API call, so failed calls still count. Keep it
that way — the fuse must bound attempts, not successes.

### 8.3 The worker writes, the app reads
The worker computes every derived value. **Nothing in a request path decides
whether a story needs re-clustering.** That keeps page loads fast and removes
a whole class of concurrency bug. Do not add write-on-read logic.

### 8.4 Builds must not need a database
`lib/db.ts` creates its client lazily on first query, never at module scope,
and every page is `dynamic = "force-dynamic"`. A module-scope throw runs while
Next collects page data during the build, which made a missing `DATABASE_URL`
fail the whole deploy rather than one request. ISR would likewise couple each
deploy to a live, awake Neon instance. **Do not reintroduce `revalidate` or
module-scope env access.**

### 8.5 The agent's three rules — enforced, not requested
1. **Answer from the index, not the live web.** Retrieval is sub-second;
   browsing takes 20s+ and defeats the purpose.
2. **Every claim carries a citation.** Passages go in numbered, the model
   emits `[n]`, and `enforceCitations()` then drops uncited sentences and
   **withholds the whole answer** if fewer than half carry a valid in-range
   marker. A confidently stated wrong benchmark is worse than no answer.
3. **"Not in the archive" is a valid answer.** `NOT_IN_ARCHIVE` is modelled
   explicitly so refusal is a normal outcome with its own copy.

### 8.6 Dates
The Neon driver returns `timestamptz` as a JavaScript `Date`, not a string, so
`.slice()` on one throws at render time — this blanked two pages once. Every
date reaching a component goes through `lib/format.ts`, whose input type
admits both. Use it.

### 8.7 Never commit a credential
`.env` is gitignored; **`.env.example` is not** — it is the one env file git
tracks. It holds placeholders and empty strings only. See §10.

## 9. Retrieval and the agent

`lib/search.ts` fuses two Postgres full-text rankers with **Reciprocal Rank
Fusion** (k=60):
1. story-level `stories.search_tsv` — matches the event as a whole
2. article bodies `articles.search_full` — matches a detail in only one source

RRF merges by **rank position**, not score, because `ts_rank_cd` values from
two different columns are not on a comparable scale and calibrating them needs
labelled data that does not exist here. Queries use `websearch_to_tsquery`,
which never throws on odd punctuation — unlike `to_tsquery` — which matters
when the input is whatever someone typed.

**There is deliberately no vector arm.** Article embeddings come from MiniLM on
the worker's CPU; encoding a *query* would need that same 90MB model inside a
serverless function, dominating cold starts. Adding query-time semantics needs
a hosted encoder and a re-embed of the corpus to matching dimensions — that is
the real cost, and it is why this was skipped, not an oversight.

`lib/agent.ts` has two modes: **scoped** (`askStory`) reads only that story's
5–40 stored sources with no retrieval step, and **archive** (`askArchive`)
retrieves 12 passages across everything ingested.

## 10. Auth

Single shared password, no accounts, no identity provider. The gate shipped
with the first page, not later: the app sits on a guessable public URL and an
ungated `/api/ask` is a free LLM endpoint for whoever finds it. **The gate
protects the quota, not just the content.**

- `proxy.ts` (Next 16's `middleware.ts` replacement) gates everything except
  `/login`, `/api/login`, `/manifest.webmanifest`, `/icon.svg`.
- Password check → HMAC-SHA256 signed cookie with an expiry, 30 days, via
  **Web Crypto** so the same code runs in Edge middleware and in Node.
- **Both the proxy and the login route fail closed** on a missing
  `AUTH_SECRET` or `APP_PASSWORD` — a misconfigured deploy locks the app
  rather than opening it. Keep that direction.
- Password and signature comparisons are constant-time.
- `pulse_viewer` is a second cookie: an anonymous UUID, not an account. It
  only separates read-state so Catch-up means something when several people
  share one password. It survives sign-out.

## 11. Operational state — as of 2026-10-10

### Deployment
- **App:** https://ai-updates-git-main-satish-999.vercel.app (Vercel Hobby)
- **Worker:** GitHub Actions `ingest.yml`, every 15 min, currently green at
  ~1m25s per run
- **DB:** Neon Postgres 18, pooled connection

### Data
```
articles   24,442 total · 0 awaiting embedding
stories    2,960 total · 126 with more than one source
entities   23 · threads 15
pending    15 stories above importance 0.5 awaiting enrichment
feeds      23 active, 3-4 failing at any time (expected, see §13)
```

### Configuration — where each value lives
Values are **not** in this repo. Variable names only:

| Variable | GitHub Actions secrets | Vercel env vars | Status |
|---|---|---|---|
| `DATABASE_URL` | required | required | working in CI; Vercel copy unverified |
| `GEMINI_API_KEY` | required | required | key validated against the API; needs pasting into both |
| `GROQ_API_KEY` | optional | optional | unset; either provider alone suffices |
| `APP_PASSWORD` | not used | required | set; value known only to the owner |
| `AUTH_SECRET` | not used | required | confirmed live (login page renders without the unconfigured error) |

**Gotcha that cost an hour:** a secret added under GitHub *Environments →
Production* is invisible to this workflow, because `ingest.yml` has no
`environment:` key. It must be a **repository** secret. The symptom is
`no LLM provider configured` with the variable looking correctly set.

Vercel never applies new environment variables to an already-built deployment
— a **Redeploy** is mandatory after changing one.

## 12. The security incident — context for anyone reading the history

Commit `149e980` committed live values for `DATABASE_URL`, `APP_PASSWORD`,
`AUTH_SECRET` and `GEMINI_API_KEY` into `.env.example` on this **public**
repository. `89375fb` restored placeholders, but that does not undo it: the
values remain readable in `149e980` forever, and orphaned blobs stay
fetchable by SHA even after a force-push unless GitHub Support purges them.

Rotation at the provider is the only real fix, and was the course taken. If
you are auditing: assume all four values from that commit are compromised and
confirm each has been rotated. Do not attempt to "clean" the history as a
substitute for rotation.

## 13. What is NOT built — the work queue

Phases 0–5 are genuinely shipped, but four things have a table or a page with
no code behind them. These are the obvious next tasks, roughly in order of
value.

### 13.1 Model Board is never populated — highest value, smallest scope
`db/005_phase5.sql` creates `models` and `/models` renders it, but **no code
anywhere writes to that table**. `src/enrich.ts` has no model-board step. The
page's own empty state promises "rows are added automatically when a launch
story is enriched", which is not true, so it stays empty forever.

Implementation sketch: when enrichment returns `category === "model_release"`,
make a second extraction (name, vendor, released_at, context window,
benchmarks as `jsonb`, notes) and upsert into `models` with `story_id` set.
Watch the quota — that is a second LLM call per launch story, so gate it on
the category and reuse the already-fetched article text. `benchmarks` is
`jsonb` on purpose: every lab reports a different set and a fixed schema would
be wrong within a month. Run entity canonicalisation on the model name
(`src/canonical.ts` already collapses size/quantisation variants) or the board
will fill with "Qwen3.8-27B-FP8"-style duplicates.

### 13.2 Saved questions — the feature that changes the product
`saved_questions` and `saved_question_hits` exist; **nothing references them
in any `.ts` file**. The intent from `PLAN.md`: a saved query re-runs on every
ingest cycle and pushes on a hit, turning the agent from something you visit
into something that watches.

Implementation sketch: a stage 7 that, for each active row, runs
`searchStories()` restricted to stories created since `last_run_at`, records
new matches in `saved_question_hits`, and updates `last_run_at`/`hits`. Keep
it retrieval-only at first — no LLM call per question per cycle, or the quota
is gone. Only notify on a genuinely new `story_id`.

### 13.3 Push notifications and the service worker
`push_subscriptions` exists; there is no VAPID code, no `/api/push`, and
`public/` contains only `icon.svg` and `manifest.webmanifest`. So the PWA
*installs* to a home screen, but there is no offline shell and no Web Push.
`PLAN.md`'s "manifest + service worker" is half done. iOS only delivers push
to an installed PWA, so the install flow matters. Pairs naturally with 13.2 —
saved questions are what there is to push *about*.

### 13.4 No tests, no lint, no typecheck in CI
Commits cite "9/9 entity tests passing" and "unit-tested centroid math", but
there are **no `*.test.ts` files and no `test` script** in `package.json` —
those were run ad hoc and never committed. CI has no lint or typecheck step
either.

Highest-value tests, given what has actually broken: `updateCentroid`
dimension/normalisation math (`src/vec.ts`), `entityMatch` word boundaries
(`src/entities.ts`), `canonicalise` and `stripVariantSuffix`
(`src/canonical.ts`), `enforceCitations` thresholds (`lib/agent.ts`), and the
`lib/format.ts` Date-vs-string handling. Adding `tsc --noEmit` to the workflow
is a two-line change and would have caught real bugs.

### 13.5 Smaller items
- **Anthropic has no RSS feed.** Every conventional path 404s, so the source
  was removed and their launches arrive only via press coverage, without the
  1.0 primary-source weight. Fixing it properly needs a new scraped source
  kind — a real feature, not a URL change.
- **`entityMatch` still uses the seed list** rather than `story_entities`
  (§6). Now that entities exist, this is a small, contained improvement.
- **README's "Phase 0 status" section is stale** — it still lists "A plain
  reverse-chronological list page — not built", superseded by the build order
  in `PLAN.md`.

## 14. Known quirks — normal, do not re-debug

- **arXiv feeds are empty at weekends.** arXiv only announces new submissions
  Monday to Friday. An empty feed there is correct.
- **Three sources fail from CI but work locally.** GitHub runners use
  datacenter IPs, which more services block: Import AI 403s (Substack),
  hnrss.org times out, r/MachineLearning 429s. All are low-weight or
  duplicated by other sources, so this is tolerated rather than fixed.
- **Reddit 429s.** Its public `.rss` is aggressively rate limited, so usually
  only one of the two subreddits succeeds per run. Sources are fetched
  least-recently-succeeded first, so the two alternate rather than one
  starving. This is the design working, not a bug.
- **Feeds occasionally serve gzip without declaring it**, which surfaces as
  `Non-whitespace before first tag … Char: \u001f` (0x1F is the gzip magic
  byte). Transient; the same feed works on the next cycle.
- **`npm run ingest` used to hang.** It finished its fetches in ~43s then sat
  open until the workflow's 12-minute timeout killed it, so every run was
  marked cancelled and queued behind the previous one. Cause: rss-parser
  leaves keep-alive sockets behind (the 429 retries being the usual culprit)
  and those keep the event loop alive. Fixed in `07a0d49` by exiting
  explicitly after `main()` resolves, draining stdout first so the run summary
  is not truncated. **If you add another network-fetching stage, expect the
  same and handle it the same way.**

Feeds move constantly — this is maintenance, not failure. `npm run status`
shows the error and `npm run probe` tests replacements.

## 15. Out of scope for v1 — decided, not forgotten

Instagram (hardest access, lowest signal, nothing unique). Comments. Social
features. Any custom-trained ML. Native apps.

## 16. Commands and verification

```bash
npm run migrate   # apply db/*.sql in order (idempotent)
npm run ingest    # stage 1 — fetch feeds, upsert articles
npm run embed     # stage 2 — MiniLM, 384-dim vectors
npm run cluster   # stage 3 — articles → stories
npm run score     # stage 4 — importance formula
npm run enrich    # stage 5 — one LLM call per qualifying story
npm run tidy      # stage 6 — canonicalise entities, refresh search text
npm run status    # what's in the DB, what's backlogged, which feeds fail
npm run probe     # test feed URLs before editing src/sources.ts
npm run dev / build / start
```

`npm run status` reports **the same predicates the stages use to find their
work**, so it is the fastest way to see where a run stopped. `npm run probe`
with no arguments re-tests every feed in `sources.ts`; pass URLs to test
candidates.

Local setup: `npm install`, then copy `.env.example` to `.env` and fill it in.
`.env` is gitignored and must stay that way.

**Before pushing anything:** run `npx tsc --noEmit`. There is no CI typecheck
yet (§13.4), so this is the only gate.

## 17. Reading order for a new contributor

1. `PLAN.md` — the problem, the decisions, and why the numbers are what they are
2. This file — current state and the work queue
3. `BUILD-RECORD.md` — the detailed account of what each phase actually did
4. `src/llm.ts` — the one place that talks to a model, and the rule around it
5. `src/cluster.ts` and `src/score.ts` — the two formulas in code
6. `lib/agent.ts` — the citation enforcement, which is the product's integrity

Then `npm run status` against a real database to see the shape of the data.
