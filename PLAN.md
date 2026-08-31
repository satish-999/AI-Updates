# AI Pulse — Project Plan

> Read this file first in every Claude Code session. It is the source of truth
> for architecture and decisions. Update it when a decision changes.

## The problem

I follow AI news worldwide — new model capabilities and comparisons, executive
moves, launches, funding, new startups. I'm tired of manually searching across
articles, YouTube and Google, and I'm always late. I want one tool that pulls
updates continuously, surfaces what actually matters first, and lets me search
everything down to minor details.

## The core design decision

**The atom of this product is a Story, not an article.**

When a lab ships a model, 40 outlets write about it. That is ONE story with 40
sources — not 40 feed items. I read one line, not forty headlines.

Stories chain into **Threads** (e.g. "Anthropic model releases"). Every new
story shows what came before it. This is how "what's the history behind this
new thing" gets answered without searching.

## Constraints

- Must work from any device, any network, with my laptop closed.
- No tunnels, no local servers, no `npm run` to use it.
- Free hosting. Zero recurring cost is the target.
- Single user.

## Stack — all free tier

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js (App Router, TypeScript) on **Vercel Hobby** | Non-commercial use only |
| DB | **Neon** Postgres + `pgvector` | Auto-suspends when idle |
| Worker | **GitHub Actions** cron, every 15 min | Public repo = unlimited minutes |
| Embeddings | `@xenova/transformers` → `all-MiniLM-L6-v2` | Runs on CPU in the Action. Free, no key. 384 dims. |
| LLM | **Gemini** free tier primary, **Groq** fallback | Behind one wrapper — see below |
| Push | Web Push (VAPID) | iOS needs the PWA installed to home screen |

### The LLM wrapper rule

All model calls go through `src/llm.ts`, which exposes exactly one function:

```ts
generate(prompt: string, opts?: { json?: boolean }): Promise<string>
```

Provider selection lives inside that file and nowhere else. Free tiers change
terms and rate-limit without warning — swapping providers must be a one-file
change. Do not import a provider SDK anywhere else in the codebase.

### Cost discipline

Only stories **above the importance threshold** get an LLM call. Roughly 10–15
a day, not 100. Embeddings are local and unlimited, so clustering and search
are free regardless of volume.

## Format

A **PWA** — Next.js web app with manifest + service worker. Installs to the
phone home screen, own icon, full screen, works on any network. One codebase
for phone and laptop. No native app, no app stores.

## Surfaces

1. **Pulse (home)** — top 8–12 stories ranked by importance, NOT by time. One
   line each, colour-tagged by category. Whole catch-up in 60 seconds.
2. **Story page** — one event: what happened, all sources collapsed, thread
   timeline below showing the previous stories that led here.
3. **Entity pages** — auto-built for every company / person / model detected.
   Tap "Mistral" → everything, chronological. Replaces Googling.
4. **Model Board** — live table of frontier models: benchmarks, context,
   pricing, release date. Rows added automatically on launch stories.
5. **Catch-up** — after time away, "here are the 6 things that mattered", not
   400 unread items. Needs read-state tracking.

## The agent — two modes

**Ask this story** (scoped): lives on the Story page, reads only that story's
source articles. Fast and cheap — corpus is 5–40 docs already stored.

**Ask the archive** (global): semantic + full-text search across everything
ever ingested, then synthesise with inline citations.

Three non-negotiable rules:

1. **Answer from the index, not the live web.** Retrieval over stored articles
   is sub-second; live browsing takes 20s+ and defeats the purpose. Fall back
   to live fetch only when the archive has no coverage — and label it.
2. **Every claim carries a citation.** An uncited sentence is a bug. A
   confidently stated wrong benchmark is worse than no answer.
3. **"Not in the archive" is a valid answer.** Distinguish "no source covered
   this" from "here's what sources say". Confabulation is the real risk.

**Saved questions**: a saved query re-runs on every ingest cycle and pushes on
a hit. Turns the agent from something I visit into something that watches.

## Schema

| Table | Purpose |
|---|---|
| `sources` | feed url, type, `weight` 0–1 authority score |
| `articles` | raw item. `url` UNIQUE. text, embedding vector(384) |
| `stories` | the atom — one_liner, category, importance, thread_id |
| `story_articles` | join: the 40-to-1 link |
| `entities` | company / person / model + `aliases[]` |
| `story_entities` | join |
| `threads` | ongoing narrative, usually anchored to an entity |
| `models` | Model Board rows, benchmarks as `jsonb` |
| `saved_questions` | query text + embedding, re-run each cycle |
| `push_subscriptions` | VAPID endpoints |
| `read_state` | what I've seen — powers Catch-up |

Two constraints that save pain later:

- `articles.url` UNIQUE — dedupe backstop when feeds republish.
- Store `fetched_at` separately from `published_at`. **Feeds lie about dates
  constantly.** You will need the real one to debug.

## The two formulas

### Clustering

Embed `title + first 200 words`. Compare only against stories from the
**last 72 hours** (not the whole table), against each story's stored centroid
so the lookup is one indexed nearest-neighbour query, not a scan over members.

```
cosine_similarity >= 0.75  ->  attach to existing story
otherwise                  ->  create new story
```

**Measured, not guessed (2026-08-31).** The original 0.82 was wrong: it sits
above every true positive. On real coverage, genuine same-event pairs land at
0.767-0.802 — Sony/Warner sue Anthropic 0.802, Nvidia buys Hugging Face 0.791,
the OpenAI/Hugging Face incident 0.774. At 0.82 nothing merges at all, which is
exactly the runaway that burns the LLM quota in phase 3.

**Research feeds are excluded from clustering** via `sources.clusterable`.
Academic titles share so much vocabulary that unrelated arXiv papers sat at
0.762 while genuinely identical news sat at 0.767 — no single threshold
separates them while research shares the pool. Papers stay embedded and
searchable; when one matters, the press coverage of it clusters on its own.

Every comparison between 0.65 and 0.90 is logged to `cluster_debug` with both
titles, so the boundary can be re-read off real news rather than argued about.

### Importance

```
score = 0.35 × max(source_weight in cluster)
      + 0.30 × log(1 + cluster_size) / log(20)
      + 0.20 × entity_match          (1.0 followed, 0.5 known, 0 unknown)
      + 0.15 × exp(-hours_old / 24)
```

Coverage velocity carries the most weight deliberately: when 15 outlets write
the same thing within two hours, that IS the importance signal. The log caps
it so a 60-outlet story doesn't dominate forever.

## Build order

Ship each phase before starting the next. Each is usable alone.

- [x] **0 · Ingest** — feeds → `articles`. Green in CI every 15 min.
- [x] **1 · Clustering** — embeddings → `stories`. Threshold calibrated to 0.75.
- [x] **2 · Ranking** — formula applied; stories carry `importance`.
- [x] **3 · Enrichment** — one Gemini call per story returning one_liner +
      category + entities as a single JSON object. Model: gemini-3.5-flash-lite.
- [x] **4 · Search + agent** — RRF over two full-text rankers, then scoped
      agent, then archive agent. Citations enforced after generation.
- [x] **5 · The rest** — threads, entity pages, Model Board, Catch-up.
      Push and saved questions remain: both need keys/config, not code.

Usable daily tool after phase 3. Shipped through phase 5 and deployed.

## Deliberately out of scope for v1

Instagram (hardest access, lowest signal, nothing unique). Comments. Social
features. Any custom-trained ML. Native apps.

## Security

- A login gate before anything else ships publicly. The app sits on a public
  URL; without auth, anyone who finds it can burn the LLM quota.
- Keys live in GitHub Secrets and Vercel env vars. **Never commit `.env`.**
- Repo is public — that is fine and intentional (unlimited Actions minutes),
  but it makes the `.gitignore` discipline non-negotiable.
