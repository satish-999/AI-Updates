/**
 * Pipeline status. Read-only.
 *
 * Reports what exists, what is backlogged, and which sources are failing.
 * The backlog numbers are the same predicates the pipeline stages use to
 * find their work, so this is the fastest way to see where a run stopped.
 *
 * Run:  npm run status
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = neon(DATABASE_URL);

async function tableExists(name: string): Promise<boolean> {
  const rows = (await sql`
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = ${name}
  `) as unknown[];
  return rows.length > 0;
}

async function main() {
  const [{ v }] = (await sql`select version() as v`) as { v: string }[];
  console.log(`\n${v.split(",")[0]}`);

  const wanted = ["sources", "articles", "stories", "story_articles"];
  const present: string[] = [];
  for (const t of wanted) if (await tableExists(t)) present.push(t);

  console.log(`tables       ${present.join(", ") || "(none — schema not applied)"}`);

  if (!present.includes("sources")) {
    console.log("\nRun db/001_phase0.sql in the Neon SQL Editor first.\n");
    return;
  }

  const [{ total, active, failing }] = (await sql`
    select count(*)::int as total,
           count(*) filter (where active)::int as active,
           count(*) filter (where last_error is not null)::int as failing
    from sources
  `) as { total: number; active: number; failing: number }[];
  console.log(`sources      ${total} total, ${active} active, ${failing} with errors`);

  if (!present.includes("articles")) return;

  const [a] = (await sql`
    select count(*)::int as total,
           count(*) filter (where fetched_at > now() - interval '24 hours')::int as day,
           count(*) filter (where embedding is null)::int as unembedded,
           min(published_at) as oldest,
           max(published_at) as newest
    from articles
  `) as {
    total: number; day: number; unembedded: number;
    oldest: string | null; newest: string | null;
  }[];

  // The driver hands back Date objects; String() on one gives "Fri Dec 11 …",
  // so go through toISOString rather than slicing the display form.
  const day = (v: string | null) =>
    v ? new Date(v).toISOString().slice(0, 10) : "—";

  console.log(`articles     ${a.total} total, ${a.day} in last 24h`);
  if (a.total > 0) {
    console.log(`             published ${day(a.oldest)} → ${day(a.newest)}`);
    console.log(`backlog      ${a.unembedded} awaiting embedding (stage 2)`);
  }

  const bySource = (await sql`
    select s.name, count(a.id)::int as n
    from sources s left join articles a on a.source_id = s.id
    where s.active
    group by s.name
    order by n desc, s.name
  `) as { name: string; n: number }[];

  if (a.total > 0) {
    console.log(`\narticles by source`);
    for (const r of bySource) {
      console.log(`  ${String(r.n).padStart(5)}  ${r.name}`);
    }
  }

  const broken = (await sql`
    select name, last_error from sources
    where last_error is not null and active
    order by name
  `) as { name: string; last_error: string }[];

  if (broken.length) {
    console.log(`\nfailing sources`);
    for (const r of broken) {
      console.log(`  ${r.name} — ${r.last_error.slice(0, 90)}`);
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
