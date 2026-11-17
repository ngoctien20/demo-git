import test from 'node:test';
import assert from 'node:assert/strict';
import {
 inspectInactiveWorkerHostMetadata,
 inspectScopedOwnerConsentTicket,
 requireSeparateNativeRealCanaryAuthorization,
 inactiveCanaryScriptName
} from './v17-7h-host-and-owner-admission-offline.mjs';
import worker from './v17-7h-hosted-deny-all-worker.mjs';

const NOW=1794912000000;
function host(){
 return {
  source:'CONNECTED_CLOUDFLARE_READONLY',
  scriptName:inactiveCanaryScriptName,
  scriptExists:true,versionCount:1,
  deploymentCount:0,routeCount:0,customDomainCount:0,cronCount:0,
  workersDevEnabled:false,previewUrlsEnabled:false,
  bindingCount:0,credentialCount:0,
  defaultHandlerIs404Verified:true,externalNetworkCallsCount:0,
  commerceConnectionsCount:0
 };
}
function owner(channel='ZALO_BOT'){
 return {
  mode:'REDACTED_PRIVATE_TICKET_SHAPE_ONLY',
  scope:'ONE_DEDICATED_QA_BOT_OR_PAGE_NO_SEND',
  channel,qaInstallationRef:'install-qa-only-001',
  ownerSessionDigest:'a'.repeat(64),operatorSessionDigest:'b'.repeat(64),
  reviewerSessionDigest:'c'.repeat(64),
  providerAccountProofDigest:'d'.repeat(64),
  expiresAtMs:NOW+300000,
  noSend:true,noCustomerData:true,noCommerceReadWrite:true
 };
}
function locked(r){
 for(const key of [
  'realMerchantOwnerVerified','realProviderQaBotOrPageOwnerVerified',
  'independentOperatorVerified','realSupabaseStoreJwtRlsVerified',
  'realNativeWebhookReceived','realProviderSignatureVerified',
  'realExternalAccessDenyVerified','realDurableReplayVerified',
  'canEnablePublicRoute','canRegisterWebhook','canInjectCredentials',
  'canSendProviderMessage','canReadCommerce','canWriteCommerce','canPublish'
 ])assert.equal(r[key],false,key);
 assert.equal(r.ownerConsentAdmitted,false);
}
for(const method of ['GET','POST','PUT','DELETE','PATCH','OPTIONS','HEAD']){
 test('inert Worker always denies HTTP '+method,async()=>{
  const request=new Request('https://canary.invalid/_qa/v17-7h/anything',{
   method,
   body:['POST','PUT','PATCH'].includes(method)?'top secret arbitrary text':undefined
  });
  const resp=await worker.fetch(request, {DANGEROUS_SEND_TOKEN:'should-not-be-used'});
  assert.equal(resp.status,404);
  assert.equal(await resp.text(),'');
  assert.equal(resp.headers.get('cache-control'),'no-store');
  assert.equal(resp.headers.get('x-content-type-options'),'nosniff');
 });
}
test('healthy hosted metadata permits INACTIVE version shape only',()=>{
 const r=inspectInactiveWorkerHostMetadata(host());
 assert.equal(r.hostAdmitted,true);assert.equal(r.realHandlerExecuted,false);locked(r);
});
function badHost(reason,modify){
 const s=host();modify(s);const r=inspectInactiveWorkerHostMetadata(s);
 assert.equal(r.hostAdmitted,false);assert.equal(r.reason,reason);locked(r);
}
test('wrong Worker identity refused',()=>badHost('INDEPENDENT_WORKER_METADATA_REQUIRED',s=>s.scriptName='another-worker'));
test('self-reported metadata source refused',()=>badHost('INDEPENDENT_WORKER_METADATA_REQUIRED',s=>s.source='CHAT_PASTED'));
test('Worker not found refused',()=>badHost('INACTIVE_SCRIPT_VERSION_NOT_FOUND',s=>s.scriptExists=false));
test('0 versions refused',()=>badHost('INACTIVE_SCRIPT_VERSION_NOT_FOUND',s=>s.versionCount=0));
test('deployment detected refused',()=>badHost('WORKER_HAS_DEPLOYMENT_OR_PUBLIC_ROUTING',s=>s.deploymentCount=1));
test('Worker route detected refused',()=>badHost('WORKER_HAS_DEPLOYMENT_OR_PUBLIC_ROUTING',s=>s.routeCount=1));
test('custom domain detected refused',()=>badHost('WORKER_HAS_DEPLOYMENT_OR_PUBLIC_ROUTING',s=>s.customDomainCount=1));
test('cron trigger detected refused',()=>badHost('WORKER_HAS_DEPLOYMENT_OR_PUBLIC_ROUTING',s=>s.cronCount=1));
test('workers.dev detected refused',()=>badHost('WORKERS_DEV_OR_PREVIEW_EXPOSURE_NOT_DENIED',s=>s.workersDevEnabled=true));
test('previews enabled detected refused',()=>badHost('WORKERS_DEV_OR_PREVIEW_EXPOSURE_NOT_DENIED',s=>s.previewUrlsEnabled=true));
test('workers.dev unknown detected refused',()=>badHost('WORKERS_DEV_OR_PREVIEW_EXPOSURE_NOT_DENIED',s=>delete s.workersDevEnabled));
test('secret/binding detected refused',()=>badHost('INERT_WORKER_HAS_UNEXPECTED_BINDINGS',s=>s.bindingCount=1));
test('credential attached detected refused',()=>badHost('INERT_WORKER_HAS_UNEXPECTED_BINDINGS',s=>s.credentialCount=1));
test('404 code not attested refused',()=>badHost('INERT_WORKER_CODE_ATTESTATION_MISSING',s=>s.defaultHandlerIs404Verified=false));
test('external network detected refused',()=>badHost('INERT_WORKER_CODE_ATTESTATION_MISSING',s=>s.externalNetworkCallsCount=1));
test('Commerce read connection detected refused',()=>badHost('INERT_WORKER_CODE_ATTESTATION_MISSING',s=>s.commerceConnectionsCount=1));
for(const channel of ['ZALO_BOT','MESSENGER']){
 test(channel+' owner ticket shape NEVER authorizes real provider canary',()=>{
  const r=inspectScopedOwnerConsentTicket(owner(channel),NOW);
  assert.equal(r.ticketFormatCandidate,true);
  assert.equal(r.independentlyAuthenticatedProviderOwner,false);
  assert.equal(r.hostAdmitted,false);locked(r);
 });
}
function badOwner(reason,modify){
 const t=owner();modify(t);const r=inspectScopedOwnerConsentTicket(t,NOW);
 assert.equal(r.ownerConsentAdmitted,false);
 assert.equal(r.reason,reason);locked(r);
}
test('real mode not allowed',()=>badOwner('OWNER_PRIVATE_CONSENT_NOT_AUTHENTICATED',t=>t.mode='LIVE'));
test('broad consent not allowed',()=>badOwner('OWNER_PRIVATE_CONSENT_NOT_AUTHENTICATED',t=>t.scope='FULL_COMMERCE'));
test('sending not allowed',()=>badOwner('OWNER_PRIVATE_CONSENT_NOT_AUTHENTICATED',t=>t.noSend=false));
test('customer data not allowed',()=>badOwner('OWNER_PRIVATE_CONSENT_NOT_AUTHENTICATED',t=>t.noCustomerData=false));
test('Commerce read not allowed',()=>badOwner('OWNER_PRIVATE_CONSENT_NOT_AUTHENTICATED',t=>t.noCommerceReadWrite=false));
test('OA may not use Bot evidence',()=>badOwner('OWNER_TICKET_HAS_UNTRUSTED_OR_SENSITIVE_FIELDS',t=>t.channel='ZALO_OA'));
test('unknown channel denied',()=>badOwner('OWNER_TICKET_HAS_UNTRUSTED_OR_SENSITIVE_FIELDS',t=>t.channel='TELEGRAM'));
test('weak installation id denied',()=>badOwner('OWNER_TICKET_HAS_UNTRUSTED_OR_SENSITIVE_FIELDS',t=>t.qaInstallationRef='1'));
for(const field of ['access_token','jwt','password','phone','email','merchant_data','raw_webhook']){
 test('refuse real/PII field '+field,()=>badOwner('OWNER_TICKET_HAS_UNTRUSTED_OR_SENSITIVE_FIELDS',t=>t[field]='untrusted'));
}
test('missing owner evidence digest denied',()=>badOwner('OWNER_AND_OPERATOR_PROOF_DIGEST_NOT_PINNED',t=>t.ownerSessionDigest=''));
test('missing provider account proof digest denied',()=>badOwner('OWNER_AND_OPERATOR_PROOF_DIGEST_NOT_PINNED',t=>t.providerAccountProofDigest=''));
test('owner and operator must differ',()=>badOwner('OWNER_OPERATOR_INDEPENDENCE_NOT_ESTABLISHED',t=>t.operatorSessionDigest=t.ownerSessionDigest));
test('operator and reviewer must differ',()=>badOwner('OWNER_OPERATOR_INDEPENDENCE_NOT_ESTABLISHED',t=>t.operatorSessionDigest=t.reviewerSessionDigest));
test('issuer and reviewer must differ',()=>badOwner('OWNER_OPERATOR_INDEPENDENCE_NOT_ESTABLISHED',t=>t.ownerSessionDigest=t.reviewerSessionDigest));
test('expired challenge rejected',()=>badOwner('PRIVATE_CONSENT_INVITATION_EXPIRED',t=>t.expiresAtMs=NOW-1));
test('challenge >15min refused',()=>badOwner('PRIVATE_CONSENT_INVITATION_EXPIRED',t=>t.expiresAtMs=NOW+20*60000));
test('claims of all-green results still NO-GO',()=>{
 const r=requireSeparateNativeRealCanaryAuthorization({
  owner:true,operator:true,cost:true,hosted:true,JWT:true,
  providerSignature:true,sendAllowed:true
 });
 assert.equal(r.pending.length,8);
 assert.equal(r.ownerConsentAdmitted,false);locked(r);
});
