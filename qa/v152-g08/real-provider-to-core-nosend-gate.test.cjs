'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CONTRACT,OBS,FLAGS,inspect}=require('./real-provider-to-core-nosend-gate.cjs');
const fixture=require('./live-vs-nosend-source-receipts.json');
const now='2026-11-17T03:47:10Z';
const copy=()=>JSON.parse(JSON.stringify(fixture));
const check=r=>{
 assert.equal(r.status,'REAL_SIGNED_COMMERCE_NOSEND_ADMISSION_NO_GO');
 for(const k of ['mayReuseDemoCallback','mayReadCommerceOrders','mayWriteCommerceOrders',
  'maySendProviderReply','mayPublish','mayMigrate','mayChangeProductionCallback',
  'mayAttachCredentials','mayBill'])
  assert.equal(r[k],false,k);
 assert.equal(r.realNoSendCallbackObserved,false);
};
test('real redacted n8n source is exact, 3 pinned executions, no customer data',()=>{
 assert.equal(fixture.contract,CONTRACT);
 assert.equal(fixture.observations.length,3);
 for(let i=0;i<3;i++){
  assert.equal(fixture.observations[i].workflowId,OBS[i][1]);
  assert.equal(fixture.observations[i].executionId,OBS[i][2]);
 }
 assert.equal(JSON.stringify(fixture).includes('customer_name'),false);
 assert.equal(JSON.stringify(fixture).includes('phone'),false);
 assert.equal(JSON.stringify(fixture).includes('senderId'),false);
});
test('actual signed Messenger DEMO execution does not authorize Store Commerce no-send',()=>{
 const result=inspect(copy(),now);
 check(result);
 assert.equal(result.diagnostic.legacySignedWebhookIsNotNoSend,true);
 assert.ok(result.blockers.includes('UNVERIFIED_realProviderNoSendOwnerAuthorized'));
 assert.ok(result.blockers.includes('UNVERIFIED_realMerchantStoreOwnershipAttested'));
});
test('actual central core 8 denied synthetic cases are not real signed Page proof',()=>{
 const result=inspect(copy(),now);
 assert.equal(result.diagnostic.centralCoreTestIsSyntheticOnly,true);
 check(result);
});
test('actual G07 20 denied admissions cannot be rebranded successful real provider UAT',()=>{
 const result=inspect(copy(),now);
 assert.equal(result.diagnostic.g07AdmissionTestDeliberatelyDeniesRealTraffic,true);
 check(result);
});
const deny=(label,mutate,expected)=>test(label,()=>{
 const x=copy();mutate(x);const r=inspect(x,now);check(r);
 assert.ok(r.blockers.includes(expected),JSON.stringify(r.blockers));
});
deny('missing origin is invalid',x=>delete x.source,'INVALID_OR_EXTRA_SOURCE_FIELDS');
deny('client-supplied Page ID field invalid',x=>x.actualPageId='NEVER_LOG','INVALID_OR_EXTRA_SOURCE_FIELDS');
deny('wrong source is not trusted',x=>x.source='BROWSER_OPERATOR_GUESS','UNAUTHENTICATED_DATA_SOURCE');
deny('different contract rejected',x=>x.contract='FAKE_GO_LIVE','UNAUTHENTICATED_DATA_SOURCE');
deny('missing one executable evidence',x=>x.observations.pop(),'THREE_INDEPENDENT_EXECUTIONS_REQUIRED');
deny('extra source record cannot promote',x=>x.observations.push(x.observations[0]),'THREE_INDEPENDENT_EXECUTIONS_REQUIRED');
deny('different DEMO execution ID rejected',x=>x.observations[0].executionId='0000','WORKFLOW_EXECUTION_PROVENANCE_MISMATCH');
deny('different published Messenger workflow rejected',x=>x.observations[0].workflowId='unknown','WORKFLOW_EXECUTION_PROVENANCE_MISMATCH');
deny('mixing Core execution and signed event forbidden',x=>x.observations[1].sourceKind='LEGACY_MESSENGER_DEMO_WEBHOOK','WORKFLOW_EXECUTION_PROVENANCE_MISMATCH');
deny('changing DEMO result to no-send is not evidence',x=>x.observations[0].providerSendNodeRan=false,'SOURCE_EVENTS_DO_NOT_PROVE_REAL_NOSEND');
deny('changing DEMO to synthetic is not real sign',x=>x.observations[0].syntheticTest=true,'SOURCE_EVENTS_DO_NOT_PROVE_REAL_NOSEND');
deny('claiming real Core was provider event is not supported',x=>x.observations[1].realProviderEventObserved=true,'SOURCE_EVENTS_DO_NOT_PROVE_REAL_NOSEND');
deny('Core cannot self-certify JWT',x=>x.observations[1].commerceStoreAuthorityVerified=true,'SOURCE_EVENTS_DO_NOT_PROVE_REAL_NOSEND');
deny('G07 denied admissions are not real signed',x=>x.observations[2].signatureVerifiedFlag=true,'SOURCE_EVENTS_DO_NOT_PROVE_REAL_NOSEND');
deny('unknown host write status cannot be asserted from source execution',x=>x.observations[0].hostedWritesCheckedHere=true,'SOURCE_EVENTS_DO_NOT_PROVE_REAL_NOSEND');
deny('raw payload hidden field not allowed',x=>x.observations[0].rawBody='NO_PII_ALLOWED','EXECUTION_RECORD_SCHEMA_DRIFT');
deny('extra customer account included in receipt rejected',x=>x.observations[1].customerPhone='FAKE','EXECUTION_RECORD_SCHEMA_DRIFT');
deny('stale observation cannot support go-live',x=>x.snapshotAtUtc='2025-01-01T00:00:00Z','SOURCE_RECEIPT_STALE_OR_FUTURE');
deny('future dated snapshot rejected',x=>x.snapshotAtUtc='2030-01-01T00:00:00Z','SOURCE_RECEIPT_STALE_OR_FUTURE');
deny('release field not present cannot be inferred true',x=>delete x.current.realSameTenantStoreRlsJwtPassed,'RELEASE_GATE_FIELDS_INVALID');
deny('extra Owner text claim invalid',x=>x.current.originalMerchantName='FAKE_OWNER','RELEASE_GATE_FIELDS_INVALID');
test('no amount of green self-reported flags can bypass independent primary-source verification',()=>{
 const x=copy();for(const key of FLAGS)x.current[key]=true;
 const result=inspect(x,now);check(result);
 assert.deepEqual(result.blockers,['ORIGINAL_PROVIDER_AND_STORE_AUTHORITY_NOT_REVIEWED_HERE']);
});
test('readiness remains blocked if only real HMAC works but production callback changed',()=>{
 const x=copy();x.current.realProviderNoSendOwnerAuthorized=true;
 x.current.productionCallbackIsolationApproved=false;
 const result=inspect(x,now);check(result);
 assert.ok(result.blockers.includes('UNVERIFIED_productionCallbackIsolationApproved'));
});
test('current local device backup deferral is not permission to migrate hosted RLS',()=>{
 const r=inspect(copy(),now);check(r);
 assert.ok(r.blockers.includes('UNVERIFIED_currentIndependentRestoreAccepted'));
});
test('source output never leaks underlying identifiers or credentials',()=>{
 const str=JSON.stringify(inspect(copy(),now));
 for(const pattern of ['Z7FdV7uDvApfbURQ','4176','iyfGUiEsZlNTBWOR',
    'mmt3ToandWrLAcjH','Facebook Page','App Secret','access_token'])
  assert.equal(str.includes(pattern),false);
});
