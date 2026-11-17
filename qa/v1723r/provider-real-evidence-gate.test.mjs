import assert from 'node:assert/strict';
import test from 'node:test';
import {GETME_OBSERVATION,WEBHOOK_OBSERVATION,PRIVATE_EVENT_REQUIRED,evaluateCurrentBotForDedicatedCanary,evaluateOneRealEventAdmission} from './provider-real-evidence-gate.mjs';
test('real webhook info is existing staging, not isolated QA',()=>{
 const x=evaluateCurrentBotForDedicatedCanary();
 assert.equal(x.status,'DEDICATED_QA_BOT_NO_GO');
 assert.equal(x.observedReadOnlyProviderChecks,true);
 assert.equal(x.matchesExistingStagingWebhook,true);
 assert.ok(x.reasons.includes('BOT_ALREADY_BOUND_TO_EXISTING_STAGING_WEBHOOK'));
 assert.ok(x.reasons.includes('READONLY_GETME_AND_WEBHOOK_INFO_NOT_A_PROVIDER_EVENT'));
 for(const k of ['canReassignWebhook','canPollGetUpdates','canReceiveRealEvent','canSend','canReadOrders','canWriteOrders','canOpenHostedIngress','canAdmitRealJwt','canDeploy'])assert.equal(x[k],false);
});
test('self-reported no-send counters not independently audited',()=>{
 const x=evaluateCurrentBotForDedicatedCanary();assert.equal(x.providerLogsIndependentlyChecked,false);assert.equal(x.independentMerchantOwnerProven,false);
});
for(const [prefix,base,key] of [['GETME',GETME_OBSERVATION,'getMe'],['WEBHOOK',WEBHOOK_OBSERVATION,'webhook']]){
 for(const field of Object.keys(base))test('drift '+prefix+' '+field,()=>{
  const x=evaluateCurrentBotForDedicatedCanary({[key]:{...base,[field]:'FORGED'}});
  assert.ok(x.reasons.includes(prefix+'_DRIFT_'+field.toUpperCase()));assert.equal(x.observedReadOnlyProviderChecks,false);assert.equal(x.canReceiveRealEvent,false);
 });
 test('missing '+prefix+' observation rejected',()=>{
  const x=evaluateCurrentBotForDedicatedCanary({[key]:null});
  assert.ok(x.reasons.includes(prefix+'_INVALID_SHAPE'));assert.equal(x.canReceiveRealEvent,false);
 });
 test('private extra field '+prefix+' redacted',()=>{
  const value='SECRET_NEVER_ECHO_1234',x=evaluateCurrentBotForDedicatedCanary({[key]:{...base,token:value}});
  assert.ok(x.reasons.includes(prefix+'_EXTRA_OR_PRIVATE_FIELD'));assert.ok(!JSON.stringify(x).includes(value));
 });
}
test('changing callback metadata cannot create QA authority',()=>{
 const x=evaluateCurrentBotForDedicatedCanary({webhook:{...WEBHOOK_OBSERVATION,matchesExistingStagingWebhook:false,matchesWebhookTest:true}});
 assert.equal(x.canReceiveRealEvent,false);assert.equal(x.dedicatedQaInstallationProven,false);
});
test('default real event request denied',()=>{
 const x=evaluateOneRealEventAdmission();assert.equal(x.status,'PRIVATE_REAL_EVENT_NO_GO');assert.equal(x.claimedChecksCount,0);assert.equal(x.authenticatedEventReceived,false);
});
test('all caller-provided green flags still NO_GO',()=>{
 const x=evaluateOneRealEventAdmission({channel:'zalo-bot',mode:'PRIVATE_NO_SEND_NO_WRITE',claims:Object.fromEntries(PRIVATE_EVENT_REQUIRED.map(k=>[k,true]))});
 assert.equal(x.claimedChecksCount,PRIVATE_EVENT_REQUIRED.length);assert.ok(x.reasons.includes('INDEPENDENT_PROVIDER_OWNER_SIGNED_RECEIPT_NOT_CONNECTED'));
 for(const k of ['canEnrollQaBot','canChangeWebhook','canAcceptPrivateEvent','canSend','canReadOrders','canUseRealJwt','canDeploy'])assert.equal(x[k],false);
});
for(const k of PRIVATE_EVENT_REQUIRED)test('missing '+k+' still denies',()=>{
 const claims=Object.fromEntries(PRIVATE_EVENT_REQUIRED.map(y=>[y,true]));claims[k]=false;
 assert.ok(evaluateOneRealEventAdmission({channel:'zalo-bot',mode:'PRIVATE_NO_SEND_NO_WRITE',claims}).reasons.includes('EVIDENCE_MISSING_'+k.toUpperCase()));
});
test('wrong channel and send scope rejected',()=>{
 const x=evaluateOneRealEventAdmission({channel:'zalo-oa',mode:'PRODUCTION_SEND'});
 assert.ok(x.reasons.includes('ZALO_BOT_DEDICATED_QA_SCOPE_REQUIRED'));assert.ok(x.reasons.includes('NO_SEND_NO_WRITE_MODE_REQUIRED'));
});
for(const k of ['token','botToken','secretToken','jwt','authorization','rawEvent','webhookUrl','providerHeader','customerPhone','orderId','storeId','userId','merchantOwnerId','privateKey','signature'])
 test('private '+k+' never accepted or echoed',()=>{
  const value='NEVER_PRINT_SENSITIVE_CANARY';
  const x=evaluateOneRealEventAdmission({channel:'zalo-bot',mode:'PRIVATE_NO_SEND_NO_WRITE',[k]:value});
  assert.ok(x.reasons.includes('SENSITIVE_DATA_MUST_REMAIN_IN_PRIVATE_VAULT'));
  assert.ok(!JSON.stringify(x).includes(value));assert.equal(x.canAcceptPrivateEvent,false);
 });
test('client owner claim does not establish authority',()=>{
 const x=evaluateOneRealEventAdmission({channel:'zalo-bot',mode:'PRIVATE_NO_SEND_NO_WRITE',claims:{merchantOwnerId:'FORGED',...Object.fromEntries(PRIVATE_EVENT_REQUIRED.map(k=>[k,true]))}});
 assert.ok(x.reasons.includes('CLIENT_SUPPLIED_AUTHORITY_REJECTED'));assert.equal(x.canEnrollQaBot,false);
});
test('no durable replay accepted from source-only packet',()=>{
 assert.equal(evaluateOneRealEventAdmission({channel:'zalo-bot',mode:'PRIVATE_NO_SEND_NO_WRITE'}).durableReplayVerified,false);
});
