import { NextResponse, type NextRequest } from "next/server";
import { markRead } from "@/lib/db";
import { identity } from "@/lib/identity";
import { sameRequestOrigin } from "@/lib/request-origin";
import { limitedBody } from "@/lib/http-input";
export async function POST(req: NextRequest) {
  const user = await identity();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  if (!sameRequestOrigin(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (user.preview) return NextResponse.json({ ok: true, preview: true });
  try {
    const { storyId } = JSON.parse(await limitedBody(req, 1000));
    if (!Number.isSafeInteger(storyId) || storyId < 1) return NextResponse.json({ ok: false }, { status: 400 });
    await markRead(user.id, storyId);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
}
