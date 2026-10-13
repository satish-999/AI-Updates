export type ProjectInput = { title: string; goal: string; requirements: { task: string; device: string; budget: number; commercial: boolean; recurringFree: boolean } };
export function projectInput(value: Record<string, unknown>): ProjectInput | null {
  const { title, goal, requirements: r } = value;
  if (typeof title !== "string" || !title.trim() || title.trim().length > 100 || typeof goal !== "string" || !goal.trim() || goal.trim().length > 1200 || !r || typeof r !== "object" || Array.isArray(r)) return null;
  const v = r as Record<string, unknown>;
  if (typeof v.task !== "string" || !["anime", "video", "audio", "graphics"].includes(v.task) || typeof v.device !== "string" || !["browser", "phone"].includes(v.device) || typeof v.budget !== "number" || !Number.isFinite(v.budget) || v.budget < 0 || v.budget > 10000 || typeof v.commercial !== "boolean" || typeof v.recurringFree !== "boolean") return null;
  return { title: title.trim(), goal: goal.trim(), requirements: { task: v.task, device: v.device, budget: v.budget, commercial: v.commercial, recurringFree: v.recurringFree } };
}
