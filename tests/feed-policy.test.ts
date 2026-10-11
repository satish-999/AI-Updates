import { test } from "node:test";
import assert from "node:assert/strict";
import { safeArticleUrl, freshness, feedOptions } from "../lib/feed-policy.ts";
test("publisher links permit only absolute HTTP(S) without credentials", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,a", "//evil.test", "/relative", "https://u:p@example.com", null]) assert.equal(safeArticleUrl(value), null);
  assert.equal(safeArticleUrl("https://example.com/article"), "https://example.com/article");
});
test("freshness handles missing, delayed, future and Date values", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  assert.equal(freshness(null, now), "unknown"); assert.equal(freshness("bad", now), "unknown");
  assert.equal(freshness(new Date(now - 1000), now), "recent");
  assert.equal(freshness(new Date(now - 7200000), now), "delayed");
  assert.equal(freshness(new Date(now + 86400000), now), "unknown");
});
test("feed parameters are bounded and normalized", () => {
  assert.deepEqual(feedOptions({ q: ["unexpected"], page: "-1", sort: "bad" }), { q: "", page: 1, sort: "latest" });
  assert.equal(feedOptions({ q: "x".repeat(1000), page: "999999" }).q.length, 160);
  assert.equal(feedOptions({ page: "999999" }).page, 1000);
});
