/**
 * Stage 5 — enrich.
 *
 * One LLM call per qualifying story, returning one JSON object with the
 * one-liner, category and entities. One call rather than three is a quota
 * decision, not a latency one: free tiers meter requests per minute at least
 * as tightly as tokens, and three round trips per story turns twelve stories
 * into thirty-six requests for no extra information.
 *
 * Only stories above the importance threshold qualify — roughly ten to fifteen
 * a day, not four hundred.
 *
 * Finds its work with `enriched_at is null and importance >= threshold`. On
 * failure the marker stays null and the next cycle retries, the same
 * resumability every other stage has.
 *
 *   npm run enrich
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { generate, parseJson, QuotaExhausted } from "./llm.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = neon(DATABASE_URL);

const MIN_IMPORTANCE = Number(process.env.ENRICH_MIN_IMPORTANCE ?? 0.5);
const MAX_PER_RUN = Number(process.env.ENRICH_MAX_PER_RUN ?? 15);

const CATEGORIES = [
  "model_release",
  "funding",
  "people",
  "research",
  "policy",
  "product",
  "business",
] as const;

type Enrichment = {
  one_liner: string;
  category: string;
  entities: { name: string; kind: string }[];
  thread_hint?: string;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildPrompt(titles: string[], summaries: string[]): string {
  const sources = titles
    .map((t, i) => `- ${t}${summaries[i] ? `\n  ${summaries[i].slice(0, 300)}` : ""}`)
    .join("\n");

  return `You are summarising ONE news event that several outlets covered.

Sources:
${sources}

Return a single JSON object, no prose, with exactly these keys:

{
  "one_liner": "what happened, max 18 words, factual, no hype, no trailing period",
  "category": one of ${JSON.stringify(CATEGORIES)},
  "entities": [{"name": "Anthropic", "kind": "company|person|model"}],
  "thread_hint": "short name for the ongoing storyline, e.g. Anthropic model releases"
}

Rules:
- The one_liner states the event, not that outlets reported it.
- Name only entities that genuinely appear; do not guess. Prefer canonical
  names ("Google DeepMind", not "GDM"). At most 5 entities.
- If the sources disagree, describe what is common to them.`;
}

async function upsertEntities(
  storyId: number,
  entities: { name: string; kind: string }[]
): Promise<void> {
  for (const e of entities.slice(0, 5)) {
    const name = String(e.name ?? "").trim();
    if (!name) continue;
    const kind = ["company", "person", "model"].includes(e.kind) ? e.kind : "company";
    const slug = slugify(name);
    if (!slug) continue;

    const [row] = (await sql`
      insert into entities (name, slug, kind) values (${name}, ${slug}, ${kind})
      on conflict (slug) do update set name = excluded.name
      returning id
    `) as { id: number }[];

    await sql`
      insert into story_entities (story_id, entity_id) values (${storyId}, ${row.id})
      on conflict do nothing
    `;
  }
}

/** Threads are keyed on (primary entity, category) — a stable narrative key
 *  that needs no clustering of clusters. */
async function attachThread(
  storyId: number,
  category: string,
  hint: string | undefined,
  entities: { name: string; kind: string }[]
): Promise<void> {
  const primary = entities.find((e) => e.kind === "company") ?? entities[0];
  if (!primary?.name) return;

  const [ent] = (await sql`
    select id from entities where slug = ${slugify(primary.name)}
  `) as { id: number }[];
  if (!ent) return;

  const title = hint?.trim() || `${primary.name} ${category.replace(/_/g, " ")}`;

  const [thread] = (await sql`
    insert into threads (entity_id, category, title)
    values (${ent.id}, ${category}, ${title})
    on conflict (entity_id, category) do update set title = threads.title
    returning id
  `) as { id: number }[];

  await sql`update stories set thread_id = ${thread.id} where id = ${storyId}`;
}

async function main() {
  const started = Date.now();

  const stories = (await sql`
    select st.id, st.importance, st.article_count
    from stories st
    where st.enriched_at is null
      and st.importance is not null
      and st.importance >= ${MIN_IMPORTANCE}
    order by st.importance desc
    limit ${MAX_PER_RUN}
  `) as { id: number; importance: number; article_count: number }[];

  if (stories.length === 0) {
    console.log(`nothing above importance ${MIN_IMPORTANCE} awaiting enrichment`);
    return;
  }

  console.log(`enriching ${stories.length} stories (importance >= ${MIN_IMPORTANCE})\n`);

  let ok = 0;
  let failed = 0;

  for (const story of stories) {
    const articles = (await sql`
      select a.title, a.summary
      from story_articles sa join articles a on a.id = sa.article_id
      where sa.story_id = ${story.id}
      order by a.published_at
      limit 12
    `) as { title: string; summary: string | null }[];

    if (articles.length === 0) continue;

    try {
      const raw = await generate(
        buildPrompt(articles.map((a) => a.title), articles.map((a) => a.summary ?? "")),
        { json: true, maxTokens: 500 }
      );
      const parsed = parseJson<Enrichment>(raw);

      const oneLiner = String(parsed.one_liner ?? "").trim().slice(0, 200);
      const category = CATEGORIES.includes(parsed.category as (typeof CATEGORIES)[number])
        ? parsed.category
        : "product";
      const entities = Array.isArray(parsed.entities) ? parsed.entities : [];

      if (!oneLiner) throw new Error("empty one_liner");

      await sql`
        update stories
        set one_liner = ${oneLiner}, category = ${category}, enriched_at = now()
        where id = ${story.id}
      `;
      await upsertEntities(story.id, entities);
      await attachThread(story.id, category, parsed.thread_hint, entities);

      ok++;
      console.log(
        `  ${story.importance.toFixed(3)} ${String(story.article_count).padStart(2)}src ` +
          `[${category}] ${oneLiner.slice(0, 68)}`
      );
    } catch (err) {
      if (err instanceof QuotaExhausted) {
        console.log(`\n  ${err.message} — stopping, ${stories.length - ok - failed} deferred`);
        break;
      }
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  FAIL story ${story.id} — ${msg.slice(0, 110)}`);
    }
  }

  const [{ used }] = (await sql`
    select coalesce(sum(calls), 0)::int as used from llm_calls where day = current_date
  `) as { used: number }[];

  console.log(
    `\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      `${ok} enriched, ${failed} failed, ${used} LLM calls used today`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
