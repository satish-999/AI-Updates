export const UPDATE_CATEGORIES = ["model_release", "product", "research"] as const;
export const NEWS_CATEGORIES = ["funding", "people", "policy", "business", "unclassified"] as const;
export type FeedKind = "updates" | "news";
export type FeedOptions = { category: string; query: string; page: number };
export function feedOptions(kind: FeedKind, params: Record<string, string | string[] | undefined>): FeedOptions {
  const categories: readonly string[] = kind === "updates" ? UPDATE_CATEGORIES : NEWS_CATEGORIES;
  const category = typeof params.category === "string" && categories.includes(params.category) ? params.category : "all";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 160) : "";
  const page = typeof params.page === "string" && /^\d{1,4}$/.test(params.page)
    ? Math.min(1000, Math.max(1, Number(params.page))) : 1;
  return { category, query, page };
}
export function feedHref(kind: FeedKind, options: FeedOptions, page: number): string {
  const params = new URLSearchParams();
  if (options.category !== "all") params.set("category", options.category);
  if (options.query) params.set("q", options.query);
  if (page > 1) params.set("page", String(page));
  return `/${kind}${params.size ? `?${params}` : ""}`;
}
