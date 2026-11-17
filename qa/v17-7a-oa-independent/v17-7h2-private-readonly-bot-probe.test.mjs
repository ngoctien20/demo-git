import test from 'node:test';
import assert from 'node:assert/strict';
import {runSyntheticPrivateBotReadback,getRealReadOnlyProbeRunbook} from './v17-7h2-private-readonly-bot-probe.mjs';

const token='QA_ONLY_private_test_token_123456:only_mock_bytes_12345';
const botId='1459232241454765289';
function fixture(webhook=''){
 const calls=[];
 const input={mode:'OFFLINE_MOCK_READONLY',noSend:true,noMutation:true,
    noCustomerRows:true,expectedBotId:botId,qaOnlyTestToken:token};
 const me={ok:true,result:{id:botId,account_name:'bot.TIen404QaTest',
   account_type:'BASIC',can_join_groups:false}};
 const info={ok:true,result:{url:webhook,updated_at:1794912000000}};
 const transport={mode:'OFFLINE_FIXED_MOCK',request:async q=>{
   calls.push(q);
   return {status:200,body:q.url.endsWith('/getMe')?me:info};
 }};
 return {input,transport,calls,me,info};
}
const safe = r=>{
 for(const key of ['realProviderAccountReadbackVerified','realBotOwnerVerified',
  'realMerchantStoreOwnerVerified','independentOperatorVerified',
  'realStoreJwtRlsVerified','canChangeWebhook','canRegisterProviderCallback',
  'canSendMessage','canReadCommerce','canWriteOrder','canPublish'])
   assert.equal(r[key],false,key);
 assert.equal(r.syntheticTransportOnly,true);
 assert.ok(!JSON.stringify(r).includes(token),'never print token');
 assert.ok(!JSON.stringify(r).includes(botId),'never print bot ID');
};
const reject=async (reason,fn)=>{
 const f=fixture();fn(f);
 const result=await runSyntheticPrivateBotReadback(f.input,f.transport);
 assert.equal(result.status,'NO_GO',JSON.stringify(result));
 assert.equal(result.reason,reason);
 safe(result);
};
test('getMe then getWebhookInfo called with exactly 2 mocked POST requests',async()=>{
 const f=fixture();
 const res=await runSyntheticPrivateBotReadback(f.input,f.transport);
 assert.equal(res.status,'SYNTHETIC_READBACK_ONLY');
 assert.equal(res.syntheticGetMeMatched,true);
 assert.equal(res.providerMethodsChecked,2);
 assert.deepEqual(f.calls.map(x=>x.url.slice(x.url.lastIndexOf('/')+1)),['getMe','getWebhookInfo']);
 for(const c of f.calls){
   assert.equal(c.method,'POST');assert.equal(c.body,'{}');
   assert.equal(c.redirect,'error');assert.equal(c.retryCount,0);
   assert.equal(c.timeoutMs,5000);
   assert.equal(new URL(c.url).hostname,'bot-api.zaloplatforms.com');
 }
 safe(res);
});
test('existing webhook stops even when matching Bot Token fixture',async()=>{
 const f=fixture('https://old-qa-provider.example.invalid/ingress');
 const res=await runSyntheticPrivateBotReadback(f.input,f.transport);
 assert.equal(res.status,'NO_GO');
 assert.equal(res.reason,'EXISTING_WEBHOOK_DO_NOT_REPOINT');
 assert.equal(res.syntheticWebhookConfigured,true);
 assert.ok(!JSON.stringify(res).includes(f.info.result.url));
 safe(res);
});
test('private real runbook is not an authorization grant',()=>{
 const p=getRealReadOnlyProbeRunbook();
 assert.equal(p.status,'REAL_OPERATOR_PRIVATE_RUNNER_NOT_ADMITTED');
 assert.equal(p.requirements.length,8);safe(p);
});
test('live mode denied',async()=>reject('PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY',f=>f.input.mode='PRIVATE_REAL'));
test('real-looking token denied',async()=>reject('PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY',f=>f.input.qaOnlyTestToken='123456:real_secret_example'));
test('noSend flag false denied',async()=>reject('PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY',f=>f.input.noSend=false));
test('noMutation flag false denied',async()=>reject('PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY',f=>f.input.noMutation=false));
test('noCustomerRows flag false denied',async()=>reject('PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY',f=>f.input.noCustomerRows=false));
test('transport missing denied',async()=>{
 const f=fixture();
 const r=await runSyntheticPrivateBotReadback(f.input,null);
 assert.equal(r.reason,'PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY');safe(r);
});
test('transport must be isolated synthetic',async()=>reject('PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY',f=>f.transport.mode='REMOTE'));
test('bot Id must be pinned',async()=>reject('PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY',f=>f.input.expectedBotId='bot.hello'));
for(const k of ['rawResponse','merchantName','token','jwt','password','customer','storeId','verifiedOwner','operatorConsent']){
 test('unexpected input '+k+' denied',async()=>reject('PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY',f=>f.input[k]='malicious'));
}
test('exception with token URL leaks nothing',async()=>reject('PRIVATE_READBACK_TRANSPORT_FAILED_REDACTED',f=>f.transport.request=async()=>{throw Error('https://bot-api.zaloplatforms.com/bot'+token+'/getMe')}));
test('getMe HTTP failure denied',async()=>reject('BOT_READBACK_FAILED_OR_UNTRUSTED_RESPONSE',f=>f.transport.request=async()=>({status:401,body:{ok:false}})));
test('getMe ok:false denied',async()=>reject('BOT_READBACK_FAILED_OR_UNTRUSTED_RESPONSE',f=>f.me.ok=false));
test('getWebhookInfo ok:false denied',async()=>reject('BOT_READBACK_FAILED_OR_UNTRUSTED_RESPONSE',f=>f.info.ok=false));
test('getWebhookInfo response > 8KiB denied',async()=>reject('BOT_READBACK_RESPONSE_TOO_LARGE',f=>f.info.result.padded='x'.repeat(9000)));
test('getMe mismatched Bot ID denied',async()=>reject('GETME_BOT_ID_MISMATCH',f=>f.me.result.id='2555555555555555000'));
test('getMe malformed bot account denied',async()=>reject('GETME_BOT_ID_MISMATCH',f=>f.me.result.account_name='not-a-bot'));
test('Webhook URL plain HTTP denied',async()=>reject('WEBHOOK_INFO_UNTRUSTED',f=>f.info.result.url='http://not-secure.example'));
test('Webhook URL with whitespace denied',async()=>reject('WEBHOOK_INFO_UNTRUSTED',f=>f.info.result.url='https://foo.example/x y'));
test('Webhook URL overlong denied',async()=>reject('WEBHOOK_INFO_UNTRUSTED',f=>f.info.result.url='https://foo.example/'+'x'.repeat(3000)));
test('Webhook missing timestamp denied',async()=>reject('WEBHOOK_INFO_UNTRUSTED',f=>delete f.info.result.updated_at));
test('response never logs Bot account_name',async()=>{
 const f=fixture();
 const r=await runSyntheticPrivateBotReadback(f.input,f.transport);
 assert.ok(!JSON.stringify(r).includes(f.me.result.account_name));safe(r);
});
