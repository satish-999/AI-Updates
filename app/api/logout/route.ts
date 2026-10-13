import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, cookieOptions } from "@/lib/auth";
import { revokeSession } from "@/lib/accounts";
import { sameOrigin } from "@/lib/request-security";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  await revokeSession(req.cookies.get(COOKIE)?.value);
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.set(COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return res;
}
