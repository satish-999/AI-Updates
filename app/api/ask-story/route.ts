import { NextResponse, type NextRequest } from "next/server";
import { askStory } from "@/lib/agent";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { storyId, question } = (await req.json()) as {
    storyId?: number;
    question?: string;
  };

  if (!storyId || !Number.isFinite(storyId) || !question?.trim()) {
    return NextResponse.json({ text: "", grounded: false, note: "Bad request." }, { status: 400 });
  }

  try {
    const answer = await askStory(storyId, question.trim());
    return NextResponse.json({
      text: answer.text,
      grounded: answer.grounded,
      note: answer.note,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Quota exhaustion is the expected failure here, and saying so is more
    // useful than a generic error.
    const note = /cap reached|quota/i.test(msg)
      ? "The daily model budget is used up. It resets at midnight UTC."
      : "The model could not be reached. Try again shortly.";
    return NextResponse.json({ text: "", grounded: false, note });
  }
}
