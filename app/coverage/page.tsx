import { Shell } from "../shell";
import { sqlClient } from "@/lib/db";
import { ago } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function Page() {
  let sources: { id: number; name: string; last_ok_at: string | Date | null; failing: boolean }[] = [];
  let unavailable = false;
  try { const sql = sqlClient(); sources = await sql`select id, name, last_ok_at, (last_error is not null) as failing from sources where active order by name` as typeof sources; } catch { unavailable = true; }
  return <Shell><section className="page-heading"><p className="eyebrow">WHERE YOUR INTELLIGENCE COMES FROM</p><h1>Source coverage</h1><p>Collection is scheduled every 15 minutes. Feeds, platform delays and enrichment quotas affect when stories appear. We do not claim to cover every AI event worldwide.</p></section>{unavailable ? <p role="status">Live source status is unavailable. Check again later.</p> : sources.length === 0 ? <p>No active sources are configured.</p> : <div className="coverage-grid">{sources.map(source => <article className="side-panel" key={source.id}><h2>{source.name}</h2><p>{source.failing ? "Latest fetch needs attention" : !source.last_ok_at ? "Waiting for first successful fetch" : Date.now() - new Date(source.last_ok_at).getTime() > 3600000 ? "Collection delayed" : "Recently collected"}</p><p>Last success: {source.last_ok_at ? ago(source.last_ok_at) : "Not yet"}</p></article>)}</div>}<p className="small-copy">A successful fetch may contain no new articles. Publisher headlines open the original article; story pages group related coverage. Recommendation prices are separately reviewed editorial snapshots.</p></Shell>;
}
