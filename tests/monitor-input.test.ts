import { test } from "node:test";
import assert from "node:assert/strict";
import { monitorId, monitorQuestion } from "../lib/monitor-input.ts";

test("normalizes whitespace while preserving search syntax and Unicode", () => {
  assert.equal(monitorQuestion('  "open source"   OR 日本 -ads '), '"open source" OR 日本 -ads');
});
test("rejects empty, oversized, non-text and punctuation-only monitor inputs", () => {
  for (const value of [null, {}, "", "a", " -- ", "x".repeat(241)]) assert.throws(() => monitorQuestion(value));
});
test("keeps bigint IDs exact and rejects SQL fragments or malformed IDs", () => {
  assert.equal(monitorId("9007199254740993"), "9007199254740993");
  for (const value of ["0", "-1", "1; delete", "1.5", "1e4", null]) assert.throws(() => monitorId(value));
});
