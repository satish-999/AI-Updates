/** Compare browser Origin against the incoming Host. Next's internal request
 * URL may use a different hostname behind a proxy or custom server. */
export function sameRequestOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password && url.origin === origin &&
      url.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}
