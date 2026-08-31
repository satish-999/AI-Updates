/**
 * Read side of the database.
 *
 * The worker writes every derived value; the app only reads. Nothing in a
 * request path decides whether a story needs re-clustering, which is what
 * keeps page loads fast and removes a whole class of concurrency bug.
 */

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export const sql = neon(url);

export type PulseStory = {
  id: number;
  one_liner: string | null;
  category: string | null;
  importance: number;
  article_count: number;
  first_seen_at: string;
  fallback_title: string;
  sources: string;
};

/** Top of the Pulse: ranked by importance, never by time. */
export async function getPulse(limit = 12): Promise<PulseStory[]> {
  return (await sql`
    select st.id, st.one_liner, st.category, st.importance, st.article_count,
           st.first_seen_at,
           (select a.title from story_articles sa join articles a on a.id = sa.article_id
            where sa.story_id = st.id order by a.published_at limit 1) as fallback_title,
           (select string_agg(distinct s.name, ' · ') from story_articles sa
            join articles a on a.id = sa.article_id
            join sources s on s.id = a.source_id
            where sa.story_id = st.id) as sources
    from stories st
    where st.importance is not null
    order by st.importance desc, st.last_seen_at desc
    limit ${limit}
  `) as PulseStory[];
}

export type StoryDetail = PulseStory & {
  last_seen_at: string;
  thread_id: number | null;
  thread_title: string | null;
};

export async function getStory(id: number): Promise<StoryDetail | null> {
  const rows = (await sql`
    select st.id, st.one_liner, st.category, st.importance, st.article_count,
           st.first_seen_at, st.last_seen_at, st.thread_id,
           t.title as thread_title,
           (select a.title from story_articles sa join articles a on a.id = sa.article_id
            where sa.story_id = st.id order by a.published_at limit 1) as fallback_title,
           (select string_agg(distinct s.name, ' · ') from story_articles sa
            join articles a on a.id = sa.article_id
            join sources s on s.id = a.source_id
            where sa.story_id = st.id) as sources
    from stories st
    left join threads t on t.id = st.thread_id
    where st.id = ${id}
  `) as StoryDetail[];
  return rows[0] ?? null;
}

export type StoryArticle = {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  published_at: string | null;
  source_name: string;
  weight: number;
};

/** Every source behind one story — the forty-to-one link, expanded. */
export async function getStoryArticles(id: number): Promise<StoryArticle[]> {
  return (await sql`
    select a.id, a.title, a.url, a.summary, a.published_at,
           s.name as source_name, s.weight
    from story_articles sa
    join articles a on a.id = sa.article_id
    join sources s on s.id = a.source_id
    where sa.story_id = ${id}
    order by s.weight desc, a.published_at
  `) as StoryArticle[];
}

export type Entity = { id: number; name: string; slug: string; kind: string };

export async function getStoryEntities(id: number): Promise<Entity[]> {
  return (await sql`
    select e.id, e.name, e.slug, e.kind
    from story_entities se join entities e on e.id = se.entity_id
    where se.story_id = ${id}
    order by e.kind, e.name
  `) as Entity[];
}

/** The stories that came before this one, so history needs no search. */
export async function getThreadStories(
  threadId: number,
  excludeStoryId: number
): Promise<PulseStory[]> {
  return (await sql`
    select st.id, st.one_liner, st.category, st.importance, st.article_count,
           st.first_seen_at,
           (select a.title from story_articles sa join articles a on a.id = sa.article_id
            where sa.story_id = st.id order by a.published_at limit 1) as fallback_title,
           '' as sources
    from stories st
    where st.thread_id = ${threadId} and st.id <> ${excludeStoryId}
    order by st.first_seen_at desc
    limit 20
  `) as PulseStory[];
}

export type PipelineStats = {
  articles: number;
  stories: number;
  enriched: number;
  latest: string | null;
};

export async function getStats(): Promise<PipelineStats> {
  const [row] = (await sql`
    select (select count(*)::int from articles) as articles,
           (select count(*)::int from stories) as stories,
           (select count(*)::int from stories where enriched_at is not null) as enriched,
           (select max(fetched_at) from articles) as latest
  `) as PipelineStats[];
  return row;
}
