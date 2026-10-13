import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/auth";
import { sessionAccount, reserveLimit } from "@/lib/accounts";
import { saveProject, deleteProject } from "@/lib/projects";
import { projectInput } from "@/lib/project-input";
import { sameOrigin, jsonBody } from "@/lib/request-security";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await sessionAccount(request.cookies.get(COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!await reserveLimit(`project:${user.id}`, 30, 3600)) return NextResponse.json({ error: "Please try again later." }, { status: 429 });
  let body;
  try { body = await jsonBody(request); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (body.action === "delete") {
    if (typeof body.id !== "string" || !/^[a-f0-9-]{36}$/.test(body.id)) return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    const removed = await deleteProject(user.id, body.id);
    return NextResponse.json({ ok: removed }, { status: removed ? 200 : 404 });
  }
  const project = projectInput(body);
  if (!project) return NextResponse.json({ error: "Invalid project details" }, { status: 400 });
  const id = await saveProject(user.id, project);
  return NextResponse.json(id ? { id } : { error: "Your account has reached the 100-project limit." }, { status: id ? 201 : 409 });
}
