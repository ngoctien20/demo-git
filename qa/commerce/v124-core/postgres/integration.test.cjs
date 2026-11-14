'use strict';
// Isolated database only. No connection strings, Supabase API access, n8n, or provider credentials.
const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {randomBytes} = require('node:crypto');
const {Pool} = require('pg');
const {fixture} = require('../qa-harness.cjs');
const api = require('../index.cjs');

if (process.env.TIEN404_EPHEMERAL_PG !== 'yes' || process.env.PGHOST !== '127.0.0.1' ||
    process.env.PGDATABASE !== 'tien404_core_ephemeral' || process.env.PGUSER !== 'postgres') {
  throw Error('Run only on the explicitly selected local disposable QA database');
}
const admin = new Pool({connectionTimeoutMillis:2500});
const pools = new Map();
function poolForContext(e) {
  if (!api.isVerifiedCustomer(e)) throw Error('UNVERIFIED_CONTEXT');
  const pool = pools.get(JSON.stringify([e.tenantId,e.storeId,e.botRef]));
  if (!pool) throw Error('UNMAPPED_CATALOG');
  return pool;
}
const getPool = shop => pools.get(JSON.stringify(['qa-tenant-'+shop,'qa-store-'+shop,'qa-bot-'+shop]));
function setup(options={}) {
  return fixture({...options, repository:options.repository || api.createPostgresQaCatalog({poolForContext}),
    sessions:api.createPostgresCustomerSessions({poolForContext,...options.policy})});
}
const privateSchema = 'tien404_customer_core_qa';
const catalogSchema = 'tien404_r1_qa';
async function rowFor(f,event) {
  const {actorHash}=f.ingress.verify(event);
  return (await admin.query('SELECT * FROM '+privateSchema+'.sessions WHERE actor_hash=$1',[actorHash])).rows[0];
}
before(async()=>{
  const {rows:[preflight]} = await admin.query("SELECT current_database() AS db,to_regnamespace($1) AS existing,to_regnamespace($2) AS existing_catalog",
    [privateSchema,catalogSchema]);
  assert.equal(preflight.db,'tien404_core_ephemeral'); assert.equal(preflight.existing,null); assert.equal(preflight.existing_catalog,null);
  assert.equal((await admin.query("SELECT current_setting('server_version') AS v")).rowCount,1);
  // Only recreate the audited staging catalog shape in this fresh database. The customer candidate is the actual source under test.
  await admin.query('CREATE SCHEMA '+catalogSchema);
  await admin.query(`CREATE TABLE tien404_r1_qa.shop_bots (tenant_key text,store_key text,bot_key text,enabled_mode text,identity_status text,
        PRIMARY KEY(tenant_key,store_key,bot_key));
    CREATE TABLE tien404_r1_qa.catalog(tenant_key text,store_key text,bot_key text,sku text,product_name text,price_vnd bigint,stock integer,
        PRIMARY KEY(tenant_key,store_key,bot_key,sku));
    ALTER TABLE tien404_r1_qa.catalog ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tien404_r1_qa.shop_bots ENABLE ROW LEVEL SECURITY`);
  await admin.query(readFileSync(join(__dirname,'customer-state.candidate.sql'),'utf8'));
  for (const shop of ['a','b']) {
    const route=['qa-tenant-'+shop,'qa-store-'+shop,'qa-bot-'+shop];
    const role='core_qa_'+shop, password=randomBytes(24).toString('hex');
    await admin.query('CREATE ROLE '+role+" LOGIN PASSWORD '"+password+"'");
    await admin.query('GRANT USAGE ON SCHEMA '+privateSchema+','+catalogSchema+' TO '+role);
    await admin.query('GRANT SELECT ON '+catalogSchema+'.catalog,'+catalogSchema+'.shop_bots TO '+role);
    await admin.query('GRANT SELECT,INSERT,UPDATE ON '+privateSchema+'.sessions TO '+role);
    await admin.query('GRANT SELECT,INSERT,DELETE ON '+privateSchema+'.receipts TO '+role);
    const scope="tenant_key='qa-tenant-"+shop+"' AND store_key='qa-store-"+shop+"' AND bot_key='qa-bot-"+shop+"'";
    for (const t of [catalogSchema+'.catalog',catalogSchema+'.shop_bots']) {
      await admin.query('CREATE POLICY read_'+role+' ON '+t+' FOR SELECT TO '+role+' USING ('+scope+')');
    }
    for (const t of [privateSchema+'.sessions',privateSchema+'.receipts']) {
      await admin.query('CREATE POLICY use_'+role+' ON '+t+' TO '+role+' USING ('+scope+') WITH CHECK ('+scope+')');
    }
    await admin.query("INSERT INTO tien404_r1_qa.shop_bots VALUES($1,$2,$3,'dry_run','synthetic_qa')",route);
    for (const [sku,price,stock] of [['F01',shop==='a'?159000:199000,shop==='a'?3:5],['F02',210000,8]]) {
      await admin.query('INSERT INTO tien404_r1_qa.catalog VALUES($1,$2,$3,$4,$5,$6,$7)',[...route,sku,'Hàng QA '+shop,price,stock]);
    }
    pools.set(JSON.stringify(route),new Pool({user:role,password,max:8,connectionTimeoutMillis:2500,application_name:'customer-core-qa-'+shop}));
  }
});
after(async()=>{await Promise.all([...pools.values()].map(p=>p.end()));await admin.end();});

test('Shop A and Shop B use the same SKU, different RLS roles and different quotes',async()=>{
  const f=setup();
  const [a,b]=await Promise.all([f.preview('Mua 2 F01'),f.preview('Mua 2 F01',{botRef:'qa-bot-b'})]);
  assert.equal(a.totalVnd,318000);assert.equal(b.totalVnd,398000);
  for (const [shop,other] of [['a','b'],['b','a']]) {
    const db=getPool(shop);
    const r=await db.query("SELECT DISTINCT tenant_key,store_key FROM tien404_r1_qa.catalog WHERE sku='F01'");
    assert.deepEqual(r.rows,[{tenant_key:'qa-tenant-'+shop,store_key:'qa-store-'+shop}]);
    const own=await db.query('SELECT count(*)::int AS n FROM '+privateSchema+'.sessions WHERE store_key=$1',['qa-store-'+other]);
    assert.equal(own.rows[0].n,0);
    const col=await db.query("SELECT has_table_privilege(current_user,'tien404_r1_qa.catalog','UPDATE') AS can_write,rolbypassrls FROM pg_roles WHERE rolname=current_user");
    assert.deepEqual(col.rows,[{can_write:false,rolbypassrls:false}]);
  }
});

test('A conversation selects, quotes, updates quantity, cancels and then asks for a new SKU',async()=>{
  const f=setup();
  const turns=[['Shop còn F01 không?','PRODUCT_SELECTED',null],['Tôi lấy 2 cái.','QUOTE_PREVIEW',318000],
    ['Đổi thành 3 cái.','QUOTE_PREVIEW',477000],['Thôi không mua nữa.','CANCELLED',null],
    ['lấy 2 cái','WAITING_FOR_CUSTOMER',null]];
  for (const [text,phase,amount] of turns) {
    const r=await f.preview(text);assert.equal(r.phase,phase);assert.equal(r.totalVnd??null,amount);assert.equal(r.ordersWritten,0);
  }
});
test('Switching SKU never carries forward the previous price or quantity',async()=>{
  const f=setup();await f.preview('mua F01 2');
  assert.equal((await f.preview('Đổi sang F02')).status,'PRODUCT_QA_PREVIEW');
  assert.equal((await f.preview('lấy 2 cái')).totalVnd,420000);
  assert.equal((await f.preview('đổi sang F99')).status,'PRODUCT_NOT_FOUND');
  assert.equal((await f.preview('lấy 2')).status,'NEED_PRODUCT');
});
test('The next turn reads updated source price and stock again',async()=>{
  const f=setup(),r=await f.preview('mua F01 2');assert.equal(r.totalVnd,318000);
  try {
    await admin.query("UPDATE tien404_r1_qa.catalog SET price_vnd=170000,stock=2 WHERE tenant_key='qa-tenant-a' AND sku='F01'");
    assert.equal((await f.preview('đổi thành 3')).status,'INSUFFICIENT_STOCK');
    assert.equal((await f.preview('lấy 2 cái')).totalVnd,340000);
  } finally {await admin.query("UPDATE tien404_r1_qa.catalog SET price_vnd=159000,stock=3 WHERE tenant_key='qa-tenant-a' AND sku='F01'");}
});
test('Product comparisons use two independent scoped readbacks',async()=>{
  const f=setup();const a=await f.preview('so sánh F01 và F02');
  assert.equal(a.status,'COMPARE_PREVIEW');assert.match(a.replyCandidate,/159.000/);assert.match(a.replyCandidate,/210.000/);
});

test('Independent backends actually contend: one preview, one duplicate, one revision',async(t)=>{
  const db=getPool('a'), f=setup(), event=f.event('mua F01 2');
  // Warm the row and acquire its lock on an independent connection to guarantee overlapping requests.
  const warm=f.event('F01',{issuedAt:new Date(Date.parse(event.issuedAt)-1).toISOString()});
  assert.equal((await f.core.preview(warm)).status,'PRODUCT_QA_PREVIEW');
  const holder=await db.connect();
  let workers=[];
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT 1 FROM '+privateSchema+'.sessions WHERE actor_hash=$1 FOR UPDATE',[f.ingress.verify(event).actorHash]);
    workers=[f.core.preview(event),f.core.preview(event)];
    let blocked=0;
    for (let i=0;i<100 && blocked<2;i++) {
      const q=await admin.query("SELECT count(DISTINCT pid)::int AS n FROM pg_stat_activity WHERE application_name='customer-core-qa-a' AND wait_event_type='Lock'");
      blocked=q.rows[0].n;if(blocked<2) await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.ok(blocked>=2,'two independent worker backends must actually be waiting');
    await holder.query('COMMIT');
    const results=await Promise.all(workers);
    assert.deepEqual(results.map(x=>x.status).sort(),['DUPLICATE_BLOCKED','ORDER_QA_PREVIEW']);
    assert.equal(Number((await rowFor(f,event)).revision),2);
    const n=await admin.query('SELECT count(*)::int AS n FROM '+privateSchema+'.receipts WHERE actor_hash=$1 AND receipt_hash=$2',
      [f.ingress.verify(event).actorHash,f.ingress.verify(event).receiptHash]);
    assert.equal(n.rows[0].n,1);t.diagnostic('independent blocked backends='+blocked+', applied turn=1, durable receipt=1');
  } finally {await holder.query('ROLLBACK');holder.release();await Promise.allSettled(workers);}
});
test('Concurrent unique turns apply a single rate window, including retry at the limit',async()=>{
  const f=setup({policy:{maxTurns:1}}), now=new Date().toISOString();
  const ev=Array.from({length:4},()=>f.event('F01',{issuedAt:now}));
  const replies=await Promise.all(ev.map(e=>f.core.preview(e)));
  assert.equal(replies.filter(x=>x.status==='PRODUCT_QA_PREVIEW').length,1);
  assert.equal(replies.filter(x=>x.status==='RATE_LIMITED').length,3);
  const accepted=ev[replies.findIndex(x=>x.status==='PRODUCT_QA_PREVIEW')];
  assert.equal((await f.core.preview(accepted)).status,'DUPLICATE_BLOCKED');
  const i=await rowFor(f,accepted);assert.equal(i.turn_count,1);assert.equal(Number(i.revision),1);
});
test('Different shoppers and shop bindings cannot reuse session context',async()=>{
  const f=setup(),now=new Date().toISOString();
  await f.preview('F01',{issuedAt:now});
  const [otherShop,otherUser]=await Promise.all([f.preview('lấy 2',{botRef:'qa-bot-b'}),f.preview('lấy 2',{senderRef:'another-shopper'})]);
  assert.ok([otherShop,otherUser].every(r=>r.status==='NEED_PRODUCT'));
});
test('A late event cannot resurrect a cancelled cart',async()=>{
  const f=setup(), now=Date.now();
  await f.preview('F01',{issuedAt:new Date(now-1000).toISOString()});
  await f.preview('hủy',{issuedAt:new Date(now).toISOString()});
  const late=f.event('lấy 2',{issuedAt:new Date(now-500).toISOString()});
  assert.equal((await f.core.preview(late)).status,'OLDER_EVENT_IGNORED');
  assert.equal((await rowFor(f,late)).phase,'CANCELLED');
});
test('Session expiry clears SKU while a previously processed receipt still deduplicates',async()=>{
  const f=setup({policy:{ttlMs:15}}),event=f.event('F01');
  await f.core.preview(event);await new Promise(resolve=>setTimeout(resolve,35));
  const r=await f.preview('lấy 2');assert.equal(r.phase,'EXPIRED');assert.equal(r.status,'NEED_PRODUCT');
  assert.equal((await f.core.preview(event)).status,'DUPLICATE_BLOCKED');
  const fresh=await f.preview('F02');assert.equal(fresh.sku,'F02');
});
test('Two workers applying different turns with the same timestamp preserve both revisions',async()=>{
  const f=setup(), same=new Date().toISOString();
  await f.preview('F01',{issuedAt:same});
  const a=f.event('lấy 2',{issuedAt:same}), b=f.event('lấy 3',{issuedAt:same});
  const turns=await Promise.all([f.core.preview(a),f.core.preview(b)]);
  assert.deepEqual(turns.map(x=>x.totalVnd),[318000,477000]);
  const row=await rowFor(f,a);assert.equal(Number(row.revision),3);assert.ok([2,3].includes(row.quantity));
});
test('A session can be resumed from a new core instance with the same trusted identity',async()=>{
  const f=setup(), sessionPort=api.createPostgresCustomerSessions({poolForContext});
  await f.preview('F01');
  const next=api.createReadOnlyReplyCore({ingress:f.ingress,repository:api.createPostgresQaCatalog({poolForContext}),
    classifier:api.createFixtureIntentClassifier(),sessions:sessionPort});
  assert.equal((await next.preview(f.event('lấy 2'))).totalVnd,318000);
});
test('A transient catalog failure rolls back session, receipt and rate; same event can retry',async()=>{
  const real=api.createPostgresQaCatalog({poolForContext});let unavailable=true;
  const f=setup({repository:{readProduct:async p=>{if(unavailable)throw Error('catalog offline');return real.readProduct(p);}}});
  const e=f.event('mua F01 2');assert.equal((await f.core.preview(e)).status,'CATALOG_UNTRUSTED');
  assert.equal(await rowFor(f,e),undefined);unavailable=false;
  assert.equal((await f.core.preview(e)).totalVnd,318000);
  assert.equal(Number((await rowFor(f,e)).revision),1);
});
test('Unknown model outcome releases the lock and can be retried safely',async()=>{
  let fail=true;const planner=api.createFixtureIntentClassifier();
  const f=setup({modelTimeoutMs:10,classifier:{classify:(p)=>fail?new Promise(()=>{}):planner.classify(p)}});
  const e=f.event('F01');assert.equal((await f.core.preview(e)).status,'MODEL_UNAVAILABLE');
  assert.equal(await rowFor(f,e),undefined);fail=false;assert.equal((await f.core.preview(e)).status,'PRODUCT_QA_PREVIEW');
});
test('Wrong shop pool cannot read the requested catalog and cannot write its session',async()=>{
  const wrong=()=>getPool('b');
  const f=setup({policy:{poolForContext:wrong}});
  assert.equal((await f.preview('F01')).status,'STATE_PORT_UNAVAILABLE');
  const read=await api.readFreshQaProduct({repository:api.createPostgresQaCatalog({poolForContext:wrong}),
    context:f.ingress.verify(f.event('F01')),sku:'F01'});assert.equal(read.status,'NOT_FOUND');
});
test('Stored customer state contains only structured fields; external order tables are absent',async()=>{
  const q=await admin.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1',[privateSchema]);
  assert.ok(!q.rows.some(x=>/raw|text|name|email|phone|message_id|price|total|chat_id/.test(x.column_name)));
  const r=await admin.query("SELECT to_regclass('public.orders') IS NULL AS no_orders,to_regclass('public.outbox') IS NULL AS no_outbox");
  assert.deepEqual(r.rows,[{no_orders:true,no_outbox:true}]);
});
test('Late unique events consume quota but do not keep the old session alive',async()=>{
  const f=setup({policy:{maxTurns:2}}),now=Date.now();
  const initial=f.event('F01',{issuedAt:new Date(now).toISOString()});
  await f.core.preview(initial);const start=await rowFor(f,initial);
  const late=f.event('lấy 2',{issuedAt:new Date(now-500).toISOString()});
  assert.equal((await f.core.preview(late)).status,'OLDER_EVENT_IGNORED');
  const after=await rowFor(f,initial);assert.equal(after.turn_count,2);
  assert.equal(+after.expires_at,+start.expires_at);assert.equal(after.revision,start.revision);
  assert.equal((await f.preview('F02')).status,'RATE_LIMITED');
});
test('Failed switch to another SKU clears the previous selection even when PostgreSQL aborts the catalog query',async()=>{
  const real=api.createPostgresQaCatalog({poolForContext});let fail=true;
  const f=setup({repository:{async readProduct(p) {
    if(fail && p.sku==='F02') await p.client.query('SELECT 1/0');
    return real.readProduct(p);
  }}});
  await f.preview('mua F01 2');
  const switchEvent=f.event('đổi sang F02');
  assert.equal((await f.core.preview(switchEvent)).status,'CATALOG_UNTRUSTED');
  const state=await rowFor(f,switchEvent);assert.equal(state.sku,null);assert.equal(state.quantity,null);
  assert.equal((await f.preview('lấy 2')).status,'NEED_PRODUCT');
  fail=false;assert.equal((await f.preview('F02')).sku,'F02');
  assert.equal((await f.preview('lấy 2')).totalVnd,420000);
});
test('A failed explicit switch can retry its exact same event before a later turn',async()=>{
  const real=api.createPostgresQaCatalog({poolForContext});let fail=true;
  const f=setup({repository:{async readProduct(p) {
    if(fail && p.sku==='F02') throw Error('offline');
    return real.readProduct(p);
  }}});
  await f.preview('F01');const e=f.event('đổi sang F02');
  assert.equal((await f.core.preview(e)).status,'CATALOG_UNTRUSTED');
  fail=false;assert.equal((await f.core.preview(e)).status,'PRODUCT_QA_PREVIEW');
  assert.equal((await f.core.preview(e)).status,'DUPLICATE_BLOCKED');
});


test('Disposable PostgreSQL retention deletes only expired synthetic sessions in bounded batches',async()=>{
  const {createQaRetentionMaintenance}=require('./retention.cjs');
  const scope=['qa-tenant-a','qa-store-a','qa-fixture','qa-bot-a'];
  const actors=['d'.repeat(64),'e'.repeat(64),'f'.repeat(64)];
  const add=async(hash,when)=>admin.query(`INSERT INTO tien404_customer_core_qa.sessions
    (tenant_key,store_key,channel,bot_key,actor_hash,expires_at)
    VALUES ($1,$2,$3,$4,$5,clock_timestamp()+$6::interval)`,
    [...scope,hash,when]);
  await add(actors[0],'-48 hours');
  await add(actors[1],'-47 hours');
  await add(actors[2],'+20 minutes');
  const receipt=async(actor,hash,interval)=>admin.query(`INSERT INTO tien404_customer_core_qa.receipts
    (tenant_key,store_key,channel,bot_key,actor_hash,receipt_hash,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp()+$7::interval)`,
    [...scope,actor,hash,interval]);
  await receipt(actors[0],'1'.repeat(64),'-47 hours');
  await receipt(actors[2],'2'.repeat(64),'-36 hours');
  await receipt(actors[2],'3'.repeat(64),'+20 minutes');
  const manager=createQaRetentionMaintenance({pool:admin,batchSize:1,sessionRetentionMs:86400000});
  const before=await manager.inspect();
  assert.ok(before.staleSessions>=2);
  assert.ok(before.staleReceipts>=2);
  assert.equal(before.mode,'READ_ONLY_RETENTION_INSPECTION');
  const first=await manager.sweepDisposableQaOnly(),second=await manager.sweepDisposableQaOnly();
  assert.equal(first.mode,'DISPOSABLE_PG_QA_ONLY');
  assert.equal(first.deletedSessions,1);assert.equal(second.deletedSessions,1);
  for(const x of [first,second]){
    assert.ok(x.deletedSessions<=1&&x.deletedReceipts<=1);
    assert.equal(x.didCallModel,false);assert.equal(x.didSendChannel,false);
    assert.ok(!JSON.stringify(x).includes('actorHash'));
  }
  const old=await admin.query(`SELECT actor_hash FROM tien404_customer_core_qa.sessions
    WHERE tenant_key=$1 AND store_key=$2 AND actor_hash=ANY($3)`,[scope[0],scope[1],actors]);
  assert.deepEqual(old.rows.map(x=>x.actor_hash),[actors[2]]);
  const receiptRows=await admin.query(`SELECT receipt_hash FROM tien404_customer_core_qa.receipts
    WHERE actor_hash=$1 ORDER BY receipt_hash`,[actors[2]]);
  assert.deepEqual(receiptRows.rows.map(x=>x.receipt_hash),['3'.repeat(64)]);
  const third=await manager.sweepDisposableQaOnly();
  assert.equal(third.deletedSessions,0);
  assert.equal(third.deletedReceipts,0);
});
