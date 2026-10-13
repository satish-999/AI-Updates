"use client";
import { useState } from "react";
import { recommend, WORKFLOWS, type Task, type Device, type CatalogPlan, type Requirements } from "@/lib/advisor";
import { ymd } from "@/lib/format";
import { externalUrl } from "@/lib/links";

export function Advisor({ plans }: { plans: CatalogPlan[] }) {
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [task, setTask] = useState<Task>("anime");
  const [device, setDevice] = useState<Device>("browser");
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("0");
  const [commercial, setCommercial] = useState(false);
  const [recurringFree, setRecurringFree] = useState(false);
  const [result, setResult] = useState<{ request: Requirements; goal: string; plans: CatalogPlan[] } | null>(null);
  return <>
    <form className="advisor-form" onChange={() => { setResult(null); setSaveStatus(""); }} onSubmit={event => {
      event.preventDefault(); setSaveStatus("");
      const request = { task, device, budget: Number(budget), commercial, recurringFree };
      setResult({ request, goal: goal.trim(), plans: recommend(plans, request) });
    }}>
      <fieldset className="task-picker"><legend>Choose your starting point</legend>{(Object.keys(WORKFLOWS) as Task[]).map(key => <label key={key} className={task === key ? "task-option selected" : "task-option"}><input type="radio" name="task" value={key} checked={task === key} onChange={() => setTask(key)} /><span>{WORKFLOWS[key].title}</span></label>)}</fieldset>
      <label className="goal-label">Describe your idea<textarea value={goal} onChange={e => setGoal(e.target.value)} required maxLength={1200} placeholder="A 30-second anime trailer about a young inventor, for my YouTube channel…" /></label>
      <p className="small-copy">This catalog currently covers {new Set(plans.map(p => p.tool)).size} providers. A $0 budget excludes paid plans. Commercial use and recurring-free filters may narrow the list further.</p><p className="small-copy">Your description becomes part of the starter prompt. Tool matching uses the category, budget, device and usage choices below; it does not yet interpret every detail of your idea.</p>
      <div className="advisor-options"><label>Monthly tool budget (USD)<input type="number" min="0" max="10000" step="0.01" required value={budget} onChange={e => setBudget(e.target.value)} /></label><label>Your device<select value={device} onChange={e => setDevice(e.target.value as Device)}><option value="browser">Computer / browser</option><option value="phone">Phone</option></select></label></div>
      <div className="check-options"><label><input type="checkbox" checked={commercial} onChange={e => setCommercial(e.target.checked)} /> Commercial project</label><label><input type="checkbox" checked={recurringFree} onChange={e => setRecurringFree(e.target.checked)} /> Recurring free options only</label></div>
      <button type="submit" className="primary-button">Find my starting point <span aria-hidden="true">→</span></button>
    </form>
    <section className="advisor-results" aria-live="polite" aria-atomic="true">{result && <>
      <div className="feed-heading"><div><p className="eyebrow">YOUR SHORTLIST</p><h2>{WORKFLOWS[result.request.task].title}</h2></div><span className="small-copy">Ordered by price, not quality</span></div>
      <button className="primary-button" disabled={saving} onClick={async () => {
        setSaving(true); setSaveStatus("");
        try { const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: result.goal.slice(0,100), goal: result.goal, requirements: result.request }) }); const data = await response.json(); setSaveStatus(response.ok ? "Saved. Open My projects to find your brief on any device." : data.error ?? "Could not save."); } catch { setSaveStatus("Connection failed. Try again."); } finally { setSaving(false); }
      }}>{saving ? "Saving…" : "Save this project"}</button><p role="status" className="small-copy">{saveStatus}</p>
      <p>For: {result.goal}</p><p className="small-copy">Matching your submitted requirements: up to ${result.request.budget}/month · {result.request.device} · {result.request.commercial ? "commercial use" : "personal use"}{result.request.recurringFree ? " · recurring free only" : ""}. This is a small curated catalog, not a complete market comparison. Plan prices are per tool, before taxes and extra usage; they are not a complete project estimate.</p>
      {!result.plans.length ? <div className="empty-panel"><h3>No verified match for these requirements</h3><p>Try a different budget or category. Missing or older-than-30-day evidence is excluded; we won’t substitute an unsupported recommendation.</p></div> : <div className="news-grid">{result.plans.map(plan => <article className="news-card" key={plan.id}>
        <div className="card-kicker"><span className="category-pill">{plan.monthlyUsd === 0 ? (plan.freeKind === "one-time" ? "One-time free credits" : "Recurring free allowance") : "Paid option"}</span><span>${plan.monthlyUsd}/mo</span></div>
        <h3>{plan.tool} <span className="small-copy">/ {plan.plan}</span></h3><p>{plan.allowance}</p><p className="small-copy">{plan.notes}</p><p className="small-copy">{plan.upgrade}</p>
        <p className="small-copy">Commercial use: {plan.commercial === "allowed" ? "provider permits it, subject to terms" : plan.commercial === "not-included" ? "license not included" : "not verified"}. Export limits and exact model availability must be checked for your task.</p>
        <div className="card-footer"><span className="small-copy">Reviewed {ymd(plan.verifiedAt)}</span>{externalUrl(plan.source) && <a href={externalUrl(plan.source)!} target="_blank" rel="noopener noreferrer">Official plan details ↗<span className="sr-only"> (opens in a new tab)</span></a>}</div>
      </article>)}</div>}
      <details><summary>Why are other plans missing?</summary><p>Only plans matching every selected requirement appear above. These alternatives are not recommendations for your current settings:</p><ul>{plans.filter(p => p.tasks.includes(result.request.task) && !result.plans.some(match => match.id === p.id)).map(p => <li key={p.id}>{p.tool} / {p.plan}: {[p.monthlyUsd > result.request.budget ? `costs $${p.monthlyUsd}/month, above your budget` : "", !p.devices.includes(result.request.device) ? "device support not verified" : "", result.request.commercial && p.commercial !== "allowed" ? "commercial rights not included or not verified" : "", result.request.recurringFree && (p.monthlyUsd !== 0 || p.freeKind !== "recurring") ? "not a recurring free plan" : "", Date.now() - Date.parse(p.verifiedAt) > 30*86400000 ? "pricing evidence needs review" : ""].filter(Boolean).join("; ") || "does not meet current verification requirements"}</li>)}</ul></details>
      <div className="workflow-panel"><div><p className="eyebrow">A PRACTICAL NEXT STEP</p><h2>Your creation checklist</h2><p className="small-copy">An editorial workflow template. Test a small sample before committing to a paid plan. Tools in the shortlist cover parts of the workflow; editing or other steps may require additional software.</p><ol>{WORKFLOWS[result.request.task].steps.map(step => <li key={step}>{step}</li>)}</ol></div><div><h3>Starter prompt</h3><pre className="starter-prompt">{WORKFLOWS[result.request.task].prompt.replace("{goal}", result.goal)}</pre><p className="small-copy">Copy this into your chosen tool and adapt it to the sample result. Media is created in the recommended applications.</p></div></div>
    </>}</section>
    <p className="advisor-disclosure">Tool subscriptions are purchased separately from AI Pulse. This advisor makes no purchases and sends your brief to no model provider. Prices and plan evidence are manually reviewed; recommendations expire after 30 days without review.</p>
  </>;
}
