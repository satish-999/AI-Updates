/** Materialize model entities from enriched release stories without extra LLM calls. */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const rows = await sql`
    insert into models(name, slug, notes, story_id, observed_at, source_url)
    select distinct on (e.slug) e.name, e.slug, st.one_liner, st.id, st.first_seen_at, source.url
    from entities e join story_entities se on se.entity_id = e.id
    join stories st on st.id = se.story_id
    join lateral (
      select a.url from story_articles sa join articles a on a.id = sa.article_id
      join sources src on src.id = a.source_id where sa.story_id = st.id
      order by src.weight desc, a.published_at limit 1
    ) source on true
    where e.kind = 'model' and st.category = 'model_release' and st.enriched_at is not null
    order by e.slug, st.first_seen_at desc, st.id desc
    on conflict(slug) do update set notes = excluded.notes, story_id = excluded.story_id,
      observed_at = excluded.observed_at, source_url = excluded.source_url
    where models.observed_at is null or models.observed_at < excluded.observed_at
    returning id`;
  console.log("Updated " + rows.length + " model observations.");
}
main().catch(() => { console.error("Model observations failed; the next run will retry."); process.exitCode = 1; });
