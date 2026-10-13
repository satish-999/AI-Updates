import { createHmac } from "node:crypto";
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
export function clientBucket(request: Request): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Authentication configuration unavailable");
  // Vercel sets forwarded client addresses; unknown hosts share a conservative bucket.
  const address = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 100);
  return createHmac("sha256", secret).update(address).digest("hex");
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("JSON required");
  if (Number(request.headers.get("content-length") ?? 0) > 16384) throw new Error("Request too large");
  const text = await request.text();
  if (text.length > 16384) throw new Error("Request too large");
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Object required");
  return value as Record<string, unknown>;
}
