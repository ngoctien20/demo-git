import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectZaloBotApiReadbackFixture,
  requireActualPrivateOwnerAndReadOnlyGetMe
} from './v17-7h1-zalo-owner-readback-offline.mjs';
function fixture(url='https://qa.example.invalid/old-webhook'){
 return {
  mode:'SYNTHETIC_OFFLINE_READBACK_ONLY',source:'OFFLINE_PROVIDER_FIXTURE',
  noNetwork:true,noMutation:true,
  installationRef:'installation-qa-001',expectedBotId:'1459232241454765289',
  getMe:{ok:true,result:{
   id:'1459232241454765289',account_name:'bot.QaFixture1',
   account_type:'BASIC',can_join_groups:false
  }},
  getWebhookInfo:{ok:true,result:{url,updated_at:1794912000000}}
 };
}
function locked(r){
 for(const k of ['realBotTokenValidated','realBotCreatorAdminVerified','realStoreOwnerVerified',
  'realWebhookOwnershipVerified','currentHostedWebhookInfoRead','realMetaPageOwnerVerified',
  'canSetWebhook','canDeleteWebhook','canSendMessage','canOpenPublicRoute',
  'canReadCommerce','canWriteCommerce','canPublish'])assert.equal(r[k],false,k);
}
function deny(reason,mutate){
 const f=fixture();mutate(f);
 const r=inspectZaloBotApiReadbackFixture(f);
 assert.equal(r.readbackShapeCandidate,false);
 assert.equal(r.reason,reason);locked(r);
}
test('valid-shaped existing webhook stays bound and is never returned',()=>{
 const f=fixture();
 const r=inspectZaloBotApiReadbackFixture(f);
 assert.equal(r.readbackShapeCandidate,true);
 assert.equal(r.webhookStatus,'EXISTING_WEBHOOK_DO_NOT_OVERWRITE');
 assert.equal(r.exactProviderWebhookUnchanged,true);
 assert.equal(JSON.stringify(r).includes(f.getWebhookInfo.result.url),false);
 locked(r);
});
test('unconfigured webhook shape is also never authorization',()=>{
 const r=inspectZaloBotApiReadbackFixture(fixture(''));
 assert.equal(r.webhookStatus,'WEBHOOK_UNSET_SYNTHETIC');locked(r);
});
test('GETME with provider-owned token never proves personal identity',()=>{
 const r=requireActualPrivateOwnerAndReadOnlyGetMe({token:'pretend'});
 assert.equal(r.readbackShapeCandidate,false);
 assert.equal(r.requiredMethods.length,5);
 locked(r);
});
test('real mode denied',()=>deny('PROVIDER_READBACK_SOURCE_OR_PIN_MISSING',x=>x.mode='HOSTED_REAL'));
test('user-supplied JSON cannot masquerade as provider readback',()=>deny('PROVIDER_READBACK_SOURCE_OR_PIN_MISSING',x=>x.source='USER_JSON'));
test('network mode denied',()=>deny('PROVIDER_READBACK_SOURCE_OR_PIN_MISSING',x=>x.noNetwork=false));
test('webhook mutation enabled denied',()=>deny('PROVIDER_READBACK_SOURCE_OR_PIN_MISSING',x=>x.noMutation=false));
test('bot ID expected must be numeric',()=>deny('PROVIDER_READBACK_SOURCE_OR_PIN_MISSING',x=>x.expectedBotId='merchant-owned'));
test('missing installation denied',()=>deny('PROVIDER_READBACK_SOURCE_OR_PIN_MISSING',x=>x.installationRef=''));
for(const k of ['botToken','access_token','jwt','storeId','customerName','approved','realOwnerVerified']){
 test('unexpected key '+k+' cannot authorize account readback',()=>deny(
  'PROVIDER_READBACK_SOURCE_OR_PIN_MISSING',x=>x[k]='malicious'));
}
test('wrong getMe bot id denied',()=>deny('GETME_BOT_ID_OR_WEBHOOKINFO_MISMATCH',x=>x.getMe.result.id='other-bot'));
test('getMe failed denied',()=>deny('GETME_BOT_ID_OR_WEBHOOKINFO_MISMATCH',x=>x.getMe.ok=false));
test('getWebhookInfo failed denied',()=>deny('GETME_BOT_ID_OR_WEBHOOKINFO_MISMATCH',x=>x.getWebhookInfo.ok=false));
test('bot account missing denied',()=>deny('GETME_BOT_ID_OR_WEBHOOKINFO_MISMATCH',x=>x.getMe.result.account_name=''));
test('webhook must be HTTPS',()=>deny('WEBHOOK_URL_READBACK_NOT_HTTPS_OR_EMPTY',x=>x.getWebhookInfo.result.url='http://bad.example'));
test('webhook cannot have raw spaces',()=>deny('WEBHOOK_URL_READBACK_NOT_HTTPS_OR_EMPTY',x=>x.getWebhookInfo.result.url='https://evil.example/ foo'));
test('too long webhook URL denied',()=>deny('WEBHOOK_URL_READBACK_NOT_HTTPS_OR_EMPTY',x=>x.getWebhookInfo.result.url='https://x.test/'+'a'.repeat(3000)));
test('do not accept extra webhook owner field',()=>deny('UNTRUSTED_WEBHOOK_INFO_READBACK_FIELDS',x=>x.getWebhookInfo.result.ownerProof=true));
test('do not trust missing provider updatedAt',()=>deny('UNTRUSTED_WEBHOOK_INFO_READBACK_FIELDS',x=>delete x.getWebhookInfo.result.updated_at));
