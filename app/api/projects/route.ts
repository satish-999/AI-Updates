import { NextRequest, NextResponse } from "next/server";
import { identity } from "@/lib/identity";
import { entitlement } from "@/lib/entitlements";
import { validateAdvisor } from "@/lib/advisor";
import { sqlClient } from "@/lib/db";
import { sameRequestOrigin } from "@/lib/request-origin";
import { limitedBody } from "@/lib/http-input";

export async function GET() {
  const user = await identity();
  if (!user || user.preview) return NextResponse.json({ error: "Sign in with your account to sync projects." }, { status: 401 });
  try {
    const sql = sqlClient();
    const projects = await sql`select id, input, created_at as "savedAt" from account_projects where owner_id = ${user.id} order by created_at desc limit 100`;
    return NextResponse.json({ projects }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Project storage is unavailable." }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const user = await identity();
  if (!user || user.preview) return NextResponse.json({ error: "Sign in with your account to save projects." }, { status: 401 });
  if (!sameRequestOrigin(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let input;
  try { input = validateAdvisor(JSON.parse(await limitedBody(req))); } catch { return NextResponse.json({ error: "Invalid project requirements." }, { status: 400 }); }
  try {
    const limit = (await entitlement(user)).projects;
    const sql = sqlClient();
    const rows = await sql`insert into account_projects(owner_id, slot, input)
      select ${user.id}, candidate, ${JSON.stringify(input)}::jsonb from generate_series(1, ${limit}) candidate
      where not exists(select 1 from account_projects where owner_id = ${user.id} and slot = candidate)
      order by candidate limit 1 on conflict do nothing returning id`;
    return rows.length ? NextResponse.json({ saved: true }) : NextResponse.json({ error: "Your project limit is reached. Delete a project or upgrade." }, { status: 409 });
  } catch { return NextResponse.json({ error: "Project storage is unavailable." }, { status: 503 }); }
}
export async function DELETE(req: NextRequest) {
  const user = await identity();
  if (!user || user.preview) return NextResponse.json({ error: "Sign in with your account." }, { status: 401 });
  if (!sameRequestOrigin(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid project." }, { status: 400 });
  try {
    const sql = sqlClient();
    await sql`delete from account_projects where id = ${id} and owner_id = ${user.id}`;
    return NextResponse.json({ deleted: true });
  } catch { return NextResponse.json({ error: "Could not delete project." }, { status: 503 }); }
}
