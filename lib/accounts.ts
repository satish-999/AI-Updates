import { randomUUID } from "node:crypto";
import { sqlClient } from "./db";
import { SESSION_SECONDS } from "./auth";
import { hashPassword, verifyPassword, tokenHash, randomToken, validToken, DUMMY_PASSWORD_HASH } from "./passwords";

export type Account = { id: string; username: string; auth_version: number };
export async function createAccount(username: string, password: string) {
  const sql = sqlClient();
  const passwordHash = await hashPassword(password);
  const recoveryCode = randomToken();
  const [user] = await sql`
    insert into app_users (id, username, password_hash, recovery_hash)
    values (${randomUUID()}, ${username}, ${passwordHash}, ${tokenHash(recoveryCode)})
    on conflict (username) do nothing returning id, username, auth_version
  `;
  return user ? { user: user as Account, recoveryCode } : null;
}
export async function authenticate(username: string, password: string): Promise<Account | null> {
  const sql = sqlClient();
  const [user] = await sql`select id, username, auth_version, password_hash from app_users where username = ${username}`;
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  return user && valid ? { id: user.id, username: user.username, auth_version: user.auth_version } : null;
}
export async function createSession(userId: string, version: number): Promise<string> {
  const sql = sqlClient();
  const token = randomToken();
  const rows = await sql`insert into app_sessions (token_hash, user_id, auth_version, expires_at)
    select ${tokenHash(token)}, id, auth_version, now() + ${SESSION_SECONDS} * interval '1 second'
    from app_users where id = ${userId} and auth_version = ${version} returning token_hash`;
  if (!rows.length) throw new Error("Account changed; sign in again");
  return token;
}
export async function sessionAccount(token: string | undefined): Promise<Account | null> {
  if (!validToken(token)) return null;
  const sql = sqlClient();
  const [user] = await sql`select u.id, u.username, u.auth_version from app_sessions s
    join app_users u on u.id = s.user_id
    where s.token_hash = ${tokenHash(token)} and s.expires_at > now() and s.auth_version = u.auth_version`;
  return user as Account ?? null;
}
export async function revokeSession(token: string | undefined): Promise<void> {
  if (!validToken(token)) return;
  await sqlClient()`delete from app_sessions where token_hash = ${tokenHash(token)}`;
}
export async function recoverAccount(username: string, code: string, newPassword: string): Promise<string | null> {
  if (!validToken(code)) return null;
  const sql = sqlClient();
  const passwordHash = await hashPassword(newPassword);
  const recoveryCode = randomToken();
  // A consumed recovery code cannot win twice; revoke sessions in the same statement.
  const [updated] = await sql`
    with changed as (
      update app_users set auth_version = auth_version + 1, password_hash = ${passwordHash}, recovery_hash = ${tokenHash(recoveryCode)}
      where username = ${username} and recovery_hash = ${tokenHash(code)} returning id
    ), revoked as (
      delete from app_sessions where user_id in (select id from changed) returning token_hash
    ) select id from changed
  `;
  return updated ? recoveryCode : null;
}
/** Atomic reservation bounds attempts, including failures, across all instances. */
export async function reserveLimit(bucket: string, limit: number, seconds: number): Promise<boolean> {
  const sql = sqlClient();
  const rows = await sql`
    insert into app_rate_limits (bucket, window_start, hits)
    values (${bucket}, to_timestamp(floor(extract(epoch from now()) / ${seconds}) * ${seconds}), 1)
    on conflict (bucket, window_start) do update set hits = app_rate_limits.hits + 1
      where app_rate_limits.hits < ${limit}
    returning hits
  `;
  return rows.length > 0;
}
export async function reserveQuestion(userId: string): Promise<boolean> {
  return reserveLimit(`question:${userId}`, 10, 86400);
}
