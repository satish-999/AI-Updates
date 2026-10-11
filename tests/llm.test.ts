import { test } from "node:test";
import assert from "node:assert/strict";
import { generate, QuotaExhausted } from "../src/llm.ts";

test("model wrapper reserves attempts, fails closed without quota DB, and never calls over the cap", async () => {
  const originalFetch = globalThis.fetch;
  const keys = ["DATABASE_URL", "GEMINI_API_KEY", "GROQ_API_KEY", "LLM_DAILY_CAP"] as const;
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  let reservations = 0; let modelCalls = 0; let failModel = false;
  try {
    process.env.GEMINI_API_KEY = "unit-test-placeholder";
    delete process.env.GROQ_API_KEY;
    delete process.env.DATABASE_URL;
    process.env.LLM_DAILY_CAP = "2";
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("generativelanguage.googleapis.com")) {
        modelCalls++;
        assert.ok(reservations >= modelCalls, "must reserve BEFORE the provider call");
        return failModel ? new Response("test failure", { status: 400 }) : Response.json({ candidates: [{ content: { parts: [{ text: "test answer" }] } }] });
      }
      const request = JSON.parse(String(options?.body));
      const insert = String(request.query).includes("insert into llm_calls");
      if (insert) reservations++;
      return Response.json({ fields: [{ name: insert ? "calls" : "total", dataTypeID: 23 }], rows: [[String(reservations)]], rowCount: 1, command: insert ? "INSERT" : "SELECT" });
    };
    await assert.rejects(generate("test"), /quota fuse/);
    assert.equal(modelCalls, 0);
    process.env.DATABASE_URL = "postgresql://test:placeholder@unit-test.invalid/test";
    assert.equal(await generate("test"), "test answer");
    failModel = true;
    await assert.rejects(generate("test"), /gemini 400/);
    assert.equal(reservations, 2, "failed provider attempt still consumes a slot");
    await assert.rejects(generate("test"), QuotaExhausted);
    assert.equal(modelCalls, 2, "over-cap reservation must not reach the provider");
  } finally {
    globalThis.fetch = originalFetch;
    for (const k of keys) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; }
  }
});
