import test from 'node:test';
import assert from 'node:assert/strict';
import {
 inspectOneEventNoSendPlan,
 inspectIndependentNoSendUatReceiptShape,
 oneEventDefaultPlan
} from './v17-7h2-one-event-nosend-admission.mjs';

function locked(r){
 for(const key of ['realOwnerConsentVerified','independentOperatorVerified',
   'realNativeSignatureVerified','realProviderEventReceived',
   'realHostedDurableLedgerVerified','realHostedStoreJwtRlsVerified',
   'realExternalEdgeDenyVerified','canEnableWorker','canSetWebhook',
   'canReceiveRealEvent','canSendProvider','canReadCommerce',
   'canWriteOrders','canUpdateStock','canPublish'])
   assert.equal(r[key],false,key);
 assert.equal(r.sourceOnly,true);
}
const plan=()=>({...oneEventDefaultPlan});
function checkBad(reason,mutate){
 const p=plan();mutate(p);
 const result=inspectOneEventNoSendPlan(p);
 assert.equal(result.shapePrepared,false,JSON.stringify(result));
 assert.equal(result.reason,reason);locked(result);
}
function receipt(){
 return {
  source:'OFFLINE_INDEPENDENT_MOCK',mode:'SYNTHETIC_AUDIT_FIXTURE_ONLY',
  singleInbound:1,providerSends:0,n8nSends:0,
  commerceOrderWrites:0,commerceStockWrites:0,privilegedRpcWrites:0,
  crossStoreReads:0,signatureFailures:0,replayedEventsDenied:1,
  auditorDistinctFromOperator:true,nativeProviderLogReconciled:false,
  hostedDbLogReconciled:false,rawSensitiveFieldsExcluded:true
 };
}
function badReceipt(mutate){
 const r=receipt();mutate(r);
 const result=inspectIndependentNoSendUatReceiptShape(r);
 assert.equal(result.shapePrepared,false);assert.equal(result.reason,
 'NATIVE_INDEPENDENT_RECONCILIATION_NOT_VERIFIED');locked(result);
}
test('one-event QA plan is structured only and cannot deploy',()=>{
 const result=inspectOneEventNoSendPlan(plan());
 assert.equal(result.shapePrepared,true);
 assert.equal(result.plannedMaxInbound,1);
 assert.equal(result.plannedMaxOutbound,0);locked(result);
});
test('unknown Tenant/Store authority metadata cannot be smuggled in',()=>checkBad(
 'CANARY_PLAN_UNTRUSTED_OR_WORKER_VERSION_DRIFT',p=>p.storeId='Store-B'));
test('version drift stopped',()=>checkBad(
 'CANARY_PLAN_UNTRUSTED_OR_WORKER_VERSION_DRIFT',p=>p.version='another-version'));
test('OA not allowed in Bot test lane',()=>checkBad(
 'CANARY_PLAN_UNTRUSTED_OR_WORKER_VERSION_DRIFT',p=>p.channel='ZALO_OA'));
test('Messenger requires independent native lane',()=>checkBad(
 'CANARY_PLAN_UNTRUSTED_OR_WORKER_VERSION_DRIFT',p=>p.channel='MESSENGER'));
test('live mode rejected',()=>checkBad(
 'CANARY_PLAN_UNTRUSTED_OR_WORKER_VERSION_DRIFT',p=>p.mode='LIVE_WEBHOOK'));
for(const [field,unsafe] of [
 ['maxInboundEvents',2],['maxProviderSends',1],
 ['maxOrderWrites',1],['maxStockWrites',1],['maxCommerceReads',1],
 ['replayRequired',false],['nativeProofRequired','STATIC_TOKEN_ONLY'],
 ['qaWindowSeconds',3600],['existingZaloWebhookUnchanged',false],
 ['existingMessengerWebhookUnchanged',false],['newPublicRoute',true],
 ['providerTokenInstalled',true],['merchantEvidenceWorkerShared',true],
 ['legacyN8nWorkflowReused',true],['independentLogsRequired',false]
]){
 test('one-event plan disallows '+field+' outside exact bound',()=>checkBad(
  'ONE_EVENT_ZERO_SEND_ZERO_WRITE_AND_ROLLBACK_LIMITS_MISSING',p=>p[field]=unsafe));
}
test('synthetic audit shape never claims real provider/DB reconciliation',()=>{
 const r=inspectIndependentNoSendUatReceiptShape(receipt());
 assert.equal(r.shapePrepared,true);
 assert.equal(r.realProviderSendAudited,false);
 assert.equal(r.realHostedDatabaseAudited,false);locked(r);
});
for(const [field,unsafe] of [
 ['mode','REAL'],['source','HOSTED_PROVIDER'],
 ['singleInbound',2],['providerSends',1],['n8nSends',1],
 ['commerceOrderWrites',1],['commerceStockWrites',1],
 ['privilegedRpcWrites',1],['crossStoreReads',1],
 ['signatureFailures',1],['replayedEventsDenied',0],
 ['auditorDistinctFromOperator',false],
 ['nativeProviderLogReconciled',true],['hostedDbLogReconciled',true],
 ['rawSensitiveFieldsExcluded',false]
]){
 test('unverified UAT receipt rejects '+field+' override',()=>badReceipt(r=>r[field]=unsafe));
}
for(const field of ['token','botId','rawMessage','jwt','customerName','ownerApproved']){
 test('UAT receipt rejects sensitive or self-declared '+field,()=>badReceipt(r=>r[field]='fake'));
}
test('missing receipt denied',()=>{
 const r=inspectIndependentNoSendUatReceiptShape(null);
 assert.equal(r.shapePrepared,false);locked(r);
});
