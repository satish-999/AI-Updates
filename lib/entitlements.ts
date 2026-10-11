import { sqlClient } from "./db";
import { PLAN_LIMITS, paidAccess } from "./billing-policy";
import type { Identity } from "./identity";
export async function entitlement(user: Identity) {
  if (user.preview) return { name: "Preview", ...PLAN_LIMITS.free, paidUntil: null };
  const sql = sqlClient();
  const [row] = await sql`select paid_until from billing_accounts where owner_id = ${user.id}`;
  const pro = paidAccess(row?.paid_until);
  return { name: pro ? "Pro" : "Free", ...PLAN_LIMITS[pro ? "pro" : "free"], paidUntil: row?.paid_until ?? null };
}
export async function reserveAccountAI(user: Identity) {
  if (user.preview) throw new Error("Live AI is disabled in the local preview.");
  const limit = (await entitlement(user)).aiDaily;
  const sql = sqlClient();
  const rows = await sql`insert into account_usage(owner_id, day, attempts)
    values (${user.id}, (now() at time zone 'UTC')::date, 1)
    on conflict(owner_id, day) do update set attempts = account_usage.attempts + 1
    where account_usage.attempts < ${limit} returning attempts`;
  if (!rows.length) throw new Error("Your daily AI allowance is used up. It resets at midnight UTC.");
}
