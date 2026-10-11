import Link from "next/link";
import { Nav } from "../nav";
import { getModelBoard } from "@/lib/db";
import { safeArticleUrl } from "@/lib/feed-policy";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

function ctx(n: number | null): string {
  if (!n) return "—";
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

/** Frontier models side by side. Rows are added by enrichment on launch stories. */
export default async function Models() {
  let rows: Awaited<ReturnType<typeof getModelBoard>> = [];
  let unavailable = false;
  try { rows = await getModelBoard(); } catch { unavailable = true; }

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand">AI Pulse</Link>
        <span className="meta">{rows.length} models</span>
      </header>
      <Nav /><h1>Model release tracker</h1><p className="hint">Models mentioned in enriched launch stories. Observed dates record coverage; they are not release dates. This is not a benchmark leaderboard. Open the sources to evaluate each claim.</p>

      {rows.length === 0 ? (
        <div className="state">
          <h2>{unavailable ? "Model data is unavailable" : "No models recorded yet"}</h2>
          <p>
            Rows are added automatically when a launch story is enriched. Until a
            model release lands in the Pulse, this stays empty.
          </p>
          <Link href="/">Back to the Pulse</Link>
        </div>
      ) : (
        <div className="tablewrap">
          <table className="board">
            <thead>
              <tr>
                <th>Model</th>
                <th>Vendor</th>
                <th>Observed</th><th>Release date</th>
                <th>Context</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.story_id ? (
                      <Link href={`/story/${m.story_id}`}>{m.name}</Link>
                    ) : (
                      m.name
                    )}
                  </td>
                  <td>{m.vendor ?? "—"}</td>
                  <td>{ymd(m.observed_at)}</td><td>{ymd(m.released_at)}</td>
                  <td>{ctx(m.context)}</td>
                  <td>{m.notes ?? "—"}{safeArticleUrl(m.source_url) && <p><a href={m.source_url!} target="_blank" rel="noopener noreferrer">Original article ↗</a></p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
