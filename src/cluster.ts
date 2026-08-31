/**
 * Stage 3 — cluster.
 *
 * Collapses articles into stories. For each unclustered article, finds the
 * nearest story centroid inside the 72h window; at or above the threshold it
 * attaches, below it starts a new story.
 *
 * Finds its work with `clustered_at is null` and marks done by writing that
 * column — whether or not the article joined a story. Using `story_id is null`
 * instead would retry the whole backfilled archive every cycle forever.
 *
 *   npm run cluster
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { parseVector, formatVector, updateCentroid } from "./vec.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = neon(DATABASE_URL);

/**
 * Measured against real coverage, not guessed. Genuine same-event pairs land
 * at 0.767-0.802 once research feeds leave the pool; PLAN.md's original 0.82
 * sat above every true positive and would have merged nothing at all.
 * Re-read cluster_debug after a few days of news before moving this.
 */
const THRESHOLD = Number(process.env.CLUSTER_THRESHOLD ?? 0.75);

/** Everything in this band is logged, so the boundary can be read off real
 *  news instead of argued about. */
const DEBUG_LO = 0.65;
const DEBUG_HI = 0.9;

/** Articles older than this never form stories. The backfilled archive is
 *  ~2,200 posts going back to 2015; each would otherwise become a singleton
 *  story that looks brand new and qualifies for an LLM call. */
const MAX_AGE_DAYS = Number(process.env.CLUSTER_MAX_AGE_DAYS ?? 7);

const WINDOW_HOURS = 72;

type Article = {
  id: number;
  title: string;
  published_at: string | null;
  emb: string;
  weight: number;
  clusterable: boolean;
};

type Candidate = {
  id: number;
  sim: number;
  title: string | null;
  centroid: string;
  article_count: number;
};

async function main() {
  const started = Date.now();

  const [{ todo }] = (await sql`
    select count(*)::int as todo from articles
    where clustered_at is null and embedding is not null
  `) as { todo: number }[];

  console.log(`${todo} articles to consider  (threshold ${THRESHOLD})`);
  if (todo === 0) return;

  let attached = 0;
  let created = 0;
  let skipped = 0;

  for (;;) {
    // Oldest first: within a burst the earliest article should seed the story
    // so later coverage attaches to it, not the other way round.
    const batch = (await sql`
      select a.id, a.title, a.published_at, a.embedding::text as emb,
             s.weight, s.clusterable
      from articles a
      join sources s on s.id = a.source_id
      where a.clustered_at is null and a.embedding is not null
      order by a.published_at asc nulls last, a.id
      limit 200
    `) as Article[];

    if (batch.length === 0) break;

    const toSkip: number[] = [];

    for (const art of batch) {
      // Bound to a local so the null check narrows for the rest of the loop.
      const publishedAt = art.published_at;
      const tooOld =
        !publishedAt ||
        Date.now() - new Date(publishedAt).getTime() > MAX_AGE_DAYS * 86_400_000;

      // Archive and research articles are stamped as considered and left
      // storyless. They stay embedded, so search still reaches them.
      if (!publishedAt || tooOld || !art.clusterable) {
        // Collected and stamped in one statement after the batch. Doing this
        // per row cost 2,640 round trips and 17 minutes on the first run.
        toSkip.push(art.id);
        skipped++;
        continue;
      }

      // Window bounds computed here rather than in SQL: an interpolation
      // inside interval '...' would be parameterised into the string literal
      // instead of substituted into it.
      const pub = new Date(publishedAt).getTime();
      const lo = new Date(pub - WINDOW_HOURS * 3_600_000).toISOString();
      const hi = new Date(pub + WINDOW_HOURS * 3_600_000).toISOString();

      const rows = (await sql`
        select st.id, st.article_count, st.centroid::text as centroid,
               1 - (st.centroid <=> ${art.emb}::vector) as sim,
               st.one_liner as title
        from stories st
        where st.last_seen_at  > ${lo}::timestamptz
          and st.first_seen_at < ${hi}::timestamptz
        order by st.centroid <=> ${art.emb}::vector
        limit 1
      `) as Candidate[];

      const best = rows[0];
      let storyId: number;

      if (best && best.sim >= THRESHOLD) {
        const merged = updateCentroid(
          parseVector(best.centroid),
          parseVector(art.emb),
          best.article_count
        );
        await sql`
          update stories set
            centroid          = ${formatVector(merged)}::vector,
            article_count     = article_count + 1,
            max_source_weight = greatest(max_source_weight, ${art.weight}),
            first_seen_at     = least(first_seen_at, ${publishedAt}::timestamptz),
            last_seen_at      = greatest(last_seen_at, ${publishedAt}::timestamptz)
          where id = ${best.id}
        `;
        storyId = best.id;
        attached++;
      } else {
        const [story] = (await sql`
          insert into stories (centroid, article_count, max_source_weight,
                               first_seen_at, last_seen_at)
          values (${art.emb}::vector, 1, ${art.weight},
                  ${publishedAt}::timestamptz, ${publishedAt}::timestamptz)
          returning id
        `) as { id: number }[];
        storyId = story.id;
        created++;
      }

      await sql`
        insert into story_articles (story_id, article_id)
        values (${storyId}, ${art.id}) on conflict do nothing
      `;
      await sql`
        update articles set story_id = ${storyId}, clustered_at = now() where id = ${art.id}
      `;

      if (best && best.sim >= DEBUG_LO && best.sim <= DEBUG_HI) {
        await sql`
          insert into cluster_debug
            (article_id, story_id, similarity, decision, article_title, story_title)
          values (${art.id}, ${best.id}, ${best.sim},
                  ${best.sim >= THRESHOLD ? "attached" : "new_story"},
                  ${art.title}, ${best.title})
        `;
      }
    }

    if (toSkip.length > 0) {
      await sql`update articles set clustered_at = now()
                where id = any(${toSkip}::bigint[])`;
    }

    process.stdout.write(
      `\r  ${attached + created + skipped}/${todo}  ` +
        `${created} stories, ${attached} attached, ${skipped} skipped   `
    );
  }

  const [{ s, multi }] = (await sql`
    select count(*)::int as s,
           count(*) filter (where article_count > 1)::int as multi
    from stories
  `) as { s: number; multi: number }[];

  console.log(
    `\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      `${created} stories created, ${attached} attached, ${skipped} skipped\n` +
      `${s} stories total, ${multi} with more than one source`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
