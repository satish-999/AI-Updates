/**
 * Maintenance pass. Idempotent, safe to re-run.
 *
 *  1. Merges duplicate entities onto their canonical name, moving story links
 *     across and deleting the orphans.
 *  2. Drops entities that canonicalisation now rejects (bare surnames,
 *     programming languages mislabelled as models).
 *  3. Refreshes stories.search_tsv so Ask and search can rank whole events.
 *
 *   npm run tidy
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { canonicalise, aliasesFor, slugify } from "./canonical.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = neon(DATABASE_URL);

async function mergeEntities() {
  const rows = (await sql`
    select id, name, slug, kind from entities order by id
  `) as { id: number; name: string; slug: string; kind: string }[];

  let merged = 0;
  let dropped = 0;

  for (const e of rows) {
    const canon = canonicalise(e.name, e.kind);

    if (!canon) {
      await sql`delete from entities where id = ${e.id}`;
      dropped++;
      console.log(`  drop   ${e.name} (${e.kind})`);
      continue;
    }

    const targetSlug = slugify(canon.name);
    if (targetSlug === e.slug && canon.kind === e.kind) continue;

    // Claim the canonical row, creating it if this is the first variant seen.
    const [target] = (await sql`
      insert into entities (name, slug, kind, aliases)
      values (${canon.name}, ${targetSlug}, ${canon.kind}, ${aliasesFor(canon)}::text[])
      on conflict (slug) do update set name = excluded.name, kind = excluded.kind
      returning id
    `) as { id: number }[];

    if (target.id === e.id) continue;

    await sql`
      insert into story_entities (story_id, entity_id)
      select story_id, ${target.id} from story_entities where entity_id = ${e.id}
      on conflict do nothing
    `;
    // threads.entity_id points at the old row; move it before deleting, and
    // skip any move that would collide with the unique (entity_id, category).
    await sql`
      update threads t set entity_id = ${target.id}
      where t.entity_id = ${e.id}
        and not exists (
          select 1 from threads x
          where x.entity_id = ${target.id} and x.category = t.category
        )
    `;
    await sql`delete from threads where entity_id = ${e.id}`;
    await sql`delete from entities where id = ${e.id}`;

    merged++;
    console.log(`  merge  ${e.name} -> ${canon.name}`);
  }

  console.log(`\n${merged} merged, ${dropped} dropped`);
}

async function refreshStorySearch() {
  // Built from the story's own text plus its members', so a search for a
  // detail buried in one article still surfaces the whole event.
  const res = (await sql`
    update stories st set search_tsv = to_tsvector('english',
      coalesce(st.one_liner, '') || ' ' || coalesce(st.category, '') || ' ' ||
      coalesce((
        select string_agg(a.title || ' ' || coalesce(a.summary, ''), ' ')
        from story_articles sa join articles a on a.id = sa.article_id
        where sa.story_id = st.id
      ), ''))
    where st.search_tsv is null or st.last_seen_at > now() - interval '7 days'
    returning st.id
  `) as unknown[];
  console.log(`refreshed search text on ${res.length} stories`);
}

async function main() {
  console.log("merging entities…");
  await mergeEntities();
  console.log("\nrefreshing story search text…");
  await refreshStorySearch();

  const [{ e, t }] = (await sql`
    select (select count(*)::int from entities) as e,
           (select count(*)::int from threads) as t
  `) as { e: number; t: number }[];
  console.log(`\n${e} entities, ${t} threads`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
