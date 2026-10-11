import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const root = new URL("../", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const alice = "11111111-1111-4111-8111-111111111111", bob = "22222222-2222-4222-8222-222222222222";
test("account project limits and owner-scoped list/delete execute against PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(read("db/008_accounts.sql")); await db.exec(read("db/008_accounts.sql"));
    const route = read("app/api/projects/route.ts");
    const create = route.match(/const rows = await sql`([\s\S]*?)`;/)[1].replaceAll('${user.id}','$1').replaceAll('${JSON.stringify(input)}','$2').replaceAll('${limit}','$3');
    for (let n=0;n<5;n++) await db.query(create,[alice,JSON.stringify({brief:"Alice confidential project"}),3]);
    await db.query(create,[bob,JSON.stringify({brief:"Bob private project"}),3]);
    assert.equal((await db.query("select count(*)::int n from account_projects where owner_id=$1",[alice])).rows[0].n,3);
    const list = route.match(/const projects = await sql`([\s\S]*?)`;/)[1].replaceAll('${user.id}','$1');
    const aliceRows = (await db.query(list,[alice])).rows;
    const bobRows = (await db.query(list,[bob])).rows;
    assert.equal(bobRows.length,1); assert.ok(aliceRows.every(r=>r.input.brief.startsWith("Alice")));
    const del = route.match(/await sql`(delete from account_projects[\s\S]*?)`;/)[1].replaceAll('${id}','$1').replaceAll('${user.id}','$2');
    await db.query(del,[aliceRows[0].id,bob]); assert.equal((await db.query(list,[alice])).rows.length,3);
    await db.query(del,[aliceRows[0].id,alice]); assert.equal((await db.query(list,[alice])).rows.length,2);
    await db.query(create,[alice,'{}',100]); await db.query(create,[alice,'{}',100]);
    assert.equal((await db.query(list,[alice])).rows.length,4);
    // Downgrade never deletes data, but cannot allocate slots beyond Free.
    assert.equal((await db.query(create,[alice,'{}',3])).rows.length,0);
  } finally { await db.close(); }
});
test("account AI reservations bound attempts and remain isolated per user", async () => {
  const db = new PGlite();
  try {
    await db.exec(read("db/008_accounts.sql"));
    const source = read("lib/entitlements.ts");
    const query = source.match(/const rows = await sql`([\s\S]*?)`;/)[1].replaceAll('${user.id}','$1').replaceAll('${limit}','$2');
    for (let i=0;i<5;i++) assert.equal((await db.query(query,[alice,5])).rows.length,1);
    assert.equal((await db.query(query,[alice,5])).rows.length,0);
    assert.equal((await db.query(query,[bob,5])).rows.length,1);
    assert.equal((await db.query(query,[alice,50])).rows.length,1);
  } finally { await db.close(); }
});
test("billing snapshots reject stale updates and event receipts are idempotent", async () => {
  const db = new PGlite();
  try {
    await db.exec(read("db/008_accounts.sql"));
    await db.query("insert into billing_accounts(owner_id,plan_id) values($1,'plan_test')",[alice]);
    const source = read("lib/razorpay.ts");
    const query = source.match(/await sql`(with updated[\s\S]*?)`;/)[1]
      .replaceAll('${id}','$1').replaceAll('${sub.status}','$2').replaceAll('${until}','$3').replaceAll('${url}','$4').replaceAll('${version}','$5').replaceAll('${account.owner_id}','$6').replaceAll('${eventId ?? "sync:" + version}','$7').replaceAll('${account.intent_id}','$8');
    const intent = (await db.query('select intent_id from billing_accounts')).rows[0].intent_id;
    await db.query(query,["sub_test","active","2030-01-01",null,"2",alice,"evt_new",intent]);
    await db.query(query,["sub_test","created",null,null,"1",alice,"evt_old",intent]);
    await db.query(query,["sub_test","active","2030-01-01",null,"2",alice,"evt_new",intent]);
    const [row] = (await db.query("select status,sync_version::int from billing_accounts")).rows;
    assert.equal(row.status,"active"); assert.equal(row.sync_version,2);
    assert.equal((await db.query("select count(*)::int n from billing_events")).rows[0].n,1);
    assert.equal((await db.query("insert into billing_accounts(owner_id,plan_id) values($1,'plan_test') on conflict(owner_id) do nothing returning owner_id",[alice])).rows.length,0);
  } finally { await db.close(); }
});
