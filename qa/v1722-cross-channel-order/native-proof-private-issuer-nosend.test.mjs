import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,generateKeyPairSync} from 'node:crypto';
import {createNativeIssuerNoSendQa,createInMemoryQaReplayClaim,F_CONTRACT}
 from './native-proof-private-issuer-nosend.mjs';
import {createCrossChannelQaLab,qaEvent,signQaEnvelope}
 from './cross-channel-qa-core.mjs';

const NOW=Date.parse('2026-11-17T13:30:00.000Z');
const SECRET_A='QA_META_APP_HMAC_KEY_A_IN_MEMORY_ONLY_2026';
const SECRET_B='QA_META_APP_HMAC_KEY_B_IN_MEMORY_ONLY_2026';
const SECRET_ZA='QA_ZALO_BOT_SHARED_HEADER_A_FAKE_ONLY_2026';
const SECRET_ZB='QA_ZALO_BOT_SHARED_HEADER_B_FAKE_ONLY_2026';
const ACTOR_SECRET=Buffer.from('QA_ACTOR_HMAC_TEST_SECRET_NOT_A_REAL_STORE_KEY_2026');

function fixture(options={}){
 const kp=generateKeyPairSync('ed25519');
 const registry=[
  {channel:'messenger',route_ref:'QA_PAGE_A',provider_installation_id:'9900000001',
   tenant:'QA_TENANT_1',store:'QA_STORE_A',
   scope:'SYNTHETIC_ONLY',status:'QA_APPROVED',owner_verified:false},
  {channel:'messenger',route_ref:'QA_PAGE_B',provider_installation_id:'9900000002',
   tenant:'QA_TENANT_1',store:'QA_STORE_B',
   scope:'SYNTHETIC_ONLY',status:'QA_APPROVED',owner_verified:false},
  {channel:'zalo_bot',route_ref:'QA_BOT_A',provider_installation_id:'QA_BOT_A',
   tenant:'QA_TENANT_1',store:'QA_STORE_A',
   scope:'SYNTHETIC_ONLY',status:'QA_APPROVED',owner_verified:false},
  {channel:'zalo_bot',route_ref:'QA_BOT_B',provider_installation_id:'QA_BOT_B',
   tenant:'QA_TENANT_1',store:'QA_STORE_B',
   scope:'SYNTHETIC_ONLY',status:'QA_APPROVED',owner_verified:false}
 ];
 const secrets=new Map([
  ['messenger:QA_PAGE_A',SECRET_A],['messenger:QA_PAGE_B',SECRET_B],
  ['zalo_bot:QA_BOT_A',SECRET_ZA],['zalo_bot:QA_BOT_B',SECRET_ZB]
 ]);
 const config={
  registrations:registry,secretByInstallation:secrets,
  trustedIssuerPrivateKey:kp.privateKey,trustedIssuerPublicKey:kp.publicKey,
  actorHmacSecret:ACTOR_SECRET,issuerId:'QA_PRIVATE_ISSUER',
  keyId:'QA_ED25519_F_V1',claimReplay:createInMemoryQaReplayClaim(),
  now:()=>NOW,...options
 };
 return {qa:createNativeIssuerNoSendQa(config),registry,secrets,config,kp};
}
function meta({
 route_ref='QA_PAGE_A',page='9900000001',sender='QA_OWNER_M_A',
 mid='QA_MSG_00001',text='QA_ORDER PREVIEW QA_SKU_001 2',time=NOW,
 bodyExtra={},messageExtra={},raw=null,secret=null
}={}){
 const body={object:'page',entry:[{id:page,messaging:[{
  sender:{id:sender},recipient:{id:page},timestamp:time,
  message:{mid,text,...messageExtra}
 }]}],...bodyExtra};
 const raw_body=raw??Buffer.from(JSON.stringify(body));
 const key=secret??(route_ref==='QA_PAGE_B'?SECRET_B:SECRET_A);
 return {channel:'messenger',route_ref,raw_body,headers:{
  'x-hub-signature-256':'sha256='+createHmac('sha256',key).update(raw_body).digest('hex')
 }};
}
function zalo({
 route_ref='QA_BOT_A',sender='QA_OWNER_Z_A',mid='QA_ZMSG_00001',
 text='QA_ORDER STATUS QA-ORD-00001',time=NOW,secret=null,
 bodyExtra={},messageExtra={}
}={}){
 const body={ok:true,result:{event_name:'message.text.received',
  message:{from:{id:sender,is_bot:false},chat:{chat_type:'PRIVATE',id:sender},
   message_id:mid,text,date:time,...messageExtra}},...bodyExtra};
 return {channel:'zalo_bot',route_ref,raw_body:Buffer.from(JSON.stringify(body)),
  headers:{'x-bot-api-secret-token':secret??(route_ref==='QA_BOT_B'?SECRET_ZB:SECRET_ZA)}};
}
const allow=out=>{
 assert.equal(out.route,'PRIVATE_QA_ORDER_CORE_NO_SEND');
 assert.equal(out.admission_scope,'SYNTHETIC_ONLY');
 assert.equal(out.issuer_receipt_scope,'SYNTHETIC_ONLY');
 assert.equal(out.provider_protocol_fixture_validated,true);
 assert.equal(out.native_provider_verified,false);
 assert.equal(out.real_store_owner_verified,false);
 assert.equal(out.provider_origin_independently_verified,false);
 assert.equal(out.provider_sends,0);
 assert.equal(out.commerce_writes,0);
 assert.equal(out.model_calls,0);
 assert.equal(out.order_writes,0);
};
const deny=out=>{
 assert.equal(out.route,'DENY_NO_SEND');
 assert.equal(out.native_provider_verified,false);
 assert.equal(out.real_store_owner_verified,false);
 assert.equal(out.provider_sends,0);
 assert.equal(out.commerce_writes,0);
};

test('F01 exact source contract is no-send only',()=>assert.match(F_CONTRACT,/NO_SEND_QA_V1$/));
test('F02 Meta HMAC raw bytes -> private signed receipt -> inherited exact-command route',async()=>{
 const f=fixture(),out=await f.qa.receiveNative(meta());allow(out);
 assert.equal(out.command,'ORDER_PREVIEW');
 assert.equal(out.store,'QA_STORE_A');
 assert.equal(out.tenant,'QA_TENANT_1');
 assert.equal(out.params.sku,'QA_SKU_001');
 assert.equal(out.params.quantity,2);
});
test('F03 distinct Meta Page B maps to Store B without self-claimed store',async()=>{
 const f=fixture(),out=await f.qa.receiveNative(meta({route_ref:'QA_PAGE_B',
  page:'9900000002',sender:'QA_OWNER_M_B'}));allow(out);
 assert.equal(out.store,'QA_STORE_B');
});
test('F04 Zalo Bot shared header -> signed private synthetic identity -> status PLAN only',async()=>{
 const f=fixture(),out=await f.qa.receiveNative(zalo());allow(out);
 assert.equal(out.command,'ORDER_STATUS');
 assert.equal(out.store,'QA_STORE_A');
 assert.equal('order_status' in out,false);
});
test('F05 Zalo Bot Store B stays distinct from Store A',async()=>{
 const f=fixture(),out=await f.qa.receiveNative(zalo({route_ref:'QA_BOT_B',
  sender:'QA_OWNER_Z_B'}));allow(out);
 assert.equal(out.store,'QA_STORE_B');
});
test('F06 missing or invalid Meta HMAC denied before issuance',async()=>{
 const f=fixture();
 const e=meta();e.headers={};deny(await f.qa.receiveNative(e));
 deny(await f.qa.receiveNative(meta({secret:'QA_FAKE_ATTACKER_OTHER_APP_KEY_2026'})));
});
test('F07 changing raw Meta bytes without recomputing signature denied',async()=>{
 const f=fixture(),e=meta();
 e.raw_body=Buffer.from(e.raw_body.toString().replace('QA_SKU_001','QA_SKU_999'));
 deny(await f.qa.receiveNative(e));
});
test('F08 valid HMAC over whitespace bytes is verified on raw bytes rather than reserialized JSON',async()=>{
 const f=fixture(),e=meta();
 const raw=Buffer.from('  '+JSON.stringify(JSON.parse(e.raw_body.toString()))+' \n');
 allow(await f.qa.receiveNative(meta({raw})));
});
test('F09 even HMAC-signed client-owned Store authority is rejected',async()=>{
 const f=fixture();deny(await f.qa.receiveNative(meta({bodyExtra:{store_id:'QA_STORE_B'}})));
});
test('F10 signed Meta recipient/Page mismatch denied',async()=>{
 const f=fixture();deny(await f.qa.receiveNative(meta({page:'9900000002'})));
});
test('F11 signed Meta echo or multi-message batch denied',async()=>{
 const f=fixture();deny(await f.qa.receiveNative(meta({messageExtra:{is_echo:true}})));
 const e=meta(),obj=JSON.parse(e.raw_body.toString());
 obj.entry[0].messaging.push(obj.entry[0].messaging[0]);
 const raw=Buffer.from(JSON.stringify(obj));
 deny(await f.qa.receiveNative(meta({raw})));
});
test('F12 stale or future Meta events denied',async()=>{
 const f=fixture();deny(await f.qa.receiveNative(meta({time:NOW-301000})));
 deny(await f.qa.receiveNative(meta({time:NOW+301000})));
});
test('F13 Zalo Bot shared header missing/wrong denied',async()=>{
 const f=fixture(),e=zalo();e.headers={};
 deny(await f.qa.receiveNative(e));
 deny(await f.qa.receiveNative(zalo({secret:'QA_OTHER_SHARED_HEADER_STOLEN_TEST_2026'})));
});
test('F14 Zalo Bot event from bot or nonprivate chat denied',async()=>{
 const f=fixture();
 deny(await f.qa.receiveNative(zalo({messageExtra:{from:{id:'QA_OWNER_Z_A',is_bot:true}}})));
 deny(await f.qa.receiveNative(zalo({messageExtra:{chat:{id:'QA_OWNER_Z_A',chat_type:'GROUP'}}})));
});
test('F15 Zalo Bot body cannot self-assign Tenant or Store',async()=>{
 const f=fixture();deny(await f.qa.receiveNative(zalo({bodyExtra:{tenant_id:'QA_TENANT_2'}})));
});
test('F16 stale Zalo message denied even if bot header token matches',async()=>{
 const f=fixture();deny(await f.qa.receiveNative(zalo({time:NOW-301000})));
});
test('F17 invalid route / unrelated channel / self-claimed authority envelope denied',async()=>{
 const f=fixture();
 deny(await f.qa.receiveNative({...meta(),route_ref:'QA_UNKNOWN_PAGE'}));
 deny(await f.qa.receiveNative({...zalo(),channel:'zalo_oa'}));
 deny(await f.qa.receiveNative({...meta(),store_id:'QA_STORE_A'}));
});
test('F18 exact replay suppresses duplicate provider processing',async()=>{
 const f=fixture(),e=meta();
 allow(await f.qa.receiveNative(e));
 const second=await f.qa.receiveNative(e);deny(second);
 assert.equal(second.reason,'DUPLICATE_EVENT_NOOP');
 assert.equal(f.qa.getCounters().accepted,1);
 assert.equal(f.qa.getCounters().duplicate,1);
});
test('F19 same event ID with changed signed raw text is conflicting replay',async()=>{
 const f=fixture();
 allow(await f.qa.receiveNative(meta()));
 const e=meta({text:'QA_ORDER PREVIEW QA_SKU_001 3'});
 const out=await f.qa.receiveNative(e);deny(out);
 assert.equal(out.reason,'CONFLICTING_EVENT_REPLAY');
});
test('F20 same actor with fresh signed event ID gets same private actor hash',async()=>{
 const f=fixture(),first=await f.qa.receiveNative(meta());
 const second=await f.qa.receiveNative(meta({mid:'QA_MSG_00002'}));
 allow(first);allow(second);
 assert.equal(first.actor_hash,second.actor_hash);
});
test('F21 different Zalo accounts have different server-keyed actor hashes',async()=>{
 const f=fixture();
 const one=await f.qa.receiveNative(zalo({mid:'QA_ZMSG_00001'}));
 const two=await f.qa.receiveNative(zalo({sender:'QA_ATTACKER_Z_A',mid:'QA_ZMSG_00002'}));
 allow(one);allow(two);assert.notEqual(one.actor_hash,two.actor_hash);
});
test('F22 revoked registry fails closed, no fallback to unauthenticated source',async()=>{
 const f=fixture();
 const registry=f.registry.filter(r=>r.route_ref!=='QA_PAGE_A');
 const r=createNativeIssuerNoSendQa({...f.config,registrations:registry});
 deny(await r.receiveNative(meta()));
});
test('F23 untrusted provider verification secret missing fails during construction',()=>{
 const f=fixture(),secrets=new Map(f.secrets);
 secrets.delete('messenger:QA_PAGE_A');
 assert.throws(()=>createNativeIssuerNoSendQa({...f.config,secretByInstallation:secrets}),
  /MISSING_PRIVATE_TEST_PROTOCOL_KEY/);
});
test('F24 mismatch between private signer and pinned issuer verify key denied',async()=>{
 const f=fixture(),wrong=generateKeyPairSync('ed25519');
 const r=createNativeIssuerNoSendQa({...f.config,trustedIssuerPublicKey:wrong.publicKey});
 const out=await r.receiveNative(meta());deny(out);
 assert.equal(out.reason,'QA_COMMAND_ROUTER_DENIED');
});
test('F25 atomic replay service unavailable fails closed',async()=>{
 const f=fixture();
 const r=createNativeIssuerNoSendQa({...f.config,claimReplay:async()=>{throw Error('offline')}});
 const out=await r.receiveNative(meta());deny(out);
 assert.equal(out.reason,'ATOMIC_REPLAY_CLAIM_NOT_AVAILABLE');
});
test('F26 non QA user message never invokes default legacy Agent',async()=>{
 const f=fixture(),out=await f.qa.receiveNative(meta({text:'Xin chào'}));
 assert.equal(out.route,'LEGACY_UNCHANGED_NOT_EXECUTED');
 assert.equal(out.provider_sends,0);
});
test('F27 callback gives no send, no commerce write, no actual operator authority',()=>{
 const f=fixture();
 assert.throws(()=>f.qa.sendReal(),/REAL_PROVIDER_SEND_DISABLED/);
 assert.throws(()=>f.qa.writeCommerce(),/COMMERCE_WRITE_DISABLED/);
 assert.equal(f.qa.getCounters().real_provider_owners_verified,0);
});
test('F28 same event concurrently through in-memory QA replay has only one admission',async()=>{
 const f=fixture(),e=meta();
 const outcomes=await Promise.all([f.qa.receiveNative(e),f.qa.receiveNative(e)]);
 assert.equal(outcomes.filter(x=>x.route==='PRIVATE_QA_ORDER_CORE_NO_SEND').length,1);
 assert.equal(outcomes.filter(x=>x.reason==='DUPLICATE_EVENT_NOOP').length,1);
});
test('F29 Zalo shared header can verify syntactic envelope without proving message body origin',async()=>{
 const f=fixture();
 const first=await f.qa.receiveNative(zalo());
 const second=await f.qa.receiveNative(zalo({sender:'QA_OTHER_PERSON',mid:'QA_ZMSG_00002'}));
 allow(first);allow(second);
 assert.equal(second.native_provider_verified,false);
});
test('F30 missing raw Buffer cannot be accepted as JSON parse first',async()=>{
 const f=fixture(),e=meta();
 deny(await f.qa.receiveNative({...e,raw_body:e.raw_body.toString('utf8')}));
});
test('F31 unknown sender authorization fields in signed Zalo message rejected',async()=>{
 const f=fixture();
 deny(await f.qa.receiveNative(zalo({messageExtra:{store_id:'QA_STORE_B'}})));
});
test('F32 QA-only source remains non-production and no paid model call',async()=>{
 const f=fixture(),out=await f.qa.receiveNative(meta());
 allow(out);
 assert.equal(f.qa.getCounters().model_calls,0);
 assert.equal(f.qa.getCounters().commerce_writes,0);
});

// Composed SOURCE-ONLY no-send end-to-end UAT: native QA admission THEN the
// previously tested in-memory fake Commerce order contract. Mapping is fixed by
// the TEST HARNESS, NOT a production adapter, customer link or real order writer.
test('F33 composed Messenger QA order -> two-code Zalo status, other account DENIED (in memory ONLY)',async()=>{
 const f=fixture(),lab=createCrossChannelQaLab({now:()=>NOW,code:(()=>{let x=111110;return ()=>++x;})()});
 let id=0;
 async function step(env){
  const admitted=await f.qa.receiveNative(env);
  allow(admitted);
  const body=JSON.parse(env.raw_body.toString());
  const sender=env.channel==='messenger'?body.entry[0].messaging[0].sender.id:body.result.message.from.id;
  const text=env.channel==='messenger'?body.entry[0].messaging[0].message.text:body.result.message.text;
  const inst=env.route_ref;
  assert.equal(admitted.store,inst.endsWith('_B')?'QA_STORE_B':'QA_STORE_A');
  const synthetic=qaEvent({
   channel:env.channel,installation_ref:inst,sender_ref:sender,
   event_id:'QA_EVT_'+String(++id).padStart(5,'0'),text,received_at:new Date(NOW).toISOString()
  });
  const result=lab.receive(signQaEnvelope(synthetic));
  assert.equal(result.provider_sends,0);
  assert.equal(result.commerce_writes,0);
  assert.equal(result.model_calls,0);
  return result;
 }
 let seq=1;
 const m=(text,sender='QA_OWNER_M_A',route='QA_PAGE_A',page='9900000001')=>
  meta({text,sender,route_ref:route,page,mid:'QA_MID_'+String(++seq).padStart(5,'0')});
 const z=(text,sender='QA_OWNER_Z_A',route='QA_BOT_A')=>
  zalo({text,sender,route_ref:route,mid:'QA_ZMID_'+String(++seq).padStart(5,'0')});
 const preview=await step(m('QA_ORDER PREVIEW QA_SKU_001 2'));
 assert.equal(preview.status,'PREVIEW_REQUIRED_CONFIRM');
 const order=await step(m('QA_ORDER CONFIRM '+preview.preview_ref));
 assert.equal(order.status,'QA_ORDER_CREATED');
 const noLink=await step(z('QA_ORDER STATUS '+order.order_ref));
 assert.equal(noLink.status,'DENIED');
 const challenge=await step(m('QA_LINK START '+order.order_ref));
 assert.equal(challenge.status,'LINK_START_MESSENGER');
 const second=await step(z('QA_LINK CODE '+challenge.messenger_code));
 assert.equal(second.status,'LINK_AWAIT_MESSENGER_CONFIRM');
 const linked=await step(m('QA_LINK CONFIRM '+challenge.link_ref+' '+second.zalo_confirmation_code));
 assert.equal(linked.status,'LINK_APPROVED');
 const good=await step(z('QA_ORDER STATUS '+order.order_ref));
 assert.equal(good.status,'ORDER_STATUS');
 assert.equal(good.total_vnd,318000);
 const intruder=await step(z('QA_ORDER STATUS '+order.order_ref,'QA_INTRUDER_Z_A'));
 assert.equal(intruder.status,'DENIED');
 const otherMeta=await step(m('QA_ORDER STATUS '+order.order_ref,'QA_INTRUDER_M_A'));
 assert.equal(otherMeta.status,'DENIED');
 const otherStore=await step(z('QA_ORDER STATUS '+order.order_ref,'QA_OTHER_Z_B','QA_BOT_B'));
 assert.equal(otherStore.status,'DENIED');
 assert.equal(lab.inspection().orders,1);
 assert.equal(lab.inspection().provider_sends,0);
 assert.equal(lab.inspection().commerce_writes,0);
 assert.equal(lab.inspection().live_orders,0);
});
