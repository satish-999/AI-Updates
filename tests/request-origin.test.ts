import { test } from "node:test";
import assert from "node:assert/strict";
import { sameRequestOrigin } from "../lib/request-origin.ts";
test("origin check uses the incoming host including local ports, not Next's internal URL", () => {
  assert.equal(sameRequestOrigin("http://127.0.0.1:3100", "127.0.0.1:3100"), true);
  assert.equal(sameRequestOrigin("https://example.com", "example.com"), true);
  for (const origin of [null, "null", "https://evil.com", "https://example.com.evil.com", "https://u:p@example.com", "https://example.com/path", "javascript:alert(1)", "https://example.com:9000"]) assert.equal(sameRequestOrigin(origin, "example.com"), false);
});
