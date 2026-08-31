import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  // Only the session goes. The viewer id stays so read history survives.
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
