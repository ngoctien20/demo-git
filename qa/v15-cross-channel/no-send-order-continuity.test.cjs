'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generateKeyPairSync,sign,createHash}=require('node:crypto');
const {attestSyntheticRequest,SOURCES}=require('../v15-hosted-readiness/trusted-ingress-gate.cjs');
const {createNoSendCommerceLab}=require('./no-send-order-continuity.cjs');
const sha=s=>createHash('sha256').update(s).digest('hex');
const now=Date.UTC(2026,10,16,3,0,0);
const channelSigner=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const memberSigner=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const roots={channelPublicKey:channelSigner.publicKey.export({type:'spki',format:'pem'}),
  membershipPublicKey:memberSigner.publicKey.export({type:'spki',format:'pem'})};
const scopes={A:{tenant:'tenant_demo_001',store:'store_A_001'},
  B:{tenant:'tenant_demo_001',store:'store_B_002'},
  C:{tenant:'tenant_demo_002',store:'store_C_003'}};
let sequence=0;
const nonces=new Set();
function signed(issuer,claims,key){
 const payload=JSON.stringify({issuer,audience:'TIEN404_V15_03H_NO_SEND_PRIVATE_QA',
   issued_ms:now-1000,expires_ms:now+100000,claims});
 return {payload,signature:sign('sha256',Buffer.from(payload),
  {key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
}
async function context({shop='A',channel='MESSENGER',subject='customer_A',event,nonce}={}){
 const f=scopes[shop]; if(!f)throw Error('BAD_FIXTURE');
 const idx=++sequence;
 const common={tenant_digest:sha(f.tenant),store_digest:sha(f.store),subject_digest:sha(subject),
  conversation_digest:sha('conversation_'+subject),event_digest:sha(event||'event_'+idx),
  challenge_nonce:sha(nonce||'nonce_'+idx),channel};
 const trust={...roots,mode:'SYNTHETIC_QA_ONLY',
  verifyPinnedFixtureBinding:async p=>p.tenantDigest===sha(f.tenant)&&p.storeDigest===sha(f.store)&&
    p.channel===channel&&p.subjectDigest===sha(subject),
  consumeNonceOnce:async ({nonce:n})=>{if(nonces.has(n))return false;nonces.add(n);return true;}};
 const v=await attestSyntheticRequest({
   channelProof:signed(SOURCES.channel,{...common,provider_mode:'V148_HMAC_SIGNED_FIXTURE_ONLY',
    provider_signature_real:false},channelSigner),
   membershipProof:signed(SOURCES.membership,{...common,registry_mode:'V147_STATIC_STAGING_FIXTURE',
    authenticated_owner_real:false,actor_role:'customer'},memberSigner),
   text:'Tin nhắn QA không gửi'
 },trust,now);
 assert.equal(v.status,'SYNTHETIC_SIGNED_QA_ONLY',JSON.stringify(v));
 return v;
}
let clock=now;
const byStore={
 [sha(scopes.A.store)]:{sku:'A001',price_vnd:159000,stock:10},
 [sha(scopes.B.store)]:{sku:'A001',price_vnd:199000,stock:3},
 [sha(scopes.C.store)]:{sku:'A001',price_vnd:109000,stock:30}
};
const catalog={source:'V15_PRIVATE_SYNTHETIC_CATALOG',getForPinnedStore:async ({tenant_digest,store_digest,sku})=>{
 const store=Object.values(scopes).find(s=>sha(s.store)===store_digest && sha(s.tenant)===tenant_digest);
 const product=byStore[store_digest];if(!store||!product||product.sku!==sku)return null;
 return {source:'V15_PINNED_SYNTHETIC_STORE_CATALOG',tenant_digest,store_digest,...product};
}};
const newLab=()=>createNoSendCommerceLab({now:()=>clock,sourceCatalog:catalog});
const buy=(context,quantity=2,total=318000)=>({context,
 request:{confirmed:true,sku:'A001',quantity,expected_total_vnd:total}});
async function orderAndLink(){
 const lab=newLab(),mess=await context({shop:'A',channel:'MESSENGER',subject:'mess_001'});
 const z=await context({shop:'A',channel:'ZALO_BOT',subject:'zalo_001'});
 const made=await lab.createConfirmedQaOrder(buy(mess));
 const ch=lab.beginCustomerLink({sourceContext:mess,consent:true});
 const linked=lab.completeCustomerLink({targetContext:z,challenge_id:ch.challenge_id,
   one_time_qa_code:ch.one_time_qa_code,consent:true});
 assert.equal(made.status,'QA_PERSISTED_IN_MEMORY_NOT_HOSTED');
 assert.equal(linked.status,'QA_LINKED_SYNTHETIC_CONSENT_ONLY');
 return {lab,mess,z,made,ch};
}
test('no-send Messenger QA confirmation persists once in process memory, not hosted',async()=>{
 const ctx=await context();const lab=newLab();const res=await lab.createConfirmedQaOrder(buy(ctx));
 assert.equal(res.status,'QA_PERSISTED_IN_MEMORY_NOT_HOSTED');assert.equal(res.total_vnd,318000);
 assert.equal(res.hosted_order_writes,0);assert.equal(res.provider_sends,0);
 assert.equal(lab.inspectForQa().orders_in_memory,1);
});
test('cross-channel Zalo cannot read solely with guessed order code',async()=>{
 const lab=newLab(),m=await context({channel:'MESSENGER',subject:'mess'}),
 z=await context({channel:'ZALO_BOT',subject:'zalo'});
 const o=await lab.createConfirmedQaOrder(buy(m));
 const denial=lab.lookupQaOrder({context:z,order_code:o.order_code});
 assert.equal(denial.status,'NOT_FOUND_OR_NOT_AUTHORIZED');
 assert.equal(JSON.stringify(denial).includes('159000'),false);
});
test('Messenger -> linked Zalo reads same exact synthetic order after consent',async()=>{
 const {lab,mess,z,made}=await orderAndLink();
 const fromMess=lab.lookupQaOrder({context:mess,order_code:made.order_code});
 const fromZalo=lab.lookupQaOrder({context:z,order_code:made.order_code});
 assert.equal(fromMess.status,'QA_ORDER_READ_IN_MEMORY_NOT_HOSTED');
 assert.equal(fromZalo.status,fromMess.status);
 for(const field of ['order_code','sku','quantity','total_vnd','order_status','version'])
   assert.equal(fromMess[field],fromZalo[field],field);
 assert.equal(fromZalo.personal_details_included,false);
});
test('same tenant Shop B cannot access Shop A order even with known code',async()=>{
 const {lab,made}=await orderAndLink();
 const b=await context({shop:'B',channel:'ZALO_BOT',subject:'zalo_001'});
 assert.equal(lab.lookupQaOrder({context:b,order_code:made.order_code}).status,'NOT_FOUND_OR_NOT_AUTHORIZED');
});
test('Shop C cross-tenant also receives indistinguishable not-found',async()=>{
 const {lab,made}=await orderAndLink(),c=await context({shop:'C',channel:'ZALO_BOT',subject:'zalo_001'});
 assert.equal(lab.lookupQaOrder({context:c,order_code:made.order_code}).status,'NOT_FOUND_OR_NOT_AUTHORIZED');
});
test('same customer name but different provider subject is NOT linked',async()=>{
 const {lab,made}=await orderAndLink();
 const stranger=await context({shop:'A',channel:'ZALO_BOT',subject:'same_display_name_unlinked'});
 assert.equal(lab.lookupQaOrder({context:stranger,order_code:made.order_code}).status,'NOT_FOUND_OR_NOT_AUTHORIZED');
});
test('consent is mandatory at both source and destination',async()=>{
 const lab=newLab(),m=await context(),z=await context({channel:'ZALO_BOT'});
 assert.equal(lab.beginCustomerLink({sourceContext:m,consent:false}).status,'BLOCKED');
 const ch=lab.beginCustomerLink({sourceContext:m,consent:true});
 assert.equal(lab.completeCustomerLink({targetContext:z,challenge_id:ch.challenge_id,
  one_time_qa_code:ch.one_time_qa_code,consent:false}).status,'BLOCKED');
});
test('link challenge is one-time and cannot be redeemed by a second Zalo account',async()=>{
 const {lab,z,ch}=await orderAndLink();
 assert.equal(lab.completeCustomerLink({targetContext:z,challenge_id:ch.challenge_id,
  one_time_qa_code:ch.one_time_qa_code,consent:true}).status,'BLOCKED');
});
test('expired challenge rejected',async()=>{
 const lab=newLab(),m=await context(),z=await context({channel:'ZALO_OA'});
 const ch=lab.beginCustomerLink({sourceContext:m,consent:true});
 clock=now+60001;
 assert.equal(lab.completeCustomerLink({targetContext:z,challenge_id:ch.challenge_id,
  one_time_qa_code:ch.one_time_qa_code,consent:true}).status,'BLOCKED');
 clock=now;
});
test('cross-store challenge cannot link accounts',async()=>{
 const lab=newLab(),m=await context({shop:'A'}),z=await context({shop:'B',channel:'ZALO_BOT'});
 const ch=lab.beginCustomerLink({sourceContext:m,consent:true});
 const res=lab.completeCustomerLink({targetContext:z,challenge_id:ch.challenge_id,
  one_time_qa_code:ch.one_time_qa_code,consent:true});
 assert.equal(res.status,'BLOCKED');
});
test('wrong code is rejected without a link after three attempts',async()=>{
 const lab=newLab(),m=await context(),z=await context({channel:'ZALO_BOT'});
 const ch=lab.beginCustomerLink({sourceContext:m,consent:true});
 for(let i=0;i<3;i++)assert.equal(lab.completeCustomerLink({targetContext:z,challenge_id:ch.challenge_id,
  one_time_qa_code:'wrong',consent:true}).status,'BLOCKED');
 assert.equal(lab.completeCustomerLink({targetContext:z,challenge_id:ch.challenge_id,
  one_time_qa_code:ch.one_time_qa_code,consent:true}).status,'BLOCKED');
});
test('identity revocation instantly invalidates QA linked channel order read',async()=>{
 const {lab,z,made}=await orderAndLink();
 assert.equal(lab.revokeCustomerLink({targetContext:z}).status,'QA_LINK_REVOKED');
 assert.equal(lab.lookupQaOrder({context:z,order_code:made.order_code}).status,'NOT_FOUND_OR_NOT_AUTHORIZED');
});
test('replayed signed event resolves same QA order; no duplicate rows',async()=>{
 const lab=newLab();const m1=await context({event:'same_event',nonce:'nonce_a'});
 const m2=await context({event:'same_event',nonce:'nonce_b'});
 const a=await lab.createConfirmedQaOrder(buy(m1)),b=await lab.createConfirmedQaOrder(buy(m2));
 assert.equal(a.order_code,b.order_code);assert.equal(b.replay,true);
 assert.equal(lab.inspectForQa().orders_in_memory,1);
});
test('same replay ID with changed quantity is blocked rather than duplicated',async()=>{
 const lab=newLab(),m1=await context({event:'fixed_event',nonce:'nonce_c'}),
 m2=await context({event:'fixed_event',nonce:'nonce_d'});
 assert.equal((await lab.createConfirmedQaOrder(buy(m1))).status,'QA_PERSISTED_IN_MEMORY_NOT_HOSTED');
 assert.equal((await lab.createConfirmedQaOrder(buy(m2,1,159000))).reason,'DUPLICATE_EVENT_PAYLOAD_CONFLICT');
});
test('source catalog exact-price and quantity guard rejects tampered total',async()=>{
 const lab=newLab(),m=await context();
 assert.equal((await lab.createConfirmedQaOrder(buy(m,2,1))).reason,'PRICE_CHANGED_REQUOTE_REQUIRED');
});
test('Shop B same SKU uses Shop B price, not Shop A price',async()=>{
 const lab=newLab(),m=await context({shop:'B'});
 assert.equal((await lab.createConfirmedQaOrder(buy(m,2,318000))).reason,'PRICE_CHANGED_REQUOTE_REQUIRED');
 assert.equal((await lab.createConfirmedQaOrder(buy(m,2,398000))).total_vnd,398000);
});
test('insufficient stock blocks without order creation',async()=>{
 const lab=newLab(),m=await context({shop:'B'});
 assert.equal((await lab.createConfirmedQaOrder(buy(m,4,796000))).reason,'INSUFFICIENT_STOCK');
 assert.equal(lab.inspectForQa().orders_in_memory,0);
});
test('forged context and owner role claim never authorize access',async()=>{
 const {lab,mess,made}=await orderAndLink();
 const forged={...mess,actor_role:'owner',store_digest:sha(scopes.B.store)};
 assert.equal(lab.lookupQaOrder({context:forged,order_code:made.order_code}).status,'BLOCKED');
 assert.equal(lab.lookupAsOwner({context:mess,order_code:made.order_code}).status,'BLOCKED');
});
test('unknown code and malformed inputs have same private safe response',async()=>{
 const {lab,z}=await orderAndLink();
 for(const order_code of ['QA-XXXXXXXX','MALFORMED',null,'QA-00!!00!!']){
   assert.equal(lab.lookupQaOrder({context:z,order_code}).status,'NOT_FOUND_OR_NOT_AUTHORIZED');
 }
});
test('Zalo cannot create Order even after linked consent',async()=>{
 const {lab,z}=await orderAndLink();
 assert.equal((await lab.createConfirmedQaOrder(buy(z))).status,'BLOCKED');
});
test('no host send or real write surfaces on all paths',async()=>{
 const {lab,z,made}=await orderAndLink();
 for(const result of [lab.lookupQaOrder({context:z,order_code:made.order_code}),
    lab.lookupQaOrder({context:z,order_code:'QA-99999999'}),lab.lookupAsOwner()]){
   assert.equal(result.provider_sends,0);assert.equal(result.hosted_order_writes,0);
   assert.equal(result.hosted_jwt_verified,false);
 }
});