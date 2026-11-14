'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makePostgresQARepository,sql}=require('./shop-b-postgres-repository.cjs');
const {processTurn}=require('./shop-b-session-service.cjs');
const NOW=Date.parse('2026-11-14T14:10:00Z');
const owner={
 source:'VERIFIED_BACKEND_BINDING',server_verified:true,binding_status:'paired',
 owner_claim_status:'CONFIRMED',owner_recipient_matches:true,enabled_mode:'dry_run',
 identity_status:'synthetic_qa',tenant_key:'qa-tenant-b',store_key:'qa-store-b',
 bot_key:'qa-bot-b',binding_fingerprint:'qa_b_binding_review_1',
 binding_challenge_id:'ed091ead-0000-4000-8000-001122334455',
 recipient_fingerprint:'qa_recipient_verified_a',
 expires_at:'2026-11-21T11:23:15.797Z'
};
const evt=(text,id='qa_pg_msg_one')=>({
 source:'VERIFIED_ZALO_WEBHOOK_NORMALIZER',accepted:true,
 eventName:'message.text.received',chatType:'PRIVATE',
 recipient_fingerprint:owner.recipient_fingerprint,message_ref:id,text
});
const newSession=(key)=>({scope_key:key,tenant_key:owner.tenant_key,
 store_key:owner.store_key,bot_key:owner.bot_key,binding_fingerprint:owner.binding_fingerprint,
 revision:0,phase:'idle',sku:null,quantity:null,expected_total_vnd:null,
 confirmation_hash:null,quote_expires_at:null,order_key:null,
 idempotency_key:null,session_ref:null,expires_at:new Date(owner.expires_at)});
class FakePool{
 constructor(){
  this.sessions=new Map();this.receipts=new Set();this.logs=[];this.releases=0;
  this.binding={status:'paired',claim_status:'CONFIRMED',
    recipient_ref:owner.recipient_fingerprint,
    claim_recipient_ref:owner.recipient_fingerprint,
    confirmed_challenge_id:owner.binding_challenge_id,
    expires_at:owner.expires_at,enabled_mode:'dry_run',identity_status:'synthetic_qa'};
  this.catalog={tenant_key:owner.tenant_key,store_key:owner.store_key,
    bot_key:owner.bot_key,sku:'F01',product_name:'Áo thun đen L [QA - B]',
    price_vnd:'199000',stock:5};
  this.forceCAS=false;this.forceReceiptConflict=false;this.failCatalog=false;
 }
 async connect(){
  const parent=this;let draft=null;
  return {
   release(){parent.releases++;},
   async query(query,params=[]){
    parent.logs.push({query,params});
    if(query==='BEGIN'){
      draft={sessions:new Map([...parent.sessions].map(([k,v])=>[k,structuredClone(v)])),
        receipts:new Set(parent.receipts)};return {rows:[]};
    }
    if(query==='ROLLBACK'){draft=null;return {rows:[]};}
    if(query==='COMMIT'){
      parent.sessions=draft.sessions;parent.receipts=draft.receipts;draft=null;return {rows:[]};
    }
    if(!draft)throw Error('NO_TRANSACTION');
    if(query===sql.binding)return {rows:[parent.binding]};
    if(query===sql.insertSession){
      if(!draft.sessions.has(params[0]))draft.sessions.set(params[0],newSession(params[0]));
      return {rows:[]};
    }
    if(query===sql.getSession){
      const row=draft.sessions.get(params[0]);return {rows:row?[row]:[]};
    }
    if(query===sql.catalog){
      if(parent.failCatalog)throw Error('DATABASE_CATALOG_ERROR');
      if(params[0]!==parent.catalog.tenant_key||params[1]!==parent.catalog.store_key||
         params[2]!==parent.catalog.bot_key||params[3]!=='F01')return {rows:[]};
      return {rows:[parent.catalog]};
    }
    if(query===sql.receiptExists)return {rows:draft.receipts.has(params[0]+':'+params[1])?[{one:1}]:[]};
    if(query===sql.updateSession){
      if(parent.forceCAS)return {rows:[]};
      const row=draft.sessions.get(params[0]);
      if(!row||row.revision!==params[11])return {rows:[]};
      Object.assign(row,{phase:params[1],sku:params[2],quantity:params[3],
        expected_total_vnd:params[4],confirmation_hash:params[5],
        quote_expires_at:params[6],order_key:params[7],idempotency_key:params[8],
        session_ref:params[9],expires_at:params[10],revision:row.revision+1});
      return {rows:[{revision:row.revision}]};
    }
    if(query===sql.writeReceipt){
      const key=params[0]+':'+params[1];
      if(parent.forceReceiptConflict||draft.receipts.has(key))return {rows:[]};
      draft.receipts.add(key);return {rows:[{event_hash:params[1]}]};
    }
    throw Error('UNKNOWN_SQL');
   }
  };
 }
}
const setup=(pool=new FakePool(),override={})=>{
 const adapter=makePostgresQARepository({pool,owner,clock:()=>NOW,...override});
 return {pool,adapter,send:(text,id='qa_pg_msg_one',opt={})=>
   processTurn({owner,event:evt(text,id),repository:adapter,now:NOW,...opt})};
};
const codeFrom=(d)=>d.reply?.match(/XAC NHAN QA ([A-F0-9]{32})/)?.[1];
const denied=(reason,fn)=>assert.rejects(fn(),{code:reason});
test('01 rejects untrusted owner in constructor',()=>assert.throws(()=>
 makePostgresQARepository({pool:new FakePool(),owner:{...owner,source:'CLIENT'}}),{code:'TRUSTED_OWNER_REQUIRED'}));
test('02 rejects missing pg pool',()=>assert.throws(()=>
 makePostgresQARepository({pool:{},owner}),{code:'PG_POOL_REQUIRED'}));
test('03 validates scope hash and handler',async()=>denied('SCOPE_OR_HANDLER_INVALID',
 ()=>makePostgresQARepository({pool:new FakePool(),owner}).transact('client-scope',async()=>{})));
test('04 bound Owner DB claim checked each transaction',async()=>{
 const w=setup(),d=await w.send('gia F01');assert.equal(d.status,'catalog');
 assert.equal(w.pool.logs.filter(x=>x.query===sql.binding).length,1);
});
test('05 exact tenant/store/bot parameters sent to binding and catalog reads',async()=>{
 const w=setup();await w.send('gia F01');
 const b=w.pool.logs.find(x=>x.query===sql.binding),c=w.pool.logs.find(x=>x.query===sql.catalog);
 assert.deepEqual(b.params,['qa-tenant-b','qa-store-b','qa-bot-b']);
 assert.deepEqual(c.params,['qa-tenant-b','qa-store-b','qa-bot-b','F01']);
});
test('06 sessions locked by SELECT FOR UPDATE before writes',async()=>{
 const w=setup();await w.send('gia F01');
 const q=w.pool.logs.map(x=>x.query);
 assert.ok(q.indexOf(sql.getSession)<q.indexOf(sql.updateSession));
 assert.match(sql.getSession,/FOR UPDATE/);
});
test('07 catalog read uses FOR SHARE',async()=>{
 const w=setup();await w.send('gia F01');assert.match(sql.catalog,/FOR SHARE/);
});
test('08 new session commits only to private QA tables',async()=>{
 const w=setup();await w.send('gia F01');
 assert.equal(w.pool.sessions.size,1);
 const queries=w.pool.logs.map(x=>x.query).join('\n');
 assert.ok(!/INSERT INTO tien404_r1_qa\.(?:sandbox_orders|owner_outbox)/.test(queries));
});
test('09 Shop B price is 199000 and no HTTP sends',async()=>{
 const w=setup(),r=await w.send('gia F01');
 assert.match(r.reply,/199\.000/);assert.doesNotMatch(r.reply,/159\.000/);
 assert.equal(r.orders_written,0);assert.equal(r.external_sends,0);
});
test('10 initial buy draft uses secure confirmation and stores only hash',async()=>{
 const w=setup(),r=await w.send('mua F01 2'),snapshot=[...w.pool.sessions.values()][0];
 assert.equal(r.status,'draft');assert.equal(r.draft.total_vnd,398000);
 assert.match(snapshot.confirmation_hash,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(snapshot).includes(codeFrom(r)));
});
test('11 confirmation yields proposal not an order insert',async()=>{
 const w=setup(),d=await w.send('mua F01 2'),r=await w.send('XAC NHAN QA '+codeFrom(d),'qa_pg_msg_two');
 assert.equal(r.status,'proposal_ready');assert.equal(r.commit_proposal.write_executed,false);
 assert.ok(w.pool.logs.every(x=>!x.query.includes('INSERT INTO tien404_r1_qa.sandbox_orders')));
});
test('12 duplicate event is ignored and not saved twice',async()=>{
 const w=setup();await w.send('mua F01 2');const r=await w.send('mua F01 2');
 assert.equal(r.status,'duplicate');assert.equal(w.pool.receipts.size,1);
});
test('13 wrong pairing challenge denies and rolls back',async()=>{
 const pool=new FakePool();pool.binding.confirmed_challenge_id='different-uuid';
 const w=setup(pool);await denied('BINDING_DB_REVALIDATION_FAILED',()=>w.send('gia F01'));
 assert.equal(pool.sessions.size,0);assert.ok(pool.logs.some(x=>x.query==='ROLLBACK'));
});
test('14 recipient mismatch denies before any data read',async()=>{
 const pool=new FakePool();pool.binding.recipient_ref='other-recipient';
 const w=setup(pool);await denied('BINDING_DB_REVALIDATION_FAILED',()=>w.send('gia F01'));
 assert.equal(pool.sessions.size,0);
});
test('15 claim revoked denies',async()=>{
 const pool=new FakePool();pool.binding.claim_status='REVOKED';await denied('BINDING_DB_REVALIDATION_FAILED',()=>setup(pool).send('gia F01'));
});
test('16 bot switched out of dry_run denies',async()=>{
 const pool=new FakePool();pool.binding.enabled_mode='live';await denied('BINDING_DB_REVALIDATION_FAILED',()=>setup(pool).send('gia F01'));
});
test('17 binding expired denied',async()=>{
 const pool=new FakePool();pool.binding.expires_at='2026-11-14T13:00:00Z';
 await denied('BINDING_DB_REVALIDATION_FAILED',()=>setup(pool).send('gia F01'));
});
test('18 catalog foreign store denied within lock',async()=>{
 const pool=new FakePool();pool.catalog.store_key='qa-store-a';
 await denied('CATALOG_READBACK_MISSING',()=>setup(pool).send('gia F01'));
 assert.equal(pool.sessions.size,0);
});
test('19 catalog failure rolls back receipt and session',async()=>{
 const pool=new FakePool();pool.failCatalog=true;
 await assert.rejects(setup(pool).send('gia F01'),/DATABASE_CATALOG_ERROR/);
 assert.equal(pool.sessions.size,0);assert.equal(pool.receipts.size,0);
});
test('20 session compare-and-swap conflict rolls back',async()=>{
 const pool=new FakePool();pool.forceCAS=true;
 await denied('SESSION_CAS_CONFLICT',()=>setup(pool).send('gia F01'));
 assert.equal(pool.sessions.size,0);
});
test('21 receipt conflict rolls back updated session',async()=>{
 const pool=new FakePool();pool.forceReceiptConflict=true;
 await denied('EVENT_REPLAY_CONFLICT',()=>setup(pool).send('gia F01'));
 assert.equal(pool.sessions.size,0);
});
test('22 every transaction releases pg client on success',async()=>{
 const w=setup();await w.send('gia F01');assert.equal(w.pool.releases,1);
});
test('23 every failed transaction releases pg client',async()=>{
 const pool=new FakePool();pool.failCatalog=true;await assert.rejects(setup(pool).send('gia F01'));
 assert.equal(pool.releases,1);
});
test('24 private schema only; no public grants in adapter SQL',()=>{
 const queries=Object.values(sql).join(' ');
 assert.ok(!queries.includes('GRANT ALL'));
 assert.ok(!queries.includes('public.shop_b_sessions'));
 assert.match(queries,/tien404_dialogue_private/);
});
test('25 re-checks stock at confirmation in database',async()=>{
 const w=setup(),d=await w.send('mua F01 2');
 w.pool.catalog.stock=1;
 const x=await w.send('XAC NHAN QA '+codeFrom(d),'qa_pg_msg_two');
 assert.equal(x.status,'quote_stale');
});
test('26 price conflict at confirmation prevents proposal',async()=>{
 const w=setup(),d=await w.send('mua F01 2');
 w.pool.catalog.price_vnd='209000';
 const x=await w.send('XAC NHAN QA '+codeFrom(d),'qa_pg_msg_two');
 assert.equal(x.status,'quote_stale');
});
test('27 raw chat id never present in committed session fields',async()=>{
 const w=setup();await w.send('gia F01');
 assert.ok(!JSON.stringify([...w.pool.sessions.values()]).includes('qa-device-chat-id'));
});
test('28 receipt hashes stable and 64-hex',async()=>{
 const w=setup();await w.send('gia F01');const val=[...w.pool.receipts][0];
 assert.match(val.split(':')[1],/^[a-f0-9]{64}$/);
});
