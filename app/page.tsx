import Link from "next/link";
import { getPulse, getStats } from "@/lib/db";

// Neon suspends when idle, so the first visitor after a quiet stretch pays a
// wake of about a second and everyone after that is served from cache. Fair
// trade for a database that costs nothing to leave running.
export const revalidate = 60;

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

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

      {stories.length === 0 ? (
        <p className="empty">Nothing ranked yet. Run the pipeline to populate the Pulse.</p>
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
