import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAccount, authenticate, createSession, sessionAccount, revokeSession, recoverAccount, reserveLimit } from "../lib/accounts";
import { sqlClient } from "../lib/db";
import { saveProject, deleteProject, listProjects } from "../lib/projects";
import { tokenHash } from "../lib/passwords";
async function main() {
  const suffix = randomUUID().replaceAll("-", "").slice(0,16);
  const names = [`test_a_${suffix}`,`test_b_${suffix}`];
  const password = randomUUID() + randomUUID();
  const bucket = `test:${suffix}`;
  const sql = sqlClient();
  try {
    const a = await createAccount(names[0], password), b = await createAccount(names[1], password);
    assert.ok(a && b);
    assert.equal(await createAccount(names[0], password),null);
    assert.equal(await authenticate(names[0], "incorrect password"),null);
    assert.ok(await authenticate(names[0], password));
    const token = await createSession(a.user.id,a.user.auth_version);
    assert.equal((await sessionAccount(token))?.id,a.user.id);
    const project = await saveProject(a.user.id,{title:"Integration test",goal:"Temporary test data",requirements:{task:"anime",device:"browser",budget:0,commercial:false,recurringFree:true}});
    assert.ok(project);assert.equal((await listProjects(b.user.id)).length,0);
    assert.equal(await deleteProject(b.user.id,project),false);
    assert.equal((await listProjects(a.user.id)).length,1);
    const results=await Promise.all(Array.from({length:12},()=>reserveLimit(bucket,3,3600)));
    assert.equal(results.filter(Boolean).length,3);
    const newCode=await recoverAccount(names[0],a.recoveryCode,password+"new");assert.ok(newCode);
    assert.equal(await sessionAccount(token),null);
    assert.equal(await recoverAccount(names[0],a.recoveryCode,password),null);
    await assert.rejects(createSession(a.user.id,a.user.auth_version));
    const refreshed=await authenticate(names[0],password+"new");assert.ok(refreshed);
    const next=await createSession(refreshed.id,refreshed.auth_version);
    await sql`update app_sessions set expires_at=now()-interval '1 minute' where token_hash=${tokenHash(next)}`;
    assert.equal(await sessionAccount(next),null);
    const last=await createSession(refreshed.id,refreshed.auth_version);await revokeSession(last);assert.equal(await sessionAccount(last),null);
    console.log("Account integration passed: passwords, duplicate names, session expiry/revocation, recovery rotation, ownership isolation and concurrent limits.");
  } finally {
    await sql`delete from app_rate_limits where bucket=${bucket}`;
    await sql`delete from app_users where username=any(${names}::text[])`;
  }
}
main().catch(() => { console.error("Account integration failed; diagnostic details withheld to protect credentials."); process.exitCode=1; });
