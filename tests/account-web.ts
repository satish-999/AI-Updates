/** Smoke-test the deployed visitor flow without printing credentials or cookies. */
import { randomUUID } from "node:crypto";
import { sqlClient } from "../lib/db";
const origin = "https://ai-updates-git-codex-ai-pulse-product-satish-999.vercel.app";
const username = `web_${randomUUID().replaceAll("-", "").slice(0,16)}`;
const password = randomUUID() + randomUUID();
let phase = "waiting for public signup";
async function post(path: string, body: object, cookie = "", requestOrigin = origin) {
  return fetch(origin + path, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/json", Origin: requestOrigin, Cookie: cookie }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
}
function requireStatus(actual: number, expected: number) {
  if (actual !== expected) throw new Error(`HTTP ${actual}; expected ${expected}`);
}
async function main() {
  let ready = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await fetch(origin + "/signup", { redirect: "manual", signal: AbortSignal.timeout(15000) });
    if (response.status === 200 && (await response.text()).includes('name="username"')) { ready = true; break; }
    if (response.status === 401 || response.status === 403 || (response.headers.get("location") ?? "").includes("vercel.com")) throw new Error("Vercel visitor access protection blocks the public signup page");
    await new Promise(resolve => setTimeout(resolve,5000));
  }
  if (!ready) throw new Error("New signup page did not become available");
  phase = "cross-origin rejection";
  requireStatus((await post("/api/signup",{username,password},"","https://untrusted.example")).status,403);
  phase = "customer signup";
  const signup = await post("/api/signup",{username,password});requireStatus(signup.status,200);
  const data = await signup.json();
  if (typeof data.recoveryCode !== "string" || data.recoveryCode.length !== 64) throw new Error("Recovery code missing");
  const cookie = signup.headers.getSetCookie().find(c => c.startsWith("pulse_account_session="))?.split(";")[0];
  if (!cookie) throw new Error("Session cookie missing");
  phase = "authenticated projects";
  const page = await fetch(origin+"/projects",{headers:{Cookie:cookie},redirect:"manual",signal:AbortSignal.timeout(30000)});
  requireStatus(page.status,200);
  if (!(await page.text()).includes(username)) throw new Error("Account identity missing on projects page");
  phase = "private project save";
  requireStatus((await post("/api/projects",{title:"Temporary web test",goal:"Verify the customer flow",requirements:{task:"anime",device:"browser",budget:0,commercial:false,recurringFree:true}},cookie)).status,201);
  phase = "logout";
  requireStatus((await post("/api/logout",{},cookie)).status,303);
  phase = "revoked session rejection";
  requireStatus((await post("/api/projects",{},cookie)).status,401);
  phase = "password login";
  requireStatus((await post("/api/login",{username,password})).status,200);
  console.log("Deployed visitor flow passed: public signup, recovery code, signed-in projects, save, logout and password login.");
}
main().catch(error => { console.error(`Web account check failed at ${phase}: ${error instanceof Error ? error.message : "unexpected error"}`); process.exitCode=1; }).finally(async () => {
  await sqlClient()`delete from app_users where username=${username}`;
  await sqlClient()`delete from app_rate_limits where bucket=any(${["auth:signup:name:"+username,"auth:login:name:"+username]}::text[])`;
});
