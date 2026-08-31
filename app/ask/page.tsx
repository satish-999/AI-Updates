import Link from "next/link";
import { Nav } from "../nav";
import { askArchive } from "@/lib/agent";
import { searchStories } from "@/lib/search";
import type { Passage } from "@/lib/search";
import { mmdd, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Turn [n] markers into links down to the numbered source list. */
function withCitations(text: string) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return <span key={i}>{part}</span>;
    return (
      <sup key={i}>
        <a href={`#src-${m[1]}`}>[{m[1]}]</a>
      </sup>
    );
  });
}

function Sources({ passages }: { passages: Passage[] }) {
  if (passages.length === 0) return null;
  return (
    <>
      <h2 className="sec">Sources</h2>
      <ul className="sources">
        {passages.map((p) => (
          <li key={p.n} id={`src-${p.n}`}>
            <div className="src-name">
              [{p.n}] {p.source_name}
              {p.published_at ? ` · ${ymd(p.published_at)}` : ""}
            </div>
            <a className="src-title" href={p.url} target="_blank" rel="noopener noreferrer">
              {p.title}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function Ask({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const question = (q ?? "").trim();

  const answer = question ? await askArchive(question) : null;
  const related = question ? await searchStories(question, 8) : [];

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand">AI Pulse</Link>
      </header>
      <Nav />

      <form className="ask" method="GET">
        <input
          name="q"
          defaultValue={question}
          placeholder="Ask the archive…"
          aria-label="Ask the archive"
          autoComplete="off"
        />
        <button type="submit">Ask</button>
      </form>

      {!question && (
        <p className="hint">
          Answers come from stored articles only, never the live web — retrieval is
          sub-second where browsing would take twenty. Every sentence carries a
          citation, and &ldquo;not in the archive&rdquo; is a real answer rather than a
          failure.
        </p>
      )}

      {answer?.grounded && (
        <div className="answer">{withCitations(answer.text)}</div>
      )}

      {answer && !answer.grounded && answer.note && (
        <div className="note">{answer.note}</div>
      )}

      {answer && <Sources passages={answer.passages} />}

      {related.length > 0 && (
        <>
          <h2 className="sec">Matching stories</h2>
          <ol className="pulse">
            {related.map((s) => (
              <li key={s.story_id}>
                <Link href={`/story/${s.story_id}`} className="story">
                  <span className="rank">{mmdd(s.first_seen_at)}</span>
                  <span>
                    <h2 className="headline">{s.one_liner ?? s.fallback_title}</h2>
                    <span className="byline">
                      {s.category && <span className="cat">{s.category.replace(/_/g, " ")}</span>}
                      {s.article_count > 1 && (
                        <>
                          <span className="dot">·</span>
                          <span className="count">{s.article_count} sources</span>
                        </>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}

      {question && !answer?.grounded && related.length === 0 && (
        <div className="state">
          <h2>Nothing found</h2>
          <p>No article in the archive mentions that. Try different words.</p>
        </div>
      )}
    </div>
  );
}
