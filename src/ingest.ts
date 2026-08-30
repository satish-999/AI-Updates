/**
 * Stage 1 — fetch.
 *
 * Fetches active sources, parses the feed, and upserts articles.
 * No AI, no clustering. Just proves the pipe works end to end.
 *
 * Run locally:  npm run ingest
 * Runs in CI:   .github/workflows/ingest.yml every 15 minutes
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import Parser from "rss-parser";
import { SOURCES } from "./sources.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = neon(DATABASE_URL);

/**
 * Stop starting new sources past this point so the run always finishes inside
 * the workflow timeout. Whatever is left is picked up next cycle — sources are
 * fetched least-recently-succeeded first, so nothing starves.
 */
const DEADLINE_MS = Number(process.env.INGEST_DEADLINE_MS ?? 7 * 60_000);

const parser = new Parser({
  timeout: 15_000,
  headers: {
    // Many sites 403 a default user-agent. This is the single most common
    // cause of "the feed works in my browser but not in code".
    "User-Agent": "Mozilla/5.0 (compatible; AIPulse/0.1; +https://github.com)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
});

/** Insert any seed sources not already present. One round trip. Idempotent. */
async function seedSources() {
  await sql`
    insert into sources (name, feed_url, site_url, kind, weight)
    select x.name, x.feed_url, x.site_url, x.kind, x.weight::real
    from unnest(
      ${SOURCES.map((s) => s.name)}::text[],
      ${SOURCES.map((s) => s.feed_url)}::text[],
      ${SOURCES.map((s) => s.site_url ?? null)}::text[],
      ${SOURCES.map((s) => s.kind ?? "rss")}::text[],
      ${SOURCES.map((s) => String(s.weight))}::text[]
    ) as x(name, feed_url, site_url, kind, weight)
    on conflict (feed_url) do update set
      name = excluded.name,
      weight = excluded.weight
  `;

  // Retire rows whose feed_url is no longer in the seed list. Without this, a
  // corrected URL leaves the old broken one active and failing forever, since
  // the upsert above matches on feed_url and never sees it again.
  // Deactivate only — a source pruned by hand stays pruned.
  await sql`
    update sources set active = false
    where active = true and feed_url <> all(${SOURCES.map((s) => s.feed_url)}::text[])
  `;
}

function cleanText(input?: string): string | null {
  if (!input) return null;
  return (
    input
      .replace(/<[^>]*>/g, " ") // strip html
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000) || null
  );
}

/** Feeds lie about dates. Reject anything absurd and fall back to null. */
function safeDate(raw?: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 2000 || d.getTime() > Date.now() + 86_400_000) return null;
  return d.toISOString();
}

type Row = {
  url: string;
  title: string;
  author: string | null;
  summary: string | null;
  body: string | null;
  published_at: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 429s and dropped connections are the norm, not the exception. One retry
 *  clears most of them; anything still failing after that is a real problem
 *  worth seeing in last_error. */
function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|50[234]|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|timeout/i.test(msg);
}

/** Reddit and arXiv each serve several feeds here. Hitting one host twice in
 *  quick succession is what earns a 429, so keep a gap per hostname. */
const HOST_GAP_MS = 6_000;
const lastHit = new Map<string, number>();

async function politeWait(url: string) {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  const prev = lastHit.get(host);
  if (prev !== undefined) {
    const wait = HOST_GAP_MS - (Date.now() - prev);
    if (wait > 0) await sleep(wait);
  }
  lastHit.set(host, Date.now());
}

async function fetchFeed(url: string) {
  await politeWait(url);
  try {
    return await parser.parseURL(url);
  } catch (err) {
    if (!isTransient(err)) throw err;
    await sleep(8_000);
    lastHit.set(new URL(url).hostname, Date.now());
    return await parser.parseURL(url);
  }
}

async function ingestSource(src: { id: number; feed_url: string }): Promise<number> {
  const feed = await fetchFeed(src.feed_url);

  const seen = new Set<string>();
  const rows: Row[] = [];

  for (const item of feed.items ?? []) {
    const url = item.link?.trim();
    const title = item.title?.trim();
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);

    const raw = item as { content?: string; "content:encoded"?: string };
    rows.push({
      url,
      title,
      author: item.creator ?? null,
      summary: cleanText(item.contentSnippet ?? item.summary),
      body: cleanText(raw["content:encoded"] ?? item.content),
      published_at: safeDate(item.isoDate ?? item.pubDate),
    });
  }

  if (rows.length === 0) return 0;

  // One statement per feed rather than one per item. The HTTP driver costs a
  // full round trip per call, and at ~30 items across 24 feeds that difference
  // is the difference between seconds and blowing the workflow timeout.
  const inserted = (await sql`
    insert into articles (source_id, url, title, author, summary, body, published_at)
    select ${src.id}, x.url, x.title, x.author, x.summary, x.body, x.published_at::timestamptz
    from unnest(
      ${rows.map((r) => r.url)}::text[],
      ${rows.map((r) => r.title)}::text[],
      ${rows.map((r) => r.author)}::text[],
      ${rows.map((r) => r.summary)}::text[],
      ${rows.map((r) => r.body)}::text[],
      ${rows.map((r) => r.published_at)}::text[]
    ) as x(url, title, author, summary, body, published_at)
    on conflict (url) do nothing
    returning id
  `) as unknown[];

  return inserted.length;
}

async function main() {
  const started = Date.now();
  await seedSources();

  // Least-recently-succeeded first. Under the deadline this rotates fairly
  // instead of always starving whatever sits at the end of the list.
  const sources = (await sql`
    select id, name, feed_url from sources
    where active = true
    order by last_ok_at asc nulls first, id
  `) as { id: number; name: string; feed_url: string }[];

  let totalNew = 0;
  let failed = 0;
  let skipped = 0;

  // Sequential on purpose. Parallel fetching of 24 feeds gets you rate-limited
  // and makes failures much harder to read in the CI log.
  for (const src of sources) {
    if (Date.now() - started > DEADLINE_MS) {
      skipped++;
      continue;
    }

    const t0 = Date.now();
    try {
      const n = await ingestSource(src);
      totalNew += n;
      await sql`update sources set last_ok_at = now(), last_error = null where id = ${src.id}`;
      console.log(
        `  ok    ${String(n).padStart(3)} new  ${String(Date.now() - t0).padStart(5)}ms  ${src.name}`
      );
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      await sql`update sources set last_error = ${msg.slice(0, 500)} where id = ${src.id}`;
      console.warn(`  FAIL       ${String(Date.now() - t0).padStart(5)}ms  ${src.name} — ${msg.slice(0, 100)}`);
    }
  }

  const [{ c }] = (await sql`select count(*)::int as c from articles`) as { c: number }[];
  console.log(
    `\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      `${totalNew} new, ${failed}/${sources.length - skipped} failed` +
      (skipped ? `, ${skipped} deferred to next run` : "") +
      `, ${c} articles total`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
