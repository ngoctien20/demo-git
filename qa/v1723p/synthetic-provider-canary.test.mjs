import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {SYNTHETIC_MARKER,SyntheticReplayMemory,simulateOneCanary,reviewQaInstallationAdmission} from './synthetic-provider-canary.mjs';

const now=1794958500000;
const body=Buffer.from('{"synthetic":"TIEN404_QA_ONLY","event":"create"}','utf8');
const secret='NOT_REAL_PROVIDER_SECRET_QA_123456789';
const app='QA_SYNTHETIC_APP_001';
const stamp='1794958500000';
const metaHeader='sha256='+createHmac('sha256',secret).update(body).digest('hex');
const oaHeader='mac='+createHash('sha256').update(Buffer.from(app)).update(body).update(Buffer.from(stamp)).update(Buffer.from(secret)).digest('hex');
const samples=[
 ['meta-messenger','SYNTHETIC_META_QA_PAGE',metaHeader],
 ['zalo-oa','SYNTHETIC_ZALO_QA_OA',oaHeader],
 ['zalo-bot','SYNTHETIC_ZALO_QA_BOT',secret]
];
function input(provider,installation,header){
 return {marker:SYNTHETIC_MARKER,operation:'SIMULATE_NO_SEND',provider,installation,
  rawBody:body,header,syntheticSecret:secret,syntheticAppId:app,syntheticEventTimestamp:stamp,
  nowMs:now,receiptAtMs:now-1000};
}
for (const [provider,installation,header] of samples){
 test(provider+' synthetic valid fixture returns no real privilege',()=>{
  const r=simulateOneCanary(input(provider,installation,header),new SyntheticReplayMemory());
  assert.equal(r.status,'SYNTHETIC_ACCEPTED_NO_HOSTED_AUTHORITY');
  assert.equal(r.syntheticSignatureVerified,true);
  for(const k of ['actualNativeProviderEventVerified','privateMerchantOwnerVerified','actualStoreBindingVerified','realJwtVerified','replayPersistenceVerified','canReadOrder','canWriteOrder','canSend','canModifyWebhook','canOpenCanary','canDeploy']) assert.equal(r[k],false);
 });
 test(provider+' duplicate event rejected within synthetic memory',()=>{
  const store=new SyntheticReplayMemory(),v=input(provider,installation,header);
  assert.equal(simulateOneCanary(v,store).syntheticSignatureVerified,true);
  const r=simulateOneCanary(v,store);assert.equal(r.status,'SYNTHETIC_DENIED');
  assert.ok(r.reasonCodes.includes('SYNTHETIC_REPLAY_BLOCKED'));
 });
 test(provider+' different installation blocked',()=>{
  const r=simulateOneCanary({...input(provider,installation,header),installation:'SYNTHETIC_WRONG_QA'},new SyntheticReplayMemory());
  assert.ok(r.reasonCodes.includes('SYNTHETIC_INSTALLATION_MISMATCH'));
 });
 test(provider+' wrong secret blocked',()=>{
  const r=simulateOneCanary({...input(provider,installation,header),syntheticSecret:secret+'_modified'},new SyntheticReplayMemory());
  assert.ok(r.reasonCodes.includes('PROVIDER_SPECIFIC_SYNTHETIC_PROOF_INVALID'));
 });
 test(provider+' mismatched raw bytes blocked where signature is payload-bound',()=>{
  const v=input(provider,installation,header);
  const r=simulateOneCanary({...v,rawBody:Buffer.concat([body,Buffer.from(' ')])},new SyntheticReplayMemory());
  if(provider==='zalo-bot')assert.equal(r.status,'SYNTHETIC_ACCEPTED_NO_HOSTED_AUTHORITY');
  else assert.ok(r.reasonCodes.includes('PROVIDER_SPECIFIC_SYNTHETIC_PROOF_INVALID'));
 });
 test(provider+' expired receipt denied',()=>{
  const r=simulateOneCanary({...input(provider,installation,header),receiptAtMs:now-300001},new SyntheticReplayMemory());
  assert.ok(r.reasonCodes.includes('SYNTHETIC_INGRESS_TIME_WINDOW_FAILED'));
 });
 test(provider+' missing isolated replay store blocked',()=>{
  const r=simulateOneCanary(input(provider,installation,header));assert.ok(r.reasonCodes.includes('SYNTHETIC_REPLAY_STORE_REQUIRED'));
 });
 test(provider+' wrong operation denied',()=>{
  const r=simulateOneCanary({...input(provider,installation,header),operation:'SEND_PRODUCTION'},new SyntheticReplayMemory());
  assert.ok(r.reasonCodes.includes('NON_SYNTHETIC_OPERATION_BLOCKED'));assert.equal(r.canSend,false);
 });
 test(provider+' missing synthetic marker denied',()=>{
  const r=simulateOneCanary({...input(provider,installation,header),marker:'REAL_PROVIDER'},new SyntheticReplayMemory());
  assert.ok(r.reasonCodes.includes('SYNTHETIC_MARKER_REQUIRED'));
 });
 test(provider+' empty payload denied',()=>{
  const r=simulateOneCanary({...input(provider,installation,header),rawBody:Buffer.alloc(0)},new SyntheticReplayMemory());
  assert.ok(r.reasonCodes.includes('INVALID_SYNTHETIC_RAW_BYTES'));
 });
 test(provider+' bound to no real Store',()=>{
  const r=simulateOneCanary({...input(provider,installation,header),storeId:'FAKE_CUSTOMER_STORE'},new SyntheticReplayMemory());
  assert.ok(r.reasonCodes.includes('REAL_DATA_OR_CLIENT_STORE_OVERRIDE_FORBIDDEN'));
 });
 test(provider+' no private secret echo',()=>{
  const canary='SECRETS_MUST_NOT_ECHO_'+provider;
  const r=simulateOneCanary({...input(provider,installation,header),syntheticSecret:canary},new SyntheticReplayMemory());
  assert.equal(JSON.stringify(r).includes(canary),false);
 });
}
test('Zalo Bot header-only auth is NOT a signature of payload bytes',()=>{
 const b=input('zalo-bot','SYNTHETIC_ZALO_QA_BOT',secret);
 const r=simulateOneCanary({...b,rawBody:Buffer.from('OTHER_PAYLOAD')},new SyntheticReplayMemory());
 assert.equal(r.syntheticSignatureVerified,true);
 assert.equal(r.actualNativeProviderEventVerified,false);
 assert.equal(r.replayPersistenceVerified,false);
});
test('cross-provider signature confusion blocked',()=>{
 const r=simulateOneCanary({...input('zalo-oa','SYNTHETIC_ZALO_QA_OA',metaHeader)},new SyntheticReplayMemory());
 assert.ok(r.reasonCodes.includes('PROVIDER_SPECIFIC_SYNTHETIC_PROOF_INVALID'));
});
test('unknown provider rejected',()=>assert.ok(simulateOneCanary({...input('zalo-bot','SYNTHETIC_ZALO_QA_BOT',secret),provider:'untrusted'},new SyntheticReplayMemory()).reasonCodes.includes('UNKNOWN_PROVIDER')));
test('canary no source even when private intake claims fully ready',()=>{
 const r=reviewQaInstallationAdmission({provider:'meta-messenger',target:'DEDICATED_DISPOSABLE_QA_INSTALLATION',mode:'PRIVATE_NO_SEND_NO_WRITE',ownerDecision:'PRIVATE_INDEPENDENT_CONSENT_PENDING',
  claims:{merchantOwnerVerified:true,JWTVerified:true,providerSigned:true}});
 assert.equal(r.status,'PRIVATE_AUTHORITY_NO_GO');assert.equal(r.canOpenProviderCanary,false);assert.equal(r.canReadOrder,false);
});
for(const field of ['jwt','appSecret','accessToken','token','pageId','oaId','botToken','providerSignature','merchantOwnerId','tenantId','storeId','customerPhone','rawEvent','webhookUrl'])
 test('reject private credential or client identity '+field,()=>{
  const token='SENSITIVE_PRIVATE_DO_NOT_ECHO_12345';
  const r=reviewQaInstallationAdmission({provider:'zalo-oa',target:'DEDICATED_DISPOSABLE_QA_INSTALLATION',mode:'PRIVATE_NO_SEND_NO_WRITE',ownerDecision:'PRIVATE_INDEPENDENT_CONSENT_PENDING',[field]:token});
  assert.ok(r.reasonCodes.includes('PRIVATE_OR_UNTRUSTED_EVIDENCE_INPUT'));assert.equal(JSON.stringify(r).includes(token),false);
 });
test('missing independent owner scope blocked',()=>assert.ok(reviewQaInstallationAdmission({provider:'zalo-bot'}).reasonCodes.includes('NO_DEDICATED_QA_INSTALLATION')));
test('synthetic event never authorizes real jwt or deploy',()=>{
 const r=simulateOneCanary(input('meta-messenger','SYNTHETIC_META_QA_PAGE',metaHeader),new SyntheticReplayMemory());
 assert.equal(r.canDeploy,false);assert.equal(r.realJwtVerified,false);
});
