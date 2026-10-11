import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogFresh, detectGoal, recommend, validateAdvisor, type AdvisorInput } from "../lib/advisor.ts";
import { CATALOG, GOALS } from "../lib/catalog.ts";
const now = Date.parse("2026-10-10T12:00:00Z");
const base: AdvisorInput = { brief: "Create an original anime short for my channel", goal: "anime", budget: 0, device: "browser", use: "personal", experience: "beginner" };
test("auto detection prioritizes anime over generic video and declines unsupported work", () => {
  assert.equal(detectGoal("Make an anime video"), "anime");
  assert.equal(detectGoal("Write a voiceover for my tutorial video"), "voice");
  assert.equal(detectGoal("Prepare a tax return"), null);
  assert.equal(recommend({ ...base, goal: "auto", brief: "Prepare a tax return" }, now).goal, null);
});
test("commercial free voice and music do not recommend personal-only plans", () => {
  for (const goal of ["voice", "music"] as const) {
    const result = recommend({ ...base, goal, use: "commercial" }, now);
    assert.equal(result.picks.length, 0);
  }
  const result = recommend({ ...base, goal: "voice", use: "commercial", budget: 6 }, now);
  assert.equal(result.picks[0].plan.name, "Starter");
  assert.equal(result.minimumMonthlyUSD, 6);
});
test("budget, commercial rights and device constraints apply to every candidate", () => {
  for (const goal of GOALS) for (const use of ["personal", "commercial"] as const) for (const budget of [0, 5, 10, 25]) {
    const result = recommend({ ...base, goal, budget, use }, now);
    assert.ok(result.minimumMonthlyUSD <= budget);
    for (const pick of [...result.picks, ...result.alternatives]) {
      assert.equal(pick.tool.device, "browser");
      assert.ok(pick.plan.monthlyUSD! <= budget);
      if (use === "commercial") assert.equal(pick.plan.commercial, "conditional");
    }
  }
});
test("GPU model appears only for an experienced compatible setup", () => {
  assert.ok(!recommend({ ...base, goal: "graphics", device: "gpu" }, now).alternatives.some(p => p.tool.id === "flux"));
  const r = recommend({ ...base, goal: "graphics", device: "gpu", experience: "experienced" }, now);
  assert.ok([...r.picks, ...r.alternatives].some(p => p.tool.id === "flux"));
});
test("old or invalid catalog dates cannot produce fresh plan advice", () => {
  assert.equal(catalogFresh("invalid", now), false);
  assert.equal(catalogFresh("2025-01-01", now), false);
  const result = recommend(base, Date.parse("2027-01-01"));
  assert.equal(result.picks.length, 0);
  assert.ok(result.excluded.every(p => p.reason.includes("review")));
});
test("reject malformed input including NaN budgets and missing preferences", () => {
  for (const input of [null, {}, { ...base, budget: NaN }, { ...base, budget: -1 }, { ...base, brief: "hi" }, { ...base, device: "invalid" }, { ...base, goal: "unknown" }]) assert.throws(() => validateAdvisor(input));
  assert.equal(validateAdvisor({ ...base, brief: `  ${base.brief}  ` }).brief, base.brief);
});
test("every tool has a dated official source, unique ID and plan facts", () => {
  assert.equal(new Set(CATALOG.map(t => t.id)).size, CATALOG.length);
  for (const tool of CATALOG) {
    assert.match(tool.source, /^https:\/\//); assert.match(tool.reviewed, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(tool.plans.length > 0);
    assert.ok(tool.plans.every(p => p.monthlyUSD === null || p.monthlyUSD >= 0));
  }
});

test("advisor rejects array-shaped preferences and strips unrecognized properties", () => {
  const input = { brief: "Create an anime short", goal: "anime", budget: 0, device: "browser", use: "personal", experience: "beginner" };
  assert.throws(() => validateAdvisor({ ...input, device: ["browser"] }));
  assert.equal("owner_id" in validateAdvisor({ ...input, owner_id: "untrusted" }), false);
});
