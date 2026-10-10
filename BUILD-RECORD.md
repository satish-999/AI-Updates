# AI Pulse — complete build record

Everything built for the AI Updates application, as of commit `76aa171`
(2026-08-31). Compiled by reading all 3,960 lines of source, all six
migrations, the CI workflow and the full commit history.

**What it is:** a personal AI-news aggregator. Feeds in, ranked *stories* out.
The product atom is a **Story**, not an article — when 40 outlets write about
one model launch, that is one story with 40 sources, so you read one line
instead of forty headlines. Stories chain into **Threads**, so every new story
shows what came before it.

**Where it runs:** `ai-updates-git-main-satish-999.vercel.app` · GitHub repo
`satish-999/AI-Updates` (public, intentionally) · worker on GitHub Actions
every 15 minutes · Postgres on Neon.

---

## 1. Stack — every layer on a free tier

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router, TS, React 19) on Vercel Hobby | one codebase for phone + laptop |
| DB | Neon Postgres + `pgvector` | auto-suspends when idle |
| Worker | GitHub Actions cron `*/15 * * * *` | public repo = unlimited minutes |
| Embeddings | `@xenova/transformers` → `all-MiniLM-L6-v2`, 384 dims | CPU-local, no key, no quota |
| LLM | Gemini `gemini-3.5-flash-lite` primary, Groq `llama-3.3-70b-versatile` fallback | both free tier |
| Format | PWA (manifest + installable) | home-screen icon, no app store |

Runtime deps are deliberately tiny: `@neondatabase/serverless`,
`@xenova/transformers`, `rss-parser`, `dotenv`, `next`, `react`, `react-dom`.

**Zero recurring cost is a design constraint, not an accident.** Embeddings run
locally so clustering and search stay free at any volume; only stories above
the importance threshold ever cost an LLM call (~10–15/day).

---

## 2. The pipeline — six stages, all resumable

Each stage finds its work with a SQL predicate and marks completion by writing
a column. A crash costs only the current batch; the next cycle picks up a
larger one. In CI every stage after the first runs under `if: always()`, so one
broken feed can never block embedding or clustering.

| # | Stage | File | Finds work by | Marks done by |
|---|---|---|---|---|
| 1 | fetch | `src/ingest.ts` | active sources, least-recently-succeeded first | `sources.last_ok_at` |
| 2 | embed | `src/embed.ts` | `embedding is null` | writes `articles.embedding` |
| 3 | cluster | `src/cluster.ts` | `clustered_at is null` | `articles.clustered_at` |
| 4 | score | `src/score.ts` | `last_seen_at` inside 72h | `stories.scored_at` |
| 5 | enrich | `src/enrich.ts` | `enriched_at is null and importance >= 0.5` | `stories.enriched_at` |
| 6 | tidy | `src/tidy.ts` | all entities; stories touched in 7d | idempotent, no marker |

### Stage 1 — fetch (`src/ingest.ts`, 240 lines)
23 seeded feeds upserted idempotently from `src/sources.ts`; rows whose
`feed_url` leaves that file are **deactivated**, so a corrected URL does not
leave the old broken one failing forever. Per feed: one `unnest()` batch insert
rather than one statement per item — the Neon HTTP driver costs a round trip
per call, and that one change took a full run from >10 minutes to ~30 seconds.
Also: a browser-like User-Agent (the single most common cause of "works in my
browser, 403s in code"), a 6-second gap per hostname, one retry on
429/50x/ECONNRESET, a `safeDate()` that rejects absurd feed dates, and an
`INGEST_DEADLINE_MS` after which remaining sources defer to the next cycle.
Sequential on purpose — parallel fetching of 24 feeds earns rate limits and
unreadable logs.

### Stage 2 — embed (`src/embed.ts`, 118 lines)
Batches of 64 through MiniLM, `normalize: true` so pgvector cosine distance and
a plain dot product agree and centroid averaging stays well-behaved. Asserts
384 dims. Embeds **title + first 200 words of summary only** — full bodies drag
in outlet boilerplate and push coverage of the same event *further* apart. One
`unnest()` update per batch. Model cached at `.models/` so CI does not
re-download ~90MB every 15 minutes.

### Stage 3 — cluster (`src/cluster.ts`, 211 lines)
For each unclustered article, one indexed nearest-neighbour query against
**story centroids** inside a ±72h window — not a scan over member articles.
At or above threshold it attaches and the centroid is updated incrementally
(`c' = (c·n + e)/(n+1)`, renormalised); below, it opens a new story.

Two exclusions that matter: articles older than 7 days never form stories (the
~2,200-post backfilled archive would each become a singleton story that looks
brand new and qualifies for an LLM call), and sources with `clusterable = false`
— i.e. arXiv — never cluster. Skips are collected and stamped in one batched
statement; doing it per row cost 2,640 round trips and 17 minutes on the first
run.

### Stage 4 — score (`src/score.ts`, 134 lines)
Applies the importance formula, recomputing every cycle while a story is inside
the 72h window, then **freezing** it. Without the freeze the Pulse would
reshuffle its entire history every 15 minutes and read-state would stop meaning
anything. Age comes from `first_seen_at` (the event), not the latest follow-up.

### Stage 5 — enrich (`src/enrich.ts`, 229 lines)
**One** LLM call per qualifying story returning one JSON object with
`one_liner`, `category`, `entities[]` and `thread_hint`. One call rather than
three is a quota decision: free tiers meter requests per minute at least as
tightly as tokens, so three round trips would turn 12 stories into 36 requests
for no extra information. Category is validated against a fixed list of seven
(`model_release`, `funding`, `people`, `research`, `policy`, `product`,
`business`), falling back to `product`. Entities are canonicalised before
storage; threads are upserted on the stable key `(primary entity, category)`,
so the thread timeline needs no clustering-of-clusters — it is just the stories
sharing a `thread_id`. Max 15 stories/run, min importance 0.5.

### Stage 6 — tidy (`src/tidy.ts`, 116 lines)
Merges duplicate entities onto their canonical row (moving `story_entities` and
`threads` links across, skipping moves that would collide with the unique
`(entity_id, category)`), drops entities canonicalisation now rejects, and
refreshes `stories.search_tsv`. Added to CI in `5d03a4b` so this stays current
without a manual pass.

---

## 3. The two formulas

### Clustering threshold — **0.75**, measured not guessed
```
cosine_similarity >= 0.75  →  attach to existing story
otherwise                  →  create new story
```
PLAN.md originally specified 0.82. That was **wrong**: it sits above every true
positive. On real coverage, genuine same-event pairs land at 0.767–0.802 — Sony/
Warner sue Anthropic 0.802, Nvidia buys Hugging Face 0.791, the OpenAI/Hugging
Face incident 0.774. At 0.82 nothing merges at all, which is precisely the
runaway that burns the LLM quota in stage 5.

Research feeds were then excluded entirely: unrelated arXiv papers sat at 0.762
while genuinely identical news sat at 0.767, so no single threshold separates
them while research shares the pool. Papers stay embedded and searchable; when
one matters, the press coverage of it clusters on its own.

Every comparison between 0.65 and 0.90 is logged to `cluster_debug` with both
titles, so the boundary can be re-read off real news rather than argued about.

### Importance
```
score = 0.35 × max(source_weight in cluster)
      + 0.30 × min(log(1 + article_count) / log(20), 1)
      + 0.20 × entity_match        (1.0 followed, 0.5 known, 0 unknown)
      + 0.15 × exp(-hours_old / 24)
```
Coverage velocity carries the most weight deliberately: when 15 outlets write
the same thing within two hours, that *is* the importance signal. The log caps
it so a 60-outlet story does not own the Pulse for a week.

`entity_match` currently reads a hand-written seed list in `src/entities.ts`
(22 FOLLOWED terms scoring 1.0, 38 KNOWN scoring 0.5) rather than the real
`story_entities` table, because entities arrive a phase later than ranking.
When the lookup is swapped, the formula itself does not change. Word boundaries
on the matcher are load-bearing — without them "meta" fires inside "metadata"
and "aws" inside "laws".

---

## 4. Schema — 6 migrations, 13 tables

All migrations are idempotent (`if not exists`, guarded `alter`, `do $$` blocks),
so `npm run migrate` is a no-op when current — cheaper to maintain than a
migrations table for a project this size. `src/migrate.ts` applies `db/*.sql` in
filename order, splitting on semicolons while respecting `$$`-quoted bodies.

| Migration | Adds |
|---|---|
| `001_phase0.sql` | `sources`, `articles` (+ `search_tsv`, 4 indexes) |
| `002_phase1.sql` | `stories`, `story_articles`, `cluster_debug`, `articles.clustered_at`, partial indexes matching the stage predicates |
| `003_clusterable.sql` | `sources.clusterable`, set false for arXiv |
| `004_phase3.sql` | `llm_calls`, `entities`, `story_entities`, `threads` |
| `005_phase5.sql` | `articles.search_full` (title+summary+body), `stories.search_tsv`, `read_state`, `models`, `saved_questions`, `saved_question_hits`, `push_subscriptions` |
| `006_multi_viewer.sql` | `read_state.viewer_id`, primary key swapped to `(viewer_id, story_id)` |

Key tables:

- **`sources`** — feed url, kind (`rss`/`youtube`/`reddit`), `weight` 0–1
  authority score, `active`, `clusterable`, `last_ok_at`, `last_error`.
- **`articles`** — `url` UNIQUE as the dedupe backstop; `published_at` and
  `fetched_at` stored **separately** because feeds lie about dates constantly;
  `embedding vector(384)`; two generated tsvectors.
- **`stories`** — the atom. Stores the running `centroid`, `article_count`,
  denormalised `max_source_weight` (so ranking never joins back to sources),
  `first_seen_at`/`last_seen_at`, `importance`, `one_liner`, `category`,
  `thread_id`.
- **`llm_calls`** — one row per provider per UTC day. The quota fuse.
- **`entities`** — company/person/model with an `aliases[]` array so
  "Google DeepMind", "DeepMind" and "GDM" resolve to one page.

---

## 5. The web app — 12 routes

Read-only by design: **the worker writes every derived value, the app only
reads.** Nothing in a request path decides whether a story needs re-clustering,
which keeps page loads fast and removes a whole class of concurrency bug.

| Route | What it is |
|---|---|
| `/` | **Pulse** — top 12 ranked by importance, never by time. One line each, category-coloured. |
| `/story/[id]` | One event: one-liner, chips (category, source count, importance, entity links), every source expanded, scoped agent, thread timeline below. |
| `/entity/[slug]` | Everything about one company/person/model, newest first, up to 60. The page that replaces Googling a name. |
| `/models` | Model Board — frontier models side by side (vendor, release, context, notes). |
| `/catchup` | The highest-ranked stories *this viewer* has not opened. Not an unread counter. |
| `/ask` | Archive agent + matching stories, with clickable `[n]` citations. |
| `/login` | Password gate. |
| `/api/login`, `/api/logout`, `/api/read`, `/api/ask-story` | Auth, read-state, scoped agent. |
| `error.tsx`, `loading.tsx`, `not-found.tsx` | Production states; the error copy names the likely cause (Neon unreachable / missing env var) instead of showing a stack. |

Every page is `dynamic = "force-dynamic"`. That is deliberate: ISR would have
Next query Neon while collecting page data at build time, coupling each deploy
to a live, awake database — a sleeping Neon instance would fail the *build*
rather than one request. At single-user traffic the saved round trip was never
worth that trade.

Styling is a single 459-line `app/globals.css`: serif type, 720px column, full
light/dark via `prefers-color-scheme`, and a CSS custom property per category
colour. No UI framework, no CSS-in-JS.

`lib/format.ts` exists because of a real render bug: the Neon driver returns
`timestamptz` as a JavaScript `Date`, not a string, so `.slice()` on one threw
and blanked the Ask and Entity pages. Every date now goes through helpers whose
input type admits both.

---

## 6. Retrieval and the agent

### Search (`lib/search.ts`, 144 lines)
Two Postgres full-text rankers fused by **Reciprocal Rank Fusion** (k=60):

1. **story-level** `stories.search_tsv` — matches the event as a whole;
2. **article bodies** `articles.search_full` — matches a detail mentioned in
   only one source, which is what "searchable down to minor details" needs.

RRF merges by *rank position* rather than score, because `ts_rank_cd` values
from two different columns are not on a comparable scale and calibrating them
would need labelled data that does not exist here. Queries go through
`websearch_to_tsquery`, which never throws on odd punctuation — unlike
`to_tsquery` — and that matters when the input is whatever someone typed.

**There is no vector arm, on purpose.** Article embeddings come from MiniLM on
the worker's CPU, so encoding a *query* would need that same 90MB model inside
a serverless function, dominating cold starts. The embeddings still earn their
keep — they are what clusters articles into stories at all — but query-time
semantics would need a hosted encoder and a re-embed of the corpus to matching
dimensions.

### The agent (`lib/agent.ts`, 139 lines) — two modes
- **Scoped** ("Ask this story"): corpus is that story's own 5–40 stored
  sources, so there is no retrieval step at all. Both the faster and cheaper
  mode.
- **Archive** ("Ask the archive"): RRF retrieval across everything ingested,
  12 numbered passages.

Three rules, **enforced rather than requested**:

1. *Answer from the index, not the live web.* Retrieval is sub-second; live
   browsing takes 20s+ and defeats the purpose.
2. *Every claim carries a citation.* Passages go in numbered, the model emits
   `[n]`, and `enforceCitations()` then **drops uncited sentences and withholds
   the whole answer if fewer than half carry a valid in-range marker**. Only
   the passages actually cited are shown. A confidently stated wrong benchmark
   is worse than no answer.
3. *"Not in the archive" is a valid answer.* `NOT_IN_ARCHIVE` is modelled
   explicitly, so refusal is a normal outcome with its own copy, not a failure.

Verified both directions at build time: a real question answers with
citations, and "capital of Bolivia" is correctly withheld.

### The LLM wrapper rule (`src/llm.ts`, 192 lines)
Exactly one exported function — `generate(prompt, opts?)`. Provider selection,
retry and fallback live in this file **and nowhere else**, and no provider SDK
is imported anywhere else in the codebase, so swapping providers when a free
tier changes terms stays a one-file edit.

- Gemini primary → Groq fallback, one retry per provider on 429/500/502/503/504
  only (a 400 fails identically however many times you ask).
- `temperature: 0`; optional JSON response mode; `parseJson()` tolerates the
  ```` ```json ```` fences models sometimes add.
- The Gemini key travels as an `x-goog-api-key` **header**, never a query
  parameter, so it cannot land in a proxy log or an error trace.
- **Daily cap (`LLM_DAILY_CAP`, now 200)** counted in `llm_calls`, throwing
  `QuotaExhausted`. This guards one specific failure: a clustering regression
  that stops merging would produce hundreds of singleton stories, each looking
  novel and important, and would drain the day's free tier overnight. The fuse
  turns that incident into a log line. Raised from 60 when the app was shared
  with a team, since every question anyone asks costs a call on top of
  enrichment's ~15/day.
- On exhaustion the caller leaves its marker column null and the next cycle
  retries — the same resumability every other stage has. `/api/ask-story`
  translates it to "The daily model budget is used up. It resets at midnight
  UTC."

---

## 7. Auth and security

Single shared password, no accounts, no identity provider — NextAuth would add
a dependency and a provider round trip to solve a problem that does not exist
here. The gate ships with the *first* page, not later, because the app sits on
a guessable public URL and an ungated `/api/ask` is a free LLM endpoint for
whoever finds it: **the gate protects the quota, not just the content.**

- `proxy.ts` (Next 16's `middleware.ts` replacement) gates everything except
  `/login`, `/api/login`, `/manifest.webmanifest` and `/icon.svg`.
- Password check → HMAC-SHA256-signed cookie carrying an expiry, 30 days, via
  **Web Crypto** so the same code runs in Edge middleware and in Node.
- **Both the proxy and the login route fail closed** on a missing `AUTH_SECRET`
  or `APP_PASSWORD` — a misconfigured deploy locks the app rather than opening
  it, which is exactly the case the gate exists for.
- Password and signature comparisons are both constant-time, so neither can be
  probed byte by byte.
- `pulse_viewer` is a second cookie: an anonymous UUID, not an account. It only
  separates read-state so Catch-up means something when several people share
  the one password. It survives sign-out, so read history is not lost on logout.
- `.gitignore` discipline is non-negotiable — the repo is public (intentionally,
  for unlimited Actions minutes) so `.env` never lands in it; keys live in
  GitHub Secrets and Vercel env vars.

---

## 8. Commands

```bash
npm run ingest    # stage 1 — fetch every active feed, upsert articles
npm run embed     # stage 2 — MiniLM, 384-dim vectors
npm run cluster   # stage 3 — articles → stories
npm run score     # stage 4 — importance formula
npm run enrich    # stage 5 — one Gemini call per qualifying story
npm run tidy      # stage 6 — canonicalise entities, refresh search text
npm run migrate   # apply db/*.sql in order (idempotent)
npm run status    # what's in the DB, what's backlogged, which feeds fail
npm run probe     # test feed URLs before editing sources.ts
npm run dev / build / start
```

`npm run status` reports the *same predicates the stages use to find their
work*, so it is the fastest way to see where a run stopped. `npm run probe`
with no arguments re-tests every feed in `sources.ts`; pass URLs to test
candidates instead.

---

## 9. Sources — 23 feeds, weighted

| Band | Feeds | Weight |
|---|---|---|
| Primary labs | OpenAI, Google DeepMind, Google AI, Meta AI Research, Mistral, Hugging Face | 0.8–1.0 |
| Analysis | Import AI, Simon Willison, Interconnects, Latent Space, AI News (smol.ai) | 0.7–0.85 |
| Press | MIT Tech Review, TechCrunch AI, The Verge AI, Crunchbase News AI, Ars Technica, VentureBeat AI | 0.65–0.75 |
| Research | arXiv cs.AI / cs.CL / cs.LG (embedded + searchable, never clustered) | 0.6 |
| Community | HN (AI, 100+ pts), r/LocalLLaMA, r/MachineLearning | 0.4–0.5 |

Primary sources score highest because they *originate*; aggregators amplify.

---

## 10. Build history — 12 commits, phases 0–5

| Commit | What shipped |
|---|---|
| `343401a` | Initial commit |
| `bd501ec` | **Phase 0** made survivable: batched inserts (>10min → ~30s), deadline + fair rotation, retries, host gap, source retirement, fixed Mistral/Meta URLs, dropped Anthropic (no feed), added `status` + `probe`. 2,466 articles, 0 duplicates on re-run. |
| `49fa9bb` | Phase 0 verified in CI — 361 articles on the first `workflow_dispatch` run. |
| `a4713da` | **Phase 1** — embeddings + clustering. Threshold corrected 0.82 → 0.75 with measurements; arXiv excluded; `clustered_at` marker; migration runner; unit-tested centroid math. 180 stories from 187 clusterable articles. |
| `6878cf9` | **Phase 2** — importance ranking, recompute-then-freeze, word-boundary seed matcher. 84 stories scored in 3.3s. |
| `e192c73` | **Phase 3** — enrichment, entities, threads; `src/llm.ts` wrapper; `gemini-3.5-flash-lite` chosen on measurement (~950ms vs 13s for flash, 124s for gemini-3.6-flash); key moved to a header; `llm_calls` fuse. 15 stories enriched in 71.4s, 27 entities, 10 threads. |
| `865c566` | **The app** — Pulse, story pages, auth gate. Verified: unauth → 307 `/login`; wrong password → 303 `?error=1`; correct → 303 `/` with cookie; 12 ranked stories render. |
| `a7aaa64` | **Vercel build fix** — lazy DB client (module-scope throw was failing deploys on a missing build-time var), pages switched to per-request, `middleware.ts` → `proxy.ts` for Next 16. Build completes with *zero* env vars set. |
| `8e73cbd` | Untrack `tsbuildinfo`. |
| `3865178` | **Phases 4 and 5** — RRF search, both agent modes with enforced citations, entity canonicalisation (27 entities → 23: three Qwen variants were three pages, "Altman"/"Elon" arrived as bare surnames, OCaml was classified as a model), the `Date`-vs-string render bug fixed, error/not-found/loading states, sign-out, read tracking. All 12 routes render. |
| `5d03a4b` | Entity tidy added to CI. |
| `76aa171` | **Team-safe** — `read_state` keyed per viewer (previously the first person to open a story marked it read for everyone, emptying colleagues' Catch-up); daily LLM cap 60 → 200. Verified with two independent sessions. |

---

## 11. What is NOT built

The plan calls phases 0–5 shipped, which is accurate — but four things have a
table or a page without the code that fills it. Worth knowing before you rely
on them:

1. **Model Board is never populated.** `db/005` creates `models` and
   `/models` renders it, but no code anywhere writes to that table —
   `src/enrich.ts` has no model-board step. The page's own empty state promises
   "rows are added automatically when a launch story is enriched", which is not
   yet true. The page will stay empty indefinitely.
2. **Saved questions: table only.** `saved_questions` and
   `saved_question_hits` exist; nothing references them in any `.ts` file. The
   "agent that watches instead of one you visit" is unimplemented.
3. **Push: table only, and no service worker.** `push_subscriptions` exists;
   there is no VAPID code, no `/api/push`, and `public/` holds only `icon.svg`
   and `manifest.webmanifest`. So the PWA *installs* to a home screen, but
   there is no service worker — meaning no offline shell and no Web Push
   (which on iOS requires an installed PWA anyway). PLAN.md's "manifest +
   service worker" is half done.
4. **No tests in the repo.** Commits cite "9/9 entity tests passing" and
   "unit-tested centroid math", but there are no `*.test.ts` files and no
   `test` script in `package.json` — those were run ad hoc and never committed.
   There is also no lint or typecheck step in CI.

Two smaller gaps:

- **`.env.example` is missing `AUTH_SECRET` and `APP_PASSWORD`.** Both are
  required for the app to open at all (it fails closed without them), yet
  neither is documented. A fresh clone following the README gets a permanently
  locked app with no hint why.
- **README's "Phase 0 status" is stale** — it still lists "A plain
  reverse-chronological list page — not built", which contradicts phases 0–5
  shipping, and the whole section is superseded by the build order in PLAN.md.

---

## 12. Known quirks — normal, not worth re-debugging

- **arXiv feeds are empty at weekends.** arXiv only announces new submissions
  Monday to Friday. An empty feed there is correct.
- **Three sources fail from CI but work locally.** GitHub runners use
  datacenter IPs, which more services block: Import AI 403s (Substack),
  hnrss.org times out, r/MachineLearning 429s. All three are low-weight or
  duplicated by other sources, so this is tolerated rather than fixed.
- **Reddit 429s.** Its public `.rss` is aggressively rate limited, so usually
  only one of the two subreddits succeeds per run. Sources are fetched
  least-recently-succeeded first, so the two alternate rather than one
  starving.
- **Anthropic has no RSS feed.** `anthropic.com/news` advertises no
  `<link rel="alternate">` and every conventional path 404s, so the source was
  removed. Their launches still arrive through press coverage, just without the
  1.0 primary-source weight. Fixing it properly needs a scraped source kind.

Feeds move constantly — this is maintenance, not failure. `npm run status`
shows the error, `npm run probe` tests replacements.

---

## 13. Deliberately out of scope for v1

Instagram (hardest access, lowest signal, nothing unique). Comments. Social
features. Any custom-trained ML. Native apps.
