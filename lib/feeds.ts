import { sqlClient } from "./db";
import type { Timestamp } from "./format";
import { UPDATE_CATEGORIES, type FeedKind, type FeedOptions } from "./feed-options";

export type FeedStory = {
  id: number; one_liner: string | null; category: string | null; article_count: number;
  first_seen_at: Timestamp; title: string; url: string; source_name: string; published_at: Timestamp;
};
export type FeedHealth = { active: number; delayed: number; failed: number; last_success: Timestamp; pending: number };

/** A single publisher per story. No duplicate cards and no writes during reads. */
export async function getFeed(kind: FeedKind, options: FeedOptions): Promise<FeedStory[]> {
  const sql = sqlClient();
  return await sql`
    select st.id, st.one_liner, st.category, st.article_count, st.first_seen_at,
           publisher.title, publisher.url, publisher.source_name, publisher.published_at
    from stories st
    join lateral (
      select a.title, a.url, s.name as source_name, a.published_at
      from story_articles sa join articles a on a.id = sa.article_id
      join sources s on s.id = a.source_id
      where sa.story_id = st.id and a.url ~* '^https?://'
      order by a.published_at desc nulls last, s.weight desc, a.id desc
      limit 1
    ) publisher on true
    where (case when ${kind} = 'updates'
      then st.category = any(${[...UPDATE_CATEGORIES]}::text[])
      else st.category is null or not (st.category = any(${[...UPDATE_CATEGORIES]}::text[])) end)
      and (${options.category} = 'all' or coalesce(st.category, 'unclassified') = ${options.category})
      and (${options.query} = '' or exists (
        select 1 from story_articles sa join articles a on a.id = sa.article_id
        where sa.story_id = st.id
          and a.search_full @@ websearch_to_tsquery('english', ${options.query})
      ))
    order by publisher.published_at desc nulls last, st.id desc
    limit 21 offset ${(options.page - 1) * 20}
  ` as FeedStory[];
}

export async function getFeedHealth(): Promise<FeedHealth> {
  const sql = sqlClient();
  const [row] = await sql`
    select count(*)::int as active,
      count(*) filter (where last_ok_at is null or last_ok_at < now() - interval '1 hour')::int as delayed,
      count(*) filter (where last_error is not null)::int as failed,
      max(last_ok_at) as last_success,
      (select count(*)::int from stories where enriched_at is null and importance >= 0.5) as pending
    from sources where active = true
  `;
  return row as FeedHealth;
}
