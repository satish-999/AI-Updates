import { NextResponse, type NextRequest } from "next/server";
import { markRead } from "@/lib/db";
import { COOKIE } from "@/lib/auth";
import { sessionAccount } from "@/lib/accounts";
import { sameOrigin, jsonBody } from "@/lib/request-security";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const user = await sessionAccount(req.cookies.get(COOKIE)?.value);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  let storyId: unknown;
  try { ({ storyId } = await jsonBody(req)); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (typeof storyId !== "number" || !Number.isSafeInteger(storyId) || storyId < 1) return NextResponse.json({ ok: false }, { status: 400 });
  await markRead(`user:${user.id}`, storyId);
  return NextResponse.json({ ok: true });
}
