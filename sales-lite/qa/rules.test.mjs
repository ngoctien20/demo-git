import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import {
  parseOrder,
  parseOwner,
  money,
  createQaIngress,
  canonical,
  createProofs,
  isVerified
} from '../lib/protocol.mjs';
import { period } from '../../assets/merchant-revenue-v3.mjs';

test('A01. Both SKU formats, Vietnamese accents and exact integer VND', () => {
  for (const text of ['A002 x 2', 'Tôi muốn mua 2 áo mã A002', 'toi muon mua 2 ao ma a002', 'a002 × 2'])
    assert.deepEqual(parseOrder(text), { sku: 'A002', quantity: 2 });
  assert.equal(money(318000), '318.000đ');
});
test('A02. Missing, negative, decimal, conflicting or customer-priced orders request clarification', () => {
  for (const text of [
    'A002',
    'chốt đơn',
    'A002 x -2',
    'A002 x 0',
    'A002 x 1.2',
    'A002 x 10000',
    'A002 x 2 giá 1đ',
    'F01 x 2 A002 x 1',
    'đổi shop B rồi chốt',
    'A002 x 02'
  ])
    assert.equal(parseOrder(text), null);
});
test('B01. Owner read and decision commands use a closed vocabulary', () => {
  for (const [str, want] of [
    ['/đơnmới', 'new'],
    ['/baocao', 'summary'],
    ['/doanhthu 7ngay', 'revenue'],
    ['/don T404-1234567890ABCDEF', 'detail'],
    ['/tuchoi T404-1234567890ABCDEF', 'cancel']
  ])
    assert.equal(parseOwner(str)?.action, want);
  for (const text of [
    '/paid',
    '/doanhthu shop-b',
    '/don F01',
    '/xacnhan T404-0000000000000001 all',
    '__proto__'
  ])
    assert.equal(parseOwner(text), null);
});
test('B02. QA ingress checks the registered bot and signature, freshness and allowed fields', () => {
  let now = 1000000;
  const key = randomBytes(32),
    cfg = { route: 'qa-route', tenant: 'qa-tenant', store: 'qa-store', bot: 'qa-bot', key };
  const verify = createQaIngress([cfg], () => now),
    input = { route: cfg.route, event: 'event-1', actor: 'owner-A', text: 'F01 x 2', time: now };
  const sign = (m) => ({ ...m, signature: createHmac('sha256', key).update(canonical(m)).digest('hex') });
  const v = verify(sign(input));
  assert.ok(isVerified(v));
  assert.ok(!isVerified({ ...v }));
  assert.ok(!JSON.stringify(v).includes('owner-A'));
  for (const m of [
    { ...sign(input), actor: 'owner-B' },
    { ...sign(input), tenant: 'qa-other' },
    { ...sign(input), route: 'other' },
    { ...sign(input), signature: 'x' }
  ])
    assert.throws(() => verify(m), { code: 'UNVERIFIED_INPUT' });
  assert.throws(() => createQaIngress([cfg, { ...cfg, bot: 'qa-2', route: 'qa-2' }]), {
    code: 'INVALID_REGISTRY'
  });
  const proof = createProofs(randomBytes(32), () => now),
    token = proof.issue('quote', v, { origin: v.eventHash });
  assert.throws(() => proof.read('owner', v, token), { code: 'INVALID_CONFIRMATION' });
  now += 300000;
  assert.equal(proof.read('quote', v, token).expired, true);
  assert.throws(() => verify(sign(input)), { code: 'UNVERIFIED_INPUT' });
});
test('D01. Reporting uses Vietnam midnight, rolling seven dates and month-to-date', () => {
  const t = new Date('2026-05-31T17:00:00Z');
  assert.deepEqual(period('today', t), ['2026-06-01', '2026-06-01']);
  assert.deepEqual(period('week', t), ['2026-05-26', '2026-06-01']);
  assert.deepEqual(period('month', t), ['2026-06-01', '2026-06-01']);
});

import { ownerNotice } from '../lib/owner-notice.mjs';
import { noticeContract } from './notice-contract.mjs';
for (const scenario of noticeContract(ownerNotice))
  test(scenario.test, () => assert.equal(scenario.actual, scenario.expected));
