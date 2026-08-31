import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE,
  VIEWER_COOKIE,
  createToken,
  cookieOptions,
  newViewerId,
  viewerCookieOptions,
} from "@/lib/auth";

/** Constant-time compare so the password cannot be probed character by character. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;

  // Fail closed on misconfiguration rather than letting anyone in.
  if (!expected || !secret) {
    return NextResponse.redirect(new URL("/login?error=unconfigured", req.url), 303);
  }

  if (!safeEqual(password, expected)) {
    return NextResponse.redirect(new URL("/login?error=1", req.url), 303);
  }

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(COOKIE, await createToken(secret), cookieOptions);

  // Keep an existing viewer id so read history survives signing out and back in.
  if (!req.cookies.get(VIEWER_COOKIE)?.value) {
    res.cookies.set(VIEWER_COOKIE, newViewerId(), viewerCookieOptions);
  }
  return res;
}
