/**
 * Feed probe. Read-only, touches no database.
 *
 * Feeds move, rename and start blocking user-agents constantly. When a source
 * shows up in `npm run status` as failing, use this to test candidate URLs
 * before editing sources.ts, rather than guessing.
 *
 *   npm run probe -- https://example.com/feed.xml https://example.com/rss
 *
 * With no arguments it re-tests every feed currently listed in sources.ts.
 */

import Parser from "rss-parser";
import { SOURCES } from "./sources.js";

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; AIPulse/0.1; +https://github.com)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
});

async function probe(url: string) {
  const t0 = Date.now();
  try {
    const feed = await parser.parseURL(url);
    const n = feed.items?.length ?? 0;
    const newest = feed.items?.[0];
    const when = newest?.isoDate ?? newest?.pubDate;
    console.log(`  ok    ${String(n).padStart(3)} items  ${String(Date.now() - t0).padStart(5)}ms  ${url}`);
    if (newest) {
      console.log(`          latest: ${(newest.title ?? "").slice(0, 72)}`);
      console.log(`          dated:  ${when ?? "(no date)"}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL           ${String(Date.now() - t0).padStart(5)}ms  ${url}`);
    console.log(`          ${msg.slice(0, 110)}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const urls = args.length ? args : SOURCES.map((s) => s.feed_url);
  for (const url of urls) await probe(url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
