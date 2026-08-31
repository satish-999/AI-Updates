/**
 * Read side of the database.
 *
 * The worker writes every derived value; the app only reads. Nothing in a
 * request path decides whether a story needs re-clustering, which is what
 * keeps page loads fast and removes a whole class of concurrency bug.
 *
 * The client is created lazily on first query, never at module scope. A
 * module-scope throw runs while Next is collecting page data during the build,
 * which made a missing DATABASE_URL fail the deploy rather than fail a request
 * — builds must not depend on a live database.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Timestamp } from "./format";

let client: NeonQueryFunction<false, false> | null = null;

function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

/** Same lazy client, for modules that build their own queries. */
export const sqlClient = db;

export type PulseStory = {
  id: number;
  one_liner: string | null;
  category: string | null;
  importance: number;
  article_count: number;
  first_seen_at: Timestamp;
  fallback_title: string;
  sources: string;
};

/** Top of the Pulse: ranked by importance, never by time. */
export async function getPulse(limit = 12): Promise<PulseStory[]> {
  const sql = db();
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
  last_seen_at: Timestamp;
  thread_id: number | null;
  thread_title: string | null;
};

export async function getStory(id: number): Promise<StoryDetail | null> {
  const sql = db();
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
  published_at: Timestamp;
  source_name: string;
  weight: number;
};

/** Every source behind one story — the forty-to-one link, expanded. */
export async function getStoryArticles(id: number): Promise<StoryArticle[]> {
  const sql = db();
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
  const sql = db();
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
  const sql = db();
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

export async function markRead(viewerId: string, storyId: number): Promise<void> {
  const sql = db();
  await sql`
    insert into read_state (viewer_id, story_id) values (${viewerId}, ${storyId})
    on conflict (viewer_id, story_id) do update set read_at = now()
  `;
}

/**
 * Catch-up: what mattered that you have not seen. Ranked by importance so a
 * week away returns the six things that counted, not four hundred unread items.
 */
export async function getCatchup(viewerId: string, limit = 10): Promise<PulseStory[]> {
  const sql = db();
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
    left join read_state r on r.story_id = st.id and r.viewer_id = ${viewerId}
    where st.importance is not null and r.story_id is null
    order by st.importance desc, st.last_seen_at desc
    limit ${limit}
  `) as PulseStory[];
}

export type EntityPage = {
  entity: Entity | null;
  stories: PulseStory[];
};

/** Everything about one company, person or model, newest first. */
export async function getEntityPage(slug: string): Promise<EntityPage> {
  const sql = db();
  const [entity] = (await sql`
    select id, name, slug, kind from entities where slug = ${slug}
  `) as Entity[];
  if (!entity) return { entity: null, stories: [] };

  const stories = (await sql`
    select st.id, st.one_liner, st.category, st.importance, st.article_count,
           st.first_seen_at,
           (select a.title from story_articles sa join articles a on a.id = sa.article_id
            where sa.story_id = st.id order by a.published_at limit 1) as fallback_title,
           '' as sources
    from story_entities se
    join stories st on st.id = se.story_id
    where se.entity_id = ${entity.id}
    order by st.first_seen_at desc
    limit 60
  `) as PulseStory[];

  return { entity, stories };
}

export type ModelRow = {
  id: number;
  name: string;
  slug: string;
  vendor: string | null;
  released_at: Timestamp;
  context: number | null;
  benchmarks: Record<string, unknown>;
  notes: string | null;
  story_id: number | null;
};

export async function getModelBoard(): Promise<ModelRow[]> {
  const sql = db();
  return (await sql`
    select id, name, slug, vendor, released_at, context, benchmarks, notes, story_id
    from models order by released_at desc nulls last, name
  `) as ModelRow[];
}

export type PipelineStats = {
  articles: number;
  stories: number;
  enriched: number;
  latest: Timestamp;
};

export async function getStats(): Promise<PipelineStats> {
  const sql = db();
  const [row] = (await sql`
    select (select count(*)::int from articles) as articles,
           (select count(*)::int from stories) as stories,
           (select count(*)::int from stories where enriched_at is not null) as enriched,
           (select max(fetched_at) from articles) as latest
  `) as PipelineStats[];
  return row;
}
