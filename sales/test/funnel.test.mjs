import test from 'node:test';
import assert from 'node:assert/strict';
import { counterEvent, dailyReport, vnDay } from '../lib/funnel.mjs';

const SALT = 's'.repeat(40);
const at = Date.parse('2026-11-24T03:00:00Z');
const ev = (kind, senderId, ms = at, channel = 'messenger') => counterEvent({ shop: 'demo', channel, kind, senderId, atMs: ms, salt: SALT });

test('event row holds no personal data', async () => {
  const e = await ev('inbound', 'PSID-123456789');
  assert.deepEqual(Object.keys(e).sort(), ['channel', 'day', 'kind', 'sender', 'shop']);
  assert.doesNotMatch(JSON.stringify(e), /123456789/); assert.match(e.sender, /^[0-9a-f]{16}$/);
});
test('same person same day -> same hash; next day -> different (no long-term tracking)', async () => {
  assert.equal((await ev('inbound', 'p1')).sender, (await ev('order_created', 'p1')).sender);
  assert.notEqual((await ev('inbound', 'p1')).sender, (await ev('inbound', 'p1', at + 86400e3)).sender);
});
test('Vietnam day boundary is UTC+7', () => {
  assert.equal(vnDay(Date.parse('2026-11-23T16:59:59Z')), '2026-11-23');
  assert.equal(vnDay(Date.parse('2026-11-23T17:00:00Z')), '2026-11-24');
});
test('report: 4 people wrote, 1 ordered twice, 1 out of stock -> 25%', async () => {
  const evs = [];
  for (const p of ['a', 'b', 'c', 'd']) evs.push(await ev('inbound', p), await ev('inbound', p));
  evs.push(await ev('order_created', 'a'), await ev('order_created', 'a'), await ev('order_rejected_stock', 'b'), await ev('handoff', 'c'));
  evs.push(await ev('inbound', 'z', at, 'zalo'));
  const [m, z] = dailyReport(evs);
  assert.deepEqual(m, { day: '2026-11-24', shop: 'demo', channel: 'messenger', people: 4, messages: 8, orders: 2, out_of_stock: 1, handoff: 1, conversion_pct: 25 });
  assert.equal(z.channel, 'zalo'); assert.equal(z.conversion_pct, 0);
});
test('rejects short salt and unknown kind/channel', async () => {
  await assert.rejects(counterEvent({ shop: 'demo', channel: 'messenger', kind: 'inbound', senderId: 'x', atMs: at, salt: 'short' }));
  await assert.rejects(ev('typing', 'x')); await assert.rejects(ev('inbound', 'x', at, 'email'));
});
