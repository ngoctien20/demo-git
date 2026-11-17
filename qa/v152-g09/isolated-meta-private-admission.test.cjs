'use strict';
const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createCandidate,CONTRACT,REFERENCE,FIELD_KEYS}=require('./isolated-meta-private-admission.cjs');
const REF_FILE=path.resolve(__dirname,'../../.g09_v171/qa/v171e-meta-real-event/isolated-meta-no-send.mjs');
const NOW=Date.parse('2026-11-17T04:45:00Z');
const SECRET='QA_ONLY_PRIVATE_G09_META_SECRET_DO_NOT_USE_REAL';
const PAGE='9900000001',TESTER='9900000011',QA_APP='8800000002',PROD_APP='8800000001',PROD_PAGE='9900000009';
const hash=txt=>crypto.createHash('sha256').update('G09QA|'+txt).digest('hex');
let handle;
before(async()=>{
 const module=await import(pathToFileURL(REF_FILE).href);
 assert.equal(module.CONTRACT,REFERENCE);
 handle=module.handleIsolatedMeta;
});
const fresh=()=>{const seen=new Set();return {
  appSecret:SECRET,verifyToken:'QA_ONLY_PRIVATE_G09_VERIFY_TOKEN',
  qaPageId:PAGE,qaTesterPsid:TESTER,qaAppId:QA_APP,
  productionAppId:PROD_APP,productionPageId:PROD_PAGE,
  ownerApproval:{
   qaAppPageIsolated:true,callbackPermissionGranted:true,
   merchantPageControlVerified:true,evidenceReference:'PRIVATE_QA_G09_FIXTURE_ONLY',
   productionAppCallbackUnchanged:true
  },
  claimOnce:async receipt=>{if(seen.has(receipt))return 'duplicate';seen.add(receipt);return 'claimed'}
 }};
const authorized=()=>({
 source:'PRIVATE_OPERATOR_CONTROL_PLANE',independentReviewer:true,
 privateOwnerEvidenceHash:hash('owner-source'),privateProviderEvidenceHash:hash('provider-source'),
 ownerAndReviewerDistinct:true,qaPageOwnerVerified:true,qaAppOwnerVerified:true,
 qaPageSubscriptionVerified:true,qaPageAppIsolated:true,testSenderApproved:true,
 callbackScopeApproved:true,productionCallbackUnchanged:true,
 originalStoreOwnerVerified:true,canonicalStoreBindingVerified:true,
 validUntilMs:NOW+300000,reviewerReceiptId:'QA_PRIVATE_REVIEWER_00001'
});
const raw=(msg='QA catalog only',changes={})=>Buffer.from(JSON.stringify({
 object:'page',entry:[{id:PAGE,messaging:[{sender:{id:TESTER},
 recipient:{id:PAGE},timestamp:NOW,message:{mid:'QA_G09_MID_00001',text:msg}}]}],
 ...changes
}),'utf8');
const req=(payload=raw(),signData=payload)=>({
 method:'POST',url:'https://qa.invalid/g09',
 headers:{'x-hub-signature-256':'sha256='+crypto.createHmac('sha256',SECRET).update(signData).digest('hex')},
 rawBody:payload
});
const clone=x=>JSON.parse(JSON.stringify(x));
function candidate({authority=authorized(),config=fresh(),privateAuthority,privateConfig,
 handler,clock=()=>NOW}={}){
 let authorityReads=0,configReads=0,handlerCalls=0;
 const engine=createCandidate({
  handler:async(...args)=>{handlerCalls++;return (handler||handle)(...args)},
  loadPrivateAuthority:async()=>{authorityReads++;return privateAuthority?privateAuthority():authority},
  loadPrivateMetaConfig:async()=>{configReads++;return privateConfig?privateConfig():config},
  clock
 });
 return {engine,stats:()=>({authorityReads,configReads,handlerCalls})};
}
const fail=async(name,change,reason)=>{
 test(name,async()=>{
  const c=candidate(change||{});
  const output=await c.engine.inspectOne({request:req()});
  assert.equal(output.status,'G09_REAL_SIGNED_NO_SEND_NOT_ADMITTED');
  assert.equal(output.reason,reason);
  for(const attr of ['canPublish','canReadCustomerOrders','canSendMessages',
   'canCreateOrders','canModifyProviderCallback','realSignedPilotCompletedHere',
   'realProviderEventIndependentlyCertifiedHere','canUseProductionCredentials'])
   assert.equal(output[attr],false,attr);
  assert.equal(output.providerSends,0);
 });
};
test('exact pinned V17.1E contract imported across branch',()=>{
 assert.equal(typeof handle,'function');
 assert.equal(CONTRACT,'T404_G09_ISOLATED_SIGNED_NOSEND_V1');
 assert.equal(REFERENCE,'T404_V171E_ISOLATED_SIGNED_NOSEND_V1');
});
test('synthetic fake signed Page event passes pinned handler but NOT actual real UAT',async()=>{
 const c=candidate();
 const out=await c.engine.inspectOne({request:req()});
 assert.equal(out.status,'G09_PINNED_META_HMAC_QA_NO_SEND_PASSED');
 assert.equal(out.metaCryptoByPinnedHandler,true);
 assert.equal(out.realSignedPilotCompletedHere,false);
 assert.equal(out.realProviderEventIndependentlyCertifiedHere,false);
 assert.equal(out.independentlyReviewedRealPageOwnershipHere,false);
 assert.equal(out.realCommerceStoreOwnershipCertifiedHere,false);
 assert.equal(out.canPublish,false);assert.equal(out.providerSends,0);
 assert.equal(out.hostedCommerceReads,0);assert.equal(out.orderWrites,0);
 assert.deepEqual(c.stats(),{authorityReads:1,configReads:1,handlerCalls:1});
});
test('one synthetic signed POST replay is deduped by pinned V17.1E claimOnce hook',async()=>{
 const c=candidate(),request=req();
 const a=await c.engine.inspectOne({request});
 const b=await c.engine.inspectOne({request});
 assert.equal(a.status,'G09_PINNED_META_HMAC_QA_NO_SEND_PASSED');
 assert.equal(b.status,'G09_DUPLICATE_NO_SEND');
 assert.equal(b.providerSends,0);
});
test('synthetic GET verify challenge cannot pass POST-only admission',async()=>{
 const c=candidate();
 const x=await c.engine.inspectOne({request:{method:'GET',url:'https://qa.invalid/',headers:{},rawBody:Buffer.from('x')}});
 assert.equal(x.reason,'POST_RAW_BYTES_ONLY_NO_CALLER_AUTHORITY');
 assert.deepEqual(c.stats(),{authorityReads:0,configReads:0,handlerCalls:0});
});
test('raw META payload mutated after signing never passes HMAC',async()=>{
 const c=candidate();const orig=raw();
 const result=await c.engine.inspectOne({request:req(raw('tampered text'),orig)});
 assert.equal(result.reason,'SIGNED_QA_EVENT_NOT_ELIGIBLE');
 assert.equal(result.providerSends,0);
});
test('signed client Store ID injection still denied by pinned actual V17 handler',async()=>{
 const c=candidate();
 const r=await c.engine.inspectOne({request:req(raw('QA catalog only',{store_id:'SHOP_B'}))});
 assert.equal(r.reason,'SIGNED_QA_EVENT_NOT_ELIGIBLE');
});
test('different QA page from private operator config cannot pass signed event',async()=>{
 const c=candidate({config:{...fresh(),qaPageId:'9900000088'}});
 const result=await c.engine.inspectOne({request:req()});
 assert.equal(result.reason,'SIGNED_QA_EVENT_NOT_ELIGIBLE');
});
test('wrong tester PSID is rejected by exact V17 source',async()=>{
 const c=candidate({config:{...fresh(),qaTesterPsid:'9900000088'}});
 const result=await c.engine.inspectOne({request:req()});
 assert.equal(result.reason,'SIGNED_QA_EVENT_NOT_ELIGIBLE');
});
test('missing HMAC is never accepted',async()=>{
 const c=candidate();
 const r=await c.engine.inspectOne({request:{...req(),headers:{}}});
 assert.equal(r.reason,'SIGNED_QA_EVENT_NOT_ELIGIBLE');
});
test('untrusted extra top-level client owner claim cannot enter boundary',async()=>{
 const c=candidate(),p={...req(),storeId:'ATTACKER_STORE'};
 const r=await c.engine.inspectOne({request:p});
 assert.equal(r.reason,'POST_RAW_BYTES_ONLY_NO_CALLER_AUTHORITY');
 assert.equal(c.stats().authorityReads,0);
});
test('private authority loader unavailable => no handler called',async()=>{
 const c=candidate({privateAuthority:()=>{throw Error('PRIVATE_INTERNAL')}});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'PRIVATE_OPERATOR_AUTHORITY_UNAVAILABLE');
 assert.deepEqual(c.stats(),{authorityReads:1,configReads:0,handlerCalls:0});
});
test('private appSecret loader unavailable => no handler called',async()=>{
 const c=candidate({privateConfig:()=>{throw Error('PRIVATE_INTERNAL')}});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'PRIVATE_META_APP_CONFIGURATION_UNAVAILABLE');
 assert.deepEqual(c.stats(),{authorityReads:1,configReads:1,handlerCalls:0});
});
test('no private replay claim => no handler call',async()=>{
 const c=candidate({config:{...fresh(),claimOnce:null}});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'PRIVATE_DURABLE_REPLAY_CLAIM_MISSING');
 assert.equal(c.stats().handlerCalls,0);
});
test('private replay backend failure => deny no-send',async()=>{
 const cfg=fresh();cfg.claimOnce=async()=>{throw Error('DB_UNAVAILABLE')};
 const c=candidate({config:cfg});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'SIGNED_QA_EVENT_NOT_ELIGIBLE');
});
test('Replay backend returns unknown => deny',async()=>{
 const cfg=fresh();cfg.claimOnce=async()=>undefined;
 const c=candidate({config:cfg});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'SIGNED_QA_EVENT_NOT_ELIGIBLE');
});
test('Pinned handler returning send=true is rejected',async()=>{
 const c=candidate({handler:async()=>({
  contract:REFERENCE,status:'SIGNED_QA_EVENT_NO_SEND',meta_outbound:1,
  model_calls:0,commerce_writes:0,http_status:200
 })});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'PINNED_META_HANDLER_CONTRACT_DRIFT');
});
test('handler failure never leaks secret details',async()=>{
 const c=candidate({handler:async()=>{throw Error('SECRET_VALUE_CANNOT_EXPOSE')}});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'PINNED_META_NO_SEND_HANDLER_FAILED');
 assert.equal(JSON.stringify(r).includes('SECRET_VALUE'),false);
});
test('QA receipt does not contain fake Page, PSID, secret or body',async()=>{
 const out=await candidate().engine.inspectOne({request:req()});
 const s=JSON.stringify(out);
 for(const text of [PAGE,TESTER,SECRET,'QA catalog only','QA_G09_MID_00001',PROD_APP,PROD_PAGE])
  assert.equal(s.includes(text),false,text);
});
test('loadPrivateAuthority cannot be replaced by caller header flags',async()=>{
 const c=candidate({authority:{...authorized(),qaPageOwnerVerified:false}});
 const p=req();p.headers['x-qa-owner-verified']='true';
 const r=await c.engine.inspectOne({request:p});
 assert.equal(r.reason,'ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
});
test('validity window maximum 30m enforced',async()=>{
 const c=candidate({authority:{...authorized(),validUntilMs:NOW+60*60*1000}});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
});
test('deliberate self-claimed all-green authority from body never sufficient',async()=>{
 const c=candidate({authority:{...authorized(),source:'CLIENT_SELF_ATTESTED'}});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
});
for(const field of [
 'independentReviewer','ownerAndReviewerDistinct','qaPageOwnerVerified',
 'qaAppOwnerVerified','qaPageSubscriptionVerified','qaPageAppIsolated',
 'testSenderApproved','callbackScopeApproved','productionCallbackUnchanged',
 'originalStoreOwnerVerified','canonicalStoreBindingVerified'
]){
 test('private original authority missing '+field+' => refuse before meta handler',async()=>{
  const a=authorized();a[field]=false;
  const c=candidate({authority:a});const r=await c.engine.inspectOne({request:req()});
  assert.equal(r.reason,'ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
  assert.equal(c.stats().configReads,0);assert.equal(c.stats().handlerCalls,0);
 });
}
test('missing private owner source digest denies',async()=>{
 const a=authorized();a.privateOwnerEvidenceHash='bad';
 const r=await candidate({authority:a}).engine.inspectOne({request:req()});
 assert.equal(r.reason,'ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
});
test('missing private provider source digest denies',async()=>{
 const a=authorized();a.privateProviderEvidenceHash='0';
 const r=await candidate({authority:a}).engine.inspectOne({request:req()});
 assert.equal(r.reason,'ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
});
test('extra private authority field cannot be accepted',async()=>{
 const a=authorized();a.clientStoreId='FAKE';
 const r=await candidate({authority:a}).engine.inspectOne({request:req()});
 assert.equal(r.reason,'ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
});
test('owner and reviewer receipt key must be private-format ID',async()=>{
 const a=authorized();a.reviewerReceiptId='x';
 const r=await candidate({authority:a}).engine.inspectOne({request:req()});
 assert.equal(r.reason,'ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
});
test('expired private authority denied',async()=>{
 const a=authorized();a.validUntilMs=NOW-1;
 const r=await candidate({authority:a}).engine.inspectOne({request:req()});
 assert.equal(r.reason,'ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
});
test('wrong production callback isolation rejected even if private flags all green',async()=>{
 const cfg=fresh();cfg.ownerApproval.productionAppCallbackUnchanged=false;
 const c=candidate({config:cfg});
 const r=await c.engine.inspectOne({request:req()});
 assert.equal(r.reason,'OPERATOR_SIGNOFF_NOT_ALIGNED_WITH_META_QA_POLICY');
 assert.equal(c.stats().handlerCalls,0);
});
test('wrong claimOwner proof in actual handler rejected',async()=>{
 const cfg=fresh();cfg.ownerApproval.evidenceReference='UNTRUSTED_PUBLIC';
 const r=await candidate({config:cfg}).engine.inspectOne({request:req()});
 assert.equal(r.reason,'SIGNED_QA_EVENT_NOT_ELIGIBLE');
});
test('no private operation may infer live Page ownership from crypto success',async()=>{
 const out=await candidate().engine.inspectOne({request:req()});
 assert.equal(out.realProviderEventIndependentlyCertifiedHere,false);
 assert.equal(out.realCommerceStoreOwnershipCertifiedHere,false);
 assert.equal(out.canModifyProviderCallback,false);
 assert.equal(out.canSendMessages,false);
 assert.equal(out.canPromoteRls,false);
});
test('only one valid DI policy constructor path',()=>{
 assert.throws(()=>createCandidate({}),/G09_PRIVATE_INJECTION_REQUIRED/);
 assert.equal(FIELD_KEYS.length,15);
});
