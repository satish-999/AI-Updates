import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/auth";
import { sessionAccount, reserveQuestion } from "@/lib/accounts";
import { askArchive, askStory } from "@/lib/agent";
import { sameOrigin, jsonBody } from "@/lib/request-security";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ note: "Forbidden" }, { status: 403 });
  const user = await sessionAccount(request.cookies.get(COOKIE)?.value);
  if (!user) return NextResponse.json({ note: "Please sign in." }, { status: 401 });
  let body;
  try { body = await jsonBody(request); } catch { return NextResponse.json({ note: "Invalid request." }, { status: 400 }); }
  const { question, storyId } = body;
  if (typeof question !== "string" || !question.trim() || question.length > 1200 || (storyId !== undefined && (typeof storyId !== "number" || !Number.isSafeInteger(storyId) || storyId < 1))) return NextResponse.json({ note: "Enter a question of up to 1,200 characters." }, { status: 400 });
  if (!await reserveQuestion(user.id)) return NextResponse.json({ note: "Your 10 daily archive questions are used. They reset at midnight UTC." }, { status: 429 });
  try {
    const answer = typeof storyId === "number" ? await askStory(storyId, question.trim()) : await askArchive(question.trim());
    return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ note: "The model is unavailable or its shared daily allowance is used. Try later." }, { status: 503 }); }
}
