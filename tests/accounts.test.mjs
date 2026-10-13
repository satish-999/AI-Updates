import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, normalizeUsername, validPassword, randomToken, tokenHash, validToken } from "../lib/passwords.ts";
import { sameOrigin, jsonBody } from "../lib/request-security.ts";
import { projectInput } from "../lib/project-input.ts";
test("password hashes are salted and reject wrong passwords and malformed hashes", async () => {
  const password = "a long test password 123!";
  const a = await hashPassword(password), b = await hashPassword(password);
  assert.notEqual(a,b); assert.ok(await verifyPassword(password,a));
  assert.equal(await verifyPassword("another long password",a),false);
  assert.equal(await verifyPassword(password,"bad"),false);
});
test("usernames normalize and passwords have bounded lengths", () => {
  assert.equal(normalizeUsername(" Alice_123 "),"alice_123");
  for (const name of ["a","a@b.com","1alice","a b",null]) assert.equal(normalizeUsername(name),null);
  assert.equal(validPassword("short"),false); assert.equal(validPassword("x".repeat(129)),false);
});
test("sessions are unpredictable and hashes do not expose the token", () => {
  const a=randomToken(),b=randomToken(); assert.notEqual(a,b);assert.ok(validToken(a));assert.notEqual(tokenHash(a),a);assert.equal(tokenHash(a),tokenHash(a));assert.equal(validToken("old.signed.cookie"),false);
});
test("mutations reject absent, cross-site and deceptive origins", () => {
  for (const origin of [null,"https://evil.example","https://app.example.evil.test"]) assert.equal(sameOrigin(new Request("https://app.example/api/signup",{headers:origin?{origin}:{}})),false);
  assert.ok(sameOrigin(new Request("https://app.example/api/signup",{headers:{origin:"https://app.example"}})));
});
test("request bodies reject non-objects and oversized input", async () => {
  for (const body of ["[]","null","x".repeat(16385)]) await assert.rejects(jsonBody(new Request("https://app.example",{method:"POST",headers:{"Content-Type":"application/json"},body})));
});
test("saved project input strips forged ownership and rejects invalid requirements", () => {
  const body={title:" Project ",goal:" Idea ",user_id:"someone-else",requirements:{task:"anime",device:"phone",budget:0,commercial:false,recurringFree:true}};
  const result=projectInput(body);assert.equal(result.title,"Project");assert.equal(result.user_id,undefined);
  assert.equal(projectInput({...body,requirements:{...body.requirements,budget:-1}}),null);
  assert.equal(projectInput({...body,goal:""}),null);
});
