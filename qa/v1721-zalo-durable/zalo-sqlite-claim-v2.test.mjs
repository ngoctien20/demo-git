import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {initReplayV2Schema,claimReplayV2,MAX_REPLAY_TTL_MS,ZALO_REPLAY_V2_SCHEMA} from './zalo-sqlite-claim-v2.mjs';
import {bindZaloReplayClaimV2} from './zalo-bot-replay-binding-v2.mjs';
import {admitBotEvent} from '../v1720-zalo-replay/zalo-bot-replay-gate.mjs';
const NOW=Date.parse('2026-11-17T09:41:19.425Z');
const H=x=>createHash('sha256').update(x).digest('hex');
const KEY=H('qa_zalo_v1721_event_1');
const DIGEST=H('qa_zalo_v1721_body_1');
const DIFF=H('qa_zalo_v1721_body_conflict');
const TTL=MAX_REPLAY_TTL_MS;
function sqlite(db){
 return {exec(q,...params){
   const stmt=db.prepare(q);
   if(/^\s*SELECT\b/i.test(q)||/\bRETURNING\b/i.test(q)){
     const arr=stmt.all(...params);
     return {toArray:()=>arr};
   }
   stmt.run(...params);
   return {toArray:()=>[]};
 }};
}
function fresh(){
 const db=new DatabaseSync(':memory:'),sql=sqlite(db);
 initReplayV2Schema(sql);return {db,sql};
}
function req(key=KEY,digest=DIGEST,expiresAtMs=NOW+TTL){return {key,digest,expiresAtMs};}
test('constant bound: 24h max claim TTL, not old 10min',()=>{
 assert.equal(TTL,86400000);assert.equal(ZALO_REPLAY_V2_SCHEMA,'zalo_bot_replay_claims_v2');
});
test('create table and expiry index idempotently',()=>{
 const {db,sql}=fresh();
 initReplayV2Schema(sql);
 const tables=db.prepare("select name from sqlite_master where type='table'").all().map(x=>x.name);
 assert.ok(tables.includes(ZALO_REPLAY_V2_SCHEMA));
 const indexes=db.prepare("select name from sqlite_master where type='index'").all().map(x=>x.name);
 assert.ok(indexes.includes('zalo_bot_replay_v2_exp'));db.close();
});
test('first claimed, duplicate suppressed, conflicting digest denied',()=>{
 const {db,sql}=fresh();
 assert.equal(claimReplayV2(sql,req(),NOW),'CLAIMED');
 assert.equal(claimReplayV2(sql,req(),NOW),'DUPLICATE');
 assert.equal(claimReplayV2(sql,req(KEY,DIFF),NOW),'CONFLICT');
 const rows=db.prepare('select * from '+ZALO_REPLAY_V2_SCHEMA).all();
 assert.equal(rows.length,1);
 assert.equal(rows[0].event_key,KEY);assert.equal(rows[0].payload_digest,DIGEST);
 assert.equal(rows[0].expires_at_ms,NOW+TTL);db.close();
});
test('independent keyed events coexist and cannot return another digest',()=>{
 const {db,sql}=fresh();
 assert.equal(claimReplayV2(sql,req(KEY),NOW),'CLAIMED');
 assert.equal(claimReplayV2(sql,req(H('other event')),NOW),'CLAIMED');
 assert.equal(db.prepare('select count(*) as n from '+ZALO_REPLAY_V2_SCHEMA).get().n,2);
 db.close();
});
test('same key expires and can be claimed after TTL with fresh server time',()=>{
 const {db,sql}=fresh();
 assert.equal(claimReplayV2(sql,req(KEY,DIGEST,NOW+1000),NOW),'CLAIMED');
 assert.equal(claimReplayV2(sql,req(KEY,DIFF,NOW+TTL),NOW+1000),'CLAIMED');
 assert.equal(claimReplayV2(sql,req(KEY,DIGEST,NOW+TTL),NOW+1000),'CONFLICT');
 db.close();
});
for(const [name,over,time] of [
 ['expired',{expiresAtMs:NOW},NOW],
 ['past timestamp',{expiresAtMs:NOW-1},NOW],
 ['beyond 24h',{expiresAtMs:NOW+TTL+1},NOW],
 ['nan expiry',{expiresAtMs:NaN},NOW],
 ['string expiry',{expiresAtMs:String(NOW+TTL)},NOW],
 ['unsafe expiry',{expiresAtMs:Number.MAX_SAFE_INTEGER+1},NOW],
 ['bad now',{expiresAtMs:NOW+TTL},NaN],
 ['future now invalid',{expiresAtMs:NOW+TTL},NOW+TTL],
]){
 test('reject '+name,()=>{
  const {db,sql}=fresh();
  assert.throws(()=>claimReplayV2(sql,{...req(),...over},time),/INVALID_REPLAY_TTL/);
  db.close();
 });
}
for(const [name,key,digest] of [
 ['raw provider ID','qa_mid_1234',DIGEST],
 ['empty key','',DIGEST],
 ['uppercase hex',KEY.toUpperCase(),DIGEST],
 ['key shorter 64',KEY.slice(0,63),DIGEST],
 ['raw payload digest',KEY,'TIEN404 EXT 03'],
 ['empty digest',KEY,''],
 ['uppercase digest',KEY,DIGEST.toUpperCase()],
 ['non-string digest',KEY,123],
]){
 test('reject unhashed '+name,()=>{
  const {db,sql}=fresh();
  assert.throws(()=>claimReplayV2(sql,req(key,digest),NOW),/HASHED_REPLAY_KEYS_REQUIRED/);
  db.close();
 });
}
test('missing backend throws: upstream V17.20 must fail closed',()=>{
 assert.throws(()=>claimReplayV2(null,req(),NOW),/SQLITE_BACKEND_UNAVAILABLE/);
 assert.throws(()=>initReplayV2Schema({}),/SQLITE_BACKEND_UNAVAILABLE/);
});
test('SQLite read/write outage fails closed and never reports claimed',()=>{
 const {db,sql}=fresh();db.close();
 assert.throws(()=>claimReplayV2(sql,req(),NOW));
});
test('bounded expired cleanup removes at most 32 unrelated rows per claim',()=>{
 const {db,sql}=fresh();
 const statement=db.prepare('insert into '+ZALO_REPLAY_V2_SCHEMA+' (event_key,payload_digest,expires_at_ms,created_at_ms) values (?,?,?,?)');
 for(let i=0;i<95;i++)statement.run(H('expired_'+i),H('payload_'+i),NOW-1,NOW-1000);
 assert.equal(claimReplayV2(sql,req(),NOW),'CLAIMED');
 assert.equal(db.prepare('select count(*) as n from '+ZALO_REPLAY_V2_SCHEMA).get().n,95-32+1);
 db.close();
});
test('persistence survives database connection restart',()=>{
 const root=mkdtempSync(join(tmpdir(),'t404-v1721-'));
 const file=join(root,'replay.sqlite');
 try{
  let db=new DatabaseSync(file),sql=sqlite(db);
  initReplayV2Schema(sql);
  assert.equal(claimReplayV2(sql,req(),NOW),'CLAIMED');db.close();
  db=new DatabaseSync(file);sql=sqlite(db);
  assert.equal(claimReplayV2(sql,req(),NOW),'DUPLICATE');
  assert.equal(claimReplayV2(sql,req(KEY,DIFF),NOW),'CONFLICT');db.close();
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('two DB connections to one physical file share uniqueness and conflicts',()=>{
 const root=mkdtempSync(join(tmpdir(),'t404-v1721-multi-'));
 const file=join(root,'replay.sqlite');
 try{
  const a=new DatabaseSync(file),b=new DatabaseSync(file);
  a.exec('PRAGMA journal_mode=WAL');b.exec('PRAGMA busy_timeout=1000');
  const sa=sqlite(a),sb=sqlite(b);initReplayV2Schema(sa);initReplayV2Schema(sb);
  assert.equal(claimReplayV2(sa,req(),NOW),'CLAIMED');
  assert.equal(claimReplayV2(sb,req(),NOW),'DUPLICATE');
  assert.equal(claimReplayV2(sb,req(KEY,DIFF),NOW),'CONFLICT');
  assert.equal(b.prepare('select count(*) as n from '+ZALO_REPLAY_V2_SCHEMA).get().n,1);
  a.close();b.close();
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('100 same-key submissions share the same synchronous SQLite claim (1:99)',async()=>{
 const {db,sql}=fresh();
 const results=await Promise.all(Array.from({length:100},async()=>claimReplayV2(sql,req(),NOW)));
 assert.equal(results.filter(x=>x==='CLAIMED').length,1);
 assert.equal(results.filter(x=>x==='DUPLICATE').length,99);
 assert.equal(db.prepare('select count(*) as n from '+ZALO_REPLAY_V2_SCHEMA).get().n,1);
 db.close();
});
test('installation scope routes deterministically to a separate DO name',async()=>{
 const calls=[];
 const namespace={getByName(name){
  calls.push(name);
  return {claimHashedEvent:async x=>{assert.equal(x.key,KEY);assert.equal(x.digest,DIGEST);return 'CLAIMED'}};
 }};
 const a=bindZaloReplayClaimV2({namespace,installationRef:'QA_ZALO_INSTALL_A'});
 const b=bindZaloReplayClaimV2({namespace,installationRef:'QA_ZALO_INSTALL_A'});
 const c=bindZaloReplayClaimV2({namespace,installationRef:'QA_ZALO_INSTALL_B'});
 assert.equal(await a(req()),'CLAIMED');assert.equal(await b(req()),'CLAIMED');assert.equal(await c(req()),'CLAIMED');
 assert.equal(calls[0],calls[1]);assert.notEqual(calls[0],calls[2]);
 assert.ok(calls.every(x=>!x.includes('QA_ZALO_INSTALL_')));
});
test('DO adapter passes only hashed claim fields and rejects foreign responses',async()=>{
 let payload;
 const namespace={getByName:()=>({claimHashedEvent:async x=>{payload=x;return 'CLAIMED'}})};
 const fn=bindZaloReplayClaimV2({namespace,installationRef:'QA_ROUTE_ZALO'});
 assert.equal(await fn(req()),'CLAIMED');
 assert.deepEqual(Object.keys(payload).sort(),['key','digest','expiresAtMs'].sort());
 await assert.rejects(fn(req('raw',DIGEST)),/REPLAY_INPUT_NOT_HASHED/);
 const broken=bindZaloReplayClaimV2({namespace:{getByName:()=>({claimHashedEvent:async()=>({claimed:true})})},installationRef:'QA_ROUTE_ZALO'});
 await assert.rejects(broken(req()),/REPLAY_DO_INVALID_RESULT/);
});
test('missing namespace or client-supplied route not admitted',()=>{
 assert.throws(()=>bindZaloReplayClaimV2({installationRef:'QA_ROUTE_ZALO'}),/TRUSTED_REPLAY_DO_BINDING_REQUIRED/);
 assert.throws(()=>bindZaloReplayClaimV2({namespace:{getByName(){return {}}},installationRef:'QA_ROUTE_ZALO'}),/REPLAY_DO_RPC_MISSING/);
 assert.throws(()=>bindZaloReplayClaimV2({namespace:{getByName(){return {}}},installationRef:'<script>'}),/TRUSTED_REPLAY_DO_BINDING_REQUIRED/);
});
test('full V17.20 admission → DO adapter → real SQLite, duplicate & conflict',async()=>{
 const {db,sql}=fresh();
 const namespace={getByName:()=>({
  claimHashedEvent:async ({key,digest,expiresAtMs})=>claimReplayV2(sql,{key,digest,expiresAtMs},NOW)
 })};
 const binding=bindZaloReplayClaimV2({namespace,installationRef:'QA_BOT_INSTALL_A'});
 const base=()=>({ok:true,result:{event_name:'message.text.received',message:{
  from:{id:'qa_customer_100',is_bot:false},
  chat:{id:'qa_private_100',chat_type:'PRIVATE'},
  message_id:'qa_message_100',text:'TIEN404 EXT 03',date:NOW,message_type:'CHAT_TEXT'
 }}});
 const settings={authenticatedByIngress:true,trustedIngress:'HEADER_SECRET_VERIFIED_SERVER_SIDE',
  installation:{channel:'zalo_bot',status:'STAGING_ONLY',mode:'NO_SEND',
   readOnly:true,serverResolved:true,installationRef:'QA_BOT_INSTALL_A'},
  replayKey:'V1721_LONG_SYNTH_HMAC_TEST_PEPPER_1234567890',nowMs:NOW,claimAtomic:binding};
 const first=await admitBotEvent({...settings,providerBody:base()});
 assert.equal(first.status,'ACCEPTED_SHADOW_ONLY');
 const dup=await admitBotEvent({...settings,providerBody:base()});
 assert.equal(dup.status,'DUPLICATE_NOOP');
 const tamper=base();tamper.result.message.text='MUA F01';
 const conflict=await admitBotEvent({...settings,providerBody:tamper});
 assert.equal(conflict.status,'DENY');assert.equal(conflict.reason,'CONFLICTING_REPLAY');
 assert.equal(first.canWrite,false);assert.equal(first.canSend,false);
 assert.equal(db.prepare('select count(*) as n from '+ZALO_REPLAY_V2_SCHEMA).get().n,1);
 db.close();
});
test('DO worker source intentionally has no public fetch or provider client',()=>{
 const source=readFileSync(new URL('./zalo-bot-replay-bucket-v2.worker.mjs',import.meta.url),'utf8');
 assert.ok(source.includes('class ZaloBotReplayBucketV2'));
 assert.equal(/export default/.test(source),false);
 assert.equal(/async fetch\(/.test(source),false);
 assert.equal(/await fetch\(/.test(source),false);
 assert.equal(source.includes('ZaloBotReplayBucketV2 extends DurableObject'),true);
});
