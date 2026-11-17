import test from 'node:test';
import assert from 'node:assert/strict';
import {
 runManagedSecretOfflineReadback,describeActualManagedSecretUatPrerequisites,
 recognizedOwnerUiEvidenceSha
} from './v17-7h3-managed-secret-readback-offline.mjs';

const BOT_ID='1459232241454765289';
const TEST_TOKEN='QA_ONLY_v17h3_fake_bot_token_123:fake_test_suffix_789123';
function fixture(hookUrl=''){
 const methods=[],vaultRefs=[];
 const intent={
  mode:'OFFLINE_CLOSED_VAULT_FIXTURE',
  source:'H3_INHERITED_H2_NO_LIVE_CALL',
  channel:'ZALO_BOT',
  installationRef:'installation-qa-0001',
  ownerUiSha256:recognizedOwnerUiEvidenceSha,
  expectedBotId:BOT_ID,
  secretRef:'qa_zalo_bot_tien404_h3_fixture',
  scope:'READ_GETME_GETWEBHOOKINFO_ONLY_NO_SEND',
  noLiveApi:true,noWebhookChange:true,noProviderSend:true,
  noCommerceReadWrite:true,maxReadMethods:2
 };
 const vault={mode:'OFFLINE_MEMORY_VAULT',
   withSecret:async(ref,fn)=>{vaultRefs.push(ref);return fn(TEST_TOKEN)}};
 const transport={mode:'OFFLINE_FIXED_MOCK',request:async req=>{
   methods.push(req);
   if(req.url.endsWith('/getMe')){
      return {status:200,body:{ok:true,result:{
        id:BOT_ID,account_name:'bot.QAfixture123',account_type:'BASIC',
        can_join_groups:false
      }}};
   }
   if(req.url.endsWith('/getWebhookInfo')){
      return {status:200,body:{ok:true,result:{
        url:hookUrl,updated_at:1794912000000
      }}};
   }
   throw Error('UNEXPECTED_METHOD');
 }};
 return {intent,adapters:{mode:'OFFLINE_INJECTED_LOCAL_ONLY',vault,transport},
   methods,vaultRefs};
}
function locked(r){
 for(const key of ['privateVaultAccessProven',
  'independentBotCreatorOwnerVerified','independentlyAuthenticatedOperatorVerified',
  'independentSecurityReviewerVerified','realGetMeCalled',
  'realGetWebhookInfoCalled','realZaloBotOwnerVerified',
  'realStoreAuthorityVerified','realProviderEventReceived',
  'realHostedReplayVerified','canSetWebhook','canDeleteWebhook',
  'canSendMessage','canChangeWorkerRoute','canDeploy',
  'canReadCommerce','canWriteCommerce','canPublish'])
  assert.equal(r[key],false,key);
 assert.equal(r.providerApiCallsMade,0);
 assert.equal(r.allowedActualProviderEvents,0);
 assert.equal(r.sourceOnly,true);
 const v=JSON.stringify(r);
 assert.ok(!v.includes(TEST_TOKEN));
 assert.ok(!v.includes(BOT_ID));
 assert.ok(!v.includes('https://old-webhook.test'));
}
async function deny(reason,change){
 const x=fixture();
 change(x);
 const r=await runManagedSecretOfflineReadback(x.intent,x.adapters);
 assert.equal(r.status,'REAL_OPERATOR_AUTHORITY_NO_GO');
 assert.equal(r.reason,reason);locked(r);
}
test('one vault callback, exactly two POST mocked getMe + getWebhookInfo and no owner grant',async()=>{
 const x=fixture(),r=await runManagedSecretOfflineReadback(x.intent,x.adapters);
 assert.equal(r.status,'SYNTHETIC_VAULT_READBACK_SHAPE_TESTED');
 assert.equal(r.syntheticVaultCallbackCount,1);
 assert.equal(r.syntheticMethodCount,2);
 assert.equal(x.vaultRefs.length,1);
 assert.equal(x.vaultRefs[0],x.intent.secretRef);
 assert.deepEqual(x.methods.map(a=>a.url.split('/').at(-1)),['getMe','getWebhookInfo']);
 assert.deepEqual(x.methods.map(a=>a.method),['POST','POST']);
 assert.deepEqual(x.methods.map(a=>a.retryCount),[0,0]);
 assert.deepEqual(x.methods.map(a=>a.redirect),['error','error']);
 locked(r);
});
test('existing webhook never repointed or returned',async()=>{
 const x=fixture('https://old-webhook.test/private');
 const r=await runManagedSecretOfflineReadback(x.intent,x.adapters);
 assert.equal(r.status,'REAL_OPERATOR_AUTHORITY_NO_GO');
 assert.equal(r.reason,'EXISTING_PROVIDER_WEBHOOK_HARD_STOP');
 assert.equal(r.webhookConfiguredInMock,true);locked(r);
});
test('real managed-secret operator prerequisites do not grant live access',()=>{
 const r=describeActualManagedSecretUatPrerequisites();
 assert.equal(r.privateOperatorRequirements.length,10);
 assert.equal(r.status,'REAL_GETME_PRIVATE_UAT_NOT_AUTHORIZED');locked(r);
});
for(const [field,bad] of [
 ['mode','LIVE'],['source','PROVIDER'],['channel','ZALO_OA'],
 ['installationRef','bad'],['ownerUiSha256','0'.repeat(64)],
 ['expectedBotId','user-bot'],['secretRef','production_token'],
 ['scope','ALL_ACCESS'],['noLiveApi',false],
 ['noWebhookChange',false],['noProviderSend',false],
 ['noCommerceReadWrite',false],['maxReadMethods',3]
]){
 test('refuse unsafe operator input '+field,async()=>deny(
  'BOT_OWNER_AND_PRIVATE_READONLY_SCOPE_NOT_PROVEN',x=>x.intent[field]=bad));
}
for(const field of ['botToken','jwt','authorization','realOwnerVerified',
 'storeId','customerPhone','userEmail','providerAdminSession','approved']){
 test('refuse extra owner self-claim '+field,async()=>deny(
  'BOT_OWNER_AND_PRIVATE_READONLY_SCOPE_NOT_PROVEN',
  x=>x.intent[field]='untrusted'));
}
test('vault adapter missing denied',async()=>deny(
 'PRIVATE_VAULT_OR_OPERATOR_RUNNER_NOT_ADMITTED',x=>delete x.adapters.vault));
test('vault fake URI remote mode denied',async()=>deny(
 'PRIVATE_VAULT_OR_OPERATOR_RUNNER_NOT_ADMITTED',x=>x.adapters.vault.mode='HOSTED_PROD'));
test('transport remote mode denied',async()=>deny(
 'PRIVATE_VAULT_OR_OPERATOR_RUNNER_NOT_ADMITTED',x=>x.adapters.transport.mode='LIVE_PROVIDER'));
test('undefined vault callback denied',async()=>deny(
 'PRIVATE_VAULT_OR_OPERATOR_RUNNER_NOT_ADMITTED',x=>delete x.adapters.vault.withSecret));
test('vault error with token path is redacted',async()=>deny(
 'PRIVATE_VAULT_READBACK_FAILED_REDACTED',
 x=>x.adapters.vault.withSecret=async()=>{throw Error('https://bot-api.zaloplatforms.com/bot'+TEST_TOKEN+'/getMe')}));
test('vault double callback denied',async()=>deny(
 'VAULT_CALLBACK_NOT_EXACTLY_ONCE',
 x=>x.adapters.vault.withSecret=async(ref,cb)=>{await cb(TEST_TOKEN);return cb(TEST_TOKEN)}));
test('vault returns secret instead of callback result denied',async()=>deny(
 'VAULT_CALLBACK_NOT_EXACTLY_ONCE',
 x=>x.adapters.vault.withSecret=async()=>TEST_TOKEN));
test('vault supplies real-like token denied',async()=>deny(
 'MOCK_GETME_OR_WEBHOOKINFO_FAILED',
 x=>x.adapters.vault.withSecret=async(ref,cb)=>cb('real-looking-provider-token')));
test('getMe mock mismatch denied without private Bot Id leakage',async()=>deny(
 'MOCK_GETME_OR_WEBHOOKINFO_FAILED',
 x=>x.adapters.transport.request=async req=>({status:200,body:{
  ok:true,result:{id:'5555555555555555555',account_name:'bot.unrelated01'}
 }})));
test('fake provider network error never exposes raw token URL',async()=>deny(
 'MOCK_GETME_OR_WEBHOOKINFO_FAILED',
 x=>x.adapters.transport.request=async req=>{throw Error('REAL_SECRET_IN_URL '+req.url)}));
