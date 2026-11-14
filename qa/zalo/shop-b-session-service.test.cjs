'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {processTurn,SESSION_TTL_MS}=require('./shop-b-session-service.cjs');
const NOW=Date.parse('2026-11-14T14:00:00.000Z');
const owner=Object.freeze({
 source:'VERIFIED_BACKEND_BINDING',server_verified:true,binding_status:'paired',
 owner_claim_status:'CONFIRMED',owner_recipient_matches:true,enabled_mode:'dry_run',
 identity_status:'synthetic_qa',tenant_key:'qa-tenant-b',store_key:'qa-store-b',
 bot_key:'qa-bot-b',binding_fingerprint:'qa_b_binding_1',
 recipient_fingerprint:'sha256_recipient_b',expires_at:'2026-11-21T11:23:15.797Z'
});
const product=Object.freeze({tenant_key:'qa-tenant-b',store_key:'qa-store-b',bot_key:'qa-bot-b',
 sku:'F01',product_name:'Áo thun đen L [QA - B]',price_vnd:199000,stock:5,
 source:'VERIFIED_DB_READBACK'});
const incoming=(text,id='qa_event_0001')=>({
 source:'VERIFIED_ZALO_WEBHOOK_NORMALIZER',accepted:true,
 eventName:'message.text.received',chatType:'PRIVATE',
 recipient_fingerprint:owner.recipient_fingerprint,message_ref:id,text
});
const fail=(code,promise)=>assert.rejects(promise,{code});
class AtomicFake {
 constructor(){this.data=new Map();this.locks=new Map();this.catalog={...product};this.transactions=0;}
 async transact(scope,body){
  const previous=this.locks.get(scope)||Promise.resolve();
  let release;const wait=new Promise(resolve=>{release=resolve;});
  this.locks.set(scope,previous.then(()=>wait));
  await previous;
  const original=this.data.get(scope)||{state:null,receipts:new Set()};
  const draft={state:original.state?structuredClone(original.state):null,receipts:new Set(original.receipts)};
  const tx={
   getState:async()=>draft.state,
   getCatalog:async(s)=>({...this.catalog}),
   hasReceipt:async(x)=>draft.receipts.has(x),
   saveState:async(x)=>{draft.state=structuredClone(x);},
   markReceipt:async(x)=>{draft.receipts.add(x);}
  };
  try {const answer=await body(tx);this.data.set(scope,draft);this.transactions++;return answer;}
  finally{release();}
 }
 snapshot(){return [...this.data.values()][0];}
}
const make=(repo=new AtomicFake(),opts={})=>({
 repo,send:(text,id='qa_event_0001',extra={})=>
 processTurn({owner,event:incoming(text,id),repository:repo,now:NOW,...opts,...extra})
});
const findCode=(x)=>x.reply?.match(/XAC NHAN QA ([A-F0-9]{32})/)?.[1]||null;
const createDraft=async(w,n=2)=>{
 const draft=await w.send('mua F01 '+n,'qa_draft_1');
 assert.equal(draft.status,'draft');return draft;
};
test('01 price Shop B 199000 is not Shop A 159000',async()=>{
 const w=make(),x=await w.send('Giá F01');assert.equal(x.status,'catalog');
 assert.match(x.reply,/199\.000/);assert.doesNotMatch(x.reply,/159\.000/);
});
test('02 correct QA stock displayed',async()=>{
 const w=make(),x=await w.send('F01 còn bao nhiêu');assert.match(x.reply,/5/);
});
test('03 greeting allowed only within owner gate',async()=>assert.equal((await make().send('xin chào')).status,'greeting'));
test('04 ask quantity does not create order',async()=>{let x=await make().send('mua F01');assert.equal(x.status,'ask_quantity');assert.equal(x.orders_written,0)});
test('05 second turn quantity 2 produces 398000',async()=>{
 const w=make();await w.send('mua F01');const d=await w.send('2','qa_event_0002');
 assert.equal(d.draft.total_vnd,398000);
});
test('06 direct buy yields one 32hex challenge',async()=>{
 const w=make();const d=await createDraft(w);
 assert.match(findCode(d),/^[A-F0-9]{32}$/);
 assert.equal(d.draft.total_vnd,398000);
});
test('07 raw confirmation code is never persisted in state',async()=>{
 const w=make(),d=await createDraft(w),encoded=JSON.stringify(w.repo.snapshot().state);
 assert.ok(!encoded.includes(findCode(d)));assert.match(w.repo.snapshot().state.confirmation_hash,/^[a-f0-9]{64}$/);
});
test('08 raw sender and event message ids never stored',async()=>{
 const w=make();await w.send('Giá F01','qa_device_msg_00001');
 const s=JSON.stringify([...w.repo.data.values()].map(x=>({...x,receipts:[...x.receipts]})));
 assert.ok(!s.includes('qa_device_msg_00001'));assert.ok(!s.includes('raw_phone'));
});
test('09 successful confirmation generates proposal only',async()=>{
 const w=make(),d=await createDraft(w),c=await w.send('XAC NHAN QA '+findCode(d),'qa_event_0002');
 assert.equal(c.status,'proposal_ready');assert.equal(c.commit_proposal.expected_total_vnd,398000);
 assert.equal(c.commit_proposal.write_executed,false);
 assert.equal(c.orders_written,0);assert.equal(c.external_sends,0);
 assert.match(c.commit_proposal.order_key,/^QA-B-[A-F0-9]{24}$/);
 assert.match(c.commit_proposal.session_ref,/^qa-session-[a-f0-9]{24}$/);
});
test('10 replay same inbound event no duplicate proposal',async()=>{
 const w=make(),d=await createDraft(w);await w.send('XAC NHAN QA '+findCode(d),'qa_event_0002');
 const x=await w.send('XAC NHAN QA '+findCode(d),'qa_event_0002');
 assert.equal(x.status,'duplicate');assert.equal(x.commit_proposal,undefined);
});
test('11 repeat same code different message no second proposal',async()=>{
 const w=make(),d=await createDraft(w);await w.send('XAC NHAN QA '+findCode(d),'qa_event_0002');
 const x=await w.send('XAC NHAN QA '+findCode(d),'qa_event_0003');assert.equal(x.status,'pending');
});
test('12 wrong code denied',async()=>{
 const w=make();await createDraft(w);
 const x=await w.send('XAC NHAN QA '+'F'.repeat(32),'qa_event_0002');
 assert.equal(x.status,'confirmation_denied');
});
test('13 casual confirmation denied',async()=>{
 const w=make();await createDraft(w);const x=await w.send('đồng ý','qa_event_0002');
 assert.notEqual(x.status,'proposal_ready');
});
test('14 confirmation without pending draft denied',async()=>{
 const x=await make().send('XAC NHAN QA '+'A'.repeat(32));
 assert.equal(x.status,'confirmation_denied');
});
test('15 price changed between draft and confirm denies',async()=>{
 const w=make(),d=await createDraft(w);w.repo.catalog={...product,price_vnd:200000};
 const x=await w.send('XAC NHAN QA '+findCode(d),'qa_event_0002');
 assert.equal(x.status,'quote_stale');assert.equal(x.commit_proposal,undefined);
});
test('16 stock changed between draft and confirm denies',async()=>{
 const w=make(),d=await createDraft(w);w.repo.catalog={...product,stock:1};
 const x=await w.send('XAC NHAN QA '+findCode(d),'qa_event_0002');
 assert.equal(x.status,'quote_stale');
});
test('17 expired quote denied',async()=>{
 const w=make(),d=await createDraft(w);
 const x=await w.send('XAC NHAN QA '+findCode(d),'qa_event_0002',{now:NOW+600001});
 assert.equal(x.status,'quote_stale');
});
test('18 expired session drops old confirmation',async()=>{
 const w=make(),d=await createDraft(w),x=await w.send('XAC NHAN QA '+findCode(d),'qa_event_0002',{now:NOW+SESSION_TTL_MS+1});
 assert.equal(x.status,'confirmation_denied');
});
test('19 cancel clears raw draft',async()=>{
 const w=make();await createDraft(w);const x=await w.send('hủy','qa_event_0002');
 assert.equal(x.status,'cancel');assert.equal(w.repo.snapshot().state.confirmation_hash,null);
});
test('20 canceled confirmation code not reusable',async()=>{
 const w=make(),d=await createDraft(w);await w.send('hủy','qa_event_0002');
 const c=await w.send('XAC NHAN QA '+findCode(d),'qa_event_0003');assert.equal(c.status,'confirmation_denied');
});
test('21 quantity zero denied',async()=>assert.equal((await make().send('mua F01 0')).status,'quantity_invalid'));
test('22 quantity 6 over 5 rejected',async()=>assert.equal((await make().send('mua F01 6')).status,'quantity_invalid'));
test('23 qty5 creates 995000 draft',async()=>assert.equal((await make().send('mua F01 5')).draft.total_vnd,995000));
test('24 inventory zero rejects all quantities',async()=>{
 const w=make();w.repo.catalog.stock=0;
 assert.equal((await w.send('mua F01 1')).status,'quantity_invalid');
});
test('25 prompt injection cannot switch to Shop A',async()=>{
 const x=await make().send('Shop A F01 159000');assert.equal(x.status,'denied');
});
test('26 bad source never accepted',async()=>fail('INBOUND_UNVERIFIED',make().send('gia F01',undefined,{event:{...incoming('gia F01'),source:'CLIENT_FORGED'}})));
test('27 bad owner role denied',async()=>fail('OWNER_SCOPE_UNVERIFIED',make().send('gia F01',undefined,{owner:{...owner,server_verified:false}})));
test('28 foreign tenant owner denied',async()=>fail('OWNER_SCOPE_UNVERIFIED',make().send('gia F01',undefined,{owner:{...owner,tenant_key:'qa-tenant-a'}})));
test('29 foreign catalog row denied',async()=>{const w=make();w.repo.catalog={...product,store_key:'qa-store-a',price_vnd:159000};await fail('CATALOG_INVALID_OR_FOREIGN',w.send('gia F01'))});
test('30 invalid numeric price denied',async()=>{const w=make();w.repo.catalog={...product,price_vnd:0};await fail('CATALOG_INVALID_OR_FOREIGN',w.send('gia F01'))});
test('31 provider fake chat private only',async()=>fail('INBOUND_UNVERIFIED',make().send('gia F01',undefined,{event:{...incoming('gia F01'),chatType:'GROUP'}})));
test('32 other recipient cannot read data',async()=>fail('INBOUND_UNVERIFIED',make().send('gia F01',undefined,{event:{...incoming('gia F01'),recipient_fingerprint:'foreign'}})));
test('33 owner pairing expiry denies',async()=>fail('OWNER_SCOPE_UNVERIFIED',make().send('gia F01',undefined,{now:Date.parse(owner.expires_at)+1})));
test('34 malformed client event denied',async()=>fail('INBOUND_UNVERIFIED',make().send('gia F01',undefined,{event:{...incoming('gia F01'),accepted:false}})));
test('35 without atomic repository denies',async()=>fail('ATOMIC_REPOSITORY_REQUIRED',processTurn({owner,event:incoming('F01'),repository:{},now:NOW})));
test('36 concurrent duplicate event yields 1 processing, 1 duplicate',async()=>{
 const w=make();const [a,b]=await Promise.all([w.send('mua F01 2','same_event'),w.send('mua F01 2','same_event')]);
 assert.equal([a.status,b.status].filter(x=>x==='draft').length,1);
 assert.equal([a.status,b.status].filter(x=>x==='duplicate').length,1);
});
test('37 sequential identical event leaves one session receipt',async()=>{
 const w=make();await w.send('mua F01 2','same_event');await w.send('mua F01 2','same_event');
 assert.equal(w.repo.snapshot().receipts.size,1);
});
test('38 simultaneous confirm same code makes one proposal',async()=>{
 const w=make(),d=await createDraft(w),code=findCode(d);
 const [a,b]=await Promise.all([w.send('XAC NHAN QA '+code,'qa_confirm_1'),w.send('XAC NHAN QA '+code,'qa_confirm_2')]);
 assert.equal([a.status,b.status].filter(x=>x==='proposal_ready').length,1);
 assert.equal([a.status,b.status].filter(x=>x==='pending').length,1);
});
test('39 re-pair with new binding fingerprint isolates state',async()=>{
 const w=make(),d=await createDraft(w);
 const other={...owner,binding_fingerprint:'qa_b_binding_repaired'};
 const x=await w.send('XAC NHAN QA '+findCode(d),'qa_event_0002',{owner:other});
 assert.equal(x.status,'confirmation_denied');
});
test('40 correct price requires DB readback not stale snapshot',async()=>{
 const w=make();w.repo.catalog={...product,source:'QA_SNAPSHOT_ONLY'};
 await fail('CATALOG_INVALID_OR_FOREIGN',w.send('gia F01'));
});
test('41 session rollback on database read error',async()=>{
 const w=make();w.repo.catalog={...product,tenant_key:'qa-tenant-a'};
 await fail('CATALOG_INVALID_OR_FOREIGN',w.send('gia F01'));
 assert.equal(w.repo.data.size,0);
});
test('42 receipt+session commit atomic under memory simulation',async()=>{
 const w=make();await w.send('gia F01');
 assert.equal(w.repo.snapshot().receipts.size,1);
 assert.equal(w.repo.snapshot().state.phase,'viewing');
});
test('43 phone/PII not returned by messages',async()=>{
 const x=await make().send('gia F01');
 assert.equal(JSON.stringify(x).includes('recipient_fingerprint'),false);
});
test('44 no send and no order write in every conversation state',async()=>{
 const w=make(),steps=['hi','gia F01','mua F01 2','huy','mua F01','2'];
 for(let i=0;i<steps.length;i++){const x=await w.send(steps[i],'evt_'+i);
 assert.equal(x.external_sends,0);assert.equal(x.orders_written,0)}
});
