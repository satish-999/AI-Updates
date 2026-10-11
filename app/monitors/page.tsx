import Link from "next/link";

import { redirect } from "next/navigation";
import { Nav } from "../nav";
import { requireIdentity } from "@/lib/identity";
import { entitlement } from "@/lib/entitlements";
import { sqlClient } from "@/lib/db";
import { ago } from "@/lib/format";
import { createMonitor, changeMonitor } from "./actions";

export const dynamic = "force-dynamic";

export default async function Monitors({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireIdentity();
  if (user.preview) return <div className="wrap"><Nav /><h1>Topic monitors</h1><p>Sign in with a configured account to create monitors and sync matches across devices. Live monitoring is unavailable in the local preview.</p></div>;
  const viewer = user.id;
  const limit = (await entitlement(user)).monitors;
  const sql = sqlClient();
  const monitors = await sql`select id, slot, question, active, hits, last_run_at from saved_questions
    where viewer_id = ${viewer} order by created_at desc limit 20`;
  const hits = await sql`select h.question_id, h.story_id, h.found_at, q.question,
    coalesce(s.one_liner, (select a.title from story_articles sa join articles a on a.id = sa.article_id
      where sa.story_id = s.id order by a.published_at limit 1)) as title
    from saved_question_hits h join saved_questions q on q.id = h.question_id
    join stories s on s.id = h.story_id where q.viewer_id = ${viewer}
    order by h.found_at desc, h.story_id desc limit 50`;
  const { error } = await searchParams;
  return <div className="wrap">
    <header className="top"><Link href="/" className="brand">AI Pulse</Link><span className="meta">Your intelligence monitors</span></header>
    <Nav />
    <section className="monitor-intro"><p className="meta">YOUR NEXT MOVE STARTS HERE</p>
      <h1>Follow the signals that matter to your business.</h1>
      <p>Track competitors, model launches and market shifts. Matching stories collect here as the worker runs.</p>
    </section>
    <form action={createMonitor} className="monitor-create">
      <label htmlFor="question">Topic or search expression</label>
      <div><input id="question" name="question" required minLength={2} maxLength={240} placeholder={'e.g. "open source" OR funding'} /><button type="submit">Create monitor</button></div>
      <p className="hint">Use keywords, quoted phrases, OR and -excluded words. Matches use the indexed stories and article text from the last 7 days; this does not generate an AI answer.</p>
    </form>
    {error && <p role="alert">{error === "input" ? "Enter a topic of 2–240 characters." : "No slot available. Delete a monitor or retry. Your current plan limit has been reached."}</p>}
    <p className="hint">These monitors belong to your signed-in account and sync across devices. Scheduled checks can be delayed; no email or push notifications are sent.</p>
    <section><h2>Your monitors <span className="meta">{monitors.length}/{limit}</span></h2>
      {monitors.length === 0 && <p className="hint">Create your first monitor to start collecting relevant stories.</p>}
      {monitors.map(m => <article className="monitor-row" key={m.id}>
        <div><h3>{m.question}</h3><p className="meta">{m.slot > limit ? "Outside current plan — checks paused" : m.active ? "Active" : "Paused"} · {m.hits} matches · {m.last_run_at ? `Checked ${ago(m.last_run_at)}` : "Waiting for first check"}</p></div>
        <form action={changeMonitor}><input type="hidden" name="id" value={String(m.id)} />
          <button name="action" value="toggle">{m.active ? "Pause" : "Resume"}</button>
          <button name="action" value="delete" aria-label={`Delete monitor: ${m.question}`}>Delete</button>
        </form>
      </article>)}
    </section>
    <section className="monitor-results"><h2>Latest matching stories</h2>
      {hits.length === 0 && <p className="hint">No matches yet. Results appear after a successful worker check; try broader keywords if a checked monitor has no matches.</p>}
      {hits.map(h => <article className="monitor-row" key={`${h.question_id}-${h.story_id}`}><div>
        <p className="meta">{h.question} · Found {ago(h.found_at)}</p>
        <Link href={`/story/${h.story_id}`}><h3>{h.title ?? "View story and sources"}</h3></Link>
      </div></article>)}
    </section>
  </div>;
}
