import Link from "next/link";
import { Nav } from "../nav";
import { getModelBoard } from "@/lib/db";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

function ctx(n: number | null): string {
  if (!n) return "—";
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

/** Frontier models side by side. Rows are added by enrichment on launch stories. */
export default async function Models() {
  const rows = await getModelBoard();

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand">AI Pulse</Link>
        <span className="meta">{rows.length} models</span>
      </header>
      <Nav />

      {rows.length === 0 ? (
        <div className="state">
          <h2>No models recorded yet</h2>
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
                <th>Released</th>
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
                  <td>{ymd(m.released_at)}</td>
                  <td>{ctx(m.context)}</td>
                  <td>{m.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
