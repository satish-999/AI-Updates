import { CATALOG, GOALS, PLAYBOOKS, type Goal, type Tool } from "./catalog.ts";
export type AdvisorInput = { brief: string; goal: Goal | "auto"; budget: number; device: "browser" | "desktop" | "gpu"; use: "personal" | "commercial"; experience: "beginner" | "experienced" };
export type Pick = { tool: Tool; plan: Tool["plans"][number]; reason: string };
export type Recommendation = { goal: Goal | null; picks: Pick[]; alternatives: Pick[]; excluded: { name: string; reason: string }[]; steps: string[]; prompt: string; note: string; minimumMonthlyUSD: number };
export function validateAdvisor(value: unknown): AdvisorInput {
  if (!value || typeof value !== "object") throw new Error("Enter your project requirements.");
  const v = value as Record<string, unknown>;
  if (typeof v.brief !== "string" || v.brief.trim().length < 10 || v.brief.length > 1200) throw new Error("Describe your project in 10–1,200 characters.");
  if (v.goal !== "auto" && !GOALS.includes(v.goal as Goal)) throw new Error("Choose a supported goal.");
  if (typeof v.budget !== "number" || !Number.isFinite(v.budget) || v.budget < 0 || v.budget > 10000) throw new Error("Enter a monthly USD budget between 0 and 10,000.");
  if (typeof v.device !== "string" || !["browser", "desktop", "gpu"].includes(v.device) || typeof v.use !== "string" || !["personal", "commercial"].includes(v.use) || typeof v.experience !== "string" || !["beginner", "experienced"].includes(v.experience)) throw new Error("Check your device, use and experience selections.");
  return { brief: v.brief.trim(), goal: v.goal, budget: v.budget, device: v.device, use: v.use, experience: v.experience } as AdvisorInput;
}
export function detectGoal(brief: string): Goal | null {
  const rules: [Goal, RegExp][] = [["anime", /\b(anime|manga|character animation)\b/i], ["voice", /\b(voice.?over|narrat\w*|dubbing|text.to.speech|podcast)\b/i], ["music", /\b(music|song|soundtrack|instrumental|melody)\b/i], ["social", /\b(social|reels?|thumbnail|instagram|tiktok)\b/i], ["video", /\b(video|film|movie|clip)\b/i], ["graphics", /\b(graphic|poster|logo|illustrat\w*|image|artwork|flyer)\b/i]];
  return rules.find(([, pattern]) => pattern.test(brief))?.[0] ?? null;
}
export function catalogFresh(date: string, now = Date.now()): boolean {
  const stamp = new Date(`${date}T00:00:00Z`).getTime();
  return Number.isFinite(stamp) && stamp <= now + 86_400_000 && now - stamp <= 30 * 86_400_000;
}
export function recommend(input: AdvisorInput, now = Date.now()): Recommendation {
  const goal = input.goal === "auto" ? detectGoal(input.brief) : input.goal;
  if (!goal) return { goal: null, picks: [], alternatives: [], excluded: [], steps: [], prompt: "", note: "This catalog covers anime, video, voiceover, music, graphics and social content. Choose a goal or describe one of those projects more clearly.", minimumMonthlyUSD: 0 };
  const excluded: Recommendation["excluded"] = [];
  const candidates: Pick[] = [];
  for (const tool of CATALOG.filter(t => t.goals.includes(goal))) {
    let reason = "";
    if (!catalogFresh(tool.reviewed, now)) reason = "Facts need a new editorial review (older than 30 days).";
    else if (tool.device === "gpu" && (input.device !== "gpu" || input.experience === "beginner")) reason = "Requires suitable local compute and experienced setup.";
    else if (tool.device === "desktop" && input.device === "browser") reason = "Requires desktop installation.";
    const eligible = tool.plans.filter(p => p.monthlyUSD !== null && p.monthlyUSD <= input.budget && (input.use !== "commercial" || p.commercial === "conditional"));
    if (!reason && !eligible.length) reason = input.use === "commercial" ? "No reviewed commercial-use plan within this budget." : "No verified plan within this budget.";
    if (reason) { excluded.push({ name: tool.name, reason }); continue; }
    const plan = eligible.sort((a, b) => a.monthlyUSD! - b.monthlyUSD!)[0];
    candidates.push({ tool, plan, reason: tool.fit });
  }
  // Curated goal priorities, not invented benchmark scores. Fill a starting
  // workflow within the TOTAL recurring budget, not per-tool budget.
  const priority: Record<Goal, string[]> = { anime: ["runway", "firefly", "flux", "krita", "elevenlabs", "canva", "audacity"], video: ["runway", "firefly", "canva", "elevenlabs", "audacity"], voice: ["elevenlabs", "audacity"], music: ["suno", "audacity"], graphics: ["firefly", "flux", "canva", "krita"], social: ["firefly", "canva", "flux", "runway"] };
  candidates.sort((a, b) => priority[goal].indexOf(a.tool.id) - priority[goal].indexOf(b.tool.id));
  const picks: Pick[] = []; const alternatives: Pick[] = []; let total = 0;
  const roles = new Set<string>();
  for (const pick of candidates) {
    const role = pick.tool.id === "flux" ? "Visual generation" : pick.tool.role;
    if (picks.length < 3 && !roles.has(role) && total + pick.plan.monthlyUSD! <= input.budget) { picks.push(pick); total += pick.plan.monthlyUSD!; roles.add(role); }
    else alternatives.push(pick);
  }
  const playbook = PLAYBOOKS[goal];
  return { goal, picks, alternatives, excluded, steps: playbook.steps,
    prompt: `${playbook.prompt}\n\nProject brief: ${input.brief}\nBudget ceiling: USD ${input.budget}/month. Experience: ${input.experience}. Use: ${input.use}.`,
    note: picks.length ? "A source-backed starting shortlist, not a guarantee of complete production. Free allowances may only cover a test. Taxes, hardware, extra credits and other services are excluded." : "No catalog option meets all these constraints with current verified facts. Change your budget/device, or revisit after the catalog is reviewed. Do not buy an unverified plan on this basis.",
    minimumMonthlyUSD: Math.round(total * 100) / 100 };
}
