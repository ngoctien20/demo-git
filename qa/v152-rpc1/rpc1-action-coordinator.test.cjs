'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRpc1ActionCoordinator}=require('./rpc1-action-coordinator.cjs');
function fixture(){
 const calls=[];
 const pairing={
  issueCandidate:async x=>{calls.push('pairing_issue');return {status:'PAIRING_CAPABILITY_PREVIEW_ONLY',fakeQAOnly:true}},
  verifyAndClaimPreview:async x=>{calls.push('pairing_consume');return {status:'SIGNED_CAPABILITY_CLAIMED_NO_DB_WRITE',dbWrites:0}}
 };
 const canonical={
  issuePreview:async ({action})=>{calls.push('commerce_issue_'+action);
   return {issueStatus:'SIGNED_RECEIPT_PREVIEW_ONLY',orderCreated:false,channelSent:false,
    liveAuthorized:false,receipt:{token:'synthetic-token',canExecute:false}};
  },
  verifyPreview:async ()=>{calls.push('commerce_consume');
   return {status:'VERIFIED_CLAIMED_NO_EXECUTION',
    action:'QUOTE',actionExecutable:false,
    orderCreated:false,providerSends:0,hostedWrites:0,liveAuthorized:false,scope:{tenant_id:'t1',store_id:'s1',channel:'MESSENGER'}};
  }
 };
 return {coordinator:createRpc1ActionCoordinator({
   mode:'SYNTHETIC_NO_SEND',pairing,canonical
 }),calls,pairing,canonical};
}
test('01 pairing action uses ONLY dedicated pairing security domain',async()=>{
 const f=fixture();
 const r=await f.coordinator.issue({action:'OWNER_PAIRING_CLAIM',
   request:{envelope:{fake:true}}});
 assert.equal(r.status,'PAIRING_CAPABILITY_PREVIEW_ONLY');
 assert.deepEqual(f.calls,['pairing_issue']);
});
test('02 catalog and quote use existing canonical action registry',async()=>{
 const f=fixture();
 for(const action of ['CATALOG','QUOTE','ORDER_REQUEST','ASK_STAFF','POLICY']){
  const r=await f.coordinator.issue({action,request:{fake:true}});
  assert.equal(r.status,'CANONICAL_ACTION_PREVIEW_ONLY');
  assert.equal(r.orderCreated,false);
  assert.equal(r.providerSends,0);
 }
 assert.equal(f.calls.length,5);
 assert(!f.calls.includes('pairing_issue'));
});
test('03 pairing consume stays separate from commerce registry',async()=>{
 const f=fixture();
 const r=await f.coordinator.verify({action:'OWNER_PAIRING_CLAIM',
   request:{envelope:{fake:true}},token:'qa-only',challenge_proof:'qa'});
 assert.equal(r.dbWrites,0);assert.deepEqual(f.calls,['pairing_consume']);
});
test('04 canonical consume cannot mutate order or send message',async()=>{
 const f=fixture();const r=await f.coordinator.verify({
   action:'QUOTE',request:{fake:true},token:'qa'});
 assert.equal(r.status,'CANONICAL_ACTION_VERIFIED_NO_EXECUTION');
 assert.equal(r.liveAuthorized,false);
 assert.equal(r.orderCreated,false);
});
test('05 unknown action SQL, delete, admin excluded',async()=>{
 const f=fixture();
 for(const action of ['SQL','SELECT','DELETE_ORDER','OWNER_PAIRING_ADMIN','EXECUTE_RPC']){
  await assert.rejects(()=>f.coordinator.issue({action,request:{}}),
   /ACTION_NOT_ALLOWLISTED/);
 }
 assert.equal(f.calls.length,0);
});
test('06 pairing request missing trusted envelope fails before any issue',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.coordinator.issue({action:'OWNER_PAIRING_CLAIM',
   request:{role:'owner',verified:true}}),/PAIRING_ENVELOPE_REQUIRED/);
 await assert.rejects(()=>f.coordinator.issue({action:'OWNER_PAIRING_CLAIM',
   request:{envelope:{}},resource_ref:'untrusted'}),/PAIRING_ENVELOPE_REQUIRED/);
});
test('07 privileged operations always disabled',()=>{
 const f=fixture();
 for(const op of ['sql','execute','send','publish'])
   assert.throws(()=>f.coordinator[op](),/(DISABLED|APPROVAL_REQUIRED)/);
});
test('08 live mode or missing backend contract fails shut',()=>{
 assert.throws(()=>createRpc1ActionCoordinator({mode:'PRODUCTION'}),
   /RPC1_GATEWAYS_UNVERIFIED/);
 const f=fixture();
 const x=createRpc1ActionCoordinator({
   mode:'SYNTHETIC_NO_SEND',
   pairing:f.pairing,
   canonical:{...f.canonical,verifyPreview:async()=>({status:'VERIFIED_CLAIMED_NO_EXECUTION',
      action:'QUOTE',orderCreated:true})}
 });
 return assert.rejects(()=>x.verify({action:'QUOTE',request:{},token:'qa'}),
   /CANONICAL_GATEWAY_CLAIM_INVARIANT_FAILED/);
});
