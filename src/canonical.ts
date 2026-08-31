/**
 * Entity canonicalisation.
 *
 * The model returns whatever name appeared in the text, so one thing arrives
 * under many labels: "QWEN", "Qwen 3.8 27B" and "Qwen3.8-27B-FP8" were three
 * separate entities for one model family, and "Altman" and "Elon" arrived as
 * bare surnames. Entity pages key on identity, so this has to be fixed before
 * those pages are worth building.
 *
 * Two passes: an explicit alias table for things worth pinning, then generic
 * normalisation for everything else.
 */

export type Canonical = { name: string; kind: "company" | "person" | "model" };

/** Variant (lowercased) -> canonical entity. */
const ALIASES: Record<string, Canonical> = {};

function alias(canonical: Canonical, variants: string[]) {
  ALIASES[canonical.name.toLowerCase()] = canonical;
  for (const v of variants) ALIASES[v.toLowerCase()] = canonical;
}

// ---- companies ----
alias({ name: "OpenAI", kind: "company" }, ["open ai", "openai inc"]);
alias({ name: "Anthropic", kind: "company" }, ["anthropic pbc"]);
alias({ name: "Google DeepMind", kind: "company" }, ["deepmind", "gdm", "google ai", "google"]);
alias({ name: "Meta", kind: "company" }, ["meta ai", "meta platforms", "facebook"]);
alias({ name: "Microsoft", kind: "company" }, ["msft"]);
alias({ name: "Nvidia", kind: "company" }, ["nvidia corporation"]);
alias({ name: "Hugging Face", kind: "company" }, ["huggingface", "hf"]);
alias({ name: "Mistral AI", kind: "company" }, ["mistral"]);
alias({ name: "xAI", kind: "company" }, ["x.ai"]);
alias({ name: "Alibaba", kind: "company" }, ["alibaba cloud", "alibaba group"]);
alias({ name: "DeepSeek", kind: "company" }, ["deep seek"]);
alias({ name: "Tencent", kind: "company" }, []);
alias({ name: "Amazon", kind: "company" }, ["aws", "amazon web services"]);
alias({ name: "Apple", kind: "company" }, ["apple inc"]);
alias({ name: "Cursor", kind: "company" }, ["anysphere"]);

// ---- people: bare surnames are the common failure ----
alias({ name: "Sam Altman", kind: "person" }, ["altman", "sam altman"]);
alias({ name: "Elon Musk", kind: "person" }, ["elon", "musk"]);
alias({ name: "Dario Amodei", kind: "person" }, ["amodei"]);
alias({ name: "Demis Hassabis", kind: "person" }, ["hassabis"]);
alias({ name: "Jensen Huang", kind: "person" }, ["huang"]);
alias({ name: "Yann LeCun", kind: "person" }, ["lecun"]);
alias({ name: "Mark Zuckerberg", kind: "person" }, ["zuckerberg"]);

// ---- model families: collapse every size/quantisation variant ----
alias({ name: "Qwen", kind: "model" }, ["qwen3", "qwen 3", "qwen2", "qwen 2"]);
alias({ name: "Claude", kind: "model" }, ["claude 3", "claude 4", "claude sonnet", "claude opus"]);
alias({ name: "GPT", kind: "model" }, ["gpt-4", "gpt-5", "gpt4", "gpt5", "chatgpt"]);
alias({ name: "Gemini", kind: "model" }, ["gemini pro", "gemini flash"]);
alias({ name: "Llama", kind: "model" }, ["llama 3", "llama 4", "llama3", "llama4"]);

/**
 * Things the model keeps classifying as "model" that are not models. Wrong
 * kind is worse than no kind: it puts a programming language on the Model
 * Board next to frontier releases.
 */
const NOT_MODELS = new Set([
  "ocaml", "python", "rust", "javascript", "typescript", "c++", "go", "java",
  "linux", "kubernetes", "docker", "pytorch", "tensorflow", "cuda", "onnx",
  "github", "vscode", "vim", "emacs",
]);

/** Strip size, quantisation and version noise: "Qwen3.8-27B-FP8" -> "Qwen". */
function stripVariantSuffix(name: string): string {
  return name
    .replace(/[-_\s]*\b\d+(\.\d+)?\s*[bB]\b/g, "")           // 27B, 1.5 B
    .replace(/[-_\s]*\b(fp|nvfp|int|q)\d+\b/gi, "")          // FP8, INT4, Q4
    .replace(/[-_\s]*\b(instruct|chat|base|preview|it|flash|lite|next|turbo)\b/gi, "")
    .replace(/[-_\s]*\d+(\.\d+)+/g, "")                       // 3.8, 2.5.1
    .replace(/[-_\s]+$/g, "")
    .trim();
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Resolve a raw model-supplied entity to a canonical name and kind.
 * Returns null for anything too short or too generic to be an entity.
 */
export function canonicalise(rawName: string, rawKind: string): Canonical | null {
  const trimmed = String(rawName ?? "").trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 60) return null;

  const lower = trimmed.toLowerCase();

  // Explicit alias wins outright.
  if (ALIASES[lower]) return ALIASES[lower];

  let kind: Canonical["kind"] =
    rawKind === "person" || rawKind === "model" || rawKind === "company"
      ? rawKind
      : "company";

  if (NOT_MODELS.has(lower)) return null;

  if (kind === "model") {
    const stripped = stripVariantSuffix(trimmed);
    const strippedLower = stripped.toLowerCase();
    if (ALIASES[strippedLower]) return ALIASES[strippedLower];
    if (stripped.length >= 2) return { name: stripped, kind };
  }

  // A single lowercase word is almost always a fragment, not an entity.
  if (!/[A-Z]/.test(trimmed) && !trimmed.includes(" ")) return null;

  return { name: trimmed, kind };
}

/** Every label that should resolve to this entity, for the aliases column. */
export function aliasesFor(canonical: Canonical): string[] {
  const out = new Set<string>();
  for (const [variant, target] of Object.entries(ALIASES)) {
    if (target.name === canonical.name) out.add(variant);
  }
  return [...out];
}
