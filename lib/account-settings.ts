import { sqlClient } from "./db";
import { authenticate, type Account } from "./accounts";
import { hashPassword, randomToken, tokenHash } from "./passwords";

export async function changePassword(user: Account, current: string, password: string) {
  const verified = await authenticate(user.username, current);
  if (!verified || verified.id !== user.id || verified.auth_version !== user.auth_version) return null;
  const hash = await hashPassword(password), code = randomToken();
  const [changed] = await sqlClient()`with changed as (
    update app_users set password_hash=${hash}, recovery_hash=${tokenHash(code)}, auth_version=auth_version+1
    where id=${user.id} and auth_version=${user.auth_version} returning id
  ), revoked as (delete from app_sessions where user_id in (select id from changed) returning token_hash)
  select id from changed`;
  return changed ? code : null;
}

export async function deleteAccount(user: Account, password: string): Promise<boolean> {
  const verified = await authenticate(user.username, password);
  if (!verified || verified.id !== user.id || verified.auth_version !== user.auth_version) return false;
  // Personal reading history is not a foreign key; remove it in the same statement.
  // Sessions and projects cascade. Shared news remains available to everyone.
  const [removed] = await sqlClient()`with removed as (
    delete from app_users where id=${user.id} and auth_version=${user.auth_version} returning id
  ), history as (
    delete from read_state where viewer_id in (select 'user:' || id::text from removed) returning viewer_id
  ) select id from removed`;
  return !!removed;
}
