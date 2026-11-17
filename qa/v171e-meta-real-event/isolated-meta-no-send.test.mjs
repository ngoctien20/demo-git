import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleIsolatedMeta,LIMIT_BYTES,CONTRACT} from './isolated-meta-no-send.mjs';
const pageId='9900000001',tester='9900000011';
const appSecret='QA_PUBLIC_TEST_ONLY_APP_SECRET_123456';
const verifyToken='QA_TEST_ONLY_VERIFY_TOKEN';
const known=()=>{const seen=new Set();return {claimOnce:async key=>{if(seen.has(key))return 'duplicate';seen.add(key);return 'claimed'}}};
const policy=(extra={})=>({
 appSecret,verifyToken,qaPageId:pageId,qaTesterPsid:tester,
 ownerApproval:{qaAppPageIsolated:true,callbackPermissionGranted:true,
 merchantPageControlVerified:true,evidenceReference:'PRIVATE_QA_APPROVAL_001',
 productionAppCallbackUnchanged:true},
 ...known(),...extra
});
const now=Date.parse('2026-11-17T02:00:00Z');
const body=(extra={})=>JSON.stringify({
 object:'page',
 entry:[{id:pageId,messaging:[{sender:{id:tester},recipient:{id:pageId},
 timestamp:now,message:{mid:'QA_SOURCE_EVENT_001',text:'QA test only'}}]}],
 ...extra
});
const sign=raw=>'sha256='+createHmac('sha256',appSecret).update(raw).digest('hex');
function post(b=body(),extra={}){const rawBody=Buffer.from(b);
 return {method:'POST',url:'https://qa.invalid/callback',
  headers:{'x-hub-signature-256':sign(rawBody)},rawBody,...extra};}
async function invoke(req=post(),cfg=policy()){return handleIsolatedMeta(req,cfg,()=>now)}
async function blocked(req,cfg,re){const r=await invoke(req,cfg);assert.equal(r.status,'BLOCKED');if(re)assert.match(r.reason,re);return r}
test('01 contract V1',()=>assert.match(CONTRACT,/V1$/));
test('02 bounds',()=>assert.equal(LIMIT_BYTES,32768));
test('03 missing private policy fails before parsing GET',async()=>blocked({method:'GET',url:'/?hub.mode=subscribe'},{},/PRIVATE_QA/));
test('04 missing app secret denies',async()=>blocked(post(),policy({appSecret:''}),/PRIVATE_QA/));
test('05 missing verify token denies',async()=>blocked(post(),policy({verifyToken:''}),/PRIVATE_QA/));
test('06 missing QA Page denies',async()=>blocked(post(),policy({qaPageId:''}),/PRIVATE_QA/));
test('07 missing QA tester denies',async()=>blocked(post(),policy({qaTesterPsid:''}),/PRIVATE_QA/));
test('08 missing durable claim denies',async()=>blocked(post(),policy({claimOnce:null}),/PRIVATE_QA/));
test('09 missing app isolation flag denies',async()=>blocked(post(),policy({ownerApproval:{...policy().ownerApproval,qaAppPageIsolated:false}}),/PRIVATE_QA/));
test('10 missing explicit callback approval denies',async()=>blocked(post(),policy({ownerApproval:{...policy().ownerApproval,callbackPermissionGranted:false}}),/PRIVATE_QA/));
test('11 missing Page owner signoff denies',async()=>blocked(post(),policy({ownerApproval:{...policy().ownerApproval,merchantPageControlVerified:false}}),/PRIVATE_QA/));
test('12 missing production callback unchanged guard denies',async()=>blocked(post(),policy({ownerApproval:{...policy().ownerApproval,productionAppCallbackUnchanged:false}}),/PRIVATE_QA/));
test('13 missing private evidence pointer denies',async()=>blocked(post(),policy({ownerApproval:{...policy().ownerApproval,evidenceReference:'PUBLIC_ISSUE_123'}}),/PRIVATE_QA/));
test('14 GET valid challenge',async()=>{
 const r=await invoke({method:'GET',url:'https://qa.invalid/?hub.mode=subscribe&hub.challenge=123456&hub.verify_token='+verifyToken});
 assert.equal(r.status,'QA_VERIFY_CHALLENGE_ACCEPTED');assert.equal(r.response_text,'123456');assert.equal(r.http_status,200);
});
test('15 GET invalid token denies',async()=>blocked({method:'GET',url:'/?hub.mode=subscribe&hub.challenge=123&hub.verify_token=wrong'},policy(),/GET_VERIFY/));
test('16 GET invalid mode denies',async()=>blocked({method:'GET',url:'/?hub.mode=wrong&hub.challenge=123&hub.verify_token='+verifyToken},policy(),/GET_VERIFY/));
test('17 GET invalid challenge denies',async()=>blocked({method:'GET',url:'/?hub.mode=subscribe&hub.challenge=<script>&hub.verify_token='+verifyToken},policy(),/GET_VERIFY/));
test('18 unsupported method denies',async()=>{const r=await blocked({method:'PUT',url:'/'});assert.equal(r.http_status,405)});
test('19 valid signed QA text accepted without send',async()=>{
 const r=await invoke();assert.equal(r.status,'SIGNED_QA_EVENT_NO_SEND');assert.equal(r.http_status,200);
 assert.equal(r.signature_matched_configured_app_secret,true);
 assert.equal(r.merchant_owner_proved_independently_by_this_code,false);
 assert.equal(r.accepted_as_real_provider_delivery,false);
});
test('20 no external send write model',async()=>{
 const r=await invoke();assert.equal(r.meta_outbound,0);assert.equal(r.model_calls,0);assert.equal(r.commerce_writes,0);
});
test('21 no raw text or identity in receipt',async()=>{
 const r=await invoke();for(const x of [tester,pageId,appSecret,verifyToken,'QA test only','QA_SOURCE_EVENT_001'])
 assert(!JSON.stringify(r).includes(x));});
test('22 invalid HMAC denied',async()=>blocked(post(body(),{headers:{'x-hub-signature-256':'sha256='+'f'.repeat(64)}}),policy(),/META_HMAC_MISMATCH/));
test('23 missing HMAC denied',async()=>blocked(post(body(),{headers:{}}),policy(),/META_HMAC_MISSING/));
test('24 altered raw body denied',async()=>{let x=post();x.rawBody=Buffer.from(body().replace('QA test only','QA edited'));await blocked(x,policy(),/META_HMAC_MISMATCH/)});
test('25 reject body not raw Buffer',async()=>blocked(post(body(),{rawBody:body()}),policy(),/RAW_BODY_REQUIRED/));
test('26 oversized body denied',async()=>blocked(post(body(),{rawBody:Buffer.alloc(32769)}),policy(),/RAW_BODY_REQUIRED/));
test('27 empty body denied',async()=>blocked(post(body(),{rawBody:Buffer.alloc(0)}),policy(),/RAW_BODY_REQUIRED/));
test('28 signed Store self-claim denied',async()=>blocked(post(body({store_id:'QA_STORE_B'})),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/));
test('29 signed Bot self-claim denied',async()=>blocked(post(body({bot_id:'QA_BOT_B'})),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/));
test('30 signed Tenant self-claim denied',async()=>blocked(post(body({tenant_id:'QA_OTHER'})),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/));
test('31 signed different Page denied',async()=>{const x=JSON.parse(body());x.entry[0].id='9900000002';await blocked(post(JSON.stringify(x)),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/)});
test('32 signed wrong recipient denied',async()=>{const x=JSON.parse(body());x.entry[0].messaging[0].recipient.id='9900000002';await blocked(post(JSON.stringify(x)),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/)});
test('33 signed wrong sender denied',async()=>{const x=JSON.parse(body());x.entry[0].messaging[0].sender.id='9900000013';await blocked(post(JSON.stringify(x)),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/)});
test('34 signed echo denied',async()=>{const x=JSON.parse(body());x.entry[0].messaging[0].message.is_echo=true;await blocked(post(JSON.stringify(x)),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/)});
test('35 signed stale timestamp denied',async()=>{const x=JSON.parse(body());x.entry[0].messaging[0].timestamp=now-3600000;await blocked(post(JSON.stringify(x)),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/)});
test('36 signed future timestamp denied',async()=>{const x=JSON.parse(body());x.entry[0].messaging[0].timestamp=now+3600000;await blocked(post(JSON.stringify(x)),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/)});
test('37 signed no text denied',async()=>{const x=JSON.parse(body());delete x.entry[0].messaging[0].message.text;await blocked(post(JSON.stringify(x)),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/)});
test('38 signed no MID denied',async()=>{const x=JSON.parse(body());delete x.entry[0].messaging[0].message.mid;await blocked(post(JSON.stringify(x)),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/)});
test('39 signed batch >1 denied',async()=>{const x=JSON.parse(body());x.entry.push(x.entry[0]);await blocked(post(JSON.stringify(x)),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/)});
test('40 signed invalid JSON denied',async()=>blocked(post('{invalid-json'),policy(),/SIGNED_EVENT_NOT_ELIGIBLE/));
test('41 duplicate after atomic claim HTTP200 no-send',async()=>{
 const cfg=policy();const x=await invoke(post(),cfg),y=await invoke(post(),cfg);
 assert.equal(x.status,'SIGNED_QA_EVENT_NO_SEND');assert.equal(y.status,'DUPLICATE_IGNORED');
 assert.equal(y.http_status,200);assert.equal(y.meta_outbound,0);
});
test('42 atomic claim error fail-closed 503',async()=>{
 const r=await blocked(post(),policy({claimOnce:async()=>{throw Error('unsafe private DB error')}}),/DURABLE_CLAIM_FAILED/);assert.equal(r.http_status,503);
});
test('43 unexpected claim outcome fails 503',async()=>{
 const r=await blocked(post(),policy({claimOnce:async()=>false}),/DURABLE_CLAIM_NOT_CONFIRMED/);assert.equal(r.http_status,503);
});
test('44 test never provides an HTTP server',async()=>{
 const r=await invoke();assert.equal('server' in r,false);assert.equal('listen' in r,false);
});
test('45 event metadata not accepted as independent owner evidence',async()=>{
 const r=await invoke();assert.equal(r.owner_approval_reference_scope,'PRIVATE_OPERATOR_ATTESTATION');
});
