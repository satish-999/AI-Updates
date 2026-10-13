/** Additive account migration only. No credentials or SQL errors are printed. */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Database is not configured");
  const sql = neon(url);
  const text = readFileSync(new URL("../db/007_customer_accounts.sql", import.meta.url), "utf8");
  for (const statement of text.replace(/--[^\n]*/g, "").split(";").map(s => s.trim()).filter(Boolean)) await sql(statement);
  console.log("Customer account schema is ready.");
}
main().catch(() => { console.error("Customer account schema setup failed. Check database connectivity and permissions."); process.exitCode = 1; });
