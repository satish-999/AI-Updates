/**
 * Stage 2 — embed.
 *
 * Turns articles into 384-dimension vectors with all-MiniLM-L6-v2, running on
 * local CPU. No API, no key, no quota: this is why clustering and semantic
 * search stay free regardless of how much volume the feeds produce.
 *
 * Finds its work with `embedding is null` and marks done by writing the
 * column, so a crash mid-batch costs only that batch.
 *
 *   npm run embed
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { pipeline, env } from "@xenova/transformers";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = neon(DATABASE_URL);

// Keep the model next to the project so CI can cache one predictable path.
env.cacheDir = path.join(root, ".models");
env.allowLocalModels = true;

const MODEL = "Xenova/all-MiniLM-L6-v2";
const BATCH = 64;
const DEADLINE_MS = Number(process.env.EMBED_DEADLINE_MS ?? 8 * 60_000);

/**
 * Clustering compares events, not documents. Title plus the opening of the
 * summary is what identifies "which event is this" — full bodies drag in
 * boilerplate and outlet voice, which pushes coverage of the same event
 * further apart rather than closer together.
 */
function embedText(a: { title: string; summary: string | null }): string {
  const words = (a.summary ?? "").split(/\s+/).slice(0, 200).join(" ");
  return `${a.title}\n\n${words}`.trim();
}

async function main() {
  const started = Date.now();

  const [{ todo }] = (await sql`
    select count(*)::int as todo from articles where embedding is null
  `) as { todo: number }[];

  if (todo === 0) {
    console.log("nothing to embed");
    return;
  }
  console.log(`${todo} articles to embed`);

  process.stdout.write("loading model… ");
  const extractor = await pipeline("feature-extraction", MODEL, { quantized: true });
  console.log(`ready in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  let done = 0;

  for (;;) {
    if (Date.now() - started > DEADLINE_MS) {
      console.log(`\ndeadline reached — ${todo - done} left for the next run`);
      break;
    }

    const rows = (await sql`
      select id, title, summary from articles
      where embedding is null
      order by published_at desc nulls last, id
      limit ${BATCH}
    `) as { id: number; title: string; summary: string | null }[];

    if (rows.length === 0) break;

    // normalize:true gives unit vectors, so pgvector cosine distance and a
    // plain dot product agree — and centroid averaging stays well behaved.
    const out = await extractor(rows.map(embedText), {
      pooling: "mean",
      normalize: true,
    });

    const dims = out.dims[out.dims.length - 1] as number;
    if (dims !== 384) throw new Error(`expected 384 dims, model returned ${dims}`);

    const data = out.data as Float32Array;
    const vectors = rows.map((_, i) =>
      `[${Array.from(data.slice(i * dims, (i + 1) * dims)).join(",")}]`
    );

    // One statement per batch. Per-row updates over the HTTP driver are what
    // made ingest miss its workflow timeout; same trap, same fix.
    await sql`
      update articles a
      set embedding = v.emb::vector
      from unnest(${rows.map((r) => r.id)}::bigint[], ${vectors}::text[]) as v(id, emb)
      where a.id = v.id
    `;

    done += rows.length;
    const rate = done / ((Date.now() - started) / 1000);
    process.stdout.write(
      `\r  ${done}/${todo}  ${rate.toFixed(0)}/s  eta ${Math.round((todo - done) / rate)}s   `
    );
  }

  console.log(`\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s — ${done} embedded`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
