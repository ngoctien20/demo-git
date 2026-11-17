'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createLeaseBridge,processPinnedNoSend,CONTRACT,REFERENCE}=
 require('./fenced-nosend-lease-adapter.cjs');
const now0=Date.parse('2026-11-17T05:00:00Z');
const APP='QA_G11_ONLY_TEST_META_APP_SECRET_STABLE_NOT_REAL';
const PAGE='9900000001',SENDER='9900000011';
const PEPPER=crypto.randomBytes(32);
const makeClock=()=>{let n=now0;return {now:()=>n,advance:ms=>(n+=ms)}};
const config=()=>({
 appSecret:APP,verifyToken:'QA_G11_VERIFY_ONLY_TEST',
 qaPageId:PAGE,qaTesterPsid:SENDER,qaAppId:'8800000002',
 productionAppId:'8800000001',productionPageId:'9900000009',
 ownerApproval:{
  qaAppPageIsolated:true,callbackPermissionGranted:true,
  merchantPageControlVerified:true,evidenceReference:'PRIVATE_QA_TEST_NOT_AUTHORITY',
  productionAppCallbackUnchanged:true
 }
});
const payload=(date=now0,mid='QA_G11_MID_001',text='QA synthetic read only')=>
 Buffer.from(JSON.stringify({object:'page',entry:[{id:PAGE,messaging:[{
  sender:{id:SENDER},recipient:{id:PAGE},timestamp:date,
  message:{mid,text}
 }]}]}));
const request=(raw=payload(),sigFor=raw)=>({
 method:'POST',url:'https://qa.invalid/g11',rawBody:raw,
 headers:{'x-hub-signature-256':'sha256='+crypto.createHmac('sha256',APP)
  .update(sigFor).digest('hex')}
});
function ledger(clock){
 const rows=new Map(), calls=[],stats={insert:0,duplicate:0,leased:0,
  reclaimed:0,done:0,conflict:0,sendUncertain:0,complete:0};
 const key=args=>args.provider+'|'+args.installationDigest.toString('hex')+'|'+args.eventDigest.toString('hex');
 const valid=x=>Buffer.isBuffer(x)&&x.length===32;
 return {
  rows,calls,stats,
  async acquireNoSend(args){
   assert.equal(args.provider,'MESSENGER');
   for(const f of ['installationDigest','eventDigest','payloadDigest'])
    assert.ok(valid(args[f]),'Only 32-byte HMAC digests may enter QA ledger');
   assert.equal(args.leaseSeconds,45);
   const k=key(args),p=args.payloadDigest.toString('hex');
   calls.push({type:'acquire',key:k});
   let row=rows.get(k);
   if(!row){
    row={state:'LEASED',payload:p,leaseToken:crypto.randomUUID(),
      until:clock.now()+args.leaseSeconds*1000,attempt:1};
    rows.set(k,row);stats.insert++;
    return {disposition:'claimed',workerToken:row.leaseToken,attempt:row.attempt};
   }
   if(row.payload!==p){stats.conflict++;return {disposition:'conflict'};}
   if(row.state==='DONE_NO_SEND'){stats.done++;return {disposition:'done'};}
   if(row.state==='SEND_UNCERTAIN'){stats.sendUncertain++;return {disposition:'manual_review'};}
   if(row.until>clock.now()){stats.leased++;return {disposition:'leased'};}
   row.attempt++;row.until=clock.now()+args.leaseSeconds*1000;
   row.leaseToken=crypto.randomUUID();stats.reclaimed++;
   return {disposition:'reclaimed',workerToken:row.leaseToken,attempt:row.attempt};
  },
  async completeNoSend(args){
   const row=rows.get(key(args));calls.push({type:'complete'});
   if(!row)return 'missing';
   if(row.state==='DONE_NO_SEND')return 'done';
   if(row.state==='SEND_UNCERTAIN')return 'manual_review';
   if(row.leaseToken!==args.workerToken)return 'stale_worker';
   if(row.until<=clock.now())return 'lease_expired';
   row.state='DONE_NO_SEND';row.leaseToken=null;row.until=null;stats.complete++;
   return 'completed';
  },
  async markSendUncertain(args){
   const row=rows.get(key(args));calls.push({type:'mark'});
   if(!row)return 'missing';
   if(row.state==='SEND_UNCERTAIN')return 'manual_review';
   if(row.leaseToken!==args.workerToken)return 'stale_worker';
   if(row.until<=clock.now())return 'lease_expired';
   row.state='SEND_UNCERTAIN';row.leaseToken=null;row.until=null;
   stats.sendUncertain++;return 'manual_review';
  }
 };
}
let handler;
test.before(async()=>{
 const m=await import(pathToFileURL(path.resolve(__dirname,
  '../../.g11_v171/qa/v171e-meta-real-event/isolated-meta-no-send.mjs')).href);
 assert.equal(m.CONTRACT,REFERENCE);
 handler=m.handleIsolatedMeta;
});
const exec=(db,clock,overrides={})=>processPinnedNoSend({
 request:request(),privateConfig:config(),pinnedHandler:handler,repository:db,
 replayPepper:PEPPER,installationRef:PAGE,clock:clock.now,...overrides
});
const receipt=mid=>crypto.createHmac('sha256',APP).update(PAGE+':'+mid).digest('hex');
const create=(db,body=payload(),extra={})=>createLeaseBridge({
 repository:db,replayPepper:PEPPER,installationRef:PAGE,rawBody:body,...extra
});
test('G11 contract is pinned, no real provider delivery implied',()=>{
 assert.equal(CONTRACT,'T404_G11_NO_SEND_LEASE_CUTOVER_CANDIDATE_V1');
 assert.equal(REFERENCE,'T404_V171E_ISOLATED_SIGNED_NOSEND_V1');
});
test('one synthetic Meta signed POST => LEASED then durable DONE_NO_SEND before success',async()=>{
 const c=makeClock(),db=ledger(c),out=await exec(db,c);
 assert.equal(out.status,'SIGNED_QA_EVENT_NO_SEND');
 assert.equal(out.noSendPersisted,true);
 assert.equal(out.providerSends,0);
 assert.equal(out.realProviderUatCompletedHere,false);
 assert.equal(out.canReadRealCommerce,false);
 assert.equal(db.rows.size,1);
 assert.equal([...db.rows.values()][0].state,'DONE_NO_SEND');
 assert.deepEqual(db.calls.map(x=>x.type),['acquire','complete']);
});
test('an exact replay after completion cannot execute the same QA step again',async()=>{
 const c=makeClock(),db=ledger(c);
 const a=await exec(db,c),b=await exec(db,c);
 assert.equal(a.status,'SIGNED_QA_EVENT_NO_SEND');
 assert.equal(b.status,'DUPLICATE_IGNORED');
 assert.equal(db.stats.complete,1);
 assert.equal(db.stats.insert,1);
});
test('parallel 24 signed identical messages => only one success; others held or duplicate',async()=>{
 const c=makeClock(),db=ledger(c);
 const answers=await Promise.all(Array.from({length:24},()=>exec(db,c)));
 assert.equal(answers.filter(r=>r.status==='SIGNED_QA_EVENT_NO_SEND').length,1);
 assert.equal(answers.filter(r=>r.status==='DUPLICATE_IGNORED'||
   r.status==='BLOCKED').length,23);
 assert.equal(db.rows.size,1);assert.equal(db.stats.complete,1);
});
test('lease in progress returns 503, never successful no-send completed',async()=>{
 const c=makeClock(),db=ledger(c);
 const lease=create(db);
 assert.equal(await lease.claimOnce(receipt('QA_G11_MID_001')),'claimed');
 const out=await exec(db,c);
 assert.equal(out.status,'BLOCKED');assert.equal(out.http_status,503);
 assert.equal(out.noSendPersisted,undefined);
 assert.equal(db.stats.complete,0);
});
test('crash before finalize can be reclaimed only after lease expiry; old token is fenced',async()=>{
 const c=makeClock(),db=ledger(c);
 const old=create(db);
 assert.equal(await old.claimOnce(receipt('QA_G11_MID_001')),'claimed');
 c.advance(46000);
 const newWorker=await exec(db,c,{request:request(payload(c.now()))});
 // Since provider timestamp changes, the payload fingerprint changes;
 // same MID but different bytes is a CONFLICT, never silently reclaimed.
 assert.equal(newWorker.status,'BLOCKED');
 assert.equal(db.stats.conflict,1);
 // Exact provider retry has same raw body and valid original HMAC but the
 // pinned handler's timestamp is now +46s, still within 5-min window.
 const right=await exec(db,c,{request:request(payload())});
 assert.equal(right.status,'SIGNED_QA_EVENT_NO_SEND');
 assert.equal(db.stats.reclaimed,1);
 await assert.rejects(old.finishNoSend(),/G11_PRIVATE_LEASE_CLAIM_REFUSED/);
 assert.equal(db.stats.complete,1);
});
test('stale worker cannot mark a send boundary after being fenced',async()=>{
 const c=makeClock(),db=ledger(c);
 const old=create(db);await old.claimOnce(receipt('QA_G11_MID_001'));
 c.advance(46000);
 const fresh=create(db);await fresh.claimOnce(receipt('QA_G11_MID_001'));
 await assert.rejects(old.flagUncertainForReview(),/G11_PRIVATE_LEASE_CLAIM_REFUSED/);
 assert.equal(await fresh.finishNoSend(),'completed');
});
test('crash after send intent goes to manual review; never automatic resend/reclaim',async()=>{
 const c=makeClock(),db=ledger(c);
 const old=create(db);
 assert.equal(await old.claimOnce(receipt('QA_G11_MID_001')),'claimed');
 assert.equal(await old.flagUncertainForReview(),'manual_review');
 c.advance(3600000);
 const attempt=await exec(db,c,{request:request(payload())});
 assert.equal(attempt.status,'BLOCKED');assert.equal(attempt.http_status,503);
 assert.equal([...db.rows.values()][0].state,'SEND_UNCERTAIN');
 assert.equal(db.stats.reclaimed,0);
});
test('unexpected same MID and different signed payload is conflict, not duplicate',async()=>{
 const c=makeClock(),db=ledger(c);
 await exec(db,c);
 const changed=request(payload(now0,'QA_G11_MID_001','QA changed text'));
 const out=await exec(db,c,{request:changed});
 assert.equal(out.status,'BLOCKED');
 assert.equal(db.stats.conflict,1);
 assert.equal(db.stats.complete,1);
});
test('different event MID creates independent claim and completion',async()=>{
 const c=makeClock(),db=ledger(c);
 await exec(db,c);
 await exec(db,c,{request:request(payload(now0,'QA_G11_MID_002'))});
 assert.equal(db.rows.size,2);
 assert.equal(db.stats.complete,2);
});
test('same event MID on distinct verified QA Page would isolate storage key',async()=>{
 const c=makeClock(),db=ledger(c);
 const a=create(db);
 assert.equal(await a.claimOnce(receipt('QA_G11_MID_001')),'claimed');
 const b=create(db,payload(),{installationRef:'QA_G11_SEPARATE_PAGE'});
 assert.equal(await b.claimOnce(receipt('QA_G11_MID_001')),'claimed');
 assert.equal(db.rows.size,2);
});
test('Meta bad raw-body HMAC is blocked before any DB claim',async()=>{
 const c=makeClock(),db=ledger(c),raw=payload();
 const changed=payload(now0,'QA_G11_MID_001','QA mutated');
 const out=await exec(db,c,{request:request(changed,raw)});
 assert.equal(out.status,'BLOCKED');
 assert.equal(db.calls.length,0);
});
test('Meta wrong Page authority rejected before any DB claim',async()=>{
 const c=makeClock(),db=ledger(c),cfg=config();cfg.qaPageId='9900000022';
 const out=await exec(db,c,{privateConfig:cfg});
 assert.equal(out.status,'BLOCKED');
 assert.equal(db.calls.length,0);
});
test('Meta unsupported echo event is rejected before any DB claim',async()=>{
 const c=makeClock(),db=ledger(c);
 const b=JSON.parse(payload().toString());
 b.entry[0].messaging[0].message.is_echo=true;
 const out=await exec(db,c,{request:request(Buffer.from(JSON.stringify(b)))});
 assert.equal(out.status,'BLOCKED');
 assert.equal(db.calls.length,0);
});
test('on provider configuration missing authority, never claim or return a positive result',async()=>{
 const c=makeClock(),db=ledger(c);
 const out=await exec(db,c,{privateConfig:{...config(),appSecret:''}});
 assert.equal(out.status,'BLOCKED');
 assert.equal(db.calls.length,0);
});
test('storage outage during acquire fails closed, no in-memory fallback',async()=>{
 const c=makeClock(),db=ledger(c);
 db.acquireNoSend=async()=>{throw Error('QA_DB_UNAVAILABLE')};
 const out=await exec(db,c);
 assert.equal(out.status,'BLOCKED');assert.equal(out.http_status,503);
 assert.equal(db.stats.complete,0);
});
test('storage outage after handler claim cannot be reported success/ACK',async()=>{
 const c=makeClock(),db=ledger(c);
 db.completeNoSend=async()=>{throw Error('QA_DB_CONNECTION_DROPPED')};
 const out=await exec(db,c);
 assert.equal(out.reason,'NO_SEND_FINALIZATION_NOT_DURABLE');
 assert.equal(out.http_status,503);
 assert.equal([...db.rows.values()][0].state,'LEASED');
});
test('recovery after crash in completion DB starts only after timeout and persists DONE',async()=>{
 const c=makeClock(),db=ledger(c);
 const original=db.completeNoSend.bind(db);
 db.completeNoSend=async()=>{throw Error('QA_OUTAGE')};
 const first=await exec(db,c);
 assert.equal(first.status,'BLOCKED');
 db.completeNoSend=original;
 c.advance(46000);
 const second=await exec(db,c);
 assert.equal(second.status,'SIGNED_QA_EVENT_NO_SEND');
 assert.equal(db.stats.reclaimed,1);
});
test('unknown disposition from repository is not accepted',async()=>{
 const c=makeClock(),db=ledger(c);
 db.acquireNoSend=async()=>({disposition:'OK_TO_SEND'});
 const out=await exec(db,c);
 assert.equal(out.status,'BLOCKED');assert.equal(db.stats.complete,0);
});
test('invalid UUID fencing token from repository cannot be used',async()=>{
 const c=makeClock(),db=ledger(c);
 db.acquireNoSend=async()=>({disposition:'claimed',workerToken:'not-a-uuid',attempt:1});
 const out=await exec(db,c);
 assert.equal(out.status,'BLOCKED');
});
test('completion stale result is not a successful No-Send acknowledgement',async()=>{
 const c=makeClock(),db=ledger(c);
 db.completeNoSend=async()=> 'stale_worker';
 const out=await exec(db,c);
 assert.equal(out.reason,'NO_SEND_FINALIZATION_NOT_DURABLE');
});
test('lease callback cannot be invoked twice by a single handler invocation',async()=>{
 const c=makeClock(),db=ledger(c),lease=create(db);
 await lease.claimOnce(receipt('QA_G11_MID_001'));
 await assert.rejects(lease.claimOnce(receipt('QA_G11_MID_001')),
  /G11_PRIVATE_LEASE_CLAIM_REFUSED/);
});
test('finish without claimed lease is refused',async()=>{
 const c=makeClock(),db=ledger(c);
 await assert.rejects(create(db).finishNoSend(),/G11_PRIVATE_LEASE_CLAIM_REFUSED/);
});
test('source rejects missing private replay pepper',()=>{
 const c=makeClock(),db=ledger(c);
 assert.throws(()=>createLeaseBridge({repository:db,replayPepper:Buffer.alloc(4),
  installationRef:PAGE,rawBody:payload()}),/G11_PRIVATE_LEASE_CLAIM_REFUSED/);
});
test('source rejects unknown Zalo OA label through missing owner-bound Page reference',()=>{
 const c=makeClock(),db=ledger(c);
 assert.throws(()=>createLeaseBridge({repository:db,replayPepper:PEPPER,
  installationRef:'bad/page',rawBody:payload()}),
 /G11_PRIVATE_LEASE_CLAIM_REFUSED/);
});
test('source rejects 32KB+ raw request without any secret use',()=>{
 const c=makeClock(),db=ledger(c);
 assert.throws(()=>createLeaseBridge({repository:db,replayPepper:PEPPER,
  installationRef:PAGE,rawBody:Buffer.alloc(32769)}),
 /G11_PRIVATE_LEASE_CLAIM_REFUSED/);
});
test('caller cannot inject Store ID or role into request envelope',async()=>{
 const c=makeClock(),db=ledger(c);
 const out=await exec(db,c,{request:{...request(),storeId:'ATTACK_SHOP'}});
 assert.equal(out.status,'BLOCKED');
 assert.equal(db.calls.length,0);
});
test('same MID after replay pepper rotation is not detectable: key epoch must be pinned',async()=>{
 const c=makeClock(),db=ledger(c);
 await exec(db,c);
 const rotated=crypto.randomBytes(32);
 const out=await exec(db,c,{replayPepper:rotated});
 assert.equal(out.status,'SIGNED_QA_EVENT_NO_SEND');
 assert.equal(db.rows.size,2);
 // This is a documented hazard, not evidence that rotation is safe.
});
test('sanitized final response never contains PSID, Page, phone or pepper',async()=>{
 const c=makeClock(),db=ledger(c);
 const out=await exec(db,c),s=JSON.stringify(out);
 for(const val of [PAGE,SENDER,APP,PEPPER.toString('hex'),'QA synthetic read only'])
  assert.equal(s.includes(val),false,val);
 assert.equal(out.releaseStatus,'HOSTED_NO_GO');
});
test('no actual provider send occurs after successful synthetic finalized NoSend',async()=>{
 const c=makeClock(),db=ledger(c);
 const out=await exec(db,c);
 assert.equal(out.meta_outbound,0);
 assert.equal(out.providerSends,0);
 assert.equal(out.canSend,false);
 assert.equal(out.canCreateOrders,false);
});
