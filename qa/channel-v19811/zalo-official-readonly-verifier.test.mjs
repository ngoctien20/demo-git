import assert from 'node:assert/strict';
import {validateReadOnlyZaloResponses} from './zalo-official-readonly-verifier.mjs';
const BOT='111111111111111111';
const url='https://qa-webhook.example.test/zalo/receipt-v19811';
const fixture=()=>({
 expected:{botId:BOT,webhookUrl:url},
 me:{ok:true,result:{id:BOT,account_name:'mock.qa.bot'}},
 hook:{ok:true,result:{url,updated_at:1795170000000}}
});
const cases=[
 ['matching getMe and webhook',x=>{},'READONLY_PROVIDER_TOKEN_AND_WEBHOOK_MATCH'],
 ['wrong bot id',x=>x.me.result.id='222222222222222222','NO_GO'],
 ['webhook changed',x=>x.hook.result.url='https://other.example.test/','NO_GO'],
 ['missing getMe result',x=>x.me={ok:false},'NO_GO'],
 ['missing webhook result',x=>x.hook={ok:false},'NO_GO'],
 ['getMe non-string id',x=>x.me.result.id=123,'NO_GO'],
 ['getMe short id',x=>x.me.result.id='12345','NO_GO'],
 ['getMe extra response irrelevant',x=>x.me.result.username='mock', 'READONLY_PROVIDER_TOKEN_AND_WEBHOOK_MATCH'],
 ['id claimed in event but mismatch',x=>x.expected.botId='222222222222222222','NO_GO'],
 ['URL expected HTTP',x=>x.expected.webhookUrl='http://qa-webhook.example.test/zalo/receipt-v19811','NO_GO'],
 ['URL expected URL pathless with missing slash',x=>x.expected.webhookUrl='https://qa-webhook.example.test','NO_GO'],
 ['URL query secret rejected',x=>x.expected.webhookUrl=url+'?token=secret','NO_GO'],
 ['URL fragment rejected',x=>x.expected.webhookUrl=url+'#x','NO_GO'],
 ['URL includes basic auth rejected',x=>x.expected.webhookUrl='https://user:pass@qa-webhook.example.test/x','NO_GO'],
 ['URL protocol javascript rejected',x=>x.expected.webhookUrl='javascript:alert(1)','NO_GO'],
 ['URL wrong host',x=>x.hook.result.url='https://wrong.example.test/zalo/receipt-v19811','NO_GO'],
 ['URL trailing slash mismatch',x=>x.hook.result.url=url+'/','NO_GO'],
 ['URL case different mismatch',x=>x.hook.result.url=url.toUpperCase(),'NO_GO'],
 ['getMe false even correct ID',x=>x.me.ok=false,'NO_GO'],
 ['getWebhookInfo false even URL correct',x=>x.hook.ok=false,'NO_GO'],
 ['getMe ID empty',x=>x.me.result.id='','NO_GO'],
 ['getWebhookInfo URL empty',x=>x.hook.result.url='','NO_GO'],
 ['expected extra object field',x=>x.expected.provenance='REAL','NO_GO'],
 ['missing expected botId',x=>delete x.expected.botId,'NO_GO'],
 ['missing expected webhookUrl',x=>delete x.expected.webhookUrl,'NO_GO'],
 ['expected webhook URL numeric',x=>x.expected.webhookUrl=13,'NO_GO'],
 ['bot numeric format bad',x=>x.expected.botId='QA_BOT','NO_GO'],
 ['getMe null response',x=>x.me=null,'NO_GO'],
 ['webhook null response',x=>x.hook=null,'NO_GO'],
 ['missing webhook result.url',x=>delete x.hook.result.url,'NO_GO'],
 ['getMe and webhook both false',x=>{x.me.ok=false;x.hook.ok=false},'NO_GO'],
];
let passed=0;
for(const [label,mutate,status] of cases){
 const x=fixture();mutate(x);
 const r=validateReadOnlyZaloResponses(x.expected,x.me,x.hook);
 assert.equal(r.decision,status,label);
 assert.equal(r.merchantConsentVerified,false,label);
 assert.equal(r.hostedCatalogAuthorized,false,label);
 assert.equal(r.canSend,false,label);
 assert.equal(r.canWrite,false,label);
 assert.equal(r.providerSends,0,label);
 assert.equal(r.productionReady,false,label);
 passed++;
}
console.log('TIEN404_V19811_ZALO_READONLY_API_SHAPE_PASS='+passed);
console.log('REAL_BOT_TOKEN_USED_BY_CI=false');
console.log('REAL_PROVIDER_API_CALLED_BY_CI=false');
