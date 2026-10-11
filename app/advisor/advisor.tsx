"use client";
import { useState } from "react";
import { GOALS, PLAYBOOKS } from "@/lib/catalog";
import { recommend, validateAdvisor, type AdvisorInput, type Recommendation, type Pick } from "@/lib/advisor";
import { ymd } from "@/lib/format";

type Saved = { id: string; input: AdvisorInput; savedAt: string };
const STORAGE = "ai-pulse-projects-v1";
const initial: AdvisorInput = { goal: "auto", brief: "", budget: 0, device: "browser", use: "personal", experience: "beginner" };
function loadProjects(): Saved[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.slice(0, 10).flatMap(p => {
      try { return typeof p.id === "string" && typeof p.savedAt === "string" ? [{ id: p.id, input: validateAdvisor(p.input), savedAt: p.savedAt }] : []; } catch { return []; }
    });
  } catch { return []; }
}
function ToolCard({ pick, input }: { pick: Pick; input: AdvisorInput }) {
  const { tool, plan } = pick;
  const upgrades = tool.plans.filter(p => p.monthlyUSD !== null && p.monthlyUSD > (plan.monthlyUSD ?? 0));
  return <article className="tool-card"><div className="tool-card-top"><div><span className="eyebrow">{tool.role}</span><h3><a href={tool.url} target="_blank" rel="noopener noreferrer">{tool.name} ↗</a></h3></div><span className="tool-kind">{tool.kind}</span></div><p>{pick.reason}</p><div className="plan-line"><strong>{plan.name}</strong><span>{plan.monthlyUSD === 0 ? tool.device === "gpu" ? "$0 model fee + compute" : "$0 starting plan" : `US$${plan.monthlyUSD}/month`}</span></div><p className="small-copy">{plan.allowance}</p><div className="tool-caveat"><strong>Before you choose</strong><p>{tool.limitation}</p><p>{plan.rights}</p></div>{upgrades.length > 0 && <details><summary>When would paying help?</summary>{upgrades.map(p => <p className="small-copy" key={p.name}><strong>{p.name} · US${p.monthlyUSD}/month:</strong> {p.allowance} {p.monthlyUSD! > input.budget ? "Above your stated budget." : "An optional upgrade, not included in the selected-plan total."}</p>)}</details>}<div className="tool-sources"><a href={tool.source} target="_blank" rel="noopener noreferrer">Plan / capability source ↗</a>{tool.rightsSource && <a href={tool.rightsSource} target="_blank" rel="noopener noreferrer">Rights source ↗</a>}<span>Reviewed {ymd(tool.reviewed)}</span></div></article>;
}
export function Advisor({ preview = false }: { preview?: boolean }) {
  const [input, setInput] = useState<AdvisorInput>(initial);
  const [submitted, setSubmitted] = useState<AdvisorInput | null>(null);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const update = <K extends keyof AdvisorInput>(key: K, value: AdvisorInput[K]) => { setInput(p => ({ ...p, [key]: value })); setResult(null); setSubmitted(null); setMessage(""); };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    let clean: AdvisorInput;
    try { clean = validateAdvisor(input); } catch (error) { setMessage((error as Error).message); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/advisor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clean), signal: AbortSignal.timeout(50_000) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "The advisor is unavailable. Try again."); }
      const body = await response.json();
      setResult(body.recommendation); setSubmitted({ ...clean, goal: body.recommendation.goal ?? clean.goal }); if (body.note) setMessage(body.note);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not connect. Please retry."); }
    finally { setBusy(false); }
  }
  async function showProjects() {
    if (preview) { setSaved(loadProjects()); return; }
    try { const response = await fetch("/api/projects"); const body = await response.json(); if (!response.ok) throw new Error(body.error); setSaved(body.projects); } catch (e) { setMessage((e as Error).message); }
  }
  async function deleteProject(id: string) {
    try {
      if (preview) { const next = (saved ?? []).filter(p => p.id !== id); localStorage.setItem(STORAGE, JSON.stringify(next)); setSaved(next); return; }
      const response = await fetch("/api/projects?id=" + encodeURIComponent(id), { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete project.");
      await showProjects();
    } catch (e) { setMessage((e as Error).message); }
  }
  async function saveProject() {
    if (!submitted || !result?.goal) return;
    try {
      if (!preview) {
        const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submitted) });
        const body = await response.json(); if (!response.ok) throw new Error(body.error);
        await showProjects(); setMessage("Project saved to your account and available across devices."); return;
      }
      const projects = loadProjects();
      const entry = { id: crypto.randomUUID(), input: submitted, savedAt: new Date().toISOString() };
      const next = [entry, ...projects].slice(0, 10); localStorage.setItem(STORAGE, JSON.stringify(next)); setSaved(next); setMessage("Project saved in this browser. The ten most recent projects are kept.");
    } catch (e) { setMessage((e as Error).message || "Could not save. You can still download the plan."); }
  }
  function exportPlan() {
    if (!result || !submitted) return;
    const lines = ["# AI Pulse project plan", submitted.brief, `Created ${ymd(new Date())}`, `Budget ceiling: USD ${submitted.budget}/month`, result.note,
      ...result.picks.map(p => `## ${p.tool.name}\n${p.reason}\nPlan: ${p.plan.name} (USD ${p.plan.monthlyUSD}/month)\n${p.plan.allowance}\n${p.tool.limitation}\n${p.plan.rights}\nSource: ${p.tool.source}\nReviewed: ${p.tool.reviewed}`),
      "## Workflow", ...result.steps.map((s, i) => `${i + 1}. ${s}`), "## Starter prompt", result.prompt];
    const url = URL.createObjectURL(new Blob([lines.join("\n\n")], { type: "text/markdown;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "ai-pulse-project-plan.md"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="product-grid"><section>
    <div className="goal-grid" aria-label="Choose a creative goal">{GOALS.map(goal => <button key={goal} disabled={busy} type="button" aria-pressed={input.goal === goal} onClick={() => { setInput(p => ({ ...p, goal, brief: PLAYBOOKS[goal].example })); setResult(null); setSubmitted(null); setMessage(""); }}><span>{PLAYBOOKS[goal].title}</span><small>{PLAYBOOKS[goal].description}</small></button>)}</div>
    <form className="advisor-form" onSubmit={submit}><fieldset disabled={busy}><label htmlFor="project-brief">Tell us what you want to build</label><textarea id="project-brief" minLength={10} maxLength={1200} required value={input.brief} placeholder="For example: a 30-second anime short with original characters…" onChange={e => update("brief", e.target.value)} /><div className="advisor-fields">
      <label>Goal<select value={input.goal} onChange={e => update("goal", e.target.value as AdvisorInput["goal"])}><option value="auto">Identify from my brief</option>{GOALS.map(g => <option value={g} key={g}>{PLAYBOOKS[g].title}</option>)}</select></label>
      <label>Monthly budget (USD)<input type="number" min={0} max={10000} step="0.01" required value={Number.isNaN(input.budget) ? "" : input.budget} onChange={e => update("budget", e.target.value === "" ? NaN : Number(e.target.value))} /></label>
      <label>Device / setup<select value={input.device} onChange={e => update("device", e.target.value as AdvisorInput["device"])}><option value="browser">Phone or browser only</option><option value="desktop">Desktop, can install apps</option><option value="gpu">Desktop with suitable GPU</option></select></label>
      <label>Intended use<select value={input.use} onChange={e => update("use", e.target.value as AdvisorInput["use"])}><option value="personal">Personal / learning</option><option value="commercial">Client work / monetization</option></select></label>
      <label>Experience<select value={input.experience} onChange={e => update("experience", e.target.value as AdvisorInput["experience"])}><option value="beginner">Beginner</option><option value="experienced">Experienced</option></select></label>
    </div><button type="submit" disabled={busy} className="button-primary">{busy ? "Checking your requirements…" : "Find my tools & workflow →"}</button><p className="small-copy">Six supported creative goals. Plan facts come from our reviewed catalog. Optional AI helps identify unclear briefs; it does not invent prices.</p></fieldset></form>
    <p role="status" className="advisor-message">{message}</p>
    {result && submitted && <section aria-label="Your recommendations" className="recommendations"><div className="recommendation-heading"><div><p className="eyebrow">Your starting shortlist</p><h2>{result.goal ? PLAYBOOKS[result.goal].title : "Let’s clarify your goal"}</h2></div><div className="plan-actions"><button type="button" className="button-secondary" onClick={saveProject} disabled={!result.goal}>Save project</button><button type="button" className="button-secondary" onClick={exportPlan} disabled={!result.goal}>Download plan</button></div></div><p>{result.note}</p>
      {result.picks.length > 0 && <p className="selected-cost">Selected plan fees: <strong>US${result.minimumMonthlyUSD}/month</strong><span>Starting fees only; not a total production-cost estimate.</span></p>}
      {result.picks.map(pick => <ToolCard key={pick.tool.id} pick={pick} input={submitted} />)}
      {result.alternatives.length > 0 && <details className="advisor-details"><summary>Other options in the catalog</summary>{result.alternatives.map(p => <ToolCard key={p.tool.id} pick={p} input={submitted} />)}</details>}
      {result.excluded.length > 0 && <details className="advisor-details"><summary>Why some tools were excluded</summary><ul>{result.excluded.map(e => <li key={e.name}><strong>{e.name}:</strong> {e.reason}</li>)}</ul></details>}
      {result.steps.length > 0 && <><h2 className="workflow-title">From idea to finished piece</h2><ol className="workflow-steps">{result.steps.map(step => <li key={step}>{step}</li>)}</ol><details className="advisor-details"><summary>Your starter prompt</summary><pre className="starter-prompt">{result.prompt}</pre></details></>}
    </section>}
  </section><aside><section className="side-panel"><p className="eyebrow">Evidence before spending</p><h2>A choice you can inspect</h2><ul><li>Why each tool fits</li><li>Free allowances and limitations</li><li>Commercial-use conditions</li><li>Sources and verification dates</li></ul><p>No sponsored placement affects this shortlist. Prices are reviewed snapshots, not live quotes.</p></section><section className="side-panel"><h2>Your saved projects</h2><p>{preview ? "Preview saves stay in this browser." : "Saved privately to your account, across devices."} Reopening a project rechecks the current catalog.</p><button type="button" className="button-secondary" onClick={showProjects}>Show saved projects</button>{saved && <div className="saved-projects">{saved.length === 0 && <p>No projects saved here yet.</p>}{saved.map(p => <div key={p.id}><button type="button" onClick={() => { setInput(p.input); setSubmitted(p.input); setResult(recommend(p.input)); setMessage("Saved requirements loaded; recommendations checked again."); }}>{p.input.brief.slice(0, 70)}</button><small>{ymd(p.savedAt)}</small><button type="button" aria-label={`Delete project ${p.input.brief.slice(0, 40)}`} onClick={() => deleteProject(p.id)}>Delete</button></div>)}</div>}</section><section className="feed-explainer"><h2>What this advisor does</h2><p>It recommends tools and workflows. Creating images, music and videos happens in the provider’s application. Those subscriptions are separate.</p></section></aside></div>;
}
