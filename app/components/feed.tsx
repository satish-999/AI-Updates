import Link from "next/link";
import { Shell } from "./shell";
import { getFeed, getFeedHealth } from "@/lib/feeds";
import { ago, ymd } from "@/lib/format";
import { externalUrl } from "@/lib/links";
import { feedOptions, feedHref, UPDATE_CATEGORIES, NEWS_CATEGORIES, type FeedKind } from "@/lib/feed-options";

export async function Feed({ kind, params }: { kind: FeedKind; params: Record<string, string | string[] | undefined> }) {
  const options = feedOptions(kind, params);
  const [rows, health] = await Promise.all([getFeed(kind, options), getFeedHealth()]);
  const stories = rows.slice(0, 20);
  const updates = kind === "updates";
  const categories = updates ? UPDATE_CATEGORIES : NEWS_CATEGORIES;
  return <Shell>
    <section className="feed-hero"><div><p className="eyebrow">YOUR SIGNAL IN A FAST-MOVING WORLD</p>
      <h1>{updates ? <>The next wave.<br /><em>Understand it first.</em></> : <>The world of AI.<br /><em>Beyond the headlines.</em></>}</h1>
      <p className="hero-copy">{updates ? "New models, useful tools and research breakthroughs. One story, all the context." : "Companies, people, policy and business. Follow the events shaping artificial intelligence."}</p>
    </div><aside className="hero-aside"><span className="eyebrow">FROM DISCOVERY TO DECISION</span><h2>What will you create?</h2><p>Find tools for your next video, voiceover or visual idea.</p><Link href="/advisor" className="text-link">Find the right AI <span aria-hidden="true">↗</span></Link></aside></section>
    <section className="health-strip" aria-label="Collection status">
      <span><b>{health.active}</b> active feeds</span>
      <span>Last feed success: <b>{health.last_success ? ago(health.last_success) : "not recorded"}</b></span>
      <span className={health.delayed || health.failed ? "health-warning" : ""}>{health.delayed} overdue · {health.failed} reporting errors</span>
      <details><summary>About freshness</summary><p>Collection is scheduled every 15 minutes; runs may be delayed. Overdue means no successful feed check in one hour. A successful check may contain no new articles. {health.pending} qualifying stories await enrichment. Unclassified stories appear in News until categorized. Coverage reflects our selected feeds, not every worldwide event.</p></details>
    </section>
    <div className="feed-heading"><div><p className="eyebrow">THE LATEST</p><h2>{updates ? "AI Updates" : "AI News"}</h2></div><span className="small-copy">Newest stories first</span></div>
    <form className="feed-controls" action={`/${kind}`} method="get">
      <label><span>Category</span><select name="category" defaultValue={options.category}><option value="all">All categories</option>{categories.map(c => <option value={c} key={c}>{c.replaceAll("_", " ")}</option>)}</select></label>
      <label className="search-label"><span>Search stories</span><input name="q" defaultValue={options.query} maxLength={160} placeholder="Search companies, models or topics…" /></label>
      <button type="submit" className="primary-button">Filter stories</button>
      {(options.query || options.category !== "all") && <Link href={`/${kind}`}>Clear</Link>}
    </form>
    {stories.length ? <div className="news-grid">{stories.map(s => {
      const url = externalUrl(s.url);
      return <article className="news-card" key={s.id}>
        <div className="card-kicker"><span className="category-pill">{(s.category ?? "unclassified").replaceAll("_", " ")}</span><span>{ago(s.first_seen_at)}</span></div>
        <h3>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{s.title}<span className="external-arrow" aria-hidden="true"> ↗</span><span className="sr-only"> (opens publisher in a new tab)</span></a> : s.title}</h3>
        {s.one_liner && s.one_liner !== s.title && <p className="card-summary">{s.one_liner}</p>}
        <div className="card-footer"><span>{s.source_name}<br /><span className="small-copy">Published {ymd(s.published_at)}</span></span><Link href={`/story/${s.id}`}>Summary &amp; sources <span aria-hidden="true">→</span><span className="sr-only"> for {s.title}</span></Link></div>
        <span className="small-copy">{s.article_count} {s.article_count === 1 ? "article" : "articles"} grouped into this story</span>
      </article>;
    })}</div> : <div className="empty-panel"><h2>No stories here yet</h2><p>{options.query || options.category !== "all" ? "Try a broader search or clear your filters." : "Stories will appear after collection and classification. Check the collection status above."}</p><Link href={`/${kind}`}>Reset filters</Link> · <Link href={updates ? "/news" : "/updates"}>Explore {updates ? "News" : "Updates"}</Link></div>}
    <nav className="pagination" aria-label="Story pages">{options.page > 1 && <Link href={feedHref(kind, options, options.page - 1)}>← Previous</Link>}<span>Page {options.page}</span>{rows.length > 20 && options.page < 1000 && <Link href={feedHref(kind, options, options.page + 1)}>Next →</Link>}</nav>
  </Shell>;
}
