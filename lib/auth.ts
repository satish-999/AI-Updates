/**
 * Single-user auth.
 *
 * One user means no roles, no registration and no identity provider. A
 * password check sets a signed cookie; middleware gates everything else.
 * NextAuth would add a dependency and a provider round trip to solve a problem
 * that does not exist here.
 *
 * What does exist: the app sits on a guessable public URL, and an ungated
 * /api/ask is a free LLM endpoint for anyone who finds it. The gate protects
 * the quota, not just the content.
 *
 * Uses Web Crypto so the same code runs in Edge middleware and in Node.
 */

export const COOKIE = "pulse_session";
const MAX_AGE_DAYS = 30;

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(sig);
}

/** Constant-time compare, so a wrong token cannot be found byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createToken(secret: string): Promise<string> {
  const expires = Date.now() + MAX_AGE_DAYS * 86_400_000;
  const payload = String(expires);
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function verifyToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  if (!safeEqual(signature, await hmac(payload, secret))) return false;

  const expires = Number(payload);
  return Number.isFinite(expires) && expires > Date.now();
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_DAYS * 86_400,
};
