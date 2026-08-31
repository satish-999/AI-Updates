import Link from "next/link";
import { Nav } from "./nav";
import { getPulse, getStats } from "@/lib/db";
import { ago } from "@/lib/format";

// Rendered per request, not prerendered at build. ISR would have Next query
// the database while collecting page data, which couples a deploy to a live
// Neon instance — a sleeping database or an unset build-time variable would
// fail the build rather than one request. At single-user traffic the saved
// round trip was never worth that.
export const dynamic = "force-dynamic";

export default async function Pulse() {
  const [stories, stats] = await Promise.all([getPulse(12), getStats()]);

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand">AI Pulse</Link>
        <span className="meta">
          {stats.stories} stories · {stats.articles} articles
          {stats.latest ? ` · updated ${ago(stats.latest)}` : ""}
        </span>
      </header>
      <Nav />

      {stories.length === 0 ? (
        <div className="state">
          <h2>Nothing ranked yet</h2>
          <p>
            The pipeline collects every 15 minutes. Stories appear here once
            articles have been clustered and scored.
          </p>
        </div>
      ) : (
        <ol className="pulse">
          {stories.map((s, i) => (
            <li key={s.id}>
              <Link href={`/story/${s.id}`} className="story">
                <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <h2 className="headline">{s.one_liner ?? s.fallback_title}</h2>
                  <span className="byline">
                    {s.category && (
                      <span
                        className="cat"
                        style={{ ["--c" as string]: `var(--${s.category})` }}
                      >
                        {s.category.replace(/_/g, " ")}
                      </span>
                    )}
                    {s.article_count > 1 && (
                      <>
                        <span className="dot">·</span>
                        <span className="count">{s.article_count} sources</span>
                      </>
                    )}
                    <span className="dot">·</span>
                    <span>{ago(s.first_seen_at)}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
