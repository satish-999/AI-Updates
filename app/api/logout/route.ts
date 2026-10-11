import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/auth";
import { authClient } from "@/lib/supabase";
import { sameRequestOrigin } from "@/lib/request-origin";
export async function POST(req: NextRequest) {
  if (!sameRequestOrigin(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (process.env.AUTH_MODE !== "preview") { try { await (await authClient()).auth.signOut({ scope: "local" }); } catch {} }
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
