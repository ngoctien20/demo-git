// F-01 (P1, live FAIL): product-detail postback bypasses Messenger Memory, so the next text turn
// refers to the previously discussed SKU. Structural check on the PUBLISHED graph f8c23034
// (connections copied from n8n 2026-11-21) + the proposed fix graph.
import test from 'node:test';
import assert from 'node:assert/strict';

const published = {
  'Loop One Message': ['Product detail postback?'],
  'Product detail postback?': [['Read selected demo product'], ['V17.15 Route QA_CORE Only?']],
  'Read selected demo product': ['Format selected product'],
  'Format selected product': ['Prepare Messenger Reply'],
  'V17.15 Route QA_CORE Only?': [['V17.15 Strip PII and Normalize Demo Query'], ['Messenger AI Agent']],
  'Messenger AI Agent': ['Prepare Messenger Reply'],
  'Prepare Messenger Reply': ['Send Messenger Reply - CONFIGURE TOKEN'],
};
const memoryWriters = (g) => new Set(['Messenger AI Agent', 'Remember Selected Product'].filter((n) => n in g || Object.values(g).flat(2).includes(n)));
function reachable(g, from, branch) {
  const seen = new Set(); const stack = [...(branch ?? [from])];
  while (stack.length) { const n = stack.pop(); if (seen.has(n)) continue; seen.add(n); for (const nx of (g[n] ?? []).flat()) stack.push(nx); }
  return seen;
}
const postbackPath = (g) => reachable(g, null, g['Product detail postback?'][0]);

test('published f8c23034: postback branch never writes chat memory (reproduces live exec 5838 -> 5840)', () => {
  const p = postbackPath(published);
  assert.equal([...memoryWriters(published)].some((n) => p.has(n)), false);
});

const fixed = structuredClone(published);
fixed['Format selected product'] = ['Prepare Messenger Reply', 'Remember Selected Product'];
fixed['Remember Selected Product'] = [];
test('proposed fix: postback branch inserts the selected SKU into the same session memory', () => {
  const p = postbackPath(fixed);
  assert.ok(p.has('Remember Selected Product'));
  assert.ok(p.has('Prepare Messenger Reply'));
});
test('proposed fix: text path unchanged (still AI agent, still one send)', () => {
  const t = reachable(fixed, null, fixed['V17.15 Route QA_CORE Only?'][1]);
  assert.ok(t.has('Messenger AI Agent'));
  assert.equal(t.has('Remember Selected Product'), false);
});
