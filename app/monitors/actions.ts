"use server";


import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/identity";
import { entitlement } from "@/lib/entitlements";
import { sqlClient } from "@/lib/db";
import { monitorId, monitorQuestion } from "@/lib/monitor-input";

async function owner() {
  const user = await requireIdentity();
  if (user.preview) redirect("/monitors?error=preview");
  return user;
}

export async function createMonitor(data: FormData) {
  const user = await owner();
  const viewer = user.id;
  let question: string;
  try { question = monitorQuestion(data.get("question")); }
  catch { redirect("/monitors?error=input"); }
  const sql = sqlClient();
  const limit = (await entitlement(user)).monitors;
  // A unique slot bounds concurrent creates as well as sequential requests.
  const rows = await sql`
    insert into saved_questions (viewer_id, slot, question)
    select ${viewer}, candidate, ${question} from generate_series(1,${limit}) candidate
    where not exists (select 1 from saved_questions where viewer_id = ${viewer} and slot = candidate)
    order by candidate limit 1 on conflict do nothing returning id
  `;
  redirect(rows.length ? "/monitors" : "/monitors?error=limit");
}

export async function changeMonitor(data: FormData) {
  const user = await owner();
  const viewer = user.id;
  const id = monitorId(data.get("id"));
  const sql = sqlClient();
  if (data.get("action") === "delete") {
    await sql`delete from saved_questions where id = ${id} and viewer_id = ${viewer}`;
  } else if (data.get("action") === "toggle") {
    await sql`update saved_questions set active = not active where id = ${id} and viewer_id = ${viewer}`;
  }
  redirect("/monitors");
}
