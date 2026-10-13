import Link from "next/link";
import { Shell } from "../components/shell";
import { requireAccount } from "@/lib/current-user";
import { listProjects } from "@/lib/projects";
import { recommend, type Requirements } from "@/lib/advisor";
import { ymd } from "@/lib/format";
import catalog from "@/data/catalog.json";
import { DeleteProject } from "./delete-project";
export const dynamic = "force-dynamic";
export default async function Projects() {
  const user = await requireAccount(); const projects = await listProjects(user.id);
  return <Shell><div className="feed-heading"><div><p className="eyebrow">PRIVATE TO YOUR ACCOUNT</p><h1>Your projects</h1></div><Link href="/advisor">Create a project →</Link></div><p>Signed in as {user.username}. Your saved briefs follow you across devices.</p>
    {!projects.length && <div className="empty-panel">No saved projects yet. Start in Find the Right AI, then save your brief.</div>}
    <div className="news-grid">{projects.map(project => { const matches = recommend(catalog, project.requirements as Requirements); return <article className="news-card" key={project.id}><h2>{project.title}</h2><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{project.goal}</p><p className="small-copy">{project.requirements.task} · ${project.requirements.budget}/month · {project.requirements.device} · Saved {ymd(project.updated_at)}</p><p className="small-copy">Current catalog matches: {matches.length ? matches.map(p => `${p.tool} ${p.plan}`).join(", ") : "No verified plans currently match."}</p><DeleteProject id={project.id} /></article>; })}</div>
    <p className="small-copy">Matches are recalculated from the current reviewed catalog when you open this page. Automatic notifications are not enabled.</p></Shell>;
}
