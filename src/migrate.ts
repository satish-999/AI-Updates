/**
 * Applies db/*.sql in filename order.
 *
 * Every migration is written to be idempotent (`if not exists`, guarded
 * `alter`), so re-running is a no-op rather than an error. That is cheaper to
 * maintain than a migrations table for a single-user project.
 *
 *   npm run migrate
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "@neondatabase/serverless";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

// Pool exposes raw .query(); the tagged-template neon() client does not,
// and migrations are plain SQL strings rather than parameterised queries.
const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * Split on semicolons that end a statement, while ignoring those inside
 * dollar-quoted blocks ($$ ... $$) — a `do $$ ... $$` body contains its own
 * semicolons and must not be cut apart.
 */
function statements(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inDollar = false;

  for (const line of text.split(/\r?\n/)) {
    const stripped = line.replace(/--.*$/, "");
    const dollars = (stripped.match(/\$\$/g) ?? []).length;
    if (dollars % 2 === 1) inDollar = !inDollar;

    buf += line + "\n";
    if (!inDollar && /;\s*$/.test(stripped)) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((s) => s.replace(/--.*$/gm, "").trim().length > 0);
}

async function main() {
  const dir = path.join(root, "db");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const stmts = statements(text);
    process.stdout.write(`${file}  ${stmts.length} statements  `);

    for (const stmt of stmts) {
      try {
        await pool.query(stmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`\n  FAILED: ${msg}`);
        console.log(`  in: ${stmt.slice(0, 200)}`);
        process.exit(1);
      }
    }
    console.log("ok");
  }
  console.log("\nschema up to date");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
