import Link from "next/link";
import { Nav } from "../nav";
import { ArchiveAnswer } from "./answer";
import { requireIdentity } from "@/lib/identity";
import { searchStories } from "@/lib/search";

import { mmdd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Ask({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const question = (q ?? "").trim().slice(0, 1200);
  const user = await requireIdentity();

  const related = question && !user.preview ? await searchStories(question, 8) : [];

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
          indexed from collected sources. Every grounded answer carries a
          citation, and &ldquo;not in the archive&rdquo; is a real answer rather than a
          failure.
        </p>
      )}

      {question && <ArchiveAnswer key={question} question={question} />}

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

      {question && related.length === 0 && (
        <div className="state">
          <h2>Nothing found</h2>
          <p>No article in the archive mentions that. Try different words.</p>
        </div>
      )}
    </div>
  );
}
