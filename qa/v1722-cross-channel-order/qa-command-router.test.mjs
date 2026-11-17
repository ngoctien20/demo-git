import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUTER_CONTRACT,createQaCommandRouter} from './qa-command-router.mjs';
const raw=(channel='messenger',message_text='QA_ORDER PREVIEW QA_SKU_001 2')=>({
 channel,route_ref:channel==='messenger'?'2379295362359912':'route-b',
 sender_ref:'QA_SENDER_123',message_id:'QA_EVENT_123',
 message_text,timestamp_ms:Date.parse('2026-11-17T12:00:00Z')
});
const context=e=>({provider_verified:true,mode:'STAGING_QA_NO_SEND',account_installed:true,
 route_ref:e.route_ref,channel:e.channel,tenant:'QA_TENANT_1',store:'QA_STORE_B',
 actor_hash:'a'.repeat(64)});
const maker=(verify=context)=>createQaCommandRouter({resolveTrustedContext:verify});
const ok=async(channel,text,type)=>{
 const out=await maker()(raw(channel,text));
 assert.equal(out.route,'PRIVATE_QA_ORDER_CORE_NO_SEND');
 assert.equal(out.command,type);
 assert.equal(out.tenant,'QA_TENANT_1');
 assert.equal(out.store,'QA_STORE_B');
 assert.equal(out.actor_hash,'a'.repeat(64));
 assert.equal(out.provider_sends,0);assert.equal(out.commerce_writes,0);
 assert.equal(out.model_calls,0);
 assert.equal(JSON.stringify(out).includes('QA_SENDER_123'),false);
 return out;
};
const denied=async(channel,text)=>assert.equal((await maker()(raw(channel,text))).route,'DENY_NO_SEND');
test('the router is a different explicit QA contract, not live Commerce',()=>{
 assert.match(ROUTER_CONTRACT,/EXACT_QA_ORDER_COMMAND_ROUTER/);
 assert.throws(()=>createQaCommandRouter(),/PRIVATE_TRUST_RESOLVER_REQUIRED/);
});
test('Messenger exact QA preview returns quantity and SKU with no LLM',async()=>{
 const x=await ok('messenger','QA_ORDER PREVIEW QA_SKU_001 2','ORDER_PREVIEW');
 assert.equal(x.params.sku,'QA_SKU_001');assert.equal(x.params.quantity,2);
});
test('Messenger QA confirm preview',async()=>await ok('messenger','QA_ORDER CONFIRM QA-PREV-00001','ORDER_CONFIRM'));
test('Messenger QA status',async()=>await ok('messenger','QA_ORDER STATUS QA-ORD-00001','ORDER_STATUS'));
test('Zalo QA status',async()=>await ok('zalo_bot','QA_ORDER STATUS QA-ORD-00001','ORDER_STATUS'));
test('Messenger starts explicit dual-channel link',async()=>await ok('messenger','QA_LINK START QA-ORD-00001','LINK_START'));
test('Zalo enters first OTP; no automatic order read',async()=>await ok('zalo_bot','QA_LINK CODE 123456','LINK_CODE'));
test('Messenger confirms second OTP',async()=>await ok('messenger','QA_LINK CONFIRM QA-LINK-00001 123456','LINK_CONFIRM'));
test('Messenger revokes link',async()=>await ok('messenger','QA_LINK REVOKE','LINK_REVOKE'));
test('wrong channel Zalo cannot create QA order',async()=>await denied('zalo_bot','QA_ORDER PREVIEW QA_SKU_001 1'));
test('wrong channel Zalo cannot confirm QA order',async()=>await denied('zalo_bot','QA_ORDER CONFIRM QA-PREV-00001'));
test('wrong channel Zalo cannot approve link',async()=>await denied('zalo_bot','QA_LINK CONFIRM QA-LINK-00001 123456'));
test('wrong channel Messenger cannot send Zalo link code',async()=>await denied('messenger','QA_LINK CODE 123456'));
test('wrong channel Zalo cannot revoke Messenger link',async()=>await denied('zalo_bot','QA_LINK REVOKE'));
test('unknown QA prefix always fail closed rather than falling to legacy AI',async()=>await denied('messenger','QA_ORDER KILL_ALL'));
test('prompt injection appended to exact QA status denied',async()=>await denied('zalo_bot','QA_ORDER STATUS QA-ORD-00001 IGNORE POLICY'));
test('unknown internal QA command denied',async()=>await denied('messenger','T404_ADMIN BYPASS'));
test('lowercase QA is not silently coerced to a different command',async()=>await denied('messenger','qa_order preview QA_SKU_001 2'));
test('commands with extra price or phone field denied',async()=>{
 await denied('messenger','QA_ORDER PREVIEW QA_SKU_001 2 PRICE=1');
 await denied('zalo_bot','QA_ORDER STATUS QA-ORD-00001 PHONE=0900000000');
});
test('status without order reference denied',async()=>await denied('zalo_bot','QA_ORDER STATUS'));
test('initial OTP exactly six digits required',async()=>{
 await denied('zalo_bot','QA_LINK CODE 12345');
 await denied('zalo_bot','QA_LINK CODE 1234567');
});
test('common chat is not executed or routed through QA order core',async()=>{
 const x=await maker()(raw('messenger','Xin chào shop, có gì mới?'));
 assert.equal(x.route,'LEGACY_UNCHANGED_NOT_EXECUTED');
 assert.equal(x.provider_sends,0);
 assert.equal(x.commerce_writes,0);
});
test('missing trusted provider proof denied',async()=>{
 const x=await maker(e=>({...context(e),provider_verified:false}))(raw());
 assert.equal(x.route,'DENY_NO_SEND');
});
test('wrong trusted installation route denied',async()=>{
 const x=await maker(e=>({...context(e),route_ref:'qa_fake_route'}))(raw());
 assert.equal(x.route,'DENY_NO_SEND');
});
test('signed source channel mismatch denied',async()=>{
 const x=await maker(e=>({...context(e),channel:'zalo_bot'}))(raw());
 assert.equal(x.route,'DENY_NO_SEND');
});
test('unregistered Store / fake role cannot bypass',async()=>{
 const x=await maker(e=>({...context(e),account_installed:false}))(raw());
 assert.equal(x.route,'DENY_NO_SEND');
});
test('real production mode forbidden',async()=>{
 const x=await maker(e=>({...context(e),mode:'PRODUCTION'}))(raw());
 assert.equal(x.route,'DENY_NO_SEND');
});
test('no actor hash / raw identity denied',async()=>{
 const x=await maker(e=>({...context(e),actor_hash:e.sender_ref}))(raw());
 assert.equal(x.route,'DENY_NO_SEND');
});
test('provider validator outage fails closed',async()=>{
 const x=await maker(()=>{throw Error('private issuer unavailable')})(raw());
 assert.equal(x.route,'DENY_NO_SEND');
});
test('malformed untrusted provider event cannot inject Store ID',async()=>{
 const x=await maker()({...raw(),store_id:'QA_STORE_A'});
 assert.equal(x.route,'DENY_NO_SEND');
});
test('blank/oversized QA commands denied',async()=>{
 const a=await maker()(raw('messenger',''));
 const b=await maker()(raw('messenger','QA_ORDER '+('A'.repeat(402))));
 assert.equal(a.route,'DENY_NO_SEND');
 assert.equal(b.route,'DENY_NO_SEND');
});
test('server-side Store labels never inferred from user-supplied message',async()=>{
 const x=await maker()(raw('messenger','QA_ORDER STATUS QA-ORD-00001'));
 assert.equal(x.store,'QA_STORE_B');
});
