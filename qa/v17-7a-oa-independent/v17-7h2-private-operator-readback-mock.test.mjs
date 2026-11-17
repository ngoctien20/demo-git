import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectTwoReadOnlyCalls,expectedReadOnlyMethods}
  from './v17-7h2-private-operator-readback-mock.mjs';
const id='1459232241454765289';
function f(){
 const callList=[];
 const intent={
  mode:'OFFLINE_INJECTED_MOCK_ONLY',channel:'ZALO_BOT',
  installationRef:'installation-qa-0001',expectedBotId:id,
  noSend:true,noMutation:true,noCommerceReadWrite:true,
  transportKind:'OFFLINE_FIXTURE'
 };
 const readback={
  getMe:{ok:true,result:{
   id,account_name:'bot.synthetic123',
   account_type:'BASIC',can_join_groups:false}},
  getWebhookInfo:{ok:true,result:{
   url:'https://example.invalid/existing-qa-callback?opaqueSecretInUrl=DO_NOT_LOG',
   updated_at:1794912000000}}
 };
 const transport={kind:'OFFLINE_FIXTURE',callReadOnly:async name=>{
  callList.push(name);
  if(!expectedReadOnlyMethods.includes(name))throw Error('API NOT ALLOWED');
  return readback[name];
 }};
 return {intent,transport,readback,callList};
}
function locked(x){
 for(const k of ['realBotCreatorOwnerVerified','realProviderSessionVerified',
 'realStoreOwnerVerified','realPrivateIssuerVerified','realOperatorVerified',
 'realReviewerVerified','realOwnerConsentSigned',
 'realProviderSignedWebhookReceived','realHostedRateAndReplayVerified',
 'realStoreABJwtRlsVerified','canSendProvider','canUpdateWebhook',
 'canReadCommerce','canWriteCommerce','canPublish'])
 assert.equal(x[k],false,k);
 assert.equal(x.sourceOnly,true);
}
async function deny(reason,modify,expectedCalls){
 const x=f();modify(x);
 const r=await inspectTwoReadOnlyCalls(x.intent,x.transport);
 assert.equal(r.readbackFixturePassed,false);
 assert.equal(r.reason,reason);locked(r);
 if(expectedCalls)assert.deepEqual(x.callList,expectedCalls);
}
test('two read-only API methods invoked exactly once with mock tokenless transport',async()=>{
 const x=f();const r=await inspectTwoReadOnlyCalls(x.intent,x.transport);
 assert.equal(r.readbackFixturePassed,true);
 assert.deepEqual(x.callList,['getMe','getWebhookInfo']);
 assert.equal(r.requestsExpectedExactlyTwo,true);
 assert.deepEqual(r.readOnlyMethodList,['getMe','getWebhookInfo']);
 assert.equal(r.botIdSha256.length,64);
 assert.equal(r.webhookUrlSha256.length,64);
 assert.equal(r.configuredWebhook,true);
 assert.equal(r.existingWebhookMustRemainUnchanged,true);
 assert.equal(r.noActualProviderNetworkMadeByThisModule,true);
 assert.equal(r.approvedRealProviderCallsExecuted,0);
 assert.equal(r.realOwnerAdminAttestationPresent,false);
 assert.equal(JSON.stringify(r).includes('opaqueSecretInUrl'),false);
 assert.equal(JSON.stringify(r).includes('bot.synthetic123'),false);
 assert.equal(JSON.stringify(r).includes(id),false);
 locked(r);
});
test('webhook not configured, no mutation still allowed in mock',async()=>{
 const x=f();x.readback.getWebhookInfo.result.url='';
 const r=await inspectTwoReadOnlyCalls(x.intent,x.transport);
 assert.equal(r.configuredWebhook,false);
 assert.equal(r.webhookUrlSha256,null);
 locked(r);
});
test('real provider mode must not run network on its own',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.mode='REAL_PROVIDER',[]));
test('real mode missing transport never calls',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.transportKind='REAL_VAULT'));
test('unknown channel no call',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.channel='ZALO_OA'));
test('missing Bot ID pin no call',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.expectedBotId=''));
test('cannot enable outbound send',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.noSend=false));
test('cannot mutate webhook',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.noMutation=false));
test('cannot read Store Commerce',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.noCommerceReadWrite=false));
test('cannot smuggle provider token in intent',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.botToken='secret'));
test('cannot smuggle Customer token in intent',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.jwt='secret'));
test('cannot fake owner admission',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.intent.ownerVerified=true));
test('transport kind not fixture rejected without API calls',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>x.transport.kind='REAL'));
test('no transport function -> no calls',async()=>deny(
 'NO_PRIVATE_TRUSTED_TRANSPORT_OR_BOT_ID_PIN',x=>delete x.transport.callReadOnly));
test('getMe must return expected Bot ID',async()=>deny(
 'GETME_ID_OR_TOKEN_ACCESS_NOT_VERIFIED',x=>x.readback.getMe.result.id='1459232241454765288',['getMe']));
test('getMe api error blocks second call',async()=>deny(
 'GETME_ID_OR_TOKEN_ACCESS_NOT_VERIFIED',x=>x.readback.getMe.ok=false,['getMe']));
test('getMe invalid account string blocks second call',async()=>deny(
 'GETME_ID_OR_TOKEN_ACCESS_NOT_VERIFIED',x=>x.readback.getMe.result.account_name='owner@example.com',['getMe']));
test('getWebhookInfo wrong response blocks success',async()=>deny(
 'GETWEBHOOKINFO_UNTRUSTED_OR_MUTATION_RISK',x=>x.readback.getWebhookInfo.ok=false,['getMe','getWebhookInfo']));
test('getWebhookInfo non-https blocked',async()=>deny(
 'GETWEBHOOKINFO_UNTRUSTED_OR_MUTATION_RISK',x=>x.readback.getWebhookInfo.result.url='http://example.invalid',['getMe','getWebhookInfo']));
test('getWebhookInfo invalid updated_at blocked',async()=>deny(
 'GETWEBHOOKINFO_UNTRUSTED_OR_MUTATION_RISK',x=>x.readback.getWebhookInfo.result.updated_at='today',['getMe','getWebhookInfo']));
test('getWebhookInfo URL oversize blocked',async()=>deny(
 'GETWEBHOOKINFO_UNTRUSTED_OR_MUTATION_RISK',x=>x.readback.getWebhookInfo.result.url='https://example.invalid/'+('X'.repeat(3000)),['getMe','getWebhookInfo']));
test('transport throws secret-containing error, deny must redact it',async()=>{
 const x=f();x.transport.callReadOnly=async()=>{
  throw Error('https://bot-api.zaloplatforms.com/botQA_ONLY_LEAKED_SECRET/getMe');
 };
 const r=await inspectTwoReadOnlyCalls(x.intent,x.transport);
 assert.equal(r.reason,'PRIVATE_PROVIDER_READBACK_FAILED_REDACTED');
 assert.equal(JSON.stringify(r).includes('QA_ONLY_LEAKED_SECRET'),false);
 locked(r);
});
test('webhook transport throws secret-bearing error, deny must redact it',async()=>{
 const x=f();x.transport.callReadOnly=async name=>{
  if(name==='getMe')return x.readback.getMe;
  throw Error('https://bot-api.zaloplatforms.com/botQA_ONLY_LEAKED_SECRET/getWebhookInfo');
 };
 const r=await inspectTwoReadOnlyCalls(x.intent,x.transport);
 assert.equal(r.reason,'PRIVATE_PROVIDER_READBACK_FAILED_REDACTED');
 assert.equal(JSON.stringify(r).includes('QA_ONLY_LEAKED_SECRET'),false);
 locked(r);
});
