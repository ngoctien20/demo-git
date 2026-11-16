'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {planStoreScope,REASON}=require('./store-security-contract.cjs');
const NOW=Date.parse('2026-11-16T10:00:00+09:00');
const event={event_id:'qa_event_0001',channel:'messenger',capability:'catalog_read'};
const proof={source:'OFFLINE_BACKEND_EVENT_ATTESTATION',environment:'qa_staging',
  eventId:event.event_id,channel:'messenger',authenticated:true,
  providerSignatureVerified:true,authUserId:'QA_OWNER_A',tenantId:'QA_TENANT_1',
  storeId:'QA_STORE_A',bindingId:'QA_BINDING_A',
  providerAccountRef:'QA_PAGE_1',providerBotRef:'QA_BOT_1',conversationId:'QA_CONV_A',
  replayKey:'qa_replay_0001',policyVersion:'QA_POLICY_V1',expiresAtMs:NOW+60000};
const evidence={source:'OFFLINE_CANONICAL_ROWS_SNAPSHOT',
  authUserExists:true,tenantExists:true,storeExists:true,
  tenantId:proof.tenantId,storeId:proof.storeId,storeTenantId:proof.tenantId,
  tenantMembershipActive:true,storeMembershipActive:true,
  membershipUserId:proof.authUserId,membershipTenantId:proof.tenantId,
  membershipStoreId:proof.storeId,role:'owner',
  bindingId:proof.bindingId,channel:proof.channel,
  providerAccountRef:proof.providerAccountRef,providerBotRef:proof.providerBotRef,
  ownerConsentVerified:true,ownerConsentExpiresAtMs:NOW+60000,
  storeStatus:'active',subscriptionActive:true,policyVersion:proof.policyVersion,
  bindingRevoked:false,tenantRevoked:false,storeRevoked:false,
  allowedCapabilities:['catalog_read','price_quote','order_status_read','owner_report_read','order_request_draft'],
  durableReplayStatus:'FRESH_VERIFIED'};
async function call({input={},attestation={},rows={},trustException=false,dbException=false}={}){
 const e={...event,...input},p={...proof,channel:e.channel,...attestation};
 const r={...evidence,channel:p.channel,...rows};
 return planStoreScope(e,{clock:()=>NOW,
   resolveTrustedEvent:async()=>{if(trustException)throw Error('unavailable');return p;},
   readCanonicalEvidence:async()=>{if(dbException)throw Error('unavailable');return r;}});
}
const expected=(name,opts,reason)=>test(name,async()=>{
 const out=await call(opts);
 assert.equal(out.status,'BLOCKED');assert.equal(out.reason,reason);
 assert.equal(out.can_send,false);assert.equal(out.can_read_hosted,false);
 assert.equal(out.can_write_orders,false);assert.equal(out.provider_sends,0);
 assert.equal(out.hosted_writes,0);
});
test('positive synthetic A catalog is NOT a hosted grant',async()=>{
 const out=await call();assert.equal(out.status,'SYNTHETIC_POLICY_ELIGIBLE_NOT_HOSTED');
 assert.equal(out.classification,'OFFLINE_SECURITY_MODEL_ONLY');
 assert.equal(out.can_read_hosted,false);assert.equal(out.hosted_reads,0);
 assert.equal(out.can_send,false);assert.equal(out.can_write_orders,false);
});
test('synthetic order request always requires another confirmation+backend gate',async()=>{
 const out=await call({input:{capability:'order_request_draft'}});
 assert.equal(out.next_gate,'USER_CONFIRMATION_AND_BACKEND_ORDER_GATE');
 assert.equal(out.hosted_writes,0);
});
for(const ch of ['messenger','zalo_bot','zalo_oa','web_widget']){
 test('same policy plan supports '+ch+' only as synthetic fixture',async()=>{
   const result=await call({input:{channel:ch},
     rows:{channel:ch}});
   assert.equal(result.status,'SYNTHETIC_POLICY_ELIGIBLE_NOT_HOSTED');
 });
}
test('shop A/B same tenant remain distinct memory scopes',async()=>{
 const a=await call();
 const b=await call({attestation:{storeId:'QA_STORE_B'},rows:{storeId:'QA_STORE_B',membershipStoreId:'QA_STORE_B'}});
 assert.equal(b.status,'SYNTHETIC_POLICY_ELIGIBLE_NOT_HOSTED');
 assert.notEqual(a.scope_ref,b.scope_ref);
});
test('shop C different tenant yields separate store scope',async()=>{
 const c=await call({attestation:{tenantId:'QA_TENANT_2',storeId:'QA_STORE_C'},rows:{
   tenantId:'QA_TENANT_2',storeId:'QA_STORE_C',storeTenantId:'QA_TENANT_2',
   membershipTenantId:'QA_TENANT_2',membershipStoreId:'QA_STORE_C'}});
 assert.equal(c.status,'SYNTHETIC_POLICY_ELIGIBLE_NOT_HOSTED');
 assert.notEqual(c.scope_ref,(await call()).scope_ref);
});
test('no authority if dependencies not injected',async()=>{
 assert.equal((await planStoreScope(event)).status,'BLOCKED');
});
expected('client store claim refused',{input:{store_id:'QA_STORE_B'}},REASON.CLIENT);
expected('client tenant claim refused',{input:{tenant_id:'QA_TENANT_1'}},REASON.CLIENT);
expected('client owner role refused',{input:{role:'owner'}},REASON.CLIENT);
expected('client capability list refused',{input:{capabilities:['owner_report_read']}},REASON.CLIENT);
expected('client can_send refused',{input:{can_send:true}},REASON.CLIENT);
expected('client provider bot ID refused',{input:{provider_bot_id:'QA_BOT_1'}},REASON.CLIENT);
expected('signature proof denied if not verified',{attestation:{providerSignatureVerified:false}},REASON.EVENT);
expected('expired event attestation denied',{attestation:{expiresAtMs:NOW-1}},REASON.EVENT);
expected('missing event expiry denied',{attestation:{expiresAtMs:undefined}},REASON.EVENT);
expected('missing authenticated identity denied',{attestation:{authenticated:false}},REASON.EVENT);
expected('untrusted source denied',{attestation:{source:'CLIENT_SAYS_TRUSTED'}},REASON.EVENT);
expected('unknown provider namespace denied',{input:{channel:'telegram'}},REASON.INVALID);
expected('missing event ID denied',{input:{event_id:'a'}},REASON.INVALID);
expected('unsupported capability denied',{input:{capability:'write_order'}},REASON.INVALID);
expected('canonical store tenant mismatch denied',{rows:{storeTenantId:'QA_TENANT_2'}},REASON.SCOPE);
expected('unrecognized tenant denied',{rows:{tenantExists:false}},REASON.SCOPE);
expected('no auth user evidence denied',{rows:{authUserExists:false}},REASON.SCOPE);
expected('no store record denied',{rows:{storeExists:false}},REASON.SCOPE);
expected('tenant membership inactive denied',{rows:{tenantMembershipActive:false}},REASON.MEMBERSHIP);
expected('store membership inactive denied',{rows:{storeMembershipActive:false}},REASON.MEMBERSHIP);
expected('cross-shop owner proof denied',{rows:{membershipStoreId:'QA_STORE_B'}},REASON.MEMBERSHIP);
expected('wrong member user denied',{rows:{membershipUserId:'QA_OWNER_B'}},REASON.MEMBERSHIP);
expected('staff cannot read owner report',{input:{capability:'owner_report_read'},rows:{role:'staff'}},REASON.MEMBERSHIP);
expected('no independent consent denied',{rows:{ownerConsentVerified:false}},REASON.OWNER);
expected('expired consent denied',{rows:{ownerConsentExpiresAtMs:NOW-1}},REASON.OWNER);
expected('missing consent expiration denied',{rows:{ownerConsentExpiresAtMs:undefined}},REASON.OWNER);
expected('binding mismatch denied',{rows:{bindingId:'QA_BINDING_B'}},REASON.OWNER);
expected('bot/account mismatch denied',{rows:{providerAccountRef:'QA_PAGE_B'}},REASON.OWNER);
expected('paused shop denied',{rows:{storeStatus:'paused'}},REASON.POLICY);
expected('expired subscription denied',{rows:{subscriptionActive:false}},REASON.POLICY);
expected('revoked binding denied',{rows:{bindingRevoked:true}},REASON.POLICY);
expected('missing revocation check denied',{rows:{bindingRevoked:undefined}},REASON.POLICY);
expected('revoked store denied',{rows:{storeRevoked:true}},REASON.POLICY);
expected('revoked tenant denied',{rows:{tenantRevoked:true}},REASON.POLICY);
expected('stale policy denied',{rows:{policyVersion:'QA_POLICY_OLD'}},REASON.POLICY);
expected('tool capability not granted denied',{rows:{allowedCapabilities:[]}},REASON.CAPABILITY);
expected('replay duplicate denied',{rows:{durableReplayStatus:'DUPLICATE'}},REASON.REPLAY);
expected('replay store unavailable denied',{rows:{durableReplayStatus:'UNAVAILABLE'}},REASON.REPLAY);
expected('auth resolver throws denied',{trustException:true},REASON.DEPENDENCY);
expected('store evidence lookup throws denied',{dbException:true},REASON.DEPENDENCY);
test('session scope separated for same channel different provider account',async()=>{
 const a=await call();const b=await call({attestation:{providerAccountRef:'QA_PAGE_2'},
 rows:{providerAccountRef:'QA_PAGE_2'}});
 assert.equal(b.status,'SYNTHETIC_POLICY_ELIGIBLE_NOT_HOSTED');
 assert.notEqual(a.scope_ref,b.scope_ref);
});
test('snapshot object is not sent to output',async()=>{
 const o=await call();assert.equal(Object.hasOwn(o,'ownerConsentVerified'),false);
 assert.equal(Object.hasOwn(o,'authUserId'),false);
});
