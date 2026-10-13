"use client";
import { useState } from "react";
import type { Answer } from "@/lib/agent";
import { externalUrl } from "@/lib/links";
export function AskForm() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  return <><form className="ask" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setAnswer(null);
    const question = new FormData(e.currentTarget).get("question");
    try { const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }); const data = await response.json(); setAnswer({ text: data.text ?? "", grounded: data.grounded ?? false, passages: data.passages ?? [], note: data.note ?? data.error }); } catch { setAnswer({ text: "", grounded: false, passages: [], note: "Connection failed. Please try again." }); } finally { setBusy(false); }
  }}><input name="question" required maxLength={1200} aria-label="Your question" placeholder="Ask about the AI news archive…" /><button disabled={busy}>{busy ? "Asking…" : "Ask"}</button></form><p className="small-copy">10 questions per account per UTC day, shared with story questions. Failed attempts also count. Answers use stored sources.</p>
  <section aria-live="polite">{answer?.text && <p className="answer">{answer.text.split(/(\[\d+\])/).map((part,i) => { const match = part.match(/^\[(\d+)\]$/); return match ? <a key={i} href={`#source-${match[1]}`}>{part}</a> : <span key={i}>{part}</span>; })}</p>}{answer?.note && <p className="note">{answer.note}</p>}{answer?.passages.map(p => <p id={`source-${p.n}`} key={p.n}>{externalUrl(p.url) ? <a href={externalUrl(p.url)!} target="_blank" rel="noopener noreferrer">[{p.n}] {p.title}</a> : p.title}</p>)}</section></>;
}
