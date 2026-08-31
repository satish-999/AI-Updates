import { NextResponse, type NextRequest } from "next/server";
import { markRead } from "@/lib/db";
import { VIEWER_COOKIE } from "@/lib/auth";

/** Marks a story seen for THIS viewer. Powers Catch-up. */
export async function POST(req: NextRequest) {
  const { storyId } = (await req.json()) as { storyId?: number };
  const viewer = req.cookies.get(VIEWER_COOKIE)?.value;

  if (!storyId || !Number.isFinite(storyId) || !viewer) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await markRead(viewer, storyId);
  return NextResponse.json({ ok: true });
}
