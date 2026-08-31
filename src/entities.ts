/**
 * Seed entity list — a stand-in, on purpose.
 *
 * The importance formula needs an `entity_match` term, but real entities come
 * from stage 5 enrichment, which ships a phase after ranking. Rather than
 * stall phase 2 or leave the term at zero for every story, match a hand-written
 * list against story text. When `story_entities` exists, only the lookup inside
 * entityMatch() changes — the formula itself does not.
 *
 * FOLLOWED scores 1.0, KNOWN scores 0.5, anything else 0.
 */

/** The labs and companies whose moves are always worth surfacing. */
export const FOLLOWED: string[] = [
  "openai", "chatgpt", "gpt-4", "gpt-5", "sora",
  "anthropic", "claude",
  "google deepmind", "deepmind", "gemini",
  "meta ai", "llama",
  "mistral",
  "xai", "grok",
  "nvidia",
  "hugging face", "huggingface",
  "microsoft", "copilot",
  "apple intelligence",
  "aws", "bedrock",
];

/** Recognised, but not followed closely enough to boost on their own. */
export const KNOWN: string[] = [
  "cohere", "stability ai", "perplexity", "runway", "midjourney",
  "groq", "cerebras", "together ai", "replicate", "scale ai",
  "databricks", "snowflake", "ibm", "oracle", "salesforce",
  "alibaba", "qwen", "deepseek", "baidu", "bytedance", "tencent",
  "elevenlabs", "character.ai", "inflection",
  "safe superintelligence", "thinking machines",
  "eu ai act", "openrouter", "ollama", "langchain",
];

/** Escape regex metacharacters so list entries stay literal. */
function esc(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary alternation, so "meta" does not fire inside "metadata". */
function asRegex(terms: string[]): RegExp {
  return new RegExp("\\b(" + terms.map(esc).join("|") + ")\\b", "i");
}

const FOLLOWED_RE = asRegex(FOLLOWED);
const KNOWN_RE = asRegex(KNOWN);

/** 1.0 followed, 0.5 known, 0 unknown. */
export function entityMatch(text: string): number {
  if (FOLLOWED_RE.test(text)) return 1.0;
  if (KNOWN_RE.test(text)) return 0.5;
  return 0;
}
