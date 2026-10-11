/** Resumable, no-LLM monitor pass. Re-scan seven days so delayed indexing is
 * picked up. The unique hit key makes retries safe. Hits and checkpoint commit
 * in one statement; a failure leaves the monitor due for the next cycle. */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const due = await sql`select id from saved_questions where active and viewer_id is not null
    and slot <= case when exists(select 1 from billing_accounts b where b.owner_id::text = saved_questions.viewer_id and b.paid_until > now()) then 20 else 3 end
    and (last_run_at is null or last_run_at < now() - interval '14 minutes')
    order by last_run_at asc nulls first, id limit 100`;
  for (const { id } of due) {
    await sql`
      with target as (
        select id, websearch_to_tsquery('english', question) as query
        from saved_questions where id = ${id} and active
          and slot <= case when exists(select 1 from billing_accounts b where b.owner_id::text = saved_questions.viewer_id and b.paid_until > now()) then 20 else 3 end for update
      ), inserted as (
        insert into saved_question_hits (question_id, story_id)
        select q.id, s.id from target q cross join stories s
        where s.last_seen_at >= now() - interval '7 days' and (
          s.search_tsv @@ q.query or exists (
            select 1 from story_articles sa join articles a on a.id = sa.article_id
            where sa.story_id = s.id and a.search_full @@ q.query
          )
        ) on conflict do nothing returning found_at
      )
      update saved_questions set last_run_at = now(),
        hits = hits + (select count(*)::int from inserted),
        last_hit_at = coalesce((select max(found_at) from inserted), last_hit_at)
      where id in (select id from target)
    `;
  }
  console.log(`Checked ${due.length} monitors without LLM calls`);
}

main().catch(() => { console.error("Monitor stage failed; unfinished checks will retry next cycle."); process.exitCode = 1; });
