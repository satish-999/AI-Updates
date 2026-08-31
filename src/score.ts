/**
 * Stage 4 — score.
 *
 * Applies the importance formula so the Pulse can sort by what matters rather
 * than by what arrived last.
 *
 *   score = 0.35 * max(source_weight in cluster)
 *         + 0.30 * log(1 + article_count) / log(20)
 *         + 0.20 * entity_match
 *         + 0.15 * exp(-hours_old / 24)
 *
 * Two of these terms grow as coverage arrives and one decays with age, so this
 * is deliberately NOT a write-once value: it is recomputed every cycle while a
 * story is inside the window, then frozen. Without the freeze the Pulse would
 * reshuffle its whole history every 15 minutes and read-state would stop
 * meaning anything.
 *
 *   npm run score
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { entityMatch } from "./entities.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = neon(DATABASE_URL);

/** Stories stop being rescored once they leave this window. */
const WINDOW_HOURS = Number(process.env.SCORE_WINDOW_HOURS ?? 72);

/** Coverage velocity saturates: the gap between 1 and 15 outlets matters far
 *  more than the gap between 15 and 60, so the log caps a huge story instead
 *  of letting it own the Pulse for a week. */
const VELOCITY_CAP = 20;

export function importance(input: {
  maxSourceWeight: number;
  articleCount: number;
  entity: number;
  hoursOld: number;
}): number {
  const authority = input.maxSourceWeight;
  const velocity = Math.log(1 + input.articleCount) / Math.log(VELOCITY_CAP);
  const recency = Math.exp(-input.hoursOld / 24);

  return (
    0.35 * authority +
    0.30 * Math.min(velocity, 1) +
    0.20 * input.entity +
    0.15 * recency
  );
}

async function main() {
  const started = Date.now();
  const cutoff = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();

  // Text comes from the member articles, since stories have no one_liner until
  // stage 5. first_seen_at is the age of the event itself, not of the latest
  // follow-up — a story that keeps attracting coverage is already rewarded by
  // the velocity term, and should not also be treated as newly broken.
  const rows = (await sql`
    select st.id, st.article_count, st.max_source_weight,
           extract(epoch from (now() - st.first_seen_at)) / 3600 as hours_old,
           (select string_agg(a.title || ' ' || coalesce(a.summary, ''), ' ')
            from story_articles sa join articles a on a.id = sa.article_id
            where sa.story_id = st.id) as text
    from stories st
    where st.last_seen_at > ${cutoff}::timestamptz
  `) as {
    id: number; article_count: number; max_source_weight: number;
    hours_old: string; text: string | null;
  }[];

  if (rows.length === 0) {
    console.log("no stories inside the window");
    return;
  }

  const ids: number[] = [];
  const scores: number[] = [];

  for (const r of rows) {
    const score = importance({
      maxSourceWeight: r.max_source_weight,
      articleCount: r.article_count,
      entity: entityMatch(r.text ?? ""),
      hoursOld: Number(r.hours_old),
    });
    ids.push(r.id);
    scores.push(Number(score.toFixed(4)));
  }

  // One statement, not one per story.
  await sql`
    update stories st
    set importance = v.score::real, scored_at = now()
    from unnest(${ids}::bigint[], ${scores}::real[]) as v(id, score)
    where st.id = v.id
  `;

  console.log(
    `scored ${rows.length} stories in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );

  const top = (await sql`
    select st.importance, st.article_count, st.max_source_weight,
           (select a.title from story_articles sa join articles a on a.id = sa.article_id
            where sa.story_id = st.id order by a.published_at limit 1) as title
    from stories st
    where st.importance is not null
    order by st.importance desc limit 12
  `) as { importance: number; article_count: number; max_source_weight: number; title: string }[];

  console.log("\ntop of the Pulse:\n");
  for (const t of top) {
    console.log(
      `  ${t.importance.toFixed(3)}  ${String(t.article_count).padStart(2)}src ` +
        `w${t.max_source_weight}  ${String(t.title).slice(0, 72)}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
