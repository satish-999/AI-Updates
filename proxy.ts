import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "./lib/auth";
import { sessionAccount } from "./lib/accounts";
const PUBLIC = new Set(["/login", "/signup", "/recover", "/api/login", "/api/signup", "/api/recover", "/manifest.webmanifest", "/icon.svg"]);
export async function proxy(req: NextRequest) {
  if (PUBLIC.has(req.nextUrl.pathname)) return NextResponse.next();
  try {
    if (await sessionAccount(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  } catch {
    return new NextResponse("Account services are temporarily unavailable. Please try again shortly.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
