import { NextResponse, type NextRequest } from "next/server";
import { markRead } from "@/lib/db";

/** Marks a story seen. Fired by the story page; powers Catch-up. */
export async function POST(req: NextRequest) {
  const { storyId } = (await req.json()) as { storyId?: number };
  if (!storyId || !Number.isFinite(storyId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await markRead(storyId);
  return NextResponse.json({ ok: true });
}
