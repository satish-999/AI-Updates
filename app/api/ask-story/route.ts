import { NextResponse, type NextRequest } from "next/server";
import { askStory } from "@/lib/agent";
import { identity } from "@/lib/identity";
import { reserveAccountAI } from "@/lib/entitlements";
import { sameRequestOrigin } from "@/lib/request-origin";
import { limitedBody } from "@/lib/http-input";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const user = await identity();
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  if (!sameRequestOrigin(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let body;
  try {
    body = JSON.parse(await limitedBody(req));
    if (!Number.isSafeInteger(body.storyId) || body.storyId < 1 || typeof body.question !== "string" || body.question.trim().length < 3 || body.question.length > 1200) throw new Error("Invalid");
  } catch { return NextResponse.json({ note: "Enter a question of 3–1,200 characters.", grounded: false, text: "" }, { status: 400 }); }
  try {
    await reserveAccountAI(user);
    const answer = await askStory(body.storyId, body.question.trim());
    return NextResponse.json({ text: answer.text, grounded: answer.grounded, note: answer.note });
  } catch (error) {
    const message = (error as Error).message;
    const note = /allowance|preview/i.test(message) ? message : /cap reached|quota/i.test(message) ? "The service-wide AI budget is used up. Try again after midnight UTC." : "AI answers are unavailable. You can still read the original sources.";
    return NextResponse.json({ text: "", grounded: false, note });
  }
}
