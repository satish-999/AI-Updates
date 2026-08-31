"use client";

import { useState } from "react";

type Result = { text: string; grounded: boolean; note?: string };

/**
 * Scoped agent. The corpus is this story's own sources — already stored, 5 to
 * 40 documents — so there is no retrieval step and the answer comes back fast.
 */
export function AskStory({ storyId }: { storyId: number }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/ask-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, question: q }),
      });
      setResult((await res.json()) as Result);
    } catch {
      setResult({ text: "", grounded: false, note: "Request failed. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="sec">Ask this story</h2>
      <form className="ask" onSubmit={submit}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What does this mean for…"
          aria-label="Ask about this story"
          autoComplete="off"
        />
        <button type="submit" disabled={busy}>
          {busy ? "…" : "Ask"}
        </button>
      </form>
      {result?.grounded && <div className="answer">{result.text}</div>}
      {result && !result.grounded && result.note && <div className="note">{result.note}</div>}
      <p className="hint">
        Answers use only the sources listed above, with a citation on every claim.
      </p>
    </>
  );
}
