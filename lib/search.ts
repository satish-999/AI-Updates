/**
 * Retrieval.
 *
 * Two rankers over Postgres full-text, fused by Reciprocal Rank Fusion: one
 * over story-level text (whole events) and one over article bodies (the buried
 * detail). RRF merges by position rather than score, because ts_rank_cd values
 * from two different columns are not on a comparable scale and calibrating
 * them against each other needs labelled data that does not exist here.
 *
 * A vector arm is deliberately absent. Article embeddings come from MiniLM
 * running on the worker's CPU; encoding a *query* would need that same 90MB
 * model inside a serverless function, which would dominate cold starts. The
 * embeddings still earn their keep — they are what clusters articles into
 * stories in the first place — but query-time semantics would need a hosted
 * encoder and a re-embed of the corpus to match its dimensions.
 */

import { sqlClient } from "./db";
import type { Timestamp } from "./format";

/** k=60 is the standard RRF constant; it damps the top rank's dominance. */
const RRF_K = 60;

export type SearchHit = {
  story_id: number;
  one_liner: string | null;
  fallback_title: string;
  category: string | null;
  importance: number;
  article_count: number;
  first_seen_at: Timestamp;
  score: number;
};

type RankedRow = { story_id: number };

/**
 * Turn a natural-language question into a websearch_to_tsquery input.
 * websearch_to_tsquery never throws on odd punctuation, unlike to_tsquery,
 * which matters when the input is whatever someone typed.
 */
function cleanQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 300);
}

export async function searchStories(raw: string, limit = 15): Promise<SearchHit[]> {
  const q = cleanQuery(raw);
  if (!q) return [];
  const sql = sqlClient();

  // Arm 1 — story-level text: matches the event as a whole.
  const byStory = (await sql`
    select st.id as story_id
    from stories st
    where st.search_tsv @@ websearch_to_tsquery('english', ${q})
    order by ts_rank_cd(st.search_tsv, websearch_to_tsquery('english', ${q})) desc,
             st.importance desc nulls last
    limit 50
  `) as RankedRow[];

  // Arm 2 — article bodies: matches a detail mentioned in only one source.
  const byArticle = (await sql`
    select a.story_id
    from articles a
    where a.story_id is not null
      and a.search_full @@ websearch_to_tsquery('english', ${q})
    group by a.story_id
    order by max(ts_rank_cd(a.search_full, websearch_to_tsquery('english', ${q}))) desc
    limit 50
  `) as RankedRow[];

  const fused = new Map<number, number>();
  for (const arm of [byStory, byArticle]) {
    arm.forEach((row, i) => {
      if (row.story_id == null) return;
      fused.set(row.story_id, (fused.get(row.story_id) ?? 0) + 1 / (RRF_K + i + 1));
    });
  }

  if (fused.size === 0) return [];

  const ids = [...fused.keys()];
  const rows = (await sql`
    select st.id as story_id, st.one_liner, st.category, st.importance,
           st.article_count, st.first_seen_at,
           (select a.title from story_articles sa join articles a on a.id = sa.article_id
            where sa.story_id = st.id order by a.published_at limit 1) as fallback_title
    from stories st
    where st.id = any(${ids}::bigint[])
  `) as Omit<SearchHit, "score">[];

  return rows
    .map((r) => ({ ...r, score: fused.get(r.story_id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type Passage = {
  n: number;
  title: string;
  url: string;
  source_name: string;
  published_at: Timestamp;
  story_id: number | null;
  text: string;
};

/** Numbered passages for the agent to cite. Order is the citation order. */
export async function retrievePassages(raw: string, limit = 12): Promise<Passage[]> {
  const q = cleanQuery(raw);
  if (!q) return [];
  const sql = sqlClient();

  const rows = (await sql`
    select a.title, a.url, a.published_at, a.story_id, s.name as source_name,
           coalesce(a.summary, left(a.body, 600), '') as text
    from articles a
    join sources s on s.id = a.source_id
    where a.search_full @@ websearch_to_tsquery('english', ${q})
    order by ts_rank_cd(a.search_full, websearch_to_tsquery('english', ${q})) desc,
             s.weight desc,
             a.published_at desc nulls last
    limit ${limit}
  `) as Omit<Passage, "n">[];

  return rows.map((r, i) => ({ ...r, n: i + 1 }));
}

/** The sources behind one story, numbered — the scoped agent's whole corpus. */
export async function storyPassages(storyId: number): Promise<Passage[]> {
  const sql = sqlClient();
  const rows = (await sql`
    select a.title, a.url, a.published_at, a.story_id, s.name as source_name,
           coalesce(a.body, a.summary, '') as text
    from story_articles sa
    join articles a on a.id = sa.article_id
    join sources s on s.id = a.source_id
    where sa.story_id = ${storyId}
    order by s.weight desc, a.published_at
    limit 40
  `) as Omit<Passage, "n">[];

  return rows.map((r, i) => ({ ...r, n: i + 1, text: r.text.slice(0, 2000) }));
}
