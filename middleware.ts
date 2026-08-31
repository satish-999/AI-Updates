/**
 * Gates every route except the login page, the auth endpoint, and the PWA
 * assets a browser must fetch before a session exists.
 */

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyToken } from "./lib/auth";

const PUBLIC = ["/login", "/api/login", "/manifest.webmanifest", "/icon.svg"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  // Fail closed. A missing secret must lock the app, never open it — the
  // opposite default would silently expose the LLM endpoints on a misconfigured
  // deploy, which is exactly the case the gate exists for.
  if (!secret) {
    return NextResponse.redirect(new URL("/login?error=unconfigured", req.url));
  }

  if (await verifyToken(req.cookies.get(COOKIE)?.value, secret)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
