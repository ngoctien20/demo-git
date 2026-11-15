import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { fixture } from './fixture.mjs';
import { revenue, formatRevenue } from '../lib/report.mjs';

let f, svc;
before(async () => {
  f = await fixture();
  svc = f.service;
});
after(async () => {
  if (f) await f.close();
});
const denies = (call, code) => assert.rejects(call, { code });
const id = () => randomBytes(32).toString('hex');
const count = async (table) =>
  Number((await f.admin.query('SELECT count(*) FROM sales_lite_qa.' + table)).rows[0].count);

test('A03/B03. Same F01 yields A=159000 B=199000; separate confirmed requests read back at integer VND', async () => {
  const before = await count('requests'),
    a = await f.make('A', 'F01', 2),
    b = await f.make('B', 'F01', 2);
  assert.deepEqual([a.quote.totalVnd, b.quote.totalVnd], [318000, 398000]);
  assert.equal(a.saved.request.status, 'NEW_PENDING_OWNER');
  assert.match(a.saved.request.code, /^T404-[0-9A-F]{16}$/);
  assert.notEqual(a.saved.request.code, b.saved.request.code);
  assert.equal(await count('requests'), before + 2);
  const lookup = await svc.command(f.owner('A', '/don ' + a.saved.request.code));
  assert.equal(lookup.request.total_vnd, '318000');
  await denies(svc.command(f.owner('B', '/don ' + a.saved.request.code)), 'REQUEST_NOT_FOUND');
  const c = await svc.shadow(f.owner('B', 'shadow'), b.saved.request.code);
  assert.equal(c.state, 'HELD');
  assert.ok(c.message.includes('398.000đ'));
  assert.equal(c.sent, 0);
});
test('A04. Invalid SKU/qty, incomplete, wrong confirmation, stale price and changed stock cannot write', async () => {
  const n = await count('requests'),
    actor = 'validation-customer';
  assert.equal((await svc.preview(f.message('A', actor, 'A002'))).state, 'NEEDS_DETAILS');
  await denies(svc.preview(f.message('A', actor, 'Z99 x 1')), 'PRODUCT_NOT_FOUND');
  await denies(svc.preview(f.message('A', actor, 'F01 x 4')), 'INSUFFICIENT_STOCK');
  const q = f.message('A', actor, 'P02 x 2'),
    quote = await svc.preview(q);
  await denies(svc.save(f.message('A', actor, 'có thể'), quote.proof), 'EXPLICIT_CONFIRMATION_REQUIRED');
  await denies(svc.save(f.message('B', actor, 'xác nhận'), quote.proof), 'INVALID_CONFIRMATION');
  await denies(svc.save(f.message('A', 'another-user', 'xác nhận'), quote.proof), 'INVALID_CONFIRMATION');
  await f.admin.query(
    "UPDATE tien404_r1_qa.catalog SET price_vnd=76000 WHERE sku='P02' AND store_key='qa-shop-a'"
  );
  await denies(svc.save(f.message('A', actor, 'xác nhận'), quote.proof), 'PRICE_CHANGED');
  await f.admin.query(
    "UPDATE tien404_r1_qa.catalog SET price_vnd=75000,stock=1 WHERE sku='P02' AND store_key='qa-shop-a'"
  );
  await denies(svc.save(f.message('A', actor, 'xác nhận'), quote.proof), 'INSUFFICIENT_STOCK');
  await f.admin.query(
    "UPDATE tien404_r1_qa.catalog SET price_vnd=9007199254740991,stock=15 WHERE sku='P02' AND store_key='qa-shop-a'"
  );
  await denies(svc.preview(f.message('A', actor, 'P02 x 2')), 'TOTAL_INVALID');
  await f.admin.query(
    "UPDATE tien404_r1_qa.catalog SET price_vnd=75000 WHERE sku='P02' AND store_key='qa-shop-a'"
  );
  f.shift.ms = 300001;
  try {
    await denies(svc.save(f.message('A', actor, 'xác nhận'), quote.proof), 'QUOTE_EXPIRED');
  } finally {
    f.shift.ms = 0;
  }
  assert.equal(await count('requests'), n);
});
test('A05. Same webhook, repeated customer confirmation and generated-code collision leave unique ledger/outbox', async () => {
  const x = await f.make('A'),
    orig = x.saved.request.code,
    n = await count('requests'),
    a = await count('owner_alerts');
  assert.equal((await svc.save(x.confirm, x.quote.proof)).request.code, orig);
  assert.equal((await svc.save(f.message('A', x.actor, 'xác nhận'), x.quote.proof)).state, 'ALREADY_SAVED');
  await f.admin.query("ALTER TABLE sales_lite_qa.requests ALTER COLUMN code SET DEFAULT '" + orig + "'");
  try {
    await denies(f.make('B'), 'CODE_COLLISION_RETRY');
  } finally {
    await f.admin.query(
      "ALTER TABLE sales_lite_qa.requests ALTER COLUMN code SET DEFAULT ('T404-' || upper(left(replace(gen_random_uuid()::text,'-',''),16)))"
    );
  }
  assert.equal(await count('requests'), n);
  assert.equal(await count('owner_alerts'), a);
});
test('C01. Injected outbox failure rolls back request, retry of same confirmed input saves once', async () => {
  const actor = 'rollback-customer',
    q = await svc.preview(f.message('B', actor, 'F01 x 2')),
    e = f.message('B', actor, 'xác nhận');
  const n = await count('requests'),
    a = await count('owner_alerts');
  await f.admin.query(
    "CREATE FUNCTION sales_lite_qa.qa_stop() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER qa_stop BEFORE INSERT ON sales_lite_qa.owner_alerts FOR EACH ROW EXECUTE FUNCTION sales_lite_qa.qa_stop()"
  );
  try {
    await denies(svc.save(e, q.proof), 'P0001');
  } finally {
    await f.admin.query(
      'DROP TRIGGER qa_stop ON sales_lite_qa.owner_alerts; DROP FUNCTION sales_lite_qa.qa_stop()'
    );
  }
  assert.equal(await count('requests'), n);
  assert.equal(await count('owner_alerts'), a);
  assert.equal((await svc.save(e, q.proof)).state, 'SAVED');
});
test('B04. Owner gate, expired subscription, revoked binding and independent DB roles enforce scope', async () => {
  await denies(svc.command(f.message('A', 'owner-B', '/donmoi')), 'OWNER_REQUIRED');
  await denies(svc.dashboard({ ...f.owner('A', 'dash') }), 'UNVERIFIED_INPUT');
  for (const [shop, other] of [
    ['A', 'B'],
    ['B', 'A']
  ]) {
    const pool = f.pools[shop];
    assert.equal(
      (await pool.query('SELECT * FROM sales_lite_qa.requests WHERE store=$1', [f.scopes[other][1]]))
        .rowCount,
      0
    );
    assert.equal(
      (await pool.query('SELECT * FROM tien404_r1_qa.catalog WHERE store_key=$1', [f.scopes[other][1]]))
        .rowCount,
      0
    );
    assert.equal(
      (
        await pool.query('UPDATE sales_lite_qa.shop_access SET alerts=false WHERE store=$1', [
          f.scopes[other][1]
        ])
      ).rowCount,
      0
    );
    await denies(
      pool.query('INSERT INTO sales_lite_qa.settings_audit VALUES($1,$2,$3,$4,$5,true,now())', [
        ...f.scopes[other],
        id(),
        id()
      ]),
      '42501'
    );
    await denies(pool.query('UPDATE sales_lite_qa.shop_access SET enabled=true'), '42501');
    await denies(pool.query('UPDATE sales_lite_qa.payment_evidence SET verified=true'), '42501');
  }
  await f.admin.query(
    "UPDATE sales_lite_qa.shop_access SET access_until=now()-interval '1 second' WHERE store='qa-shop-b'"
  );
  try {
    await denies(svc.command(f.owner('B', '/doanhthu')), 'SHOP_UNAVAILABLE');
    await denies(f.make('B'), 'SHOP_UNAVAILABLE');
  } finally {
    await f.admin.query(
      "UPDATE sales_lite_qa.shop_access SET access_until=now()+interval '1 day' WHERE store='qa-shop-b'"
    );
  }
  await f.admin.query("UPDATE tien404_r1_qa.owner_bindings SET status='revoked' WHERE store_key='qa-shop-a'");
  try {
    await denies(svc.command(f.owner('A', '/baocao')), 'OWNER_REQUIRED');
    assert.equal((await svc.command(f.owner('B', '/baocao'))).state, 'REPORT');
  } finally {
    await f.admin.query(
      "UPDATE tien404_r1_qa.owner_bindings SET status='paired' WHERE store_key='qa-shop-a'"
    );
  }
});
test('C02. Revoked/missing owner or disabled alerts create held intents which cannot be retroactively rerouted', async () => {
  await f.admin.query("UPDATE tien404_r1_qa.owner_bindings SET status='revoked' WHERE store_key='qa-shop-b'");
  let x;
  try {
    x = await f.make('B');
  } finally {
    await f.admin.query(
      "UPDATE tien404_r1_qa.owner_bindings SET status='paired' WHERE store_key='qa-shop-b'"
    );
  }
  await denies(svc.shadow(f.owner('B', 'shadow'), x.saved.request.code), 'RECIPIENT_UNAVAILABLE');
  const orig = await f.make('B'),
    newRecipient = f.message('B', 'owner-replaced', 'shadow');
  await f.admin.query(
    "UPDATE tien404_r1_qa.owner_bindings SET recipient_ref=$1 WHERE store_key='qa-shop-b'",
    [newRecipient.recipientRef]
  );
  try {
    await denies(svc.shadow(newRecipient, orig.saved.request.code), 'OWNER_REQUIRED');
  } finally {
    await f.admin.query(
      "UPDATE tien404_r1_qa.owner_bindings SET recipient_ref=$1 WHERE store_key='qa-shop-b'",
      [f.owner('B', 'shadow').recipientRef]
    );
  }
  const event = f.owner('A', 'settings');
  assert.equal((await svc.setAlerts(event, false)).state, 'APPLIED');
  assert.equal((await svc.setAlerts(event, false)).state, 'ALREADY_APPLIED');
  await denies(svc.setAlerts(event, true), 'EVENT_CONFLICT');
  const muted = await f.make('A');
  await svc.setAlerts(f.owner('A', 'settings'), true);
  await denies(svc.shadow(f.owner('A', 'shadow'), muted.saved.request.code), 'RECIPIENT_UNAVAILABLE');
});
test('C03. Unknown outcome is terminal, acceptance is not a read; duplicate/retry respects backoff and bounded attempts', async () => {
  const sim = (code, result, event = f.owner('B', 'shadow')) => svc.shadow(event, code, result);
  const a = (await f.make('B')).saved.request.code;
  const responses = await Promise.all([sim(a, 'TIMEOUT'), sim(a, 'TIMEOUT')]);
  assert.ok(responses.every((x) => x.state === 'SIM_UNKNOWN' && x.attempts === 1 && !x.read && x.sent === 0));
  const stop = await sim(a, 'API_ACCEPTED');
  assert.equal(stop.state, 'SIM_UNKNOWN');
  assert.equal(stop.attempts, 1);
  const b = (await f.make('B')).saved.request.code,
    accepted = await sim(b, 'API_ACCEPTED');
  assert.equal(accepted.state, 'SIM_ACCEPTED');
  assert.equal(accepted.read, false);
  assert.equal((await svc.command(f.owner('B', '/don ' + b))).request.status, 'NEW_PENDING_OWNER');
  const c = (await f.make('B')).saved.request.code,
    e = f.owner('B', 'shadow'),
    retry = 'NOT_ACCEPTED_RETRYABLE';
  assert.equal((await sim(c, retry, e)).state, 'SIM_RETRYABLE');
  assert.equal((await sim(c, retry)).state, 'WAIT_BACKOFF');
  try {
    f.shift.ms = 31000;
    assert.equal((await sim(c, retry, e)).attempts, 1);
    assert.equal((await sim(c, retry)).attempts, 2);
    f.shift.ms = 92000;
    assert.equal((await sim(c, retry)).state, 'SIM_REJECTED');
    assert.equal((await sim(c, 'API_ACCEPTED')).attempts, 3);
  } finally {
    f.shift.ms = 0;
  }
  assert.equal((await sim((await f.make('B')).saved.request.code, 'REJECTED')).state, 'SIM_REJECTED');
});
test('A06/B05. Signed channel → revised quote → customer confirmation → held owner preview → two-step owner decision/audit', async () => {
  const m = (text, event) => f.message('A', 'buyer-channel', text, event),
    receive = (e) => svc.receive(e);
  const first = m('A002 x 2');
  assert.equal((await receive(first)).unitVnd, 159000);
  assert.equal((await receive(first)).state, 'REPLAY_IGNORED');
  const revised = await receive(m('F01 x 2'));
  assert.ok(revised.message.includes('xác nhận F01 x 2'));
  await denies(receive(m('xác nhận')), 'QUOTE_SELECTION_REQUIRED');
  const commit = m('xác nhận F01 x 2'),
    saved = await receive(commit),
    code = saved.request.code;
  assert.equal(saved.state, 'SAVED');
  assert.equal((await receive(commit)).request.code, code);
  const pending = await receive(f.owner('A', '/xacnhan ' + code));
  assert.match(pending.message, /dongy/);
  assert.equal(pending.proof, undefined);
  await denies(receive(f.owner('B', '/dongy ' + code)), 'CONFIRMATION_EXPIRED');
  const ok = f.owner('A', '/dongy ' + code);
  assert.equal((await receive(ok)).request.status, 'OWNER_CONFIRMED');
  assert.equal((await receive(ok)).state, 'ALREADY_DECIDED');
  const logs = await f.admin.query(
    'SELECT count(*) FROM sales_lite_qa.decisions d JOIN sales_lite_qa.requests r ON d.request_id=r.id WHERE r.code=$1',
    [code]
  );
  assert.equal(logs.rows[0].count, '1');
  await receive(m('A002 x 2'));
  assert.equal((await receive(m('Z99 x 1'))).reason, 'PRODUCT_NOT_FOUND');
  await denies(receive(m('xác nhận')), 'QUOTE_EXPIRED');
  const newOrder = await f.make('A', 'C20');
  const d = await f.decide('A', newOrder.saved.request.code, 'tuchoi');
  assert.equal(d.done.request.status, 'CANCELLED');
  assert.equal((await svc.command(d.event, d.proof)).state, 'ALREADY_DECIDED');
});
test('E01. Two customers request last unit; two owner decisions race, exactly one approval and baseline stock untouched', async () => {
  const [a, b] = await Promise.all([f.make('A', 'R01'), f.make('A', 'R01')]);
  const results = await Promise.allSettled([a, b].map((x) => f.decide('A', x.saved.request.code)));
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(results.find((x) => x.status === 'rejected').reason.code, 'INSUFFICIENT_STOCK');
  assert.equal(
    (await f.admin.query("SELECT stock FROM tien404_r1_qa.catalog WHERE store_key='qa-shop-a' AND sku='R01'"))
      .rows[0].stock,
    1
  );
});
test('E02. Two shops × 20 simultaneous confirmed events, each delivered twice: 40 requests, 40 unique correctly routed HELD intents, 0 sends', async (t) => {
  const n = await count('requests'),
    alerts = await count('owner_alerts');
  const plans = await Promise.all(
    ['A', 'B'].flatMap((shop) =>
      Array.from({ length: 20 }, async (_, i) => {
        const actor = 'load-' + i,
          quote = await svc.receive(f.message(shop, actor, 'C20 x 1', 'load-quote-' + i));
        assert.equal(quote.state, 'AWAITING_CUSTOMER');
        return f.message(shop, actor, 'xác nhận', 'load-confirm-' + i);
      })
    )
  );
  const results = await Promise.all(plans.flatMap((e) => [svc.receive(e), svc.receive(e)]));
  assert.equal(results.filter((r) => r.state === 'SAVED').length, 40);
  assert.equal(results.filter((r) => r.state === 'ALREADY_SAVED').length, 40);
  const codes = [...new Set(results.map((r) => r.request.code))];
  assert.equal(codes.length, 40);
  assert.equal((await count('requests')) - n, 40);
  assert.equal((await count('owner_alerts')) - alerts, 40);
  const q = await f.admin.query(
    `SELECT r.store,count(*)::int AS total FROM sales_lite_qa.requests r JOIN sales_lite_qa.owner_alerts a ON a.request_id=r.id
    JOIN tien404_r1_qa.owner_bindings b ON (a.tenant,a.store,a.bot,a.recipient_ref,a.owner_ref)=(b.tenant_key,b.store_key,b.bot_key,b.recipient_ref,b.owner_ref)
    WHERE r.code=ANY($1) AND a.state='HELD' AND a.attempt_count=0 GROUP BY r.store ORDER BY r.store`,
    [codes]
  );
  assert.deepEqual(
    q.rows.map((r) => r.total),
    [20, 20]
  );
  assert.ok(f.pools.A.totalCount > 1 && f.pools.B.totalCount > 1);
  t.diagnostic(
    '80 deliveries; 40 saved + 40 replay; A 20/B 20 held; pool connections A ' +
      f.pools.A.totalCount +
      ', B ' +
      f.pools.B.totalCount
  );
});
test('D02. Paid date Vietnam boundaries, verified receipts only, duplicate evidence and incomplete sources', async () => {
  const asOf = new Date('2026-06-02T12:00:00Z'),
    pre = '2026-06-01T12:00:00Z',
    inside = '2026-06-01T17:00:00Z';
  async function row(shop, status, created, amount, paidAt = null, receiptAmount = amount) {
    const scope = f.scopes[shop],
      r = await f.admin.query(
        `INSERT INTO sales_lite_qa.requests(tenant,store,bot,source,actor_hash,event_hash,quote_event,
      sku,product_label,quantity,unit_vnd,status,created_at) VALUES($1,$2,$3,'qa_inbound',$4,$5,$6,'D01','QA',1,$7,$8,$9) RETURNING id`,
        [...scope, id(), id(), id(), amount, status, created]
      );
    if (paidAt)
      await f.admin.query('INSERT INTO sales_lite_qa.payment_evidence VALUES($1,$2,$3,$4,$5,$6,$7,true)', [
        ...scope,
        r.rows[0].id,
        randomUUID(),
        receiptAmount,
        paidAt
      ]);
    return r.rows[0].id;
  }
  const outside = await row('A', 'PAID', pre, 1000, '2026-06-01T16:59:59.999Z');
  await row('A', 'PAID', pre, 23000, inside);
  await row('A', 'OWNER_CONFIRMED', inside, 5000);
  await row('A', 'NEW_PENDING_OWNER', inside, 6000);
  await row('A', 'CANCELLED', inside, 7000);
  await row('B', 'PAID', pre, 99999, inside);
  const get = (s) => revenue(f.pools[s], f.scopes[s], 'today', asOf);
  let a = await get('A');
  assert.deepEqual(
    [a.paid_vnd, a.receipts, a.requested_vnd, a.requests, a.pending, a.confirmed, a.cancelled],
    ['23000', 1, '18000', 3, 1, 1, 1]
  );
  assert.equal((await get('B')).paid_vnd, '99999');
  await denies(
    f.admin.query('INSERT INTO sales_lite_qa.payment_evidence VALUES($1,$2,$3,$4,$5,1000,$6,true)', [
      ...f.scopes.A,
      outside,
      randomUUID(),
      inside
    ]),
    '23505'
  );
  await row('A', 'PAID', pre, 1000);
  await row('A', 'PAID', inside, 7500, inside, 7300);
  a = await get('A');
  assert.equal(a.paid_vnd, null);
  assert.equal(a.verified_vnd, '23000');
  assert.equal(a.incomplete, 2);
  assert.match(formatRevenue(a), /thiếu chứng cứ/);
  await denies(f.admin.query('UPDATE sales_lite_qa.payment_evidence SET amount_vnd=-1'), '23514');
});

test('B06/D03. A role cannot mark a request PAID or confirm without a matching scoped audit event', async () => {
  const x = (await f.make('B', 'C20')).saved.request;
  for (const state of ['PAID', 'OWNER_CONFIRMED'])
    await denies(
      f.pools.B.query('UPDATE sales_lite_qa.requests SET status=$2,revision=revision+1 WHERE code=$1', [
        x.code,
        state
      ]),
      '23514'
    );
  await denies(
    f.pools.B.query('UPDATE sales_lite_qa.requests SET unit_vnd=1 WHERE code=$1', [x.code]),
    '42501'
  );
  const read = await svc.command(f.owner('B', '/don ' + x.code));
  assert.equal(read.request.status, 'NEW_PENDING_OWNER');
});
test('A07. Durable quote is recovered by a new service instance; different input under one receipt cannot change it', async () => {
  const e = f.message('B', 'restart-actor', 'F01 x 2', 'restart-event');
  assert.equal((await svc.receive(e)).state, 'AWAITING_CUSTOMER');
  await denies(svc.receive(f.message('B', 'restart-actor', 'C20 x 3', 'restart-event')), 'EVENT_CONFLICT');
  const { createSalesLite } = await import('../lib/service.mjs');
  const restart = createSalesLite({ poolFor: () => f.pools.B, proofKey: randomBytes(32) });
  const r = await restart.receive(f.message('B', 'restart-actor', 'xác nhận'));
  assert.equal(r.request.total_vnd, '398000');
  assert.equal(r.state, 'SAVED');
});

test('D04. Separately supplied verified QA receipt posts atomically; replay counts once; owner cannot record cash', async () => {
  const x = (await f.make('B', 'C20')).saved.request;
  const sql = 'SELECT sales_lite_qa.record_verified_receipt($1,$2,$3,$4,$5,$6,$7) AS result';
  const now = (await f.admin.query('SELECT clock_timestamp()::text AS time')).rows[0].time;
  const args = [...f.scopes.B, x.code, randomUUID(), x.total_vnd, now];
  await denies(f.admin.query(sql, args), '23514');
  await f.decide('B', x.code);
  await denies(f.pools.B.query(sql, args), '42501');
  await denies(f.admin.query(sql, [...args.slice(0, 5), '33', now]), '23514');
  assert.equal((await f.admin.query(sql, args)).rows[0].result, 'RECORDED');
  assert.equal((await f.admin.query(sql, args)).rows[0].result, 'ALREADY_RECORDED');
  assert.equal((await svc.command(f.owner('B', '/don ' + x.code))).request.status, 'PAID');
  const report = await svc.command(f.owner('B', '/doanhthu'));
  assert.equal(report.report.paid_vnd, '10000');
  assert.equal((await svc.command(f.owner('A', '/doanhthu'))).report.verified_vnd, '0');
});

test('B07. A legacy paired row without a consumed and confirmed challenge has no recipient or revenue access',async()=>{
  const scope=f.scopes.A,id=(await f.admin.query('SELECT confirmed_challenge_id FROM tien404_r1_qa.owner_bindings WHERE store_key=$1',[scope[1]])).rows[0].confirmed_challenge_id;
  await f.admin.query('UPDATE tien404_r1_qa.owner_bindings SET confirmed_challenge_id=NULL WHERE store_key=$1',[scope[1]]);
  let saved;
  try {
    await denies(svc.command(f.owner('A','/doanhthu')),'OWNER_REQUIRED');
    await denies(svc.dashboard(f.dash('A')('/baocao')),'OWNER_REQUIRED');
    saved=await f.make('A','C20');
    assert.equal((await svc.command(f.owner('B','/baocao'))).state,'REPORT');
  } finally {await f.admin.query('UPDATE tien404_r1_qa.owner_bindings SET confirmed_challenge_id=$1 WHERE store_key=$2',[id,scope[1]]);}
  await denies(svc.shadow(f.owner('A','shadow'),saved.saved.request.code),'RECIPIENT_UNAVAILABLE');
});
test('B08. Dashboard subject, current owner membership and binding instance fence every pending action',async()=>{
  const x=(await f.make('B','C20')).saved.request,owner=f.dash('B'),cmd='/xacnhan '+x.code;
  await denies(svc.dashboard(f.dash('B',f.subjects.A)('/baocao')),'OWNER_REQUIRED');
  const q=await svc.command(owner(cmd));
  await f.admin.query('UPDATE public.tenant_memberships SET active=false WHERE user_id=$1',[f.subjects.B]);
  try {await denies(svc.command(owner(cmd),q.proof),'OWNER_REQUIRED');await denies(svc.command(f.owner('B','/donmoi')),'OWNER_REQUIRED');}
  finally {await f.admin.query('UPDATE public.tenant_memberships SET active=true WHERE user_id=$1',[f.subjects.B]);}
  const id=randomUUID(),scope=f.scopes.B;
  await f.admin.query("INSERT INTO tien404_r1_qa.owner_pairing_challenges SELECT tenant_key,store_key,bot_key,$1,owner_ref,requester_user_id,now()+interval '5 minutes',now() FROM tien404_r1_qa.owner_pairing_challenges WHERE store_key=$2",[id,scope[1]]);
  await f.admin.query("INSERT INTO tien404_r1_qa.owner_pairing_claims_v3 SELECT tenant_key,store_key,bot_key,$1,recipient_ref,status,now(),now() FROM tien404_r1_qa.owner_pairing_claims_v3 WHERE store_key=$2",[id,scope[1]]);
  await f.admin.query('UPDATE tien404_r1_qa.owner_bindings SET confirmed_challenge_id=$1 WHERE store_key=$2',[id,scope[1]]);
  await denies(svc.command(owner(cmd),q.proof),'INVALID_CONFIRMATION');
  await denies(svc.shadow(f.owner('B','shadow'),x.code),'RECIPIENT_UNAVAILABLE');
  assert.equal((await svc.dashboard(owner('/baocao'),{tab:'settings'})).botPaired,true);
});
