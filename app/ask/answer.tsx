"use client";
import { useState } from "react";
import type { Answer } from "@/lib/agent";
import { safeArticleUrl } from "@/lib/feed-policy";
export function ArchiveAnswer({ question }: { question: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function ask() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }), signal: AbortSignal.timeout(55000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setAnswer(body);
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section><button disabled={busy} onClick={ask}>{busy ? "Checking the archive…" : "Generate a cited answer"}</button><p className="hint">Uses one AI request from your daily allowance. Search itself does not use AI.</p>{error && <p role="alert">{error}</p>}{answer && <><p>{answer.note}</p>{answer.grounded && <div className="answer">{answer.text.split(/(\[\d+\])/g).map((part, i) => /^\[\d+\]$/.test(part) ? <a key={i} href={"#ai-source-" + part.slice(1,-1)}>{part}</a> : <span key={i}>{part}</span>)}</div>}<ol>{answer.passages.map((p,i) => <li key={i} id={"ai-source-" + p.n}>{safeArticleUrl(p.url) ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a> : p.title}</li>)}</ol></>}</section>;
}
