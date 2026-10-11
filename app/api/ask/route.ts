import { NextResponse, type NextRequest } from "next/server";
import { askArchive } from "@/lib/agent";
import { identity } from "@/lib/identity";
import { reserveAccountAI } from "@/lib/entitlements";
import { sameRequestOrigin } from "@/lib/request-origin";
import { limitedBody } from "@/lib/http-input";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const user = await identity();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  if (!sameRequestOrigin(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let question: string;
  try {
    const input = JSON.parse(await limitedBody(req));
    if (typeof input.question !== "string" || input.question.trim().length < 3 || input.question.length > 1200) throw new Error("Invalid");
    question = input.question.trim();
  } catch { return NextResponse.json({ error: "Enter a question of 3–1,200 characters." }, { status: 400 }); }
  try { await reserveAccountAI(user); return NextResponse.json(await askArchive(question)); }
  catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: /allowance|preview/i.test(message) ? message : "AI answers are unavailable or the service budget is exhausted. Read the matching sources below." }, { status: 503 });
  }
}
