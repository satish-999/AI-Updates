/**
 * The only place in this codebase that talks to a language model.
 *
 * PLAN.md's wrapper rule: provider selection, retry and fallback live here and
 * nowhere else, and no provider SDK is imported anywhere else. Free tiers
 * change their terms and rate limits without notice, so swapping providers
 * must stay a one-file edit rather than a refactor.
 *
 * Exposes exactly one function:
 *
 *   generate(prompt, opts?) => Promise<string>
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

/**
 * Hard ceiling on calls per UTC day.
 *
 * This exists for one specific failure: a clustering regression that stops
 * merging would produce hundreds of single-article stories, each looking novel
 * and important, and would drain the day's quota overnight. The fuse turns
 * that incident into a log line.
 *
 * Raised from 60 once the app was shared with a team: enrichment uses ~15 a
 * day, and every question someone asks costs one more. The cap still has to
 * sit under the provider's own free-tier limit to be worth anything.
 */
const DAILY_CAP = Number(process.env.LLM_DAILY_CAP ?? 200);

/**
 * gemini-3.5-flash-lite measured at ~950ms against 13s for flash and 124s for
 * gemini-3.6-flash. Enrichment is extraction, not reasoning, so the lite model
 * is the right trade — and the speed keeps stage 5 inside the CI job timeout.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export type GenerateOptions = {
  /** Ask the provider for a JSON object rather than prose. */
  json?: boolean;
  maxTokens?: number;
  /** Skip the daily fuse. Only for interactive one-offs, never the pipeline. */
  uncapped?: boolean;
};

export class QuotaExhausted extends Error {
  constructor(used: number, cap: number) {
    super(`daily LLM cap reached (${used}/${cap})`);
    this.name = "QuotaExhausted";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Counts a call against today's budget and returns false when the fuse blows. */
async function reserve(provider: string): Promise<boolean> {
  if (!sql) return true;
  const [row] = (await sql`
    insert into llm_calls (day, provider, calls)
    values (current_date, ${provider}, 1)
    on conflict (day, provider) do update set calls = llm_calls.calls + 1
    returning calls
  `) as { calls: number }[];

  const [{ total }] = (await sql`
    select coalesce(sum(calls), 0)::int as total from llm_calls where day = current_date
  `) as { total: number }[];

  if (total > DAILY_CAP) {
    throw new QuotaExhausted(total, DAILY_CAP);
  }
  return row.calls > 0;
}

async function callGemini(prompt: string, opts: GenerateOptions): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  // Key travels as a header, not a query parameter, so it never lands in a
  // URL that could be logged by a proxy or captured in an error trace.
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`gemini ${res.status}: ${body.slice(0, 200)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("gemini returned no text");
  return text;
}

async function callGroq(prompt: string, opts: GenerateOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`groq ${res.status}: ${body.slice(0, 200)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("groq returned no text");
  return text;
}

/**
 * Generate text. Tries Gemini, falls back to Groq, retries transient failures
 * once with backoff. Throws on exhaustion so the caller leaves its marker
 * column null and the next cycle retries — the same resumability every other
 * pipeline stage has.
 */
export async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const providers: [string, (p: string, o: GenerateOptions) => Promise<string>][] = [];
  if (process.env.GEMINI_API_KEY) providers.push(["gemini", callGemini]);
  if (process.env.GROQ_API_KEY) providers.push(["groq", callGroq]);
  if (providers.length === 0) throw new Error("no LLM provider configured");

  let lastError: unknown;

  for (const [name, call] of providers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (!opts.uncapped) await reserve(name);
        return await call(prompt, opts);
      } catch (err) {
        if (err instanceof QuotaExhausted) throw err;
        lastError = err;
        const status = (err as Error & { status?: number }).status ?? 0;
        // Only a transient failure is worth a second attempt on the same
        // provider; a 400 will fail identically however many times we ask.
        if (attempt === 0 && isTransient(status)) {
          await sleep(2_000 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Parse a JSON reply, tolerating the ```json fences models sometimes add. */
export function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as T;
}
