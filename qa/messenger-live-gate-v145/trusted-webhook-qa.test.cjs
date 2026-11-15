'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {createTrustedQaGate}=require('./trusted-webhook-qa.cjs');
const NOW=Date.parse('2026-11-16T08:00:00Z');
const PAGE_A='700000000000001',PAGE_B='700000000000002',PAGE_C='800000000000003';
const PSID_A='900000000000011',PSID_B='900000000000022';
const SECRET=Buffer.from('V14.5 fake QA secret; not used in any production environment.');
const registry=[
 {pageId:PAGE_A,tenantId:'TENANT_QA_1',storeId:'STORE_QA_A',active:true},
 {pageId:PAGE_B,tenantId:'TENANT_QA_1',storeId:'STORE_QA_B',active:true},
 {pageId:PAGE_C,tenantId:'TENANT_QA_2',storeId:'STORE_QA_C',active:true}
];
let serial=1000;
const msg=(opts={})=>({sender:{id:PSID_A},recipient:{id:PAGE_A},timestamp:NOW,
 message:{mid:'mid.QA.'+(++serial),text:'Báo giá áo trắng'},...opts});
const payload=(entryId=PAGE_A,messages=[msg()])=>({object:'page',entry:[{id:entryId,messaging:messages}]});
function signed(object,secret=SECRET){const rawBody=Buffer.from(JSON.stringify(object),'utf8');return {
 rawBody,signature:'sha256='+createHmac('sha256',secret).update(rawBody).digest('hex')
};}
function create(opts={}){let current=NOW;const gate=createTrustedQaGate({
 mode:'OFFLINE_SIGNED_FIXTURE_ONLY',appSecret:SECRET,pageRegistry:registry,
 now:()=>current,...opts});return {gate,advance:n=>current+=n};}
function blocked(fn,code){assert.throws(fn,e=>e.code===code);}

test('01 require explicit offline-only configuration',()=>blocked(()=>createTrustedQaGate(), 'QA_GATE_CONFIG_INVALID'));
test('02 forbids live mode even with valid fixture secret',()=>blocked(()=>createTrustedQaGate({mode:'LIVE',appSecret:SECRET,pageRegistry:registry}), 'QA_GATE_CONFIG_INVALID'));
test('03 rejects invalid secret strength',()=>blocked(()=>createTrustedQaGate({mode:'OFFLINE_SIGNED_FIXTURE_ONLY',appSecret:Buffer.from('123'),pageRegistry:registry}),'QA_GATE_CONFIG_INVALID'));
test('04 page registry cannot duplicate IDs',()=>blocked(()=>create({pageRegistry:[registry[0],registry[0]]}), 'QA_PAGE_REGISTRY_INVALID'));
test('05 signed raw bytes route correct Store A',()=>{const {gate}=create();const r=gate.ingress(signed(payload()));assert.equal(r.status,'SIGNED_FIXTURE_ACCEPTED_NO_SEND');assert.equal(r.events[0].storeId,'STORE_QA_A');assert.equal(r.signaturesVerified,true);});
test('06 same tenant Store B remains separately bound',()=>{const {gate}=create();const r=gate.ingress(signed(payload(PAGE_B,[msg({recipient:{id:PAGE_B}})])));assert.equal(r.events[0].storeId,'STORE_QA_B');assert.equal(r.events[0].tenantId,'TENANT_QA_1');});
test('07 cross-tenant Store C stays independent',()=>{const {gate}=create();const r=gate.ingress(signed(payload(PAGE_C,[msg({recipient:{id:PAGE_C}})])));assert.equal(r.events[0].tenantId,'TENANT_QA_2');});
test('08 fails without signature',()=>blocked(()=>create().gate.ingress({...signed(payload()),signature:undefined}),'WEBHOOK_SIGNATURE_MISSING_OR_MALFORMED'));
test('09 fails malformed SHA256',()=>blocked(()=>create().gate.ingress({...signed(payload()),signature:'sha1=abc'}),'WEBHOOK_SIGNATURE_MISSING_OR_MALFORMED'));
test('10 wrong secret cannot validate signed body',()=>blocked(()=>create().gate.ingress(signed(payload(),Buffer.from('Another mock secret; never production secret.'))),'WEBHOOK_SIGNATURE_INVALID'));
test('11 body tamper after signing gets rejected',()=>{const x=signed(payload());x.rawBody=Buffer.from(x.rawBody.toString().replace('Báo giá','Đặt hàng'));blocked(()=>create().gate.ingress(x),'WEBHOOK_SIGNATURE_INVALID');});
test('12 JSON reserialization breaks exact raw body MAC',()=>{const x=signed(payload());const parsed=JSON.parse(x.rawBody.toString());const y=Buffer.from(JSON.stringify(parsed,null,2));blocked(()=>create().gate.ingress({rawBody:y,signature:x.signature}),'WEBHOOK_SIGNATURE_INVALID');});
test('13 require Buffer raw bytes rather than structured object',()=>blocked(()=>create().gate.ingress({rawBody:payload(),signature:'sha256='+'a'.repeat(64)}),'WEBHOOK_RAW_BYTES_REQUIRED'));
test('14 signed invalid JSON cannot be parsed',()=>{const rawBody=Buffer.from('not a json');const signature='sha256='+createHmac('sha256',SECRET).update(rawBody).digest('hex');blocked(()=>create().gate.ingress({rawBody,signature}),'WEBHOOK_JSON_INVALID');});
test('15 non Page object refused even with valid signature',()=>blocked(()=>create().gate.ingress(signed({...payload(),object:'user'})),'WEBHOOK_PAGE_BATCH_INVALID'));
test('16 unknown Page refused even with valid Meta-like signature',()=>blocked(()=>create().gate.ingress(signed(payload('999999999999999'))),'PAGE_BINDING_NOT_FOUND_OR_INACTIVE'));
test('17 disabled Page refused',()=>{const gate=create({pageRegistry:[{...registry[0],active:false}]}).gate;blocked(()=>gate.ingress(signed(payload())),'PAGE_BINDING_NOT_FOUND_OR_INACTIVE');});
test('18 reject wrong recipient Page',()=>blocked(()=>create().gate.ingress(signed(payload(PAGE_A,[msg({recipient:{id:PAGE_B}})]))),'WEBHOOK_EVENT_SCOPE_OR_TIME_INVALID'));
test('19 reject invalid sender ID',()=>blocked(()=>create().gate.ingress(signed(payload(PAGE_A,[msg({sender:{id:'fake'}})]))),'WEBHOOK_EVENT_SCOPE_OR_TIME_INVALID'));
test('20 reject absent event timestamp',()=>blocked(()=>create().gate.ingress(signed(payload(PAGE_A,[msg({timestamp:undefined})]))),'WEBHOOK_EVENT_SCOPE_OR_TIME_INVALID'));
test('21 reject future more than 2 minutes',()=>blocked(()=>create().gate.ingress(signed(payload(PAGE_A,[msg({timestamp:NOW+125000})]))),'WEBHOOK_EVENT_SCOPE_OR_TIME_INVALID'));
test('22 reject extremely old webhook',()=>blocked(()=>create().gate.ingress(signed(payload(PAGE_A,[msg({timestamp:NOW-37*3600000})]))),'WEBHOOK_EVENT_SCOPE_OR_TIME_INVALID'));
test('23 echo notification ignored without reply',()=>{const {gate}=create();const r=gate.ingress(signed(payload(PAGE_A,[msg({message:{is_echo:true,mid:'mid.echo.01'}})])));assert.equal(r.acceptedEvents,0);assert.equal(r.ignoredEchoEvents,1);});
test('24 only supported text events enter QA gate',()=>blocked(()=>create().gate.ingress(signed(payload(PAGE_A,[msg({message:{mid:'mid.postback.01',attachment:{}}})]))),'WEBHOOK_TEXT_EVENT_UNSUPPORTED'));
test('25 missing message MID refused',()=>blocked(()=>create().gate.ingress(signed(payload(PAGE_A,[msg({message:{text:'hello'}})]))),'WEBHOOK_TEXT_EVENT_UNSUPPORTED'));
test('26 store_id injected at event level rejected',()=>blocked(()=>create().gate.ingress(signed(payload(PAGE_A,[msg({storeId:'STORE_QA_B'})]))),'WEBHOOK_CLIENT_SCOPE_OVERRIDE'));
test('27 tenantId injected in message body rejected',()=>blocked(()=>create().gate.ingress(signed(payload(PAGE_A,[msg({message:{mid:'mid.foo.01',text:'hello',tenantId:'TENANT_QA_2'}})]))),'WEBHOOK_CLIENT_SCOPE_OVERRIDE'));
test('28 replay exact Page, MID, sender and content is deduplicated',()=>{const {gate}=create(),p=signed(payload());const a=gate.ingress(p),b=gate.ingress(p);assert.equal(a.acceptedEvents,1);assert.equal(b.acceptedEvents,0);assert.equal(b.duplicateEvents,1);});
test('29 reused MID with altered sender fails closed',()=>{const {gate}=create(),a=msg();gate.ingress(signed(payload(PAGE_A,[a])));blocked(()=>gate.ingress(signed(payload(PAGE_A,[{...a,sender:{id:PSID_B}}]))),'WEBHOOK_MID_PAYLOAD_CONFLICT');});
test('30 reused MID with changed text fails closed',()=>{const {gate}=create(),a=msg();gate.ingress(signed(payload(PAGE_A,[a])));blocked(()=>gate.ingress(signed(payload(PAGE_A,[{...a,message:{...a.message,text:'Đặt 2 cái'}}]))),'WEBHOOK_MID_PAYLOAD_CONFLICT');});
test('31 identical MID on another Page is independent',()=>{const {gate}=create(),a=msg();gate.ingress(signed(payload(PAGE_A,[a])));const b={...a,recipient:{id:PAGE_B}};const r=gate.ingress(signed(payload(PAGE_B,[b])));assert.equal(r.acceptedEvents,1);assert.equal(r.events[0].storeId,'STORE_QA_B');});
test('32 duplicate MID within same batch denied, no partial replay state',()=>{const {gate}=create(),a=msg();blocked(()=>gate.ingress(signed(payload(PAGE_A,[a,a]))),'WEBHOOK_BATCH_DUPLICATE_MID');assert.equal(gate.inspect().replayKeyCount,0);});
test('33 mixed good and unsupported signed events do not commit partial replay',()=>{const {gate}=create();blocked(()=>gate.ingress(signed(payload(PAGE_A,[msg(),msg({message:{text:'missing mid'}})]))),'WEBHOOK_TEXT_EVENT_UNSUPPORTED');assert.equal(gate.inspect().replayKeyCount,0);});
test('34 replay cache bounded capacity fails closed',()=>{const {gate}=create({maxReplayKeys:2});gate.ingress(signed(payload(PAGE_A,[msg(),msg()])));blocked(()=>gate.ingress(signed(payload(PAGE_A,[msg()]))),'WEBHOOK_REPLAY_CAPACITY_EXHAUSTED');assert.equal(gate.inspect().replayKeyCount,2);});
test('35 TTL eviction allows synthetic test replay after expiry',()=>{const {gate,advance}=create({ttlMs:60000});const r=signed(payload());gate.ingress(r);advance(65000);const c=gate.ingress(r);assert.equal(c.acceptedEvents,1);});
test('36 no real secret or PSID leaks in result text',()=>{const {gate}=create(),p=signed(payload());const out=JSON.stringify(gate.ingress(p));assert.equal(out.includes(PSID_A),false);assert.equal(out.includes(SECRET.toString()),false);assert.equal(out.includes('Báo giá áo trắng'),false);});
test('37 no Page registry bypass through client store input',()=>{const {gate}=create();const p=payload();p.store_id='STORE_QA_B';const r=gate.ingress(signed(p));assert.equal(r.events[0].storeId,'STORE_QA_A');});
test('38 batch with two different pages resolves each against server binding',()=>{const {gate}=create();const p={object:'page',entry:[{id:PAGE_A,messaging:[msg()]},{id:PAGE_B,messaging:[msg({recipient:{id:PAGE_B}})]}]};const r=gate.ingress(signed(p));assert.deepEqual(r.events.map(x=>x.storeId),['STORE_QA_A','STORE_QA_B']);});
test('39 defaults to no-SEND even after successful signature',()=>{const {gate}=create();gate.ingress(signed(payload()));const x=gate.inspect();assert.equal(x.realMessengerMessagesSent,0);assert.equal(x.hostedWrites,0);assert.equal(x.canPublish,false);});
test('40 approval gate remains blocked when evidence missing',()=>{const r=create().gate.readiness();assert.equal(r.permitSend,false);assert.ok(r.pending.includes('pagesMessagingGranted'));});
test('41 booleans even all true cannot self authorize live send',()=>{const g=create().gate;const checks=g.readiness().pending;const input=Object.fromEntries(checks.map(x=>[x,true]));const r=g.readiness(input);assert.deepEqual(r.pending,[]);assert.equal(r.permitSend,false);assert.equal(r.permitWebhookPublish,false);});
test('42 no actual Page token, JWT Auth or real Meta permission check is claimed',()=>{const x=create().gate.inspect();assert.equal(x.hasActualMetaPageToken,false);assert.equal(x.hasActualJWTBinding,false);assert.equal(x.realPagePermissionsChecked,false);});
test('43 malformed Page empty batch refused',()=>blocked(()=>create().gate.ingress(signed({object:'page',entry:[]})),'WEBHOOK_PAGE_BATCH_INVALID'));
test('44 more than 20 entries refused',()=>blocked(()=>create().gate.ingress(signed({object:'page',entry:Array(21).fill({id:PAGE_A,messaging:[msg()]})})),'WEBHOOK_PAGE_BATCH_INVALID'));
test('45 oversized raw body fails closed before JSON',()=>{const {gate}=create();const rawBody=Buffer.alloc(512001);blocked(()=>gate.ingress({rawBody,signature:'sha256='+'0'.repeat(64)}),'WEBHOOK_RAW_BYTES_REQUIRED');});
