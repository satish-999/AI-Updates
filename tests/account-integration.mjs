/** Local integration harness: synthetic auth/payment providers + embedded PostgreSQL.
 * No real email, payment, model, or production database request is made. */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const dir = fileURLToPath(new URL("../", import.meta.url));
process.chdir(dir);
process.env.AUTH_MODE = "supabase";
process.env.SUPABASE_URL = "https://accounts.test";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-placeholder";
process.env.APP_URL = "http://127.0.0.1:3131";
process.env.DATABASE_URL = "postgresql://test:placeholder@database.test/db";
process.env.BILLING_ENABLED = "true";
process.env.RAZORPAY_KEY_ID = "rzp_test_synthetic";
process.env.RAZORPAY_KEY_SECRET = "test-key-placeholder";
process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-placeholder";
process.env.RAZORPAY_PLAN_ID = "plan_test";
process.env.SUPPORT_EMAIL = "support@example.test";
process.env.BUSINESS_NAME = "Synthetic integration fixture";
process.env.REFUND_POLICY = "Test fixture; no real payment.";
delete process.env.GEMINI_API_KEY; delete process.env.GROQ_API_KEY;

const db = new PGlite();
await db.exec(readFileSync("db/008_accounts.sql", "utf8"));
const users = new Map(); const tokens = new Map(); const subscriptions = new Map();
let idCounter = 0; let paymentCreates = 0; let emailRequests = 0;
const nativeFetch = globalThis.fetch;
function json(value, status=200) { return Response.json(value, { status }); }
function session(user) {
  const token = Buffer.from(JSON.stringify({ alg:"HS256",typ:"JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub:user.id, exp:Math.floor(Date.now()/1000)+3600, email:user.email, role:"authenticated" })).toString("base64url") + ".synthetic";
  tokens.set(token,user);
  return { access_token:token, refresh_token:"refresh-"+user.id, token_type:"bearer", expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user };
}
globalThis.fetch = async (resource, options={}) => {
  const url = new URL(typeof resource === "string" || resource instanceof URL ? resource : resource.url);
  const headers = new Headers(options.headers ?? (resource instanceof Request ? resource.headers : {}));
  const raw = options.body ?? (resource instanceof Request ? await resource.text() : "");
  if (url.hostname === "accounts.test") {
    const body = raw ? JSON.parse(String(raw)) : {};
    if (url.pathname.endsWith("/signup")) { emailRequests++; return json({ user: { email:body.email, identities:[] }, session:null }); }
    if (url.pathname.endsWith("/recover")) { emailRequests++; return json({}); }
    if (url.pathname.endsWith("/token")) {
      const user = users.get(body.email);
      if (!user || body.password !== "synthetic-password-123") return json({ msg:"Invalid login credentials", error_code:"invalid_credentials" },400);
      return json(session(user));
    }
    if (url.pathname.endsWith("/user")) {
      const user = tokens.get((headers.get("authorization") ?? "").replace("Bearer ",""));
      return user ? json(user) : json({ msg:"Invalid token", error_code:"bad_jwt" },401);
    }
    if (url.pathname.endsWith("/logout")) return new Response(null,{status:204});
    throw new Error("Unexpected auth endpoint");
  }
  if (url.hostname === "api.razorpay.com") {
    if (url.pathname === "/v1/plans/plan_test") return json({ id:"plan_test",period:"monthly",interval:1,item:{name:"Pro test",amount:19900,currency:"INR"} });
    if (url.pathname === "/v1/subscriptions" && options.method === "POST") {
      paymentCreates++;
      const body=JSON.parse(String(raw)); const id="sub_test"+paymentCreates;
      const sub={id,plan_id:body.plan_id,notes:body.notes,status:"created",paid_count:0,current_end:null,short_url:"https://rzp.io/rzp/"+id};
      subscriptions.set(id,sub); return json(sub);
    }
    const match=url.pathname.match(/^\/v1\/subscriptions\/(sub_test\d+)(\/cancel)?$/);
    if (match) {
      const sub=subscriptions.get(match[1]); if (!sub) return json({},404);
      return json(sub);
    }
    throw new Error("Unexpected billing endpoint");
  }
  if (url.pathname.endsWith("/sql")) {
    const body=JSON.parse(String(raw));
    async function query(q) {
      const result=await db.query(q.query,q.params);
      return { fields:result.fields, rows:result.rows.map(row=>result.fields.map(f=>{const v=row[f.name];return v==null?null:v instanceof Date?v.toISOString().replace("T"," ").replace("Z","+00"):typeof v==="object"?JSON.stringify(v):String(v);})), rowCount:result.affectedRows ?? result.rows.length, command:"SELECT" };
    }
    try { return json(body.queries ? {results:await Promise.all(body.queries.map(query))} : await query(body)); }
    catch { return json({message:"Synthetic database query failed",code:"XX000"},400); }
  }
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return nativeFetch(resource,options);
  throw new Error("External network forbidden by integration harness: "+url.hostname);
};
const next = (await import("next")).default;
const app=next({ dev:false,dir,hostname:"127.0.0.1",port:3131 });
await app.prepare();
const server=createServer(app.getRequestHandler());
await new Promise(resolve=>server.listen(3131,"127.0.0.1",resolve));
const origin="http://127.0.0.1:3131";
function browser() {
  const jar=new Map();
  return async (path, init={}) => {
    const headers=new Headers(init.headers); headers.set("cookie",[...jar].map(([k,v])=>k+"="+v).join("; "));
    if (init.method && init.method !== "GET") headers.set("origin",origin);
    const r=await nativeFetch(origin+path,{...init,headers,redirect:"manual"});
    for (const cookie of r.headers.getSetCookie()) { const [pair]=cookie.split(";"); const dot=pair.indexOf("="); jar.set(pair.slice(0,dot),pair.slice(dot+1)); }
    return r;
  };
}
async function action(client,path,fields) {
  const page=await client(path); const html=await page.text();
  const names=[...html.matchAll(/name="(\$ACTION_ID_[^"]+)"/g)].map(m=>m[1]);
  assert.ok(names.length,"Server action form missing: "+path);
  const form=new FormData(); form.set(names[0],"");
  for (const [key,value] of Object.entries(fields)) form.set(key,String(value));
  return client(path,{method:"POST",body:form});
}
try {
  const alice=browser(), bob=browser(), outsider=browser();
  for (const email of ["alice@example.test","bob@example.test"]) {
    const id=(++idCounter===1?"11111111-1111-4111-8111-111111111111":"22222222-2222-4222-8222-222222222222");
    users.set(email,{id,email,email_confirmed_at:new Date().toISOString(),aud:"authenticated",role:"authenticated",app_metadata:{provider:"email",providers:["email"]},user_metadata:{},created_at:new Date().toISOString()});
  }
  assert.equal((await outsider("/api/projects")).status,401);
  const signup=await action(outsider,"/signup",{mode:"signup",email:"new@example.test",password:"synthetic-password-123"});
  assert.equal(signup.status,303); assert.ok(signup.headers.get("location").includes("notice=verify"));
  assert.equal((await action(outsider,"/forgot-password",{mode:"recover",email:"unknown@example.test"})).status,303);
  assert.equal(emailRequests,2);
  for (const [client,email] of [[alice,"alice@example.test"],[bob,"bob@example.test"]]) {
    const login=await action(client,"/login",{mode:"login",email,password:"synthetic-password-123"});
    assert.equal(login.status,303); assert.equal(login.headers.get("location"),"/");
    assert.equal((await client("/account")).status,200);
  }
  const input={brief:"Create an original anime film",goal:"anime",budget:0,device:"browser",use:"personal",experience:"beginner"};
  const save=client=>client("/api/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)});
  for(let i=0;i<3;i++) assert.equal((await save(alice)).status,200);
  assert.equal((await save(alice)).status,409); assert.equal((await save(bob)).status,200);
  const projects=await (await alice("/api/projects")).json(); assert.equal(projects.projects.length,3);
  await bob("/api/projects?id="+projects.projects[0].id,{method:"DELETE"});
  assert.equal((await (await alice("/api/projects")).json()).projects.length,3);
  // Submit the checkout form, not the separate status-refresh form.
  const html=await (await alice("/account")).text();
  const checkoutForm=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(f=>f.includes('name="amount"'));
  assert.ok(checkoutForm);
  const actionIds=[...checkoutForm.matchAll(/name="(\$ACTION_ID_[^"]+)"/g)];
  const form=new FormData();form.set(actionIds.at(-1)[1],"");form.set("amount","19900");form.set("consent","yes");
  const start=await alice("/account",{method:"POST",body:form});
  assert.equal(start.status,303); assert.ok(start.headers.get("location").startsWith("https://rzp.io/"));
  assert.equal(paymentCreates,1);
  const retry = await alice("/account",{method:"POST",body:form});
  assert.equal(retry.status,303); assert.equal(paymentCreates,1,"checkout retry reuses the existing subscription");
  assert.equal((await save(alice)).status,409,"checkout redirect does not grant access");
  const sub=[...subscriptions.values()][0];sub.status="active";sub.paid_count=1;sub.current_end=Math.floor(Date.now()/1000)+86400*30;
  const raw=JSON.stringify({event:"subscription.charged",payload:{subscription:{entity:{id:sub.id}}}});
  const signature=createHmac("sha256",process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
  const webhook=signature=>nativeFetch(origin+"/api/billing/webhook",{method:"POST",headers:{"content-type":"application/json","x-razorpay-event-id":"evt_test","x-razorpay-signature":signature},body:raw});
  assert.equal((await webhook("bad")).status,401);
  assert.equal((await webhook(signature)).status,200); assert.equal((await webhook(signature)).status,200);
  assert.equal((await save(alice)).status,200,"verified payment grants Pro");
  assert.equal((await db.query("select count(*)::int n from billing_events")).rows[0].n,1);
  const cancelHtml=await (await alice("/account")).text();
  const cancelForm=[...cancelHtml.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(f=>f.includes('name="confirm"'));
  assert.ok(cancelForm); const cancelData=new FormData();
  cancelData.set(cancelForm.match(/name="(\$ACTION_ID_[^"]+)"/)[1],"");cancelData.set("confirm","cancel");
  assert.equal((await alice("/account",{method:"POST",body:cancelData})).status,303);
  assert.equal((await db.query("select cancel_requested from billing_accounts")).rows[0].cancel_requested,true);
  assert.equal((await save(alice)).status,200,"cancel at cycle end preserves current paid access");
  sub.status="cancelled";sub.current_end=Math.floor(Date.now()/1000)-1;
  const expiredRaw=JSON.stringify({event:"subscription.cancelled",payload:{subscription:{entity:{id:sub.id}}}});
  const expiredSignature=createHmac("sha256",process.env.RAZORPAY_WEBHOOK_SECRET).update(expiredRaw).digest("hex");
  assert.equal((await nativeFetch(origin+"/api/billing/webhook",{method:"POST",headers:{"x-razorpay-event-id":"evt_expired","x-razorpay-signature":expiredSignature},body:expiredRaw})).status,200);
  assert.equal((await save(alice)).status,409,"expired access returns to Free without deleting saves");
  const restart=await alice("/account",{method:"POST",body:form});assert.equal(restart.status,303);assert.equal(paymentCreates,2);
  assert.equal((await db.query("select count(*)::int n from billing_history")).rows[0].n,1);
  assert.equal((await alice("/api/logout",{method:"POST"})).status,303);
  assert.equal((await alice("/api/projects")).status,401);
  console.log("PASS: real Next server actions for signup/recovery/login, verified sessions, two-account private saves, Free limits, hosted checkout without premature access, webhook signature/retry, Pro upgrade, cancellation, expiry, resubscription and logout. All services synthetic.");
} catch(error) { console.error(error); process.exitCode = 1; } finally {
  await new Promise(resolve=>server.close(resolve)); await app.close(); await db.close();
}
