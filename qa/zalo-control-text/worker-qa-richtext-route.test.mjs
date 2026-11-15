import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {qaRichTextRoute} from './worker-qa-richtext-route.mjs';
const now=Date.parse('2026-11-15T06:30:00Z');
const testId='TIEN404_SHOP_B_RICH_V135_20261115';
function db(){
 const claims=new Map();
 return {claims,prepare(sql){
  return {bind(...args){return {
   async first(){
    if(sql.startsWith('SELECT state FROM outbound_claims'))return claims.has(args[0])?{state:claims.get(args[0])}:null;
    throw Error('unexpected SQL SELECT');
   },
   async run(){
    if(sql.startsWith('INSERT INTO outbound_claims')){
      if(claims.has(args[0]))return {meta:{changes:0}};
      claims.set(args[0],args[2]);return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE outbound_claims')){claims.set(args[1],args[0]);return {meta:{changes:1}};}
    throw Error('unexpected SQL mutation');
   }
  }}};
 }};
}
function env(extras={}){
 return {ZALO_SEND_ENABLED:'false',ZALO_OWNER_APPROVAL_EXPIRES:'2026-11-20T13:17:32Z',
 GATEWAY_AUTH_KEY:'unit-qa-secret',ZALO_BOT_TOKEN:'fake-bot-token',ZALO_OWNER_CHAT_ID:'shop-b-owner-qa',
 REPLAY_DB:db(),...extras};
}
function request(route,{case_id,chat_id='shop-b-owner-qa',test_id=testId}={},auth='Bearer unit-qa-secret',ct='application/json'){
 const body=route.endsWith('/send')?{case_id,chat_id,test_id}:{chat_id,test_id};
 return new Request('https://qa.example.test'+route,{
  method:'POST',headers:{authorization:auth,'content-type':ct},body:JSON.stringify(body)
 });
}
const pathPre='/v1/qa-richtext/preflight',pathSend='/v1/qa-richtext/send';
function provider(){
 const calls=[];
 return {calls,fetch:async(url,init)=>{
  calls.push({op:url.endsWith('/getMe')?'getMe':'sendMessage',payload:JSON.parse(init.body)});
  return {ok:true,status:200,json:async()=>({ok:true,result:url.endsWith('/getMe')?{id:'bot-qa'}:{message_id:'msg-fixture'}})};
 }};
}
async function invoke(e,route,args,fetchImpl,at=now,auth){
 const r=await qaRichTextRoute(request(route,args,auth),e,route,at,fetchImpl);
 return {status:r?.status,body:await r?.json()};
}
test('preflight accepts verified exact recipient; zero sends',async()=>{
 const e=env(),p=provider();
 const r=await invoke(e,pathPre,{},p.fetch);
 assert.equal(r.status,200);assert.equal(r.body.owner_verified,true);
 assert.equal(r.body.external_sends,0);assert.equal(r.body.global_send_enabled,false);
 assert.deepEqual(r.body.already_claimed,[]);assert.deepEqual(p.calls.map(x=>x.op),['getMe']);
});
test('wrong user cannot impersonate Shop B owner',async()=>{
 const e=env(),p=provider();const r=await invoke(e,pathPre,{chat_id:'friend-outside-shop-b'},p.fetch);
 assert.equal(r.status,403);assert.deepEqual(p.calls,[]);
});
test('credentialless or wrong gateway auth rejected',async()=>{
 const e=env(),p=provider();
 for(const auth of ['','Bearer wrong-secret','Basic abc']){
 const r=await invoke(e,pathSend,{case_id:'T1'},p.fetch,now,auth);
 assert.equal(r.status,401);
 }
 assert.deepEqual(p.calls,[]);
});
test('global sending remains disabled and route rejects when enabled',async()=>{
 const e=env({ZALO_SEND_ENABLED:'true'}),p=provider();
 const r=await invoke(e,pathSend,{case_id:'T1'},p.fetch);
 assert.equal(r.status,423);assert.deepEqual(p.calls,[]);
});
test('QA route has hard expiry',async()=>{
 const e=env(),p=provider();
 assert.equal((await invoke(e,pathSend,{case_id:'T1'},p.fetch,Date.parse('2026-11-15T10:00:00Z'))).status,403);
 assert.deepEqual(p.calls,[]);
});
test('missing approval expiry fails closed',async()=>{
 const e=env({ZALO_OWNER_APPROVAL_EXPIRES:''}),p=provider();
 assert.equal((await invoke(e,pathSend,{case_id:'T1'},p.fetch)).status,403);
 assert.deepEqual(p.calls,[]);
});
test('single T1 sends one numbered text menu, no hidden tool calls',async()=>{
 const e=env(),p=provider();
 const r=await invoke(e,pathSend,{case_id:'T1'},p.fetch);
 assert.equal(r.status,200);assert.equal(r.body.result,'API_ACCEPTED');
 assert.equal(r.body.external_send_attempts,1);assert.equal(r.body.orders_written,0);
 assert.deepEqual(p.calls.map(x=>x.op),['sendMessage']);
 assert.equal(p.calls[0].payload.chat_id,'shop-b-owner-qa');
 assert.match(p.calls[0].payload.text,/1\. Xem sản phẩm\n2\. Hỏi giá\n3\. Yêu cầu mua hàng/);
 assert.equal('text_styles' in p.calls[0].payload,false);
});
test('single T2 uses UTF-16 codes for bold green and italic emoji',async()=>{
 const e=env(),p=provider();const r=await invoke(e,pathSend,{case_id:'T2'},p.fetch);
 assert.equal(r.status,200);
 const msg=p.calls[0].payload;
 assert.deepEqual(msg.text_styles[0].st,['b','f_18','c_15a85f']);
 assert.deepEqual(msg.text_styles[1].st,['i']);
 assert.equal(msg.text.slice(msg.text_styles[1].start,msg.text_styles[1].start+msg.text_styles[1].len),'Chữ nghiêng và emoji 🛒');
 assert.equal('parse_mode' in msg,false);
});
test('single T3 uses Markdown, no mixed text_styles',async()=>{
 const p=provider(),r=await invoke(env(),pathSend,{case_id:'T3'},p.fetch);
 assert.equal(r.status,200);
 assert.equal(p.calls[0].payload.parse_mode,'markdown');
 assert.equal('text_styles' in p.calls[0].payload,false);
 assert.match(p.calls[0].payload.text,/\*\*TIEN404\*\*/);
});
test('three deterministic case IDs are max: T1,T2,T3 only',async()=>{
 const e=env(),p=provider();
 for(const case_id of ['T1','T2','T3'])assert.equal((await invoke(e,pathSend,{case_id},p.fetch)).status,200);
 assert.equal(p.calls.length,3);assert.equal(e.REPLAY_DB.claims.size,3);
 assert.equal((await invoke(e,pathSend,{case_id:'T4'},p.fetch)).status,422);
 assert.equal(p.calls.length,3);
});
test('replay of same case id blocked before provider send',async()=>{
 const e=env(),p=provider();
 assert.equal((await invoke(e,pathSend,{case_id:'T1'},p.fetch)).status,200);
 assert.equal((await invoke(e,pathSend,{case_id:'T1'},p.fetch)).status,409);
 assert.equal(p.calls.length,1);
});
test('upstream failed may have delivered: claim remains consumed',async()=>{
 const e=env();let calls=0;const providerFail=async()=>{calls++;throw Error('network timeout');};
 const r=await invoke(e,pathSend,{case_id:'T1'},providerFail);
 assert.equal(r.status,502);assert.equal(r.body.retry_allowed,false);
 assert.equal((await invoke(e,pathSend,{case_id:'T1'},providerFail)).status,409);
 assert.equal(calls,1);
});
test('missing D1 replay store blocks before send',async()=>{
 const e=env({REPLAY_DB:null}),p=provider();
 assert.equal((await invoke(e,pathSend,{case_id:'T1'},p.fetch)).status,503);
 assert.deepEqual(p.calls,[]);
});
test('preflight provider getMe failure blocks no-send',async()=>{
 const e=env(),p=async()=>({ok:false,status:401,json:async()=>({ok:false})});
 assert.equal((await invoke(e,pathPre,{},p)).status,502);
 assert.equal(e.REPLAY_DB.claims.size,0);
});
test('unknown routes do not intercept existing Worker paths',async()=>{
 const e=env(),p=provider();
 assert.equal(await qaRichTextRoute(request(pathPre),e,'/v1/send',now,p.fetch),null);
 assert.deepEqual(p.calls,[]);
});
test('no external fetch in source except Zalo getMe and sendMessage',()=>{
 const c=fs.readFileSync(new URL('./worker-qa-richtext-route.mjs',import.meta.url),'utf8');
 assert.match(c,/ZALO_SEND_ENABLED!=='false'/);
 assert.match(c,/OWNER_CHAT_ID/);
 assert.match(c,/ON CONFLICT\(idempotency_key\) DO NOTHING/);
 assert.equal(c.includes('eval('),false);
 assert.equal(c.includes('localStorage'),false);
 assert.equal(c.includes('/setWebhook'),false);
 assert.equal(c.includes('api.zalo.me'),false);
});
