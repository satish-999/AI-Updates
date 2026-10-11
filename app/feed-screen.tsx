import Link from "next/link";
import { Shell } from "./shell";
import { getFeed, getFeedHealth } from "@/lib/feed";
import { freshness, feedOptions } from "@/lib/feed-policy";
import { ago, ymd } from "@/lib/format";
export async function FeedScreen({ kind, params }: { kind: "updates" | "news"; params: Record<string, string | string[] | undefined> }) {
  const { q, sort, page } = feedOptions(params);
  const results = await Promise.allSettled([getFeed(kind, q, sort, page), getFeedHealth()]);
  const data = results[0].status === "fulfilled" ? results[0].value : null;
  const health = results[1].status === "fulfilled" ? results[1].value : null;
  const status = freshness(health?.latest ?? null);
  const updates = kind === "updates";
  const href = (p: number) => `${updates ? "/" : "/news"}?${new URLSearchParams({ q, sort, page: String(p) })}`;
  return <Shell>
    <section className="page-heading"><p className="eyebrow">{updates ? "The capability brief" : "Beyond the product launches"}</p><h1>{updates ? "What’s new. What it means for you." : "The stories shaping AI."}</h1><p>{updates ? "Model releases and tools from across the AI ecosystem." : "Research, companies, funding, policy and the wider impact of AI."}</p></section>
    <div className="product-grid"><section>
      <form className="feed-controls" method="GET"><label className="visually-hidden" htmlFor="feed-search">Search this feed</label><input id="feed-search" name="q" defaultValue={q} maxLength={160} placeholder="Search companies, models or topics…" /><label className="visually-hidden" htmlFor="feed-sort">Sort stories</label><select id="feed-sort" name="sort" defaultValue={sort}><option value="latest">Latest first</option><option value="importance">Most important</option></select><button type="submit" className="button-secondary">Search</button></form>
      <div className="feed-health" role="status"><span className={`status-dot ${status}`} aria-hidden="true" />{status === "unknown" ? "Collection status unavailable" : `Last successful source check ${ago(health?.latest)}`}{status === "delayed" && " · collection may be delayed"}{health && health.failing > 0 && ` · ${health.failing} of ${health.total} sources reporting errors`}{health && health.stale > 0 && ` · ${health.stale} sources not checked successfully within an hour`}</div>
      {!data ? <div className="product-empty"><h2>The feed is temporarily unavailable</h2><p>We could not read the news archive. Please retry shortly. The advisor’s curated catalog is still available.</p><Link className="button-primary" href="/advisor">Explore the advisor →</Link></div> : data.stories.length === 0 ? <div className="product-empty"><h2>{q ? "No matching stories" : page > 1 ? "No more stories" : "No stories in this feed yet"}</h2><p>{q ? "Try a broader term or search the other feed." : updates ? "Releases appear after the worker classifies them. Unclassified events remain in AI News." : "Stories appear after collection and clustering complete."}</p><Link href={updates ? "/news" : "/"}>{updates ? "Open AI News" : "Open AI Updates"} →</Link></div> : data.stories.map((story, i) => <article className={`feed-story ${i === 0 ? "featured" : ""}`} key={story.id}>
        <div className="story-meta"><span className="category-label">{story.category?.replaceAll("_", " ") ?? "Awaiting classification"}</span><span>{story.source_name}</span><time>{ymd(story.source_date)}</time></div>
        <h2>{story.source_url ? <a href={story.source_url} target="_blank" rel="noopener noreferrer">{story.title}<span aria-label="Opens original article in a new tab"> ↗</span></a> : <Link href={`/story/${story.id}`}>{story.title}</Link>}</h2>
        <div className="story-bottom"><Link href={`/story/${story.id}`}>Context & {story.article_count} {story.article_count === 1 ? "source" : "sources"} →</Link><span>{ago(story.first_seen_at)}</span></div>
      </article>)}
      {data && <nav className="pagination" aria-label="Feed pages">{page > 1 && <Link href={href(page - 1)}>← Previous</Link>}<span>Page {page}</span>{data.hasMore && <Link href={href(page + 1)}>Next →</Link>}</nav>}
    </section><aside><section className="side-panel"><p className="eyebrow">Put it to work</p><h2>What do you want to create?</h2><p>Find a starting tool, free alternatives and a workflow for your next project.</p><Link className="button-primary" href="/advisor">Find the Right AI →</Link></section><section className="side-panel"><h2>Follow what matters</h2><p>Track a company or topic. Matching stories collect in your monitors.</p><Link href="/monitors">Open your monitors →</Link></section><section className="feed-explainer"><h2>Clarity before hype</h2><p>Headlines open a representative publisher’s article. Context brings together the other sources.</p><p>Collection is scheduled about every 15 minutes and may be delayed. Coverage reflects our connected sources, not every event worldwide.</p></section></aside></div>
  </Shell>;
}
