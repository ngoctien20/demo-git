'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash,generateKeyPairSync,sign}=require('node:crypto');
const {attestSyntheticRequest,SOURCES}=require('../v15-hosted-readiness/trusted-ingress-gate.cjs');
const {FIXTURES}=require('../v147-custom-studio/studio-core.js');
const {createSyntheticStoreRegistry,previewChannelStoreCommerce,ALLOWED_KINDS}=
  require('./channel-store-readonly-contract.cjs');
const now=Date.UTC(2026,10,16,5,34,0);
const sha=x=>createHash('sha256').update(x).digest('hex');
let seq=0;
async function signedContext(store='A',channel='MESSENGER',opts={}){
 const f=FIXTURES[store];
 const c=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const m=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const nonce='p0g-nonce-'+(++seq);
 const common={tenant_digest:sha(f.tenantId),
  store_digest:sha(f.storeId),subject_digest:sha('qa-subject-'+nonce),
  conversation_digest:sha('qa-conversation-'+nonce),
  event_digest:sha('qa-event-'+nonce),challenge_nonce:sha(nonce),
  channel};
 const make=(issuer,claims,key)=>{const payload=JSON.stringify({
  issuer,audience:'TIEN404_V15_03H_NO_SEND_PRIVATE_QA',
  issued_ms:now-1000,expires_ms:now+60000,claims});
  return{payload,signature:sign('sha256',Buffer.from(payload),
    {key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
 };
 const bundle={
  channelProof:make(SOURCES.channel,{...common,
    provider_mode:'V148_HMAC_SIGNED_FIXTURE_ONLY',provider_signature_real:false},c),
  membershipProof:make(SOURCES.membership,{...common,
    registry_mode:'V147_STATIC_STAGING_FIXTURE',
    authenticated_owner_real:false,actor_role:'customer'},m),
  text:'QA synthetic buyer message'
 };
 const used=new Set();
 const trusted={
  mode:'SYNTHETIC_QA_ONLY',
  channelPublicKey:c.publicKey.export({format:'pem',type:'spki'}),
  membershipPublicKey:m.publicKey.export({format:'pem',type:'spki'}),
  verifyPinnedFixtureBinding:async x=>
    x.tenantDigest===sha((opts.attestStore?FIXTURES[opts.attestStore]:f).tenantId)&&
    x.storeDigest===sha((opts.attestStore?FIXTURES[opts.attestStore]:f).storeId)&&
    x.channel===(opts.attestChannel||channel)&&x.providerIsSynthetic===true,
  consumeNonceOnce:async x=>{
   if(used.has(x.nonce))return false;used.add(x.nonce);return true;
  }
 };
 const context=await attestSyntheticRequest(bundle,trusted,now);
 return{context,bundle,trusted};
}
const registry=()=>createSyntheticStoreRegistry();
const run=async (store,channel,intent,reg=registry())=>{
 const {context}=await signedContext(store,channel);
 assert.equal(context.status,'SYNTHETIC_SIGNED_QA_ONLY');
 return previewChannelStoreCommerce({context,intent,registry:reg});
};
const denied=r=>{
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.can_send,false);
 assert.equal(r.can_write_orders,false);
 assert.equal(r.orders_written,0);
 assert.equal(r.owner_notifications_sent,0);
 assert.equal(r.paid_model_calls,0);
 assert.equal(r.provider_identity_real,false);
 assert.equal(r.hosted_store_authority_verified,false);
};
const noSideEffects=r=>{
 assert.equal(r.synthetic_only,true);
 assert.equal(r.can_send,false);
 assert.equal(r.can_publish,false);
 assert.equal(r.can_write_orders,false);
 assert.equal(r.orders_written,0);
 assert.equal(r.stock_deducted,false);
 assert.equal(r.owner_notifications_sent,0);
 assert.equal(r.paid_model_calls,0);
 assert.equal(r.provider_identity_real,false);
 assert.equal(r.hosted_store_authority_verified,false);
 assert.equal(r.real_price_verified,false);
};
test('3 shops x 4 channels are pinned synthetic only, zero hosted bindings',()=>{
 const s=registry().summary();
 assert.equal(s.storeCount,3);assert.equal(s.channelCount,4);
 assert.equal(s.providerBindings,12);assert.equal(s.real_hosted_bindings,0);
 assert.equal(s.provider_sends,0);
});
test('A Messenger catalog derives price and stock from authenticated QA Store context',async()=>{
 const r=await run('A','MESSENGER',{kind:'catalog',sku:'A001'});
 assert.equal(r.status,'QA_CATALOG_READ_ONLY');
 assert.equal(r.price_vnd,159000);assert.equal(r.stock,3);
 assert.equal(r.qa_store_key,'A');noSideEffects(r);
});
test('A and B share Tenant but same SKU resolves distinct products/prices',async()=>{
 const [a,b]=await Promise.all([
  run('A','MESSENGER',{kind:'quote',sku:'A001'}),
  run('B','MESSENGER',{kind:'quote',sku:'A001'})]);
 assert.equal(FIXTURES.A.tenantId,FIXTURES.B.tenantId);
 assert.equal(a.price_vnd,159000);assert.equal(b.price_vnd,209000);
 assert.notEqual(a.name,b.name);
 noSideEffects(a);noSideEffects(b);
});
test('Shop C on different Tenant gets its own C price',async()=>{
 const c=await run('C','MESSENGER',{kind:'quote',sku:'A001'});
 assert.notEqual(FIXTURES.C.tenantId,FIXTURES.A.tenantId);
 assert.equal(c.price_vnd,259000);assert.equal(c.qa_store_key,'C');
 noSideEffects(c);
});
test('all four channel modes work ONLY with synthetic signed Store binding',async()=>{
 for(const channel of ['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']){
  const q=await run('B',channel,{kind:'quote',sku:'A001'});
  assert.equal(q.status,'QA_QUOTE_READ_ONLY',channel);
  assert.equal(q.channel,channel);assert.equal(q.price_vnd,209000);
  noSideEffects(q);
 }
});
test('B Zalo quote is not a genuine Zalo provider signature or real price',async()=>{
 const b=await run('B','ZALO_BOT',{kind:'quote',sku:'A001'});
 assert.equal(b.status,'QA_QUOTE_READ_ONLY');
 assert.equal(b.provider_identity_real,false);
 assert.equal(b.real_price_verified,false);
});
test('order request is a confirmation proposal, never a real order',async()=>{
 const r=await run('A','MESSENGER',
  {kind:'order_request',sku:'A001',quantity:2,expected_total_vnd:318000});
 assert.equal(r.status,'QA_ORDER_REQUEST_REQUIRES_CONFIRMATION');
 assert.equal(r.expected_total_vnd,318000);
 assert.equal(r.customer_confirmation_required,true);
 assert.equal(r.atomic_order_outbox_certified,false);
 assert.equal(r.backend_write_approved,false);
 noSideEffects(r);
});
test('wrong expected total triggers re-quote, not stale price or write',async()=>{
 const r=await run('A','MESSENGER',
  {kind:'order_request',sku:'A001',quantity:2,expected_total_vnd:1});
 assert.equal(r.reason,'EXPECTED_TOTAL_MISMATCH_REQUOTE_REQUIRED');denied(r);
});
test('insufficient stock denies order request without reservation',async()=>{
 const r=await run('A','MESSENGER',
  {kind:'order_request',sku:'A001',quantity:4});
 assert.equal(r.reason,'INSUFFICIENT_QA_STOCK');denied(r);
});
test('unlisted SKU never returns another Store price',async()=>{
 const r=await run('A','ZALO_OA',{kind:'quote',sku:'A002'});
 assert.equal(r.reason,'SKU_NOT_IN_PINNED_QA_STORE');denied(r);
});
test('invalid SKU / lowercase / whitespace never invokes Store lookup',async()=>{
 for(const sku of ['A002 ','a001','','B-001',null,100]){
  const r=await run('A','MESSENGER',{kind:'quote',sku});
  assert.equal(r.reason,'SKU_REQUIRED_OR_INVALID');denied(r);
 }
});
test('untrusted input store_id, tenant_id, recipient, confirmed flags blocked',async()=>{
 for(const field of ['store_id','tenant_id','recipient','owner_id','verified','can_send',
  'service_role','api_key','provider_signature_real']){
  const r=await run('A','MESSENGER',
   {kind:'quote',sku:'A001',[field]:'B'});
  assert.equal(r.reason,'STRICT_READONLY_INTENT_SCHEMA',field);denied(r);
 }
});
test('attempt to request direct insert/order writes/delete is blocked',async()=>{
 for(const kind of ['create_order','send_notification','update_stock','admin_sql','delete',
   'SUPPORT_TOOL','issue_refund']){
  const r=await run('A','MESSENGER',{kind,sku:'A001'});
  assert.equal(r.reason,'STRICT_READONLY_INTENT_SCHEMA',kind);
  denied(r);
 }
});
test('quote and catalog cannot carry quantity or expected totals',async()=>{
 for(const kind of ['quote','catalog']){
  for(const key of ['quantity','expected_total_vnd']){
   const r=await run('A','MESSENGER',{kind,sku:'A001',[key]:2});
   assert.equal(r.reason,'STRICT_READONLY_INTENT_SCHEMA');denied(r);
  }
 }
});
test('numeric invalid or overflow-like expected total/quantity fails closed',async()=>{
 for(const value of [0,-1,100,1.5,'2',Number.MAX_SAFE_INTEGER+1]){
  const r=await run('A','MESSENGER',
   {kind:'order_request',sku:'A001',quantity:value});
  assert.equal(r.reason,'ORDER_REQUEST_OR_EXPECTED_TOTAL_INVALID');denied(r);
 }
 for(const value of [0,-1,'318000',1.25,Number.MAX_SAFE_INTEGER+1]){
  const r=await run('A','MESSENGER',
   {kind:'order_request',sku:'A001',quantity:2,expected_total_vnd:value});
  assert.equal(r.reason,'ORDER_REQUEST_OR_EXPECTED_TOTAL_INVALID');denied(r);
 }
});
test('paused Store cannot return catalog, quote or proposal',async()=>{
 const reg=createSyntheticStoreRegistry({pausedStores:['A']});
 for(const kind of ['catalog','quote','order_request']){
  const r=await run('A','MESSENGER',
   kind==='order_request'?{kind,sku:'A001',quantity:1}:{kind,sku:'A001'},reg);
  assert.equal(r.reason,'STORE_PAUSED');denied(r);
 }
});
test('disabled one channel does not disable independent other channel in same Shop',async()=>{
 const reg=createSyntheticStoreRegistry({disabledChannels:['B|ZALO_OA']});
 const b=await run('B','ZALO_OA',{kind:'quote',sku:'A001'},reg);
 assert.equal(b.reason,'CHANNEL_DISABLED');denied(b);
 const other=await run('B','MESSENGER',{kind:'quote',sku:'A001'},reg);
 assert.equal(other.status,'QA_QUOTE_READ_ONLY');noSideEffects(other);
});
test('client cannot forge or clone a signed QA context',async()=>{
 const {context}=await signedContext('A');
 const clone={...context};clone.store_digest=sha(FIXTURES.B.storeId);
 const result=await previewChannelStoreCommerce({
  context:clone,intent:{kind:'quote',sku:'A001'},registry:registry()});
 assert.equal(result.reason,'TWO_SIGNED_QA_PROOFS_REQUIRED');denied(result);
});
test('context from unpinned signer/store mismatch cannot authorize a quote',async()=>{
 const {context}=await signedContext('A','MESSENGER',{attestStore:'B'});
 assert.equal(context.status,'BLOCKED');
 const r=await previewChannelStoreCommerce({
  context,intent:{kind:'quote',sku:'A001'},registry:registry()});
 assert.equal(r.reason,'TWO_SIGNED_QA_PROOFS_REQUIRED');denied(r);
});
test('unknown/fake registry and registry clones cannot return any quote',async()=>{
 const {context}=await signedContext('A');
 for(const reg of [null,{},Object.create(null),{...registry()}]){
  const r=await previewChannelStoreCommerce({
   context,intent:{kind:'quote',sku:'A001'},registry:reg});
  assert.equal(r.reason,'PRIVATE_PINNED_QA_REGISTRY_REQUIRED');denied(r);
 }
});
test('registry config cannot be silently overridden with unknown Store or channel',()=>{
 for(const opt of [
  {pausedStores:['D']},{disabledChannels:['A|UNKNOWN']},
  {disabledChannels:['B|MESSENGER|BAD']},{disabledChannels:[42]},
  {pausedStores:'A'},{disabledChannels:'A|MESSENGER'}]){
  assert.throws(()=>createSyntheticStoreRegistry(opt),/INVALID_SYNTHETIC_REGISTRY_SETTINGS/);
 }
});
test('replayed signed nonce cannot be reused to produce another trusted context',async()=>{
 const {bundle,trusted,context}=await signedContext('B');
 assert.equal(context.status,'SYNTHETIC_SIGNED_QA_ONLY');
 const second=await attestSyntheticRequest(bundle,trusted,now);
 assert.equal(second.status,'BLOCKED');
 assert.equal(second.reason,'NONCE_REPLAY_OR_ATOMIC_STORE_UNAVAILABLE');
 const r=await previewChannelStoreCommerce({
  context:second,intent:{kind:'quote',sku:'A001'},registry:registry()});
 denied(r);
});
test('forged authenticated-owner and provider-real flags cannot be accepted',async()=>{
 const {context}=await signedContext('C','ZALO_BOT');
 const forged={...context,provider_identity_real:true,owner_certified:true};
 const r=await previewChannelStoreCommerce({
  context:forged,intent:{kind:'quote',sku:'A001'},registry:registry()});
 assert.equal(r.reason,'TWO_SIGNED_QA_PROOFS_REQUIRED');denied(r);
});
test('strict intent rejects inherited class instance, null, array, unknown field',async()=>{
 const {context}=await signedContext('A');
 for(const intent of [null,[],new Date(),{kind:'quote',sku:'A001',extra:true}]){
  const r=await previewChannelStoreCommerce({context,intent,registry:registry()});
  assert.equal(r.reason,'STRICT_READONLY_INTENT_SCHEMA');denied(r);
 }
});
test('all successful preview surfaces are NO-SEND, zero paid models, no hosted reads',async()=>{
 const reg=registry();
 const {context}=await signedContext('C','WEB_WIDGET');
 for(const intent of [{kind:'catalog',sku:'A001'},
  {kind:'quote',sku:'A001'},{kind:'order_request',sku:'A001',quantity:1}]){
  const r=await previewChannelStoreCommerce({context,intent,registry:reg});
  noSideEffects(r);
 }
 assert.deepEqual(ALLOWED_KINDS,['catalog','quote','order_request']);
});
