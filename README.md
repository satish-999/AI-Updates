# AI Pulse

Personal AI news aggregator. One tool for worldwide AI updates — ranked by
what actually matters, searchable down to minor details.

**Read `PLAN.md` before doing anything.** It holds the architecture, formulas
and decisions. In Claude Code, start each session by asking it to read PLAN.md.

Currently at: **Phase 0 — ingest works. The app is not built yet.**

## Commands

```bash
npm run ingest    # stage 1 — fetch every active feed, upsert articles
npm run status    # what's in the database, what's backlogged, what's failing
npm run probe     # test feed URLs before editing sources.ts
```

`npm run probe` with no arguments re-tests every feed in `sources.ts`; pass
URLs to test candidates instead:

```bash
npm run probe -- https://example.com/rss.xml https://example.com/feed
```

## Setup

### 1. Database

1. Sign up at [neon.tech](https://neon.tech), create a project.
2. Open the **SQL Editor**, paste all of `db/001_phase0.sql`, run it.
3. Copy the **pooled** connection string from the dashboard.

### 2. Local

```bash
npm install
cp .env.example .env      # paste your Neon connection string into DATABASE_URL
npm run ingest
```

### 3. Automate it

1. Push to GitHub as a **public** repo. Public means unlimited free Actions
   minutes, which is what pays for 15-minute polling.
2. Repo **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `DATABASE_URL`
   - Value: your Neon connection string
3. **Actions** tab → `ingest` → **Run workflow** to test it immediately.

From here the ingest runs every 15 minutes with your laptop closed.

## Phase 0 status

- [x] `npm run ingest` inserts articles
- [x] Fewer than 5 sources failing (1 of 23)
- [x] Re-running inserts 0 duplicates — the `url` UNIQUE constraint works
- [ ] The GitHub Action has run on its own schedule — needs the repo pushed
- [ ] A plain reverse-chronological list page — not built

## Known source quirks

These are normal and not worth re-debugging:

- **arXiv feeds are empty at weekends.** arXiv only announces new submissions
  Monday to Friday. An empty feed there is correct, not broken.
- **Reddit 429s.** Its public `.rss` is aggressively rate limited, so usually
  only one of the two subreddits succeeds per run. Sources are fetched
  least-recently-succeeded first, so the two alternate rather than one
  starving. Expect this to fail more often from GitHub's datacenter IPs.
- **Anthropic has no RSS feed.** `anthropic.com/news` advertises no feed and
  every conventional path 404s, so the source was removed. Their launches
  still arrive through press coverage, just without the primary-source weight.
  Fixing it properly needs a scraped source kind.

When something else breaks, `npm run status` shows the error and `npm run
probe` tests replacements. Feeds move constantly — this is maintenance, not
failure.

## Never commit

`.env`. The repo is public. Keys go in GitHub Secrets and Vercel env vars.
