import test from 'node:test';
import assert from 'node:assert/strict';
import {issueWebsiteSession,verifyWebsiteSession,processWebsiteMessage,CONTRACT} from './website-session-core.mjs';
const now=Date.parse('2026-11-17T03:00:00Z');
const SECRET='QA_FICTIONAL_ONLY_WEBSITE_HMAC_SECRET_MIN_32_BYTES';
const cfg={issuer:'t404-qa-issuer',audience:'t404-website-chat',activeKid:'qa_v1',keyring:{qa_v1:SECRET},qaMode:true};
const originA='https://qa-shop-a.example.invalid',originB='https://qa-shop-b.example.invalid';
const instA='QA_WEB_WIDGET_A',instB='QA_WEB_WIDGET_B';
const mkBinding=(store='A',over={})=>({
 channel:'website',installation_ref:store==='B'?instB:instA,origin:store==='B'?originB:originA,
 tenant_ref:'QA_TENANT_1',store_ref:'QA_STORE_'+store,bot_ref:'QA_BOT_'+store,
 bot_version:'QA_BOT_'+store+'_V1',prompt_version:'QA_PROMPT_'+store+'_V1',
 knowledge_version:'QA_KNOWLEDGE_'+store+'_V1',policy_version:'QA_POLICY_V172',
 approval_scope:'SYNTHETIC_ONLY',owner_authority_verified:false,read_only:true,
 tool_allowlist:'catalog_read',subscription_active:true,store_paused:false,status:'QA_APPROVED',...over
});
let registry;
const reset=()=>registry={ [instA]:mkBinding('A'),[instB]:mkBinding('B')};
reset();
const resolve=async({channel,installation_ref})=>channel==='website'?registry[installation_ref]:null;
const stableRandom=()=>Buffer.alloc(24,17);
async function issue(inst=instA,orig=originA,over={}){
 return issueWebsiteSession({installationRef:inst,origin:orig,resolveBinding:resolve,config:cfg,now,random:stableRandom,...over});
}
async function verified(token,over={}){
 return verifyWebsiteSession({token,origin:originA,installationRef:instA,resolveBinding:resolve,config:cfg,now,...over});
}
function catalog({tenant_ref,store_ref,sku}){
 const b=store_ref==='QA_STORE_B'?259000:159000;
 return {tenant_ref,store_ref,sku,price_vnd:b,stock:store_ref==='QA_STORE_B'?2:5};
}
function atom(){
 const keys=new Set();
 return async key=>{if(keys.has(key))return 'duplicate';keys.add(key);return 'claimed';};
}
async function message(inst=instA,orig=originA,reqOver={},callOver={}){
 const minted=await issue(inst,orig);assert.equal(minted.status,'SESSION_ISSUED');
 return processWebsiteMessage({request:{token:minted.token,origin:orig,installationRef:inst,
  eventId:'QA_MSG_0001',text:'Cho xem giá QA_SKU_001',requestedTool:'catalog_read',...reqOver},
  config:cfg,resolveBinding:resolve,claimMessage:atom(),readQaCatalog:catalog,now,...callOver});
}
test('01 contract has QA marker',()=>assert.match(CONTRACT,/WEBSITE_SESSION_QA_V1/));
test('02 mint A',async()=>assert.equal((await issue()).status,'SESSION_ISSUED'));
test('03 issued session is time bounded',async()=>assert.equal((await issue()).expires_in_sec,300));
test('04 no customer identity asserted on mint',async()=>assert.equal((await issue()).customer_identity_verified,false));
test('05 no hosted RLS asserted on mint',async()=>assert.equal((await issue()).hosted_rls_verified,false));
test('06 returns token with fixed alg no browser-controlled alg',async()=>assert.match((await issue()).token,/^t404s1\.qa_v1\.[\w-]+\.[\w-]+$/));
test('07 token contains no plaintext secret',async()=>assert(!JSON.stringify(await issue()).includes(SECRET)));
test('08 valid token verifies',async()=>assert.equal((await verified((await issue()).token)).status,'SESSION_VERIFIED'));
test('09 expected A store',async()=>assert.equal((await verified((await issue()).token)).context.store_ref,'QA_STORE_A'));
test('10 expected Bot A',async()=>assert.equal((await verified((await issue()).token)).context.bot_ref,'QA_BOT_A'));
test('11 prompt version bound',async()=>assert.equal((await verified((await issue()).token)).context.prompt_version,'QA_PROMPT_A_V1'));
test('12 knowledge version bound',async()=>assert.equal((await verified((await issue()).token)).context.knowledge_version,'QA_KNOWLEDGE_A_V1'));
test('13 policy version bound',async()=>assert.equal((await verified((await issue()).token)).context.policy_version,'QA_POLICY_V172'));
test('14 origin mismatch forbidden',async()=>assert.equal((await verified((await issue()).token,{origin:originB})).status,'DENY'));
test('15 cross-widget installation mismatch forbidden',async()=>assert.equal((await verified((await issue()).token,{installationRef:instB})).status,'DENY'));
test('16 missing token denies',async()=>assert.equal((await verified('')).status,'DENY'));
test('17 truncated token denies',async()=>assert.equal((await verified('foo')).status,'DENY'));
test('18 token payload tamper denies',async()=>{let t=(await issue()).token.split('.');t[2]=t[2].slice(0,-1)+(t[2].endsWith('a')?'b':'a');assert.equal((await verified(t.join('.'))).status,'DENY')});
test('19 signature tamper denies',async()=>{let t=(await issue()).token.split('.');t[3]=t[3].slice(0,-1)+(t[3].endsWith('a')?'b':'a');assert.equal((await verified(t.join('.'))).status,'DENY')});
test('20 unknown key kid denies',async()=>{let t=(await issue()).token.split('.');t[1]='fake_kid';assert.equal((await verified(t.join('.'))).status,'DENY')});
test('21 forged alg none rejected',async()=>assert.equal((await verified('none.'+(await issue()).token)).status,'DENY'));
test('22 expires at exactly 300s',async()=>assert.equal((await verified((await issue()).token,{now:now+300000})).status,'DENY'));
test('23 valid at 299s',async()=>assert.equal((await verified((await issue()).token,{now:now+299000})).status,'SESSION_VERIFIED'));
test('24 origin requires HTTPS',async()=>assert.equal((await issue(instA,'http://qa-shop-a.example.invalid')).status,'DENY'));
test('25 origin with pathname rejected',async()=>assert.equal((await issue(instA,originA+'/test')).status,'DENY'));
test('26 origin with query rejected',async()=>assert.equal((await issue(instA,originA+'/?x=1')).status,'DENY'));
test('27 unknown website installation denied',async()=>assert.equal((await issue('QA_WEB_UNKNOWN')).status,'DENY'));
test('28 cannot mint B token from A origin',async()=>assert.equal((await issue(instB,originA)).status,'DENY'));
test('29 B widget independently minted',async()=>assert.equal((await issue(instB,originB)).status,'SESSION_ISSUED'));
test('30 B token binds B store',async()=>assert.equal((await verified((await issue(instB,originB)).token,{origin:originB,installationRef:instB})).context.store_ref,'QA_STORE_B'));
test('31 B token cannot access A',async()=>assert.equal((await verified((await issue(instB,originB)).token)).status,'DENY'));
test('32 revoked session rejected on verify',async()=>{const t=(await issue()).token;registry[instA]=mkBinding('A',{status:'REVOKED'});assert.equal((await verified(t)).status,'DENY');reset()});
test('33 paused store denies mint',async()=>{registry[instA]=mkBinding('A',{store_paused:true});assert.equal((await issue()).status,'DENY');reset()});
test('34 subscription expired denies mint',async()=>{registry[instA]=mkBinding('A',{subscription_active:false});assert.equal((await issue()).status,'DENY');reset()});
test('35 changed Bot version revokes old token',async()=>{const t=(await issue()).token;registry[instA]=mkBinding('A',{bot_version:'QA_BOT_A_V2'});assert.equal((await verified(t)).status,'DENY');reset()});
test('36 changed knowledge version revokes old token',async()=>{const t=(await issue()).token;registry[instA]=mkBinding('A',{knowledge_version:'QA_KNOWLEDGE_A_V2'});assert.equal((await verified(t)).status,'DENY');reset()});
test('37 changed Store binding revokes old token',async()=>{const t=(await issue()).token;registry[instA]=mkBinding('A',{store_ref:'QA_STORE_B'});assert.equal((await verified(t)).status,'DENY');reset()});
test('38 QA fixture cannot claim independently verified owner',async()=>{registry[instA]=mkBinding('A',{owner_authority_verified:true});assert.equal((await issue()).status,'DENY');reset()});
test('39 QA fixture cannot grant production scope',async()=>{registry[instA]=mkBinding('A',{approval_scope:'OWNER_APPROVED'});assert.equal((await issue()).status,'DENY');reset()});
test('40 production mode not granted by QA fixture',async()=>assert.equal((await issue(instA,originA,{config:{...cfg,qaMode:false}})).status,'DENY'));
test('41 signing secret missing fails closed',async()=>assert.equal((await issue(instA,originA,{config:{...cfg,keyring:{qa_v1:''}}})).status,'DENY'));
test('42 registry error 503',async()=>{const r=await issue(instA,originA,{resolveBinding:async()=>{throw Error('private')}});assert.equal(r.http_status,503)});
test('43 invalid random denied',async()=>{const r=await issue(instA,originA,{random:()=>Buffer.alloc(1)});assert.equal(r.status,'DENY')});
test('44 normal catalog QA reply',async()=>assert.equal((await message()).status,'QA_CATALOG_REPLY_PREPARED'));
test('45 QA A expected catalog price',async()=>assert.equal((await message()).price_vnd,159000));
test('46 QA B expected catalog price',async()=>assert.equal((await message(instB,originB)).price_vnd,259000));
test('47 wrong cross-store catalog result blocked',async()=>{
 const r=await message(instA,originA,{}, {readQaCatalog:async()=>({tenant_ref:'QA_TENANT_1',store_ref:'QA_STORE_B',sku:'QA_SKU_001',price_vnd:259000,stock:2})});
 assert.equal(r.status,'DENY');
});
test('48 cross tenant catalog result blocked',async()=>{
 const r=await message(instA,originA,{}, {readQaCatalog:async()=>({tenant_ref:'QA_TENANT_2',store_ref:'QA_STORE_A',price_vnd:1,stock:1})});
 assert.equal(r.status,'DENY');
});
test('49 create_order denied',async()=>assert.equal((await message(instA,originA,{requestedTool:'create_order'})).status,'DENY'));
test('50 order_read denied',async()=>assert.equal((await message(instA,originA,{requestedTool:'order_read'})).status,'DENY'));
test('51 update_price denied',async()=>assert.equal((await message(instA,originA,{requestedTool:'update_price'})).status,'DENY'));
test('52 client supplied store_id denied',async()=>assert.equal((await message(instA,originA,{store_id:'QA_STORE_B'})).status,'DENY'));
test('53 client supplied tenant_id denied',async()=>assert.equal((await message(instA,originA,{tenant_id:'QA_TENANT_2'})).status,'DENY'));
test('54 client supplied verified boolean denied',async()=>assert.equal((await message(instA,originA,{verified:true})).status,'DENY'));
test('55 client supplied bot id denied',async()=>assert.equal((await message(instA,originA,{bot_id:'QA_BOT_B'})).status,'DENY'));
test('56 long text denied',async()=>assert.equal((await message(instA,originA,{text:'X'.repeat(501)})).status,'DENY'));
test('57 empty text denied',async()=>assert.equal((await message(instA,originA,{text:''})).status,'DENY'));
test('58 invalid event ID denied',async()=>assert.equal((await message(instA,originA,{eventId:''})).status,'DENY'));
test('59 duplicate only acknowledged once without repeating tool call',async()=>{
 const token=(await issue()).token,check=atom();let count=0;
 const request={token,origin:originA,installationRef:instA,eventId:'QA_MSG_001',text:'QA_SKU_001',requestedTool:'catalog_read'};
 const args={request,config:cfg,resolveBinding:resolve,claimMessage:check,readQaCatalog:async x=>{count++;return catalog(x)},now};
 const a=await processWebsiteMessage(args),b=await processWebsiteMessage(args);
 assert.equal(a.status,'QA_CATALOG_REPLY_PREPARED');assert.equal(b.status,'DUPLICATE_IGNORED');assert.equal(count,1);
});
test('60 atomic claim failure rejected',async()=>assert.equal((await message(instA,originA,{}, {claimMessage:async()=>{throw Error('PRIVATE')}})).status,'DENY'));
test('61 atomic claim unspecified rejected',async()=>assert.equal((await message(instA,originA,{}, {claimMessage:async()=>undefined})).status,'DENY'));
test('62 no default claim provider rejected',async()=>assert.equal((await message(instA,originA,{}, {claimMessage:null})).status,'DENY'));
test('63 real model and commerce calls zero',async()=>{
 const r=await message();assert.equal(r.model_calls,0);assert.equal(r.commerce_writes,0);assert.equal(r.provider_sends,0);
});
test('64 reply clearly identified as QA',async()=>assert.match((await message()).reply,/Ví dụ QA/));
test('65 no real cross-channel identity claim',async()=>assert.equal((await message()).customer_identity_verified,false));
test('66 bot version preserved in runtime',async()=>assert.equal((await message()).bot_version,'QA_BOT_A_V1'));
test('67 token only uses fake fixture origin',async()=>assert(!JSON.stringify(await issue()).includes('ngoctien20.app.n8n.cloud')));
test('68 no customer PII in tokens',async()=>{
 const t=(await issue()).token;assert(!t.includes('phone'));assert(!t.includes('customer_name'));
});
test('69 script has no network listener',()=>assert.equal(typeof issueWebsiteSession,'function'));

test('70 QA binding read_only false cannot mint session',async()=>{
 registry[instA]=mkBinding('A',{read_only:false});
 assert.equal((await issue()).status,'DENY');reset();
});
test('71 QA binding status Owner Approved not allowed in synthetic lane',async()=>{
 registry[instA]=mkBinding('A',{status:'OWNER_APPROVED'});
 assert.equal((await issue()).status,'DENY');reset();
});
test('72 QA binding tool allowlist extra privilege cannot mint',async()=>{
 registry[instA]=mkBinding('A',{tool_allowlist:'catalog_read,create_order'});
 assert.equal((await issue()).status,'DENY');reset();
});
test('73 private issuer requires independently owner-approved status in prod config',async()=>{
 registry[instA]=mkBinding('A',{approval_scope:'OWNER_APPROVED',owner_authority_verified:true,status:'OWNER_APPROVED'});
 const r=await issue(instA,originA,{config:{...cfg,qaMode:false}});
 assert.equal(r.status,'SESSION_ISSUED');assert.equal(r.customer_identity_verified,false);
 reset();
});
test('74 production-mode message cannot access QA catalog or write',async()=>{
 registry[instA]=mkBinding('A',{approval_scope:'OWNER_APPROVED',owner_authority_verified:true,status:'OWNER_APPROVED'});
 const realCfg={...cfg,qaMode:false};
 const sess=await issue(instA,originA,{config:realCfg});
 const r=await processWebsiteMessage({request:{token:sess.token,origin:originA,installationRef:instA,eventId:'QA_MSG_099',text:'QA_SKU_001',requestedTool:'catalog_read'},
   config:realCfg,resolveBinding:resolve,claimMessage:atom(),readQaCatalog:catalog,now});
 assert.equal(r.status,'DENY');assert.equal(r.reason,'HOSTED_STORE_AND_DURABLE_CLAIM_NOT_CERTIFIED');reset();
});
test('75 production-mode owner flag cannot authorize an unapproved owner status',async()=>{
 registry[instA]=mkBinding('A',{approval_scope:'OWNER_APPROVED',owner_authority_verified:true,status:'QA_APPROVED'});
 assert.equal((await issue(instA,originA,{config:{...cfg,qaMode:false}})).status,'DENY');reset();
});
