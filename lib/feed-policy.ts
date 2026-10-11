export const UPDATE_CATEGORIES = ["model_release", "product"];
export function safeArticleUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function freshness(value: string | Date | null, now = Date.now()): "unknown" | "recent" | "delayed" {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time) || time > now + 300_000) return "unknown";
  return now - time <= 60 * 60 * 1000 ? "recent" : "delayed";
}
export function feedOptions(params: Record<string, string | string[] | undefined>) {
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 160) : "";
  return { q, sort: params.sort === "importance" ? "importance" as const : "latest" as const,
    page: Math.max(1, Math.min(1000, Number.parseInt(String(params.page ?? "1"), 10) || 1)) };
}
