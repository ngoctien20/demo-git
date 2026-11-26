import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {admitBotEvent,createInMemoryQaClaim,CONTRACT} from './zalo-bot-replay-gate.mjs';

const NOW=Date.parse('2026-11-17T09:41:19.425Z');
const STAGING=Object.freeze({channel:'zalo_bot',status:'STAGING_ONLY',mode:'NO_SEND',
 readOnly:true,serverResolved:true,installationRef:'QA_ZALO_BOT_INSTALL_A'});
const KEY='QA_V1720_LONG_HMAC_PEPPER_1234567890_NOT_PRODUCTION';
const event=()=>({ok:true,result:{event_name:'message.text.received',message:{
 from:{id:'qa_sender_123456',is_bot:false},
 chat:{id:'qa_chat_123456',chat_type:'PRIVATE'},
 message_id:'qa_message_0001',date:NOW,text:'TIEN404 EXT 03',message_type:'TEXT'
}}});
const clone=()=>structuredClone(event());
function options(override={}){
 return {authenticatedByIngress:true,trustedIngress:'HEADER_SECRET_VERIFIED_SERVER_SIDE',
  installation:STAGING,providerBody:clone(),replayKey:KEY,
  claimAtomic:createInMemoryQaClaim(),nowMs:NOW,...override};
}
const call=override=>admitBotEvent(options(override));
function guarded(result){
 assert.equal(result.canSend,false);
 assert.equal(result.canWrite,false);
 assert.equal(result.external_sends,0);
 assert.equal(result.commerce_writes,0);
 assert.equal(result.model_calls,0);
 assert.equal(result.provider_origin_independently_verified,false);
 assert.equal(result.merchant_store_verified,false);
 assert.equal(result.customer_route_approved,false);
 assert.ok(!JSON.stringify(result).includes('qa_sender_123456'));
 assert.ok(!JSON.stringify(result).includes('qa_chat_123456'));
 assert.ok(!JSON.stringify(result).includes('TIEN404 EXT 03'));
}
test('contract is source-only, not a provider proof',()=>assert.match(CONTRACT,/REPLAY_ADMISSION_CANDIDATE/));
for(const [name,maker] of [
 ['wrapped Zalo Bot provider shape',()=>clone()],
 ['flat event shape',()=>clone().result],
 ['Unicode and punctuation without forward text',()=>{let x=clone();x.result.message.text='Xin chào! 💬 ?';return x;}],
 ['past boundary 5min',()=>{let x=clone();x.result.message.date=NOW-300000;return x;}],
 ['future boundary 2min',()=>{let x=clone();x.result.message.date=NOW+120000;return x;}]
])test('allow '+name,async()=>{
 const result=await call({providerBody:maker()});
 assert.equal(result.status,'ACCEPTED_SHADOW_ONLY');guarded(result);
 assert.equal(result.bot_header_attested,true);
 assert.equal(result.next_action,'CORE_TECHNICAL_SHADOW_ONLY');
 assert.match(result.provider_event_digest,/^[a-f0-9]{16}$/);
});
const bad=[
 ['missing ingress authentication',()=>({authenticatedByIngress:false}),'HEADER_AUTH_NOT_VERIFIED'],
 ['wrong trusted ingress claim',()=>({trustedIngress:'SYNTHETIC_PROVIDER_VERIFIED'}),'HEADER_AUTH_NOT_VERIFIED'],
 ['client JSON pretending header verified',()=>{let x=clone();x.result.message.canSend=true;return {providerBody:x};},'INVALID_MESSAGE_SHAPE_OR_FORGED_SCOPE'],
 ['unsupported OA channel',()=>({installation:{...STAGING,channel:'zalo_oa'}}),'INSTALLATION_NOT_TRUSTED'],
 ['unapproved installation',()=>({installation:{...STAGING,status:'OWNER_APPROVED'}}),'INSTALLATION_NOT_TRUSTED'],
 ['wrong mode',()=>({installation:{...STAGING,mode:'CAN_SEND'}}),'INSTALLATION_NOT_TRUSTED'],
 ['wrong readonly',()=>({installation:{...STAGING,readOnly:false}}),'INSTALLATION_NOT_TRUSTED'],
 ['unresolved route',()=>({installation:{...STAGING,serverResolved:false}}),'INSTALLATION_NOT_TRUSTED'],
 ['missing installation ref',()=>({installation:{...STAGING,installationRef:''}}),'INSTALLATION_NOT_TRUSTED'],
 ['missing pepper',()=>({replayKey:''}),'REPLAY_INFRASTRUCTURE_NOT_READY'],
 ['missing claim function',()=>({claimAtomic:null}),'REPLAY_INFRASTRUCTURE_NOT_READY'],
 ['bad clock',()=>({nowMs:Number.NaN}),'REPLAY_INFRASTRUCTURE_NOT_READY'],
 ['stale six minutes',()=>{let x=clone();x.result.message.date=NOW-360000;return {providerBody:x};},'PROVIDER_EVENT_TIME_OUTSIDE_WINDOW'],
 ['future three minutes',()=>{let x=clone();x.result.message.date=NOW+180000;return {providerBody:x};},'PROVIDER_EVENT_TIME_OUTSIDE_WINDOW'],
 ['seconds timestamp',()=>{let x=clone();x.result.message.date=Math.floor(NOW/1000);return {providerBody:x};},'MISSING_OR_INVALID_PROVIDER_EVENT_TIME'],
 ['missing timestamp',()=>{let x=clone();delete x.result.message.date;return {providerBody:x};},'MISSING_OR_INVALID_PROVIDER_EVENT_TIME'],
 ['date timestamp as string',()=>{let x=clone();x.result.message.date=String(NOW);return {providerBody:x};},'MISSING_OR_INVALID_PROVIDER_EVENT_TIME'],
 ['Bot echo',()=>{let x=clone();x.result.message.from.is_bot=true;return {providerBody:x};},'BOT_ECHO_DENIED'],
 ['alternative Bot echo',()=>{let x=clone();x.result.message.from.isbot=true;return {providerBody:x};},'BOT_ECHO_DENIED'],
 ['group conversation',()=>{let x=clone();x.result.message.chat.chat_type='GROUP';return {providerBody:x};},'NONPRIVATE_EVENT_DENIED'],
 ['image event',()=>{let x=clone();x.result.event_name='message.image.received';return {providerBody:x};},'UNSUPPORTED_EVENT'],
 ['media disguised as text event',()=>{let x=clone();x.result.message.message_type='PHOTO';return {providerBody:x};},'UNSUPPORTED_MESSAGE_TYPE'],
 ['empty text',()=>{let x=clone();x.result.message.text='';return {providerBody:x};},'MESSAGE_TEXT_BOUNDS'],
 ['overlength text',()=>{let x=clone();x.result.message.text='x'.repeat(513);return {providerBody:x};},'MESSAGE_TEXT_BOUNDS'],
 ['empty message ID',()=>{let x=clone();x.result.message.message_id='';return {providerBody:x};},'INVALID_PROVIDER_IDS'],
 ['invalid chat ID',()=>{let x=clone();x.result.message.chat.id='<script>';return {providerBody:x};},'INVALID_PROVIDER_IDS'],
 ['missing sender ID',()=>{let x=clone();delete x.result.message.from.id;return {providerBody:x};},'INVALID_PROVIDER_IDS'],
 ['forged Store scope in root',()=>{let x=clone();x.store_id='QA_STORE_B';return {providerBody:x};},'INVALID_OR_FORGED_BODY'],
 ['forged tenant inside event',()=>{let x=clone();x.result.tenant_id='QA_TENANT_B';return {providerBody:x};},'INVALID_WRAPPED_PROVIDER_EVENT'],
 ['forged bot inside message',()=>{let x=clone();x.result.message.bot_id='QA_BOT_C';return {providerBody:x};},'INVALID_MESSAGE_SHAPE_OR_FORGED_SCOPE'],
 ['forged permissions in sender',()=>{let x=clone();x.result.message.from.permissions=['send'];return {providerBody:x};},'INVALID_MESSAGE_SHAPE_OR_FORGED_SCOPE'],
 ['forged admin in chat',()=>{let x=clone();x.result.message.chat.admin=true;return {providerBody:x};},'INVALID_MESSAGE_SHAPE_OR_FORGED_SCOPE'],
 ['forged body-auth claim',()=>{let x=clone();x.result.authorization='HEADER_SECRET_VERIFIED_SERVER_SIDE';return {providerBody:x};},'INVALID_WRAPPED_PROVIDER_EVENT'],
 ['wrong wrapper ok=false',()=>{let x=clone();x.ok=false;return {providerBody:x};},'INVALID_WRAPPED_PROVIDER_EVENT'],
 ['wrong wrapper extra key',()=>{let x=clone();x.fake=true;return {providerBody:x};},'INVALID_WRAPPED_PROVIDER_EVENT'],
 ['malformed null body',()=>({providerBody:null}),'INVALID_OR_FORGED_BODY'],
 ['oversized event JSON',()=>{let x=clone();x.result.metadata='x'.repeat(9000);return {providerBody:x};},'BODY_SIZE_LIMIT']
];
for(const [name,fn,reason] of bad)test('deny '+name,async()=>{
 const x=fn(),r=(x&&Object.hasOwn(x,'providerBody'))||('authenticatedByIngress' in x||'installation' in x||'trustedIngress' in x||'replayKey' in x||'claimAtomic' in x||'nowMs' in x)
   ? await call(x) : await call({providerBody:x});
 assert.equal(r.status,'DENY',name);assert.equal(r.reason,reason,name);guarded(r);
});
test('identical duplicate is idempotent (not a second decision)',async()=>{
 const claim=createInMemoryQaClaim(),p=options({claimAtomic:claim});
 const first=await admitBotEvent(p),second=await admitBotEvent(p);
 assert.equal(first.status,'ACCEPTED_SHADOW_ONLY');
 assert.equal(second.status,'DUPLICATE_NOOP');guarded(second);
});
for(const [name,mutation] of [
 ['different text',x=>x.result.message.text='MUA F01'],
 ['different chat',x=>x.result.message.chat.id='qa_chat_54321'],
 ['different sender',x=>x.result.message.from.id='qa_sender_54321'],
 ['different timestamp',x=>x.result.message.date=NOW-1000]
])test('same message ID '+name+' is conflicting replay',async()=>{
 const claim=createInMemoryQaClaim();
 const first=await admitBotEvent(options({claimAtomic:claim}));
 const x=clone();mutation(x);
 const second=await admitBotEvent(options({providerBody:x,claimAtomic:claim}));
 assert.equal(first.status,'ACCEPTED_SHADOW_ONLY');
 assert.equal(second.status,'DENY');
 assert.equal(second.reason,'CONFLICTING_REPLAY');guarded(second);
});
test('same message ID under independent trusted installation does not conflict',async()=>{
 const claim=createInMemoryQaClaim();
 const a=await admitBotEvent(options({claimAtomic:claim}));
 const b=await admitBotEvent(options({claimAtomic:claim,installation:{...STAGING,installationRef:'QA_ZALO_BOT_INSTALL_B'}}));
 assert.equal(a.status,'ACCEPTED_SHADOW_ONLY');assert.equal(b.status,'ACCEPTED_SHADOW_ONLY');
 assert.notEqual(a.provider_event_digest,b.provider_event_digest);
});
test('atomic backend outage fails closed without proceeding',async()=>{
 const r=await call({claimAtomic:async()=>{throw Error('DB DOWN')}});
 assert.equal(r.status,'DENY');assert.equal(r.reason,'ATOMIC_REPLAY_SERVICE_UNAVAILABLE');guarded(r);
});
test('unknown backend return fails closed',async()=>{
 const r=await call({claimAtomic:async()=>({status:'CLAIMED'})});
 assert.equal(r.status,'DENY');assert.equal(r.reason,'ATOMIC_REPLAY_SERVICE_UNAVAILABLE');guarded(r);
});
test('concurrent same event: exactly one claimed in a linearizable QA claim mock',async()=>{
 const claim=createInMemoryQaClaim(),p=options({claimAtomic:claim});
 const all=await Promise.all(Array.from({length:25},()=>admitBotEvent(p)));
 assert.equal(all.filter(x=>x.status==='ACCEPTED_SHADOW_ONLY').length,1);
 assert.equal(all.filter(x=>x.status==='DUPLICATE_NOOP').length,24);
 all.forEach(guarded);
});
test('backend claim scope contains no raw PII or text',async()=>{
 let captured;const claim=async input=>{captured=input;return 'CLAIMED';};
 const r=await call({claimAtomic:claim});
 assert.equal(r.status,'ACCEPTED_SHADOW_ONLY');
 assert.deepEqual(Object.keys(captured).sort(),['digest','expiresAtMs','key'].sort());
 assert.match(captured.key,/^[a-f0-9]{64}$/);
 assert.match(captured.digest,/^[a-f0-9]{64}$/);
 assert.equal(captured.expiresAtMs,NOW+86400000);
 assert.equal(JSON.stringify(captured).includes('qa_sender_123456'),false);
 assert.equal(JSON.stringify(captured).includes('TIEN404 EXT 03'),false);
});
test('source has no outbound API or privileged mutation client',()=>{
 const code=readFileSync(new URL('./zalo-bot-replay-gate.mjs',import.meta.url),'utf8');
 for(const token of ['fetch(', 'http.request(', 'axios.', 'sendMessage(', 'createOrder(', 'deleteWebhook(', 'setWebhook('])
   assert.equal(code.includes(token),false);
});
