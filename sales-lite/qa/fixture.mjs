import pg from 'pg';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createQaIngress, canonical } from '../lib/protocol.mjs';
import { createSalesLite } from '../lib/service.mjs';

const scopes = Object.freeze({
  A: ['qa-tenant-a', 'qa-shop-a', 'qa-bot-a'],
  B: ['qa-tenant-b', 'qa-shop-b', 'qa-bot-b']
});
const tables = [
  'shop_access',
  'requests',
  'owner_alerts',
  'decisions',
  'payment_evidence',
  'settings_audit',
  'alert_attempts',
  'chat_sessions',
  'channel_receipts'
];
export async function fixture() {
  const host = process.env.PGHOST,
    database = process.env.PGDATABASE;
  if (
    process.env.TIEN404_LITE_QA !== 'yes' ||
    !['localhost', '127.0.0.1'].includes(host) ||
    !['tien404_sales_lite_ephemeral', 'tien404_sales_lite_browser'].includes(database)
  )
    throw Error('Requires an empty, local Sales Lite QA database');
  const admin = new pg.Pool({ max: 4 });
  const {
    rows: [meta]
  } = await admin.query(
    "SELECT current_database() AS db,to_regnamespace('sales_lite_qa') AS lite,to_regnamespace('tien404_r1_qa') AS r1"
  );
  if (meta.db !== database || meta.lite || meta.r1)
    throw Error('QA bootstrap requires a fresh empty fixture');
  const routes = {},
    pools = {},
    users = {},
    shift = { ms: 0 };
  const clock = () => Date.now() + shift.ms;
  for (const [shop, [tenant, store, bot]] of Object.entries(scopes)) {
    routes[shop] = { tenant, store, bot, route: 'route-' + shop, key: randomBytes(32) };
  }
  const verify = createQaIngress(Object.values(routes), clock);
  function signed(shop, actor, text, event = randomUUID()) {
    const r = routes[shop],
      input = { route: r.route, event, actor, text, time: clock() };
    return { ...input, signature: createHmac('sha256', r.key).update(canonical(input)).digest('hex') };
  }
  const message = (shop, actor, text, event) => verify(signed(shop, actor, text, event));
  await admin.query(`CREATE SCHEMA tien404_r1_qa;
    CREATE TABLE tien404_r1_qa.shop_bots(tenant_key text,store_key text,bot_key text,enabled_mode text,identity_status text,
      PRIMARY KEY(tenant_key,store_key,bot_key));
    CREATE TABLE tien404_r1_qa.catalog(tenant_key text,store_key text,bot_key text,sku text,product_name text,price_vnd bigint,stock int,
      PRIMARY KEY(tenant_key,store_key,bot_key,sku), FOREIGN KEY(tenant_key,store_key,bot_key) REFERENCES tien404_r1_qa.shop_bots);
    CREATE TABLE tien404_r1_qa.owner_bindings(tenant_key text,store_key text,bot_key text,owner_ref text,recipient_ref text,status text,expires_at timestamptz,
      PRIMARY KEY(tenant_key,store_key,bot_key,owner_ref), FOREIGN KEY(tenant_key,store_key,bot_key) REFERENCES tien404_r1_qa.shop_bots)`);
  await admin.query(await readFile(new URL('../db/candidate.sql', import.meta.url), 'utf8'));
  for (const name of ['shop_bots', 'catalog', 'owner_bindings']) {
    await admin.query(
      `ALTER TABLE tien404_r1_qa.${name} ENABLE ROW LEVEL SECURITY; ALTER TABLE tien404_r1_qa.${name} FORCE ROW LEVEL SECURITY`
    );
  }
  for (const [shop, scope] of Object.entries(scopes)) {
    const suffix = randomBytes(6).toString('hex'),
      user = 'lite_qa_' + suffix,
      pass = randomBytes(32).toString('hex');
    users[shop] = user;
    // Both values are generated lowercase hex, never caller input; used only by this disposable cluster.
    await admin.query(`CREATE ROLE ${user} LOGIN PASSWORD '${pass}' NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA sales_lite_qa,tien404_r1_qa TO ${user};
      GRANT SELECT ON ALL TABLES IN SCHEMA sales_lite_qa,tien404_r1_qa TO ${user};
      GRANT INSERT(tenant,store,bot,source,event_hash,quote_event,actor_hash,sku,product_label,quantity,unit_vnd) ON sales_lite_qa.requests TO ${user};
      GRANT INSERT ON sales_lite_qa.decisions,sales_lite_qa.owner_alerts,sales_lite_qa.settings_audit,sales_lite_qa.alert_attempts,sales_lite_qa.chat_sessions,sales_lite_qa.channel_receipts TO ${user};
      GRANT UPDATE(last_ms,pending,until_at,last_code) ON sales_lite_qa.chat_sessions TO ${user};
      GRANT UPDATE(status,revision) ON sales_lite_qa.requests TO ${user};
      GRANT UPDATE(alerts) ON sales_lite_qa.shop_access TO ${user};
      GRANT UPDATE(state,attempt_count,last_outcome,retry_after) ON sales_lite_qa.owner_alerts TO ${user}`);
    const values = scope.map((x) => "'" + x + "'").join(',');
    for (const t of tables) {
      const condition = '(tenant,store,bot)=(' + values + ')';
      await admin.query(
        `CREATE POLICY ${user} ON sales_lite_qa.${t} TO ${user} USING (${condition}) WITH CHECK (${condition})`
      );
    }
    for (const t of ['shop_bots', 'catalog', 'owner_bindings'])
      await admin.query(
        `CREATE POLICY ${user} ON tien404_r1_qa.${t} FOR SELECT TO ${user} USING ((tenant_key,store_key,bot_key)=(${values}))`
      );
    pools[shop] = new pg.Pool({ user, password: pass, max: 24 });
    await admin.query(
      "INSERT INTO tien404_r1_qa.shop_bots VALUES ($1,$2,$3,'dry_run','synthetic_qa')",
      scope
    );
    await admin.query(
      "INSERT INTO sales_lite_qa.shop_access VALUES ($1,$2,$3,true,now()+interval '1 day',true)",
      scope
    );
    await admin.query(
      "INSERT INTO tien404_r1_qa.owner_bindings VALUES ($1,$2,$3,$4,$5,'paired',now()+interval '1 day')",
      [...scope, 'qa-owner-' + shop, message(shop, 'owner-' + shop, 'QA').recipientRef]
    );
    for (const [sku, name, price, stock] of [
      ['F01', 'Áo thun ' + shop, shop === 'A' ? 159000 : 199000, shop === 'A' ? 3 : 5],
      ['A002', 'Áo thun trắng', 159000, 25],
      ['C20', 'Sản phẩm thử đồng thời', 10000, 100],
      ['R01', 'Sản phẩm đặt cuối', 80000, 1],
      ['P02', 'Sản phẩm đổi giá', 75000, 15]
    ])
      await admin.query('INSERT INTO tien404_r1_qa.catalog VALUES($1,$2,$3,$4,$5,$6,$7)', [
        ...scope,
        sku,
        name,
        price,
        stock
      ]);
  }
  const service = createSalesLite({
    poolFor: (e) => pools[Object.keys(scopes).find((k) => scopes[k][2] === e.bot)],
    proofKey: randomBytes(32),
    clock
  });
  const owner = (shop, text, event) => message(shop, 'owner-' + shop, text, event);
  async function make(shop, sku = 'F01', quantity = 1, actor = 'customer-' + randomUUID()) {
    const quote = await service.preview(message(shop, actor, sku + ' x ' + quantity));
    const confirm = message(shop, actor, 'xác nhận');
    return { quote, confirm, saved: await service.save(confirm, quote.proof), actor };
  }
  async function decide(shop, code, action = 'xacnhan') {
    const text = '/' + action + ' ' + code,
      preview = await service.command(owner(shop, text)),
      event = owner(shop, text);
    return { event, proof: preview.proof, done: await service.command(event, preview.proof) };
  }
  const close = () => Promise.all([admin, ...Object.values(pools)].map((p) => p.end()));
  return { admin, pools, scopes, users, signed, verify, message, owner, make, decide, service, close, shift };
}
