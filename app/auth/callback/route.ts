import { NextRequest, NextResponse } from "next/server";
import { authClient, appOrigin } from "@/lib/supabase";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  let path = "/login?error=failed";
  try {
    if (code && code.length < 4096) {
      const { error } = await (await authClient()).auth.exchangeCodeForSession(code);
      if (!error) path = req.nextUrl.searchParams.get("next") === "reset" ? "/reset-password" : "/";
    }
    return NextResponse.redirect(new URL(path, appOrigin()));
  } catch { return NextResponse.redirect(new URL(path, req.url)); }
}
