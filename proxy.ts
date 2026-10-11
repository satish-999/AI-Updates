import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { COOKIE, verifyToken } from "./lib/auth";

const PUBLIC = ["/login", "/signup", "/forgot-password", "/auth/confirm", "/auth/callback", "/api/login", "/api/billing/webhook", "/pricing", "/privacy", "/terms", "/manifest.webmanifest", "/icon.svg"];
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const publicRoute = PUBLIC.includes(pathname);
  let response = NextResponse.next({ request: req });
  let valid = false;
  let configured = true;
  if (process.env.AUTH_MODE === "preview") {
    // Preview bypass is only available on loopback, even if accidentally deployed.
    if (process.env.VERCEL || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.get("host") ?? "")) return NextResponse.json({ error: "Preview is local only." }, { status: 503 });
    configured = !!process.env.AUTH_SECRET && !!process.env.APP_PASSWORD;
    valid = configured && await verifyToken(req.cookies.get(COOKIE)?.value, process.env.AUTH_SECRET!);
  } else {
    const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    configured = !!url && !!key;
    if (configured && !publicRoute) {
      const client = createServerClient(url!, key!, {
        cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
        cookies: { getAll: () => req.cookies.getAll(), setAll: values => {
          values.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        } },
      });
      try { const { data: { user } } = await client.auth.getUser(); valid = !!user?.email_confirmed_at; } catch { valid = false; }
    }
  }
  if (!publicRoute && !valid) {
    const denied = pathname.startsWith("/api/")
      ? NextResponse.json({ error: configured ? "Sign in to continue." : "Account sign-in is not configured yet." }, { status: configured ? 401 : 503 })
      : NextResponse.redirect(new URL(configured ? "/login" : "/login?error=unconfigured", req.url));
    response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
    response = denied;
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
