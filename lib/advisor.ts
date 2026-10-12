export type Task = "anime" | "video" | "audio" | "graphics";
export type Device = "browser" | "phone";
export type CatalogPlan = {
  id: string; tool: string; plan: string; tasks: string[]; devices: string[];
  monthlyUsd: number; freeKind: string; commercial: string; allowance: string;
  notes: string; upgrade: string; source: string; verifiedAt: string;
};
export type Requirements = { task: Task; device: Device; budget: number; commercial: boolean; recurringFree: boolean };

/** Fail closed on missing/expired evidence. Sorting is affordability, never quality. */
export function recommend(plans: CatalogPlan[], request: Requirements, now = Date.now()) {
  if (!Number.isFinite(request.budget) || request.budget < 0) return [];
  return plans.filter(plan => {
    const checked = Date.parse(plan.verifiedAt);
    const age = now - checked;
    let sourceValid = false;
    try { const u = new URL(plan.source); sourceValid = u.protocol === "https:" && !u.username && !u.password; } catch { /* no evidence */ }
    return sourceValid && Number.isFinite(checked) && age >= 0 && age <= 30 * 86400000
      && Number.isFinite(plan.monthlyUsd) && plan.monthlyUsd >= 0 && plan.monthlyUsd <= request.budget
      && plan.tasks.includes(request.task) && plan.devices.includes(request.device)
      && (!request.commercial || plan.commercial === "allowed")
      && (!request.recurringFree || (plan.monthlyUsd === 0 && plan.freeKind === "recurring"));
  }).sort((a, b) => a.monthlyUsd - b.monthlyUsd || a.tool.localeCompare(b.tool));
}

export const WORKFLOWS: Record<Task, { title: string; steps: string[]; prompt: string }> = {
  anime: { title: "Anime & animation", steps: ["Write a short script and divide it into individual shots.", "Create a character reference with a consistent outfit, palette and proportions.", "Test one short animated shot before generating the full sequence.", "Add voiceover and sound using assets you have permission to use.", "Edit the shots together and check character consistency, subtitles and export quality."], prompt: "Create a shot list for this original anime idea: {goal}. For each shot include duration, character reference, action, camera movement and dialogue. Start with a five-second proof of concept." },
  video: { title: "AI video", steps: ["Define the audience, aspect ratio and target length.", "Break the concept into short shots with a clear opening.", "Generate a sample and measure credits used, including retries.", "Assemble the clips, voiceover and captions in an editor.", "Review visual errors, sound levels and export restrictions before publishing."], prompt: "Turn this video idea into a production brief: {goal}. Include audience, aspect ratio, a shot list and a small test before full production." },
  audio: { title: "Voice & audio", steps: ["Write and time the script; specify the language and tone.", "Choose an authorized voice and test names and pronunciations.", "Generate a short sample before the full recording.", "Edit pauses, balance sound levels and review usage rights.", "Export and listen on the device your audience will use."], prompt: "Prepare a voiceover script for: {goal}. Add pronunciation notes, pauses and tone directions. Do not imitate a real person's voice without permission." },
  graphics: { title: "Graphics & design", steps: ["Define the audience, dimensions, message and visual references.", "Generate a few visual concepts before choosing a direction.", "Refine composition and leave space for readable text.", "Set typography in a design editor and check spelling manually.", "Review licensing and export at the required dimensions."], prompt: "Write a visual brief for: {goal}. Include composition, palette, lighting, negative space and export dimensions. Keep important lettering for the layout stage." },
};
