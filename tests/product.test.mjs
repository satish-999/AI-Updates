import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommend, WORKFLOWS } from '../lib/advisor.ts';
import { externalUrl } from '../lib/links.ts';
import { feedOptions, feedHref } from '../lib/feed-options.ts';
import { ago, ymd } from '../lib/format.ts';
const plans = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const now = Date.parse('2026-10-12T12:00:00Z');
const request = { task: 'audio', device: 'browser', budget: 10, commercial: false, recurringFree: false };

test('publisher URLs reject scripts, relative paths, malformed input and embedded credentials', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,x', '//example.com', '/story/1', 'https://user:password@example.com', '', null]) assert.equal(externalUrl(value), null);
  assert.equal(externalUrl('https://example.com/story?x=1'), 'https://example.com/story?x=1');
});
test('feed filters cannot select a category belonging to the other tab', () => {
  assert.equal(feedOptions('updates', { category: 'funding' }).category, 'all');
  assert.equal(feedOptions('news', { category: 'product' }).category, 'all');
  assert.equal(feedOptions('news', { category: 'unclassified' }).category, 'unclassified');
});
test('feed pagination and search inputs are bounded', () => {
  for (const page of ['-1', '0', 'abc', ['2'], '1e3']) assert.equal(feedOptions('news', { page }).page, 1);
  assert.equal(feedOptions('news', { page: '9999' }).page, 1000);
  assert.equal(feedOptions('news', { q: 'x'.repeat(500) }).query.length, 160);
  assert.equal(feedOptions('news', { q: ['x', 'y'] }).query, '');
});
test('pagination preserves and escapes search filters', () => {
  const href = feedHref('news', { query: 'AI & policy', category: 'policy', page: 1 }, 2);
  const url = new URL(href, 'https://example.com');
  assert.equal(url.searchParams.get('q'), 'AI & policy');
  assert.equal(url.searchParams.get('category'), 'policy');
  assert.equal(url.searchParams.get('page'), '2');
});
test('free budget never recommends a paid plan', () => {
  const matches = recommend(plans, { ...request, budget: 0 }, now);
  assert.ok(matches.length > 0);
  assert.ok(matches.every(p => p.monthlyUsd === 0));
});
test('recurring free excludes one-time credits even with a larger budget', () => {
  const matches = recommend(plans, { ...request, task: 'video', recurringFree: true, budget: 50 }, now);
  assert.ok(matches.length > 0);
  assert.ok(matches.every(p => p.monthlyUsd === 0 && p.freeKind === 'recurring'));
  assert.ok(!matches.some(p => p.id === 'runway-free'));
});
test('commercial projects exclude absent and unknown licenses', () => {
  const matches = recommend(plans, { ...request, commercial: true }, now);
  assert.ok(matches.some(p => p.id === 'eleven-starter'));
  assert.ok(!matches.some(p => p.id === 'eleven-free'));
  assert.ok(matches.every(p => p.commercial === 'allowed'));
});
test('stale or future evidence never becomes a recommendation', () => {
  assert.deepEqual(recommend(plans, request, now + 31 * 86400000), []);
  assert.deepEqual(recommend(plans, request, now - 86400000), []);
  assert.deepEqual(recommend([{ ...plans[0], verifiedAt: 'bad date' }], request, now), []);
});
test('no recommendation without a safe source URL', () => {
  assert.deepEqual(recommend([{ ...plans[0], source: 'javascript:alert(1)' }], request, now), []);
});
test('unknown devices or tasks and invalid budgets do not silently broaden matches', () => {
  assert.deepEqual(recommend(plans, { ...request, device: 'offline' }, now), []);
  assert.deepEqual(recommend(plans, { ...request, task: 'resume' }, now), []);
  for (const budget of [-1, NaN, Infinity]) assert.deepEqual(recommend(plans, { ...request, budget }, now), []);
});
test('affordability ordering respects exact budget boundaries', () => {
  const matches = recommend(plans, { ...request, budget: 6 }, now);
  assert.ok(matches.some(p => p.id === 'eleven-starter'));
  assert.ok(!matches.some(p => p.id === 'firefly-standard'));
  assert.deepEqual(matches.map(p => p.monthlyUsd), [...matches.map(p => p.monthlyUsd)].sort((a, b) => a - b));
});
test('catalog has unique identities, sources and task workflows', () => {
  assert.equal(new Set(plans.map(p => p.id)).size, plans.length);
  for (const p of plans) {
    assert.ok(externalUrl(p.source));
    assert.ok(p.allowance && p.notes && p.verifiedAt);
    for (const task of p.tasks) assert.ok(WORKFLOWS[task]);
  }
});
test('database Date values and string dates render equally; invalid dates are safe', () => {
  const date = '2026-10-12T01:00:00Z';
  assert.equal(ymd(new Date(date)), ymd(date));
  assert.equal(ymd(null), '—');
  assert.equal(ymd('not a date'), '—');
  assert.equal(ago('invalid'), '—');
});
