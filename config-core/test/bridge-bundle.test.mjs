// Runs the exact jsCode embedded in config-core/n8n/bridge.sdk.js with n8n-like $ / $input stubs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { templateConfig } from '../lib/templates.mjs';

const sdk = fs.readFileSync(new URL('../n8n/bridge.sdk.js', import.meta.url), 'utf8');
const start = sdk.indexOf('jsCode: ') + 'jsCode: '.length;
const end = sdk.indexOf(' } },\n  output: [{ mode', start);
const jsCode = JSON.parse(sdk.slice(start, end));
const run = (inp, res) => new Function('$', '$input', jsCode)(() => ({ first: () => ({ json: inp }) }), { first: () => ({ json: res }) })[0].json;
const menu = () => { const c = templateConfig('shop'); return { ...c, version_no: 7, config_sha256: 'abc', menu: c.menu.filter((m) => m.enabled) }; };

test('bundle: published menu -> decision with version', () => {
  const r = run({ channel: 'messenger', payload: 'T404:M:handoff' }, menu());
  assert.equal(r.mode, 'handoff'); assert.equal(r.configVersion, 7); assert.equal(r.configSource, 'published');
});
test('bundle: RPC null -> safe rejected; HTTP error -> legacy fallback', () => {
  const unavailable = run({ channel: 'messenger', payload: 'T404:M:catalog' }, {});
  assert.equal(unavailable.mode, 'rejected');
  assert.equal(unavailable.reason, 'menu_unavailable');
  assert.match(unavailable.message.text, /không khả dụng/);
  const e = run({ channel: 'messenger', payload: 'T404:M:catalog' }, { error: { message: 'timeout' } });
  assert.equal(e.mode, 'legacy'); assert.equal(e.configSource, 'read_failed');
});
test('bundle: get started -> greeting quick replies', () => {
  assert.equal(run({ channel: 'messenger', payload: 'TIEN404:START' }, menu()).message.quick_replies.length, 3);
});

test('bundle: catalog cursor is authorized by current published menu version', () => {
  const m = menu(); m.version_no = 11;
  const first = run({ channel: 'messenger', payload: 'T404:M:catalog' }, m);
  assert.equal(first.mode, 'catalog');
  assert.equal(first.catalogPage, 1);
  assert.equal(first.configVersion, 11);
  const next = run({ channel: 'messenger', payload: 'T404:C:catalog:11:2' }, m);
  assert.equal(next.mode, 'catalog');
  assert.equal(next.itemId, 'catalog');
  assert.equal(next.catalogPage, 2);
  const old = run({ channel: 'messenger', payload: 'T404:C:catalog:10:2' }, m);
  assert.equal(old.mode, 'rejected');
  assert.equal(old.reason, 'catalog_version_stale');
  assert.equal(run({ channel: 'messenger', payload: 'T404:C:order_lookup:11:2' }, m).mode, 'rejected');
});
