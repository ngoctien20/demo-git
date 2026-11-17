import test from 'node:test';
import assert from 'node:assert/strict';
import {
 reconcileParallelH2Evidence, independentOneEventDecision,
 canonicalParallelH2Evidence
} from './v17-7h3-independent-one-event-decision.mjs';

const copy=()=>structuredClone(canonicalParallelH2Evidence);
function locked(x){
 for(const f of ['realOwnerIndependentlyVerified','realOperatorAndReviewerVerified',
 'realGetMeVerified','realGetWebhookInfoVerified','realBotIsDisposableAndUnbound',
 'realNativeProviderEventReceived','realCloudflareReplayVerified',
 'realExternalNoSendAuditVerified','realCrossStoreJwtRlsVerified',
 'allowActivateWorker','allowPublicProviderCallback','allowSetWebhook',
 'allowSendProviderMessage','allowCommerceReader','allowCommerceWriter',
 'allowPublish'])assert.equal(x[f],false,f);
 assert.equal(x.sourceOnly,true);
}
function denied(reason,change){
 const e=copy();change(e);
 const r=reconcileParallelH2Evidence(e);
 assert.equal(r.status,'NO_GO');
 assert.equal(r.reason,reason);
 locked(r);
}
test('parallel H2 image and H2 getMe mock are admitted only as source evidence',()=>{
 const v=reconcileParallelH2Evidence(copy());
 assert.equal(v.status,'PRIVATE_EVIDENCE_INTAKE_READY_REAL_UAT_NO_GO');
 assert.equal(v.sourceEvidenceCount,2);
 assert.equal(v.screenPr,360);assert.equal(v.methodMockPr,364);
 assert.equal(v.screenshotIsUserSuppliedOnly,true);
 assert.equal(v.realNativeOwnerSessionCount,0);
 assert.equal(v.realBotApiRequestsCount,0);
 assert.equal(v.workerRemainsInactive,true);locked(v);
});
test('unverified report with forged all-green flags still NO-GO',()=>{
 const r=independentOneEventDecision({
  owner:true,operator:true,botId:true,realGetMe:true,
  providerSignature:true,replay:true,approved:true,
  canSend:true,storeJWT:true
 },{source:'PRIVATE_TRUSTED_ISSUER_VERIFIED'});
 assert.equal(r.status,'REAL_ONE_EVENT_NO_GO');
 assert.equal(r.blockers.length,8);
 assert.equal(r.approvedRealEventCount,0);
 assert.equal(r.maxRealOutbound,0);
 assert.equal(r.maxRealCommerceWrites,0);
 assert.equal(r.selfReportedFlagsIgnored,true);locked(r);
});
test('no evidence also returns NO-GO and next user action',()=>{
 const r=independentOneEventDecision();
 assert.equal(r.status,'REAL_ONE_EVENT_NO_GO');
 assert.equal(r.selfReportedFlagsIgnored,false);
 assert.match(r.nextUserAction,/OFFICIAL_CREATOR/);locked(r);
});
test('null reconciliation input denied',()=>{
 const r=reconcileParallelH2Evidence(null);
 assert.equal(r.status,'NO_GO');locked(r);
});
test('wrong mode denied',()=>denied('CROSS_CHECKPOINT_SCOPE_UNTRUSTED',x=>x.mode='PRODUCTION'));
test('no-send false denied',()=>denied('CROSS_CHECKPOINT_SCOPE_UNTRUSTED',x=>x.noProviderSend=false));
test('Commerce write allowed denied',()=>denied('CROSS_CHECKPOINT_SCOPE_UNTRUSTED',x=>x.noCommerceWrite=false));
test('customer data admission denied',()=>denied('CROSS_CHECKPOINT_SCOPE_UNTRUSTED',x=>x.noCustomerData=false));
for(const field of ['botToken','jwt','secret','customer','merchantRecords','ownerApproved']){
 test('sensitive top-level self-report '+field+' denied',()=>denied('CROSS_CHECKPOINT_SCOPE_UNTRUSTED',x=>x[field]='untrusted'));
}
test('wrong screenshot SHA denied',()=>denied('SCREENSHOT_IS_NOT_VERIFIED_OWNER_OR_QA_BOT',x=>x.screenshot.sha256='0'.repeat(64)));
test('wrong screenshot branch provenance denied',()=>denied('SCREENSHOT_IS_NOT_VERIFIED_OWNER_OR_QA_BOT',x=>x.screenshot.pr=364));
test('screenshot mistaken for provider session denied',()=>denied('SCREENSHOT_IS_NOT_VERIFIED_OWNER_OR_QA_BOT',x=>x.screenshot.providerSessionVerified=true));
test('screenshot contains Bot ID unexpected denied',()=>denied('SCREENSHOT_IS_NOT_VERIFIED_OWNER_OR_QA_BOT',x=>x.screenshot.botIdVisible=true));
test('screenshot as separate QA Bot proof denied',()=>denied('SCREENSHOT_IS_NOT_VERIFIED_OWNER_OR_QA_BOT',x=>x.screenshot.separateQaBotVerified=true));
test('screenshot claims Bot Creator attestation denied',()=>denied('SCREENSHOT_IS_NOT_VERIFIED_OWNER_OR_QA_BOT',x=>x.screenshot.classification='REAL_VERIFIED'));
test('screenshot extra token denied',()=>denied('SCREENSHOT_IS_NOT_VERIFIED_OWNER_OR_QA_BOT',x=>x.screenshot.botToken='secret'));
test('wrong mock branch denied',()=>denied('MOCK_GETME_IS_NOT_PROVIDER_NATIVE_READBACK',x=>x.operatorMock.pr=360));
test('mock tries to claim real getMe denied',()=>denied('MOCK_GETME_IS_NOT_PROVIDER_NATIVE_READBACK',x=>x.operatorMock.realApiCalls=2));
test('mock claims Bot owner denied',()=>denied('MOCK_GETME_IS_NOT_PROVIDER_NATIVE_READBACK',x=>x.operatorMock.ownerVerified=true));
test('mock changes webhook denied',()=>denied('MOCK_GETME_IS_NOT_PROVIDER_NATIVE_READBACK',x=>x.operatorMock.webhookChanged=true));
test('mock adds credential denied',()=>denied('MOCK_GETME_IS_NOT_PROVIDER_NATIVE_READBACK',x=>x.operatorMock.accessToken='untrusted'));
test('missing Cloudflare readback denied',()=>denied('INACTIVE_WORKER_OR_PUBLIC_ROUTE_DRIFT_REQUIRES_AUDIT',x=>x.worker.source='USER_PASTED'));
test('wrong Worker version denied',()=>denied('INACTIVE_WORKER_OR_PUBLIC_ROUTE_DRIFT_REQUIRES_AUDIT',x=>x.worker.version='new_version'));
test('deployed Worker denied',()=>denied('INACTIVE_WORKER_OR_PUBLIC_ROUTE_DRIFT_REQUIRES_AUDIT',x=>x.worker.deployments=1));
test('binding drift denied',()=>denied('INACTIVE_WORKER_OR_PUBLIC_ROUTE_DRIFT_REQUIRES_AUDIT',x=>x.worker.bindings=1));
test('workers.dev enabled denied',()=>denied('INACTIVE_WORKER_OR_PUBLIC_ROUTE_DRIFT_REQUIRES_AUDIT',x=>x.worker.workersDev=true));
test('preview enabled denied',()=>denied('INACTIVE_WORKER_OR_PUBLIC_ROUTE_DRIFT_REQUIRES_AUDIT',x=>x.worker.previews=true));
test('public route enabled denied',()=>denied('INACTIVE_WORKER_OR_PUBLIC_ROUTE_DRIFT_REQUIRES_AUDIT',x=>x.worker.publicRoute=true));
for(const [field,value] of [
 ['operatorGrantExists',true],['trustedProviderSessionExists',true],
 ['realBotIdKnown',true],['realGetMeVerified',true],
 ['hostedReplayVerified',true],['independentProviderNoSendAudited',true]
]){
 test('self-reported hosted proof '+field+' denied',()=>denied(
  'UNVERIFIED_LIVE_OR_AUTHORITY_CLAIM_NOT_ACCEPTED',x=>x[field]=value));
}
