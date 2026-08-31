/**
 * The agent, in two modes.
 *
 * Scoped ("ask this story") reads only that story's sources — 5 to 40 documents
 * already in the database, so no retrieval step is needed at all. That is why
 * it is both the faster and the cheaper mode.
 *
 * Archive ("ask the archive") retrieves across everything ever ingested.
 *
 * Three rules, enforced rather than requested:
 *   1. Answer from the index, not the live web.
 *   2. Every claim carries a citation — checked after generation, not hoped for.
 *   3. "Not in the archive" is a valid answer, and is modelled explicitly so
 *      refusal is a normal outcome rather than a failure.
 */

import { generate } from "@/src/llm";
import { retrievePassages, storyPassages, type Passage } from "./search";

export type Answer = {
  text: string;
  passages: Passage[];
  grounded: boolean;
  note?: string;
};

const NOT_FOUND = "NOT_IN_ARCHIVE";

function buildPrompt(question: string, passages: Passage[]): string {
  const corpus = passages
    .map((p) => `[${p.n}] ${p.source_name} — ${p.title}\n${p.text.slice(0, 1200)}`)
    .join("\n\n");

  return `Answer the question using ONLY the numbered sources below. This is a
news archive; do not use anything you know from outside it.

Sources:
${corpus}

Question: ${question}

Rules:
- Cite every factual sentence with the bracketed number of its source, like [2].
  A sentence with no citation is a bug.
- Never invent a number, benchmark, date or quote. If the sources disagree, say so.
- If the sources do not actually answer the question, reply with exactly
  ${NOT_FOUND} and nothing else. That is a correct answer, not a failure.
- Be brief: at most six sentences. No preamble, no restating the question.`;
}

/** Split on sentence ends, keeping the punctuation. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Structural citation check. The model is asked to cite; this verifies it did,
 * because a confidently stated wrong benchmark is worse than no answer.
 * Sentences with no marker are dropped, and an answer that is mostly uncited
 * is rejected outright rather than shown.
 */
function enforceCitations(raw: string, passageCount: number): { text: string; grounded: boolean } {
  const valid = /\[(\d+)\]/g;
  const kept: string[] = [];
  let cited = 0;

  for (const s of sentences(raw)) {
    const marks = [...s.matchAll(valid)].map((m) => Number(m[1]));
    const inRange = marks.filter((n) => n >= 1 && n <= passageCount);
    if (inRange.length > 0) {
      cited++;
      kept.push(s);
    } else if (/^(however|but|the sources|sources disagree)/i.test(s)) {
      // Connective sentences carry no claim of their own; keep them.
      kept.push(s);
    }
  }

  const total = sentences(raw).length;
  if (total === 0 || cited === 0) return { text: "", grounded: false };
  // Fewer than half the sentences carrying a citation means the model drifted
  // off the sources; surfacing that is safer than surfacing the answer.
  if (cited / total < 0.5) return { text: "", grounded: false };

  return { text: kept.join(" "), grounded: true };
}

async function answer(question: string, passages: Passage[]): Promise<Answer> {
  if (passages.length === 0) {
    return {
      text: "",
      passages: [],
      grounded: false,
      note: "Nothing in the archive matches that. Try different words, or wait for the next ingest.",
    };
  }

  const raw = (await generate(buildPrompt(question, passages), { maxTokens: 700 })).trim();

  if (raw.includes(NOT_FOUND)) {
    return {
      text: "",
      passages,
      grounded: false,
      note: "The archive has related articles but none that answer this. Shown below is what was retrieved.",
    };
  }

  const checked = enforceCitations(raw, passages.length);
  if (!checked.grounded) {
    return {
      text: "",
      passages,
      grounded: false,
      note: "The answer could not be traced back to the sources, so it was withheld. The retrieved articles are below.",
    };
  }

  // Only the passages actually cited are worth showing.
  const used = new Set([...checked.text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  return {
    text: checked.text,
    passages: passages.filter((p) => used.has(p.n)),
    grounded: true,
  };
}

/** Scoped: one story's sources, no retrieval step. */
export async function askStory(storyId: number, question: string): Promise<Answer> {
  return answer(question, await storyPassages(storyId));
}

/** Global: hybrid retrieval across everything ingested. */
export async function askArchive(question: string): Promise<Answer> {
  return answer(question, await retrievePassages(question, 12));
}
