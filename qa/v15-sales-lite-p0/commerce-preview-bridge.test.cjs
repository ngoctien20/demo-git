'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {generateKeyPairSync,sign,createHash}=require('node:crypto');
const {attestSyntheticRequest,SOURCES}=require('../v15-hosted-readiness/trusted-ingress-gate.cjs');
const {previewCommerceRequest}=require('./commerce-preview-bridge.cjs');
const {FIXTURES}=require('../v147-custom-studio/studio-core.js');
const now=Date.UTC(2026,10,16,1,24,0);
const sha=s=>createHash('sha256').update(s).digest('hex');
const ch=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),member=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const roots={
 channelPublicKey:ch.publicKey.export({format:'pem',type:'spki'}),
 membershipPublicKey:member.publicKey.export({format:'pem',type:'spki'})
};
const common={
 tenant_digest:sha(FIXTURES.A.tenantId),store_digest:sha(FIXTURES.A.storeId),
 subject_digest:sha('test_person_only'),conversation_digest:sha('test_conversation_only'),
 event_digest:sha('test_event_unique'),challenge_nonce:sha('test_nonce_unique'),channel:'MESSENGER'
};
function signed(issuer,claims,key){
 const payload=JSON.stringify({issuer,audience:'TIEN404_V15_03H_NO_SEND_PRIVATE_QA',
   issued_ms:now-1000,expires_ms:now+100000,claims});
 return {payload,signature:sign('sha256',Buffer.from(payload),
   {key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
}
async function context(){
 const used=new Set();
 const trust={
   ...roots,mode:'SYNTHETIC_QA_ONLY',
   verifyPinnedFixtureBinding:async p=>p.tenantDigest===sha(FIXTURES.A.tenantId)
     &&p.storeDigest===sha(FIXTURES.A.storeId)&&p.channel==='MESSENGER',
   consumeNonceOnce:async ({nonce})=>{if(used.has(nonce))return false;used.add(nonce);return true;}
 };
 const signedBundle={
   channelProof:signed(SOURCES.channel,{...common,provider_mode:'V148_HMAC_SIGNED_FIXTURE_ONLY',
     provider_signature_real:false},ch),
   membershipProof:signed(SOURCES.membership,{...common,registry_mode:'V147_STATIC_STAGING_FIXTURE',
     authenticated_owner_real:false,actor_role:'customer'},member),
   text:'Mua 2 áo A001'
 };
 const result=await attestSyntheticRequest(signedBundle,trust,now);
 assert.equal(result.status,'SYNTHETIC_SIGNED_QA_ONLY',JSON.stringify(result));
 return result;
}
const backend=(product=FIXTURES.A.product,store=FIXTURES.A.storeId)=>({
 source:'PRIVATE_QA_READONLY_FIXTURE_ADAPTER',
 readPinnedFixture:async()=>({
   source:'V14_7_SYNTHETIC_FIXTURE',tenantId:FIXTURES.A.tenantId,
   storeId:store,product
 })
});
async function go(intent,qaBackend=backend()){return previewCommerceRequest({
 context:await context(),intent,qaBackend
})}
test('synthetic quote returns exact pinned QA price, never provider send',async()=>{
 const v=await go({kind:'quote',sku:'A001'});
 assert.equal(v.status,'QA_QUOTE_ONLY');
 assert.equal(v.price_vnd,159000);assert.equal(v.can_send,false);
 assert.equal(v.orders_written,0);assert.equal(v.owner_notifications_sent,0);
});
test('order request is confirmation proposal and no writer is reachable',async()=>{
 const v=await go({kind:'order_request',sku:'A001',quantity:2});
 assert.equal(v.status,'QA_ORDER_CONFIRMATION_PROPOSAL_ONLY');
 assert.equal(v.expected_total_vnd,318000);
 assert.equal(v.customer_confirmation_required,true);
 assert.equal(v.can_write_orders,false);assert.equal(v.stock_deducted,false);
 assert.equal(v.owner_notifications_sent,0);
});
test('matching expected_total cannot promote to an authorized write',async()=>{
 const v=await go({kind:'order_request',sku:'A001',quantity:2,expected_total_vnd:318000});
 assert.equal(v.status,'QA_ORDER_CONFIRMATION_PROPOSAL_ONLY');
 assert.equal(v.orders_written,0);assert.equal(v.atomic_order_outbox_certified,false);
});
test('incorrect expected_total blocked (price changed / tampered)',async()=>{
 const v=await go({kind:'order_request',sku:'A001',quantity:2,expected_total_vnd:1});
 assert.equal(v.reason,'EXPECTED_TOTAL_MISMATCH_REQUOTE_REQUIRED');
});
test('unknown SKU never returns a Shop A price',async()=>{
 const v=await go({kind:'quote',sku:'A002'});
 assert.equal(v.reason,'SKU_NOT_IN_TRUSTED_QA_STORE');
});
test('stock insufficient always blocks draft',async()=>{
 const v=await go({kind:'order_request',sku:'A001',quantity:4});
 assert.equal(v.reason,'INSUFFICIENT_QA_STOCK');
});
test('wrong Store signed fixture binding fails',async()=>{
 const v=await go({kind:'quote',sku:'A001'},backend(FIXTURES.A.product,FIXTURES.B.storeId));
 assert.equal(v.reason,'PINNED_STORE_FIXTURE_CANNOT_BE_VERIFIED');
});
test('forged context never authorized',async()=>{
 const original=await context();
 const v=await previewCommerceRequest({context:{...original},intent:{kind:'quote',sku:'A001'},qaBackend:backend()});
 assert.equal(v.reason,'SIGNED_SYNTHETIC_CONTEXT_REQUIRED');
});
test('client-supplied tenant, store, recipient or confirmed flag denied',async()=>{
 for(const field of ['tenant_id','store_id','owner_id','recipient','confirmed','can_send']){
   const v=await go({kind:'order_request',sku:'A001',quantity:1,[field]:true});
   assert.equal(v.reason,'STRICT_INTENT_CONTRACT',field);
 }
});
test('invalid quantities, floats, and invalid expected totals denied',async()=>{
 for(const quantity of [0,-1,1.5,'2',100]){
   const v=await go({kind:'order_request',sku:'A001',quantity});
   assert.equal(v.reason,'ORDER_REQUEST_QUANTITY_INVALID');
 }
 for(const total of [0,-1,1.5,'318000',Number.MAX_SAFE_INTEGER+1]){
   const v=await go({kind:'order_request',sku:'A001',quantity:1,expected_total_vnd:total});
   assert.equal(v.reason,'INVALID_EXPECTED_TOTAL');
 }
});
test('quote cannot carry quantity or expected total',async()=>{
 const v=await go({kind:'quote',sku:'A001',quantity:2});
 assert.equal(v.reason,'QUOTE_MUST_BE_READ_ONLY');
});
test('even a failing backend never sends, charges or writes',async()=>{
 const v=await go({kind:'quote',sku:'A001'},{
  source:'PRIVATE_QA_READONLY_FIXTURE_ADAPTER',
  readPinnedFixture:async()=>{throw Error('TEST_BACKEND_UNAVAILABLE')}
 });
 assert.equal(v.status,'BLOCKED');
 assert.equal(v.can_send,false);assert.equal(v.orders_written,0);
 assert.equal(v.paid_model_calls,0);
});
