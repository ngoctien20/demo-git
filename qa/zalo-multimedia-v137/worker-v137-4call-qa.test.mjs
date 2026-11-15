import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {v137MediaQaRoute,ZALO_V137_TEST_ID} from './worker-v137-4call-qa.mjs';
const NOW=Date.parse('2026-11-15T08:00:00Z');
const PATH='/v1/qa-v137/';
const IDS=['PHOTO','TYPING','STICKER','VOICE'];
const HEADERS={'authorization':'Bearer unit-qa-gateway-key','content-type':'application/json'};
function makeDb(){const records=new Map();return{records,prepare(sql){return{bind(...args){return{async first(){if(!sql.startsWith('SELECT state'))throw Error('unexpected select');return records.has(args[0])?{state:records.get(args[0])}:null;},async run(){if(sql.startsWith('INSERT INTO')){if(records.has(args[0]))return{meta:{changes:0}};records.set(args[0],args[2]);return{meta:{changes:1}};}if(sql.startsWith('UPDATE outbound_claims')){records.set(args[1],args[0]);return{meta:{changes:1}};}throw Error('unexpected write');}};}};}};}
function makeEnv(extra={}){return{ZALO_SEND_ENABLED:'false',ZALO_OWNER_APPROVAL_EXPIRES:'2026-11-20T00:00:00Z',GATEWAY_AUTH_KEY:'unit-qa-gateway-key',ZALO_BOT_TOKEN:'fake-token',ZALO_OWNER_CHAT_ID:'shop-b-allowlisted-private-chat',REPLAY_DB:makeDb(),...extra};}
function req(path,body={},options={}){return new Request('https://qa.invalid'+path,{method:options.method||'POST',headers:options.headers||HEADERS,body:['GET','HEAD'].includes(options.method)?undefined:JSON.stringify(body)});}
function body(case_id){return{test_id:ZALO_V137_TEST_ID,chat_id:'shop-b-allowlisted-private-chat',...(case_id?{case_id}:{})};}
function provider(){const calls=[];return{calls,fetch:async(url,opt)=>{const endpoint=url.split('/').at(-1);calls.push({endpoint,method:opt.method,payload:JSON.parse(opt.body)});return{ok:true,status:200,json:async()=>({ok:true,result:endpoint==='getMe'?{name:'Bot TIEN404 AI'}:{message_id:'private-message-id'}})};}};}
async function invoke(env,path,b,p=provider(),now=NOW,override={}){const request=req(path,b,override);const response=await v137MediaQaRoute(request,env,path,now,p.fetch);return{status:response.status,data:await response.json(),calls:p.calls,provider:p};}
test('server handles unrelated paths without interceptions',async()=>{
 const r=await v137MediaQaRoute(req('/health',{}),makeEnv(),'/health',NOW,provider().fetch);
 assert.equal(r,null);
});
test('photo is valid, static original PNG fixture',async()=>{
 const path=PATH+'media/photo.png';const res=await v137MediaQaRoute(req(path,{}, {method:'GET'}),makeEnv(),path,NOW);
 assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'image/png');
 const b=new Uint8Array(await res.arrayBuffer());
 assert.deepEqual([...b.slice(0,8)],[137,80,78,71,13,10,26,10]);
 assert.ok(b.length>=100);
});
test('voice is ADTS AAC test tone, no customer data',async()=>{
 const path=PATH+'media/voice.aac';const res=await v137MediaQaRoute(req(path,{}, {method:'GET'}),makeEnv(),path,NOW);
 assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'audio/aac');
 const b=new Uint8Array(await res.arrayBuffer());
 assert.equal(b[0],255);assert.ok((b[1]&240)===240);assert.ok(b.length>250);
});
test('HEAD media only returns metadata, no body',async()=>{
 const path=PATH+'media/photo.png';
 const res=await v137MediaQaRoute(req(path,{}, {method:'HEAD'}),makeEnv(),path,NOW);
 assert.equal(res.status,200);assert.equal((await res.arrayBuffer()).byteLength,0);
});
test('media fixture rejects POST and returns expired after hard gate',async()=>{
 const path=PATH+'media/voice.aac';
 const bad=await v137MediaQaRoute(req(path,{hello:1}),makeEnv(),path,NOW);
 assert.equal(bad.status,405);
 const expired=await v137MediaQaRoute(req(path,{}, {method:'GET'}),makeEnv(),path,Date.parse('2026-11-15T09:30:00Z'));
 assert.equal(expired.status,410);
});
test('preflight Bot getMe, owner and 4 claims checked without outbound sends',async()=>{
 const p=provider(),e=makeEnv();const r=await invoke(e,PATH+'preflight',body(),p);
 assert.equal(r.status,200);assert.equal(r.data.bot_verified,true);assert.equal(r.data.owner_verified,true);
 assert.equal(r.data.external_sends,0);assert.equal(r.data.global_send_enabled,false);
 assert.deepEqual(r.data.claimed,[]);assert.equal(r.calls.length,1);assert.equal(r.calls[0].endpoint,'getMe');
});
test('all HTTP methods except POST are rejected',async()=>{
 const p=provider(),e=makeEnv();for(const method of ['GET','HEAD']){
 const path=PATH+'send';const x=await v137MediaQaRoute(req(path,{}, {method}),e,path,NOW,p.fetch);
 assert.equal(x.status,405);}assert.equal(p.calls.length,0);
});
test('wrong or absent Authorization is rejected before provider',async()=>{
 const e=makeEnv(),p=provider();
 for(const authorization of ['', 'Bearer wrong','Basic access']){
 const r=await invoke(e,PATH+'send',body('PHOTO'),p,NOW,{headers:{...HEADERS,authorization}});
 assert.equal(r.status,401);}assert.deepEqual(p.calls,[]);
});
test('global sending must remain false, fails closed when enabled',async()=>{
 const e=makeEnv({ZALO_SEND_ENABLED:'true'}),p=provider();
 assert.equal((await invoke(e,PATH+'send',body('PHOTO'),p)).status,423);
 assert.equal(p.calls.length,0);
});
test('new approval and fixed test deadline enforce hard fail close',async()=>{
 const e=makeEnv(),p=provider();
 assert.equal((await invoke(e,PATH+'send',body('PHOTO'),p,Date.parse('2026-11-15T09:30:00Z'))).status,403);
 assert.equal((await invoke(makeEnv({ZALO_OWNER_APPROVAL_EXPIRES:''}),PATH+'send',body('PHOTO'),p)).status,403);
 assert.deepEqual(p.calls,[]);
});
test('wrong recipient and wrong test ID forbidden',async()=>{
 const e=makeEnv(),p=provider();
 assert.equal((await invoke(e,PATH+'send',{...body('PHOTO'),chat_id:'friend-not-owner'},p)).status,403);
 assert.equal((await invoke(e,PATH+'send',{...body('PHOTO'),test_id:'OTHER'},p)).status,403);
 assert.deepEqual(p.calls,[]);
});
test('arbitrary payload fields or tenant spoof forbidden',async()=>{
 const e=makeEnv(),p=provider();
 for(const field of ['tenant_id','store_id','photo','voice_url','url','sticker','token','dry_run']){
 const r=await invoke(e,PATH+'send',{...body('PHOTO'),[field]:'evil'},p);
 assert.equal(r.status,403);
 }
 assert.deepEqual(p.calls,[]);
});
test('no arbitrary extra API methods or cases',async()=>{
 const e=makeEnv(),p=provider();
 assert.equal((await invoke(e,PATH+'send',body('sendMessage'),p)).status,422);
 assert.equal((await invoke(e,PATH+'send',body('DELETE_WEBHOOK'),p)).status,422);
 assert.equal(p.calls.length,0);
});
test('four cases map to official provider endpoints and exact fixed payloads',async()=>{
 const e=makeEnv(),p=provider();
 for(const id of IDS){
  const r=await invoke(e,PATH+'send',body(id),p);assert.equal(r.status,200,id);
  assert.equal(r.data.result,'API_ACCEPTED');assert.equal(r.data.attempts,1);
  assert.equal(r.data.orders_written,0);assert.equal(r.data.retry_allowed,false);
 }
 assert.deepEqual(p.calls.map(x=>x.endpoint),['sendPhoto','sendChatAction','sendSticker','sendVoice']);
 for(const c of p.calls)assert.equal(c.payload.chat_id,'shop-b-allowlisted-private-chat');
 assert.equal(p.calls[0].payload.photo,'https://tien404-zalo-outbound-v1-staging.tienmobi208.workers.dev/v1/qa-v137/media/photo.png');
 assert.deepEqual(p.calls[1].payload,{chat_id:'shop-b-allowlisted-private-chat',action:'typing'});
 assert.equal(p.calls[2].payload.sticker,'0e078a2fb66a5f34067b');
 assert.equal(p.calls[3].payload.voice_url.endsWith('.aac'),true);
 assert.equal('caption' in p.calls[3].payload,false);
 assert.equal(e.REPLAY_DB.records.size,4);
});
test('preflight reports claimed cases and no sends after test',async()=>{
 const e=makeEnv(),p=provider();await invoke(e,PATH+'send',body('PHOTO'),p);
 const r=await invoke(e,PATH+'preflight',body(),p);
 assert.equal(r.status,200);assert.deepEqual(r.data.claimed.map(v=>v.case_id),['PHOTO']);
});
test('replay one-shot must return 409 without second provider call',async()=>{
 const e=makeEnv(),p=provider();await invoke(e,PATH+'send',body('VOICE'),p);
 const r=await invoke(e,PATH+'send',body('VOICE'),p);
 assert.equal(r.status,409);assert.equal(p.calls.length,1);
});
test('provider may reject sticker; claim stays spent, no retry',async()=>{
 const e=makeEnv();let calls=0;
 const rejected=async()=>{calls++;return{status:400,ok:false,json:async()=>({ok:false,error:'BAD_STICKER'})};};
 const r=await v137MediaQaRoute(req(PATH+'send',body('STICKER')),e,PATH+'send',NOW,rejected);
 assert.equal(r.status,502);const q=await r.json();
 assert.equal(q.result,'PROVIDER_REJECTED');assert.equal(q.retry_allowed,false);
 assert.equal(e.REPLAY_DB.records.size,1);
 const retry=await v137MediaQaRoute(req(PATH+'send',body('STICKER')),e,PATH+'send',NOW,rejected);
 assert.equal(retry.status,409);assert.equal(calls,1);
});
test('timeout ambiguous provider result never retried',async()=>{
 const e=makeEnv();let calls=0;
 const bad=async()=>{calls++;throw Error('network unknown');};
 const r=await v137MediaQaRoute(req(PATH+'send',body('VOICE')),e,PATH+'send',NOW,bad);
 assert.equal(r.status,502);assert.equal((await r.json()).result,'UNKNOWN_AFTER_SEND_ATTEMPT');
 const retry=await v137MediaQaRoute(req(PATH+'send',body('VOICE')),e,PATH+'send',NOW,bad);
 assert.equal(retry.status,409);assert.equal(calls,1);
});
test('D1 absent or unavailable blocks all sends',async()=>{
 const p=provider();assert.equal((await invoke(makeEnv({REPLAY_DB:null}),PATH+'send',body('PHOTO'),p)).status,503);
 const badDb={prepare(){throw Error('D1 down');}};
 assert.equal((await invoke(makeEnv({REPLAY_DB:badDb}),PATH+'send',body('PHOTO'),p)).status,503);
 assert.equal(p.calls.length,0);
});
test('provider ACK does not expose token, recipient or provider message ID',async()=>{
 const p=provider();const e=makeEnv();
 const r=await invoke(e,PATH+'send',body('PHOTO'),p);
 const s=JSON.stringify(r.data);
 assert.equal(r.data.provider_message_id_present,true);
 for(const secret of ['fake-token','shop-b-allowlisted-private-chat','private-message-id','unit-qa-gateway-key'])
  assert.equal(s.includes(secret),false);
});
test('source has no generic send unlock, RLS, auth or webhook changes',()=>{
 const s=fs.readFileSync(new URL('./worker-v137-4call-qa.mjs',import.meta.url),'utf8');
 assert.match(s,/ZALO_SEND_ENABLED!=='false'/);
 assert.match(s,/ON CONFLICT\(idempotency_key\) DO NOTHING/);
 for(const x of ['setWebhook(','deleteWebhook(','ZALO_SEND_ENABLED=true','service_role','order_id','createOrder(','localStorage'])
  assert.equal(s.includes(x),false,x);
});
