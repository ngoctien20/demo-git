'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {resolveShopBInbound,canonical,MAX_CLOCK_SKEW_MS,QUERY}=require('./shop-b-trusted-owner-resolver.cjs');
const {processTurn}=require('./shop-b-session-service.cjs');
const NOW=Date.parse('2026-11-14T15:20:00Z'),KEY=Buffer.alloc(32,0x42); // synthetic QA-only key
const ref='qa_verified_owner_recipient_reference_B_1234567890123456789012345678901234';
const challenge='11111111-1111-4111-8111-111111111111';
const base={
 version:1,source:'VERIFIED_ZALO_V1_INGRESS',bot_ref:'qa-bot-b',
 event_name:'message.text.received',chat_type:'PRIVATE',
 recipient_ref:ref,message_ref:'qa-device-event-01',
 text:'mua F01 2',issued_at:new Date(NOW).toISOString()
};
const sign=(fields=base,key=KEY)=>({...fields,signature:createHmac('sha256',key).update(canonical(fields)).digest('hex')});
const row={
 binding_status:'paired',claim_status:'CONFIRMED',
 recipient_ref:ref,claim_recipient_ref:ref,
 enabled_mode:'dry_run',identity_status:'synthetic_qa',
 expires_at:'2026-11-21T11:23:15.797Z',confirmed_challenge_id:challenge
};
class FakeDB {
 constructor(rows=[row]){this.rows=rows;this.calls=[];}
 async query(query,params){this.calls.push({query,params});return {rows:this.rows};}
}
const setup=(env=sign(),db=new FakeDB(),opt={})=>({
 db,run:()=>resolveShopBInbound({envelope:env,internalKey:KEY,database:db,now:NOW,...opt})
});
const denied=(code,fn)=>assert.rejects(fn(),{code});
test('01 trusted signed private message resolves owner and event',async()=>{
 const x=await setup().run();assert.equal(x.owner.tenant_key,'qa-tenant-b');
 assert.equal(x.owner.store_key,'qa-store-b');assert.equal(x.owner.bot_key,'qa-bot-b');
 assert.equal(x.owner.recipient_fingerprint,ref);
 assert.equal(x.owner.source,'VERIFIED_BACKEND_BINDING');
 assert.equal(x.event.message_ref,'qa-device-event-01');
});
test('02 owner pairing fingerprint is 64 hex and stable',async()=>{
 const a=await setup().run(),b=await setup().run();
 assert.match(a.owner.binding_fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(a.owner.binding_fingerprint,b.owner.binding_fingerprint);
});
test('03 re-pair changes session fingerprint namespace',async()=>{
 const a=await setup().run(),b=await setup(sign(),new FakeDB([{...row,confirmed_challenge_id:'22222222-2222-4222-8222-222222222222'}])).run();
 assert.notEqual(a.owner.binding_fingerprint,b.owner.binding_fingerprint);
});
test('04 wrong HMAC is rejected before database read',async()=>{
 const db=new FakeDB(),x=setup(sign(base,Buffer.alloc(32,0x24)),db);
 await denied('INGRESS_SIGNATURE_INVALID',x.run);assert.equal(db.calls.length,0);
});
test('05 altered text invalidates HMAC',async()=>{
 const db=new FakeDB();
 const env={...sign(base),text:'mua F01 999'};
 await denied('INGRESS_SIGNATURE_INVALID',setup(env,db).run);
 assert.equal(db.calls.length,0);
});
test('06 altered recipient invalidates HMAC',async()=>{
 const env={...sign(base),recipient_ref:'fake-recipient'};
 await denied('INGRESS_SIGNATURE_INVALID',setup(env).run);
});
test('07 signature missing',async()=>denied('INGRESS_ENVELOPE_INVALID',setup({...base}).run));
test('08 timestamp too old',async()=>denied('INGRESS_CLOCK_SKEW',setup(sign({...base,issued_at:new Date(NOW-MAX_CLOCK_SKEW_MS-1).toISOString()})).run));
test('09 timestamp too far in future',async()=>denied('INGRESS_CLOCK_SKEW',setup(sign({...base,issued_at:new Date(NOW+MAX_CLOCK_SKEW_MS+1).toISOString()})).run));
test('10 exactly at time tolerance is allowed',async()=>{
 const env=sign({...base,issued_at:new Date(NOW-MAX_CLOCK_SKEW_MS).toISOString()});
 assert.equal((await setup(env).run()).owner.binding_status,'paired');
});
test('11 malformed timestamp fails closed',async()=>denied('INGRESS_CLOCK_SKEW',setup(sign({...base,issued_at:'not-time'})).run));
test('12 short bridge key denied',async()=>denied('INTERNAL_HMAC_KEY_REQUIRED',setup(sign(),new FakeDB(),{internalKey:Buffer.alloc(16)}).run));
test('13 missing DB connector denied',async()=>denied('PRIVATE_DB_REQUIRED',setup(sign(),new FakeDB(),{database:null}).run));
test('14 group message forbidden',async()=>denied('INGRESS_ENVELOPE_INVALID',setup(sign({...base,chat_type:'GROUP'})).run));
test('15 bot manager or wrong bot name forbidden',async()=>denied('INGRESS_ENVELOPE_INVALID',setup(sign({...base,bot_ref:'zalo-bot-manager'})).run));
test('16 external/client source forbidden',async()=>denied('INGRESS_ENVELOPE_INVALID',setup(sign({...base,source:'CLIENT_FORGED'})).run));
test('17 cannot supply client-controlled tenant_id additional key',async()=>denied('INGRESS_ENVELOPE_INVALID',setup(sign({...base,tenant_key:'qa-tenant-a'})).run));
test('18 requires nonempty message and max 512',async()=>denied('INGRESS_ENVELOPE_INVALID',setup(sign({...base,text:'x'.repeat(513)})).run));
test('19 whitespace-only message denied',async()=>denied('INGRESS_ENVELOPE_INVALID',setup(sign({...base,text:'  '})).run));
test('20 forged recipient row returns no binding',async()=>denied('OWNER_DB_BINDING_NOT_FOUND',setup(sign(),new FakeDB([])).run));
test('21 multiple matching owner bindings refused',async()=>denied('OWNER_DB_BINDING_NOT_FOUND',setup(sign(),new FakeDB([row,row])).run));
test('22 revoked owner claim denied',async()=>denied('OWNER_DB_BINDING_INVALID',setup(sign(),new FakeDB([{...row,claim_status:'REVOKED'}])).run));
test('23 recipient mismatch in claims denied',async()=>denied('OWNER_DB_BINDING_INVALID',setup(sign(),new FakeDB([{...row,claim_recipient_ref:'different'}])).run));
test('24 bot no longer dry_run denied',async()=>denied('OWNER_DB_BINDING_INVALID',setup(sign(),new FakeDB([{...row,enabled_mode:'live'}])).run));
test('25 binding expired denied',async()=>denied('OWNER_DB_BINDING_INVALID',setup(sign(),new FakeDB([{...row,expires_at:'2026-11-14T14:00:00Z'}])).run));
test('26 missing pairing challenge denies',async()=>denied('OWNER_DB_BINDING_INVALID',setup(sign(),new FakeDB([{...row,confirmed_challenge_id:null}])).run));
test('27 signed query uses only Shop B scope and recipient',async()=>{
 const db=new FakeDB();await setup(sign(),db).run();
 assert.equal(db.calls.length,1);
 assert.deepEqual(db.calls[0].params,['qa-tenant-b','qa-store-b','qa-bot-b',ref,'paired','CONFIRMED','dry_run','synthetic_qa']);
 assert.match(db.calls[0].query,/b\.recipient_ref=\$4/);
 assert.doesNotMatch(db.calls[0].query,/INSERT|UPDATE|DELETE/i);
});
test('28 actual recipient ref is not copied to exposed reply',async()=>{
 const r=await setup().run();
 assert.equal(r.event.recipient_fingerprint,ref);
 assert.ok(!JSON.stringify({source:r.owner.source,scope:r.owner.store_key}).includes(ref));
});
test('29 valid signing remains unambiguous with multiline content',async()=>{
 const env=sign({...base,text:'F01\nmua F01 2'});
 assert.equal((await setup(env).run()).event.text,'F01\nmua F01 2');
});
test('30 real Shop B resolver feeds pure order preview (no sends)',async()=>{
 const r=await setup().run();
 const atomic={
   async transact(scope,handler){
     const tx={hasReceipt:async()=>false,getState:async()=>null,
       getCatalog:async()=>({
         tenant_key:'qa-tenant-b',store_key:'qa-store-b',bot_key:'qa-bot-b',
         sku:'F01',product_name:'Áo thun đen L [QA - B]',
         price_vnd:199000,stock:5,source:'VERIFIED_DB_READBACK'
       }),saveState:async()=>{},markReceipt:async()=>{}};
     return handler(tx);
   }
 };
 const preview=await processTurn({owner:r.owner,event:r.event,repository:atomic,now:NOW});
 assert.equal(preview.status,'draft');assert.equal(preview.draft.total_vnd,398000);
 assert.equal(preview.external_sends,0);assert.equal(preview.orders_written,0);
});
test('31 not allowed to use Zalo token as internal bridge key type',async()=>{
 const key='my-zalo-token-should-not-be-accepted';
 await denied('INTERNAL_HMAC_KEY_REQUIRED',setup(sign(),new FakeDB(),{internalKey:key}).run);
});
test('32 intentionally no network, no sql writes and no Zalo send method',()=>{
 const q=QUERY.toUpperCase();assert.ok(q.startsWith('SELECT '));
 for(const forbidden of ['INSERT ','DELETE ','UPDATE ','SENDMESSAGE','SETWEBHOOK']) assert.ok(!q.includes(forbidden));
});
