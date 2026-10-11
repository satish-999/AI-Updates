import { sqlClient } from "./db";
import { UPDATE_CATEGORIES, safeArticleUrl } from "./feed-policy";
import type { Timestamp } from "./format";
export type FeedStory = {
  id: string; title: string; category: string | null; first_seen_at: Timestamp;
  article_count: number; importance: number | null; source_name: string;
  source_url: string | null; source_date: Timestamp;
};
export async function getFeed(kind: "updates" | "news", q: string, sort: "latest" | "importance", page: number) {
  const sql = sqlClient();
  // One event per row; prefer the highest-weight publisher, then earliest article.
  const rows = await sql`
    select st.id::text, coalesce(st.one_liner, primary_article.title) as title,
      st.category, st.first_seen_at, st.article_count, st.importance,
      primary_article.url as source_url, primary_article.source_name,
      primary_article.published_at as source_date
    from stories st
    join lateral (
      select a.title, a.url, a.published_at, s.name as source_name
      from story_articles sa join articles a on a.id = sa.article_id
      join sources s on s.id = a.source_id where sa.story_id = st.id
      order by s.weight desc, a.published_at asc, a.id asc limit 1
    ) primary_article on true
    where (
      (${kind} = 'updates' and st.category = any(${UPDATE_CATEGORIES}::text[])) or
      (${kind} = 'news' and (st.category is null or not(st.category = any(${UPDATE_CATEGORIES}::text[]))))
    ) and (${q} = '' or st.search_tsv @@ websearch_to_tsquery('english', ${q}) or exists (
      select 1 from story_articles sa join articles a on a.id = sa.article_id
      where sa.story_id = st.id and a.search_full @@ websearch_to_tsquery('english', ${q})
    ))
    order by case when ${sort} = 'importance' then st.importance end desc nulls last,
      st.first_seen_at desc, st.id desc
    limit 21 offset ${(page - 1) * 20}
  ` as FeedStory[];
  return { stories: rows.slice(0, 20).map(row => ({ ...row, source_url: safeArticleUrl(row.source_url) })), hasMore: rows.length > 20 };
}
export async function getFeedHealth() {
  const sql = sqlClient();
  const [row] = await sql`select max(last_ok_at) as latest,
    count(*) filter (where last_error is not null)::int as failing,
    count(*) filter (where last_ok_at is null or last_ok_at < now() - interval '1 hour')::int as stale,
    count(*)::int as total from sources where active = true`;
  return row as { latest: string | Date | null; failing: number; stale: number; total: number };
}
