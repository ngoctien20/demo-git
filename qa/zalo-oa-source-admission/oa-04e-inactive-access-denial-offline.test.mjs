import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectInactiveDedicatedOaWorkerSnapshot,
  inspectExternalAccessNoSendTranscript,
  ownerAndCostReleaseGate
} from './oa-04e-inactive-access-denial-offline.mjs';

const NOW=1794900000000;
const AUD='737646a56ab1df6ec9bddc7e5ca84eaf3b0768850f3ffb5d74f1534911fe3893';
function infra(){
 const scriptName='tien404-zalo-qa-04e-inactive';
 const workerId='c81a2d22c29840ed9d61681a3270dbff';
 const access={name:'TIEN404 OA QA PRIVATE',aud:AUD,workerId,
   exactOperatorEmails:['approved-operator@qa.invalid']};
 const app={id:'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   name:access.name,aud:AUD,type:'self_hosted',session_duration:'1h',
   destinations:[{type:'worker',worker_id:workerId}],
   policies:[{decision:'allow',include:[{email:{email:'approved-operator@qa.invalid'}}]}]};
 return {
   worker:{scriptName,workerId,workersDevEnabled:false,
     previewUrlsEnabled:false,activeDeploymentCount:0,triggersEnabled:false},
   routes:[],domains:[],accessApps:[app],expected:{scriptName,workerId,access}
 };
}
function probe(){
 const ids=['QA-anonymous-01','QA-wrongactor-02','QA-approved-03','QA-oauthroute-04','QA-webhook-05','QA-approval-06'];
 const stamp=correlationId=>({correlationId});
 return {
   anonymous:{...stamp(ids[0]),status:302,workerInvoked:false,
      location:'https://team-qa.cloudflareaccess.com/cdn-cgi/access/login?redirect_url=%2F'},
   unauthorizedOperator:{...stamp(ids[1]),status:403,workerInvoked:false,authorizedToExecute:false},
   approvedOperator:{...stamp(ids[2]),status:200,workerInvoked:true,accessAud:AUD,ctxAccessVerified:true,
     body:{stage:'SOURCE_04B_OPERATOR_ACCESS_CONFIRMED_ONLY',
       providerOwnershipVerified:false,signedProviderEventVerified:false,
       canReceiveProviderTraffic:false,canActivate:false,canSend:false,canWriteOrders:false}},
   oauthPath:{...stamp(ids[3]),status:404,workerInvoked:true,
     body:{reason:'PROVIDER_ENDPOINT_NOT_HOSTED_HERE'}},
   webhookPath:{...stamp(ids[4]),status:404,workerInvoked:true,
     body:{reason:'PROVIDER_ENDPOINT_NOT_HOSTED_HERE'}},
   approvalPost:{...stamp(ids[5]),status:423,workerInvoked:true,
     body:{canActivate:false,noSend:true}},
   collectedAtMs:NOW
 };
}
const expected={teamAccessHost:'team-qa.cloudflareaccess.com',aud:AUD,nowMs:NOW};
function checkInactive(reason,fn){
 const f=infra();fn(f);const r=inspectInactiveDedicatedOaWorkerSnapshot(f);
 assert.equal(r.candidate,false);assert.equal(r.reason,reason);
 assert.equal(r.canDeploy,false);assert.equal(r.canSend,false);
}
function checkProbe(reason,fn){
 const f=probe(),e={...expected};fn(f,e);
 const r=inspectExternalAccessNoSendTranscript(f,e);
 assert.equal(r.candidate,false,JSON.stringify(r));assert.equal(r.reason,reason);
 assert.equal(r.edgeAccessProved,false);assert.equal(r.canDeploy,false);
}
test('inactive Worker and exact Access are only a SOURCE shape candidate',()=>{
 const r=inspectInactiveDedicatedOaWorkerSnapshot(infra());
 assert.equal(r.candidate,true);assert.equal(r.edgeAccessProved,false);
 assert.equal(r.canDeploy,false);assert.equal(r.canReceiveZalo,false);
});
test('worker not created is BLOCKED, not readiness success',()=>checkInactive('DEDICATED_WORKER_NOT_CREATED_OR_UNVERIFIED',f=>{f.worker=null}));
test('worker target alias mismatch denied',()=>checkInactive('DEDICATED_WORKER_NOT_CREATED_OR_UNVERIFIED',f=>{f.worker.scriptName='someone-else'}));
test('workers.dev public endpoint denied',()=>checkInactive('WORKER_NOT_PROVEN_INACTIVE',f=>{f.worker.workersDevEnabled=true}));
test('preview URL active denied',()=>checkInactive('WORKER_NOT_PROVEN_INACTIVE',f=>{f.worker.previewUrlsEnabled=true}));
test('active deployment denied',()=>checkInactive('WORKER_NOT_PROVEN_INACTIVE',f=>{f.worker.activeDeploymentCount=1}));
test('Cron trigger on inactive worker denied',()=>checkInactive('WORKER_NOT_PROVEN_INACTIVE',f=>{f.worker.triggersEnabled=true}));
test('Worker route matched denied',()=>checkInactive('UNEXPECTED_PUBLIC_WORKER_ROUTE_OR_DOMAIN',f=>{f.routes.push({script:f.expected.scriptName})}));
test('Worker custom domain matched denied',()=>checkInactive('UNEXPECTED_PUBLIC_WORKER_ROUTE_OR_DOMAIN',f=>{f.domains.push({service:f.expected.scriptName})}));
test('Access app absent denied',()=>checkInactive('DEDICATED_ACCESS_APP_NOT_UNIQUELY_BOUND',f=>{f.accessApps=[]}));
test('two Access apps for same worker denied',()=>checkInactive('DEDICATED_ACCESS_APP_NOT_UNIQUELY_BOUND',f=>{f.accessApps.push({...f.accessApps[0]})}));
test('preview-only Access insufficient',()=>checkInactive('DEDICATED_ACCESS_APP_NOT_UNIQUELY_BOUND',f=>{f.accessApps[0].destinations[0].type='preview_worker'}));
test('bypass Access policy denied',()=>checkInactive('ACCESS_API_POLICY_NOT_STRICTLY_PINNED',f=>{f.accessApps[0].policies[0].decision='bypass'}));
test('existing Pages staging Access cannot be used',()=>checkInactive('DEDICATED_ACCESS_APP_NOT_UNIQUELY_BOUND',f=>{f.accessApps[0].destinations=[{type:'public',uri:'*.tien404-ai-git-staging.pages.dev'}]}));
test('invented worker ID not permitted',()=>checkInactive('MISSING_TRUSTED_ISOLATED_WORKER_EXPECTATION',f=>{f.expected.workerId='fake-id'}));
test('synthetic matching external transcript is still NOT real hosted evidence',()=>{
 const r=inspectExternalAccessNoSendTranscript(probe(),expected);
 assert.equal(r.candidate,true);assert.equal(r.edgeAccessProved,false);
 assert.equal(r.realCanaryExecuted,false);assert.equal(r.canSend,false);
});
test('HTTP 200 anonymous is a security failure',()=>checkProbe('ANONYMOUS_EDGE_CHALLENGE_NOT_SHOWN',f=>{f.anonymous.status=200}));
test('Worker-returned 403 is not proof of Access edge challenge',()=>checkProbe('ANONYMOUS_EDGE_CHALLENGE_NOT_SHOWN',f=>{f.anonymous.status=403}));
test('anonymous invokes Worker before Access denied',()=>checkProbe('ANONYMOUS_EDGE_CHALLENGE_NOT_SHOWN',f=>{f.anonymous.workerInvoked=true}));
test('phishing redirect to attacker domain rejected',()=>checkProbe('ACCESS_CHALLENGE_ORIGIN_NOT_PINNED',f=>{f.anonymous.location='https://team-qa.cloudflareaccess.com.evil.test/cdn-cgi/access/login'}));
test('non-HTTPS Access redirect rejected',()=>checkProbe('ACCESS_CHALLENGE_ORIGIN_NOT_PINNED',f=>{f.anonymous.location='http://team-qa.cloudflareaccess.com/cdn-cgi/access/login'}));
test('unauthorized operator gets access denied before Worker',()=>checkProbe('UNAUTHORIZED_OPERATOR_NOT_DENIED_AT_EDGE',f=>{f.unauthorizedOperator.workerInvoked=true}));
test('unauthorized operator HTTP 200 denied',()=>checkProbe('UNAUTHORIZED_OPERATOR_NOT_DENIED_AT_EDGE',f=>{f.unauthorizedOperator.status=200}));
test('approved operator wrong Access audience rejected',()=>checkProbe('AUTHORIZED_OPERATOR_NOT_RESTRICTED_TO_NO_SEND',f=>{f.approvedOperator.accessAud='different'}));
test('approved operator accidentally enables send rejected',()=>checkProbe('AUTHORIZED_OPERATOR_NOT_RESTRICTED_TO_NO_SEND',f=>{f.approvedOperator.body.canSend=true}));
test('approved operator accidentally reads provider traffic rejected',()=>checkProbe('AUTHORIZED_OPERATOR_NOT_RESTRICTED_TO_NO_SEND',f=>{f.approvedOperator.body.canReceiveProviderTraffic=true}));
test('OA OAuth callback accidentally exposed rejected',()=>checkProbe('PROVIDER_ENDPOINT_EXPOSED_ON_OPERATOR_WORKER',f=>{f.oauthPath.status=200}));
test('Zalo webhook accidentally exposed rejected',()=>checkProbe('PROVIDER_ENDPOINT_EXPOSED_ON_OPERATOR_WORKER',f=>{f.webhookPath.status=200}));
test('POST /approve accidentally enabled rejected',()=>checkProbe('APPROVAL_OR_WRITE_ENDPOINT_NOT_LOCKED',f=>{f.approvalPost.status=200}));
test('duplicate probe receipt correlation denied',()=>checkProbe('INDEPENDENT_PROBE_RECEIPTS_MISSING',f=>{f.approvalPost.correlationId=f.oauthPath.correlationId}));
test('stale UAT transcript rejected',()=>checkProbe('EXTERNAL_EVIDENCE_STALE_OR_FUTURE',(f,e)=>{e.nowMs+=10*60*1000}));
test('owner self-attestation cannot bypass actual provider ownership',()=>{
 const r=ownerAndCostReleaseGate({ownerConsent:true,operatorConsent:true,access:true,oaAdmin:true});
 assert.equal(r.realOwnerProved,false);
 assert.equal(r.canCreateWorker,false);assert.equal(r.canDeploy,false);
 assert.equal(r.required.length,9);
});
