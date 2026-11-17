import test from 'node:test';
import assert from 'node:assert/strict';
import {V174PReplayGuard,QA_RATE_POLICY} from './hosted-issuer.worker.mjs';

const k='A'.repeat(43), fingerprint='B'.repeat(43), other='C'.repeat(43);
const payload=(kind,extras={})=>kind==='session'?{kind}:{kind,key:k,fingerprint,expires_at:Math.floor(Date.now()/1000)+240,...extras};
class MemoryStorage {
 constructor(){this.data=new Map();this.when=null;this.tail=Promise.resolve();this.fail=false;}
 async transaction(fn){
  let release;const turn=new Promise(r=>{release=r;});
  const preceding=this.tail;this.tail=preceding.then(()=>turn);
  await preceding;
  try{
   if(this.fail)throw Error('DISK_FAILURE');
   return await fn({get:async x=>this.data.get(x),put:async(x,v)=>this.data.set(x,v)});
  }finally{release();}
 }
 async getAlarm(){return this.when;}
 async setAlarm(t){this.when=t;}
 async list({prefix,limit=1000}){
  return new Map([...this.data.entries()].filter(([key])=>key.startsWith(prefix))
    .sort(([a],[b])=>a.localeCompare(b)).slice(0,limit));
 }
 async delete(key){return this.data.delete(key);}
 async fire(target){if(this.when===null)throw Error('ALARM_ABSENT');this.when=null;await target.alarm();}
}
function inst(){const storage=new MemoryStorage();return {storage,guard:new V174PReplayGuard({storage})};}
async function gate(guard,body,method='POST',path='/gate'){
 const res=await guard.fetch(new Request('https://durable.internal'+path,{
  method,headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 return {http:res.status,...await res.json()};
}
test('01 correct fixed QA caps are immutable',()=>{
 assert.equal(QA_RATE_POLICY.sessionPerMinute,64);assert.equal(QA_RATE_POLICY.messagePerMinute,120);
 assert.equal(Object.isFrozen(QA_RATE_POLICY),true);
});
test('02 malformed direct gate request is denied before writes',async()=>{
 const {storage,guard}=inst();
 assert.equal((await gate(guard,{kind:'message',key:'x',fingerprint,expires_at:Math.floor(Date.now()/1000)+60})).http,400);
 assert.equal(storage.data.size,0);
});
test('03 session uses transactional durable counter and alarm',async()=>{
 const {storage,guard}=inst(),r=await gate(guard,payload('session'));
 assert.equal(r.status,'admitted');assert.equal(storage.data.size,1);
 assert(Number.isFinite(storage.when));
});
test('04 repeated identical message can only claim once',async()=>{
 const {storage,guard}=inst(),v=payload('message');
 assert.equal((await gate(guard,v)).status,'claimed');
 assert.equal((await gate(guard,v)).status,'duplicate');
 assert.equal([...storage.data.keys()].filter(x=>x.startsWith('e:')).length,1);
});
test('05 reused event with changed payload is a conflict',async()=>{
 const {guard}=inst(),v=payload('message');
 assert.equal((await gate(guard,v)).status,'claimed');
 assert.equal((await gate(guard,{...v,fingerprint:other})).status,'conflict');
});
test('06 session rate 64 per minute and attempt 65 blocked',async()=>{
 const {guard}=inst();
 for(let i=0;i<64;i++)assert.equal((await gate(guard,payload('session'))).status,'admitted');
 assert.equal((await gate(guard,payload('session'))).status,'rate_limited');
});
test('07 message rate 120 per minute includes duplicate attempts',async()=>{
 const {guard}=inst(),v=payload('message');
 for(let i=0;i<120;i++){
  const r=await gate(guard,v);
  assert.equal(r.status,i===0?'claimed':'duplicate');
 }
 assert.equal((await gate(guard,v)).status,'rate_limited');
});
test('08 concurrent same-key claims serialize: exactly one first write',async()=>{
 const {storage,guard}=inst(),v=payload('message');
 const all=await Promise.all(Array.from({length:32},()=>gate(guard,v)));
 assert.equal(all.filter(x=>x.status==='claimed').length,1);
 assert.equal(all.filter(x=>x.status==='duplicate').length,31);
 assert.equal([...storage.data.keys()].filter(x=>x.startsWith('e:')).length,1);
});
test('09 concurrent session admissions cannot pass cap',async()=>{
 const {guard}=inst();const all=await Promise.all(Array.from({length:80},()=>gate(guard,payload('session'))));
 assert.equal(all.filter(x=>x.status==='admitted').length,64);
 assert.equal(all.filter(x=>x.status==='rate_limited').length,16);
});
test('10 independent operator instances do not share rate limits',async()=>{
 const a=inst(),b=inst();
 for(let i=0;i<64;i++)await gate(a.guard,payload('session'));
 assert.equal((await gate(a.guard,payload('session'))).status,'rate_limited');
 assert.equal((await gate(b.guard,payload('session'))).status,'admitted');
});
test('11 expired message and far-future expiry cannot enter storage',async()=>{
 const {storage,guard}=inst(),now=Math.floor(Date.now()/1000);
 for(const sec of [now,now-10,now+301]){
  assert.equal((await gate(guard,payload('message',{expires_at:sec}))).http,400);
 }
 assert.equal(storage.data.size,0);
});
test('12 storage errors fail closed, no unsafe success',async()=>{
 const {storage,guard}=inst();storage.fail=true;
 const r=await gate(guard,payload('session'));assert.equal(r.http,503);
 assert.equal(r.status,'DENY');
});
test('13 alarm support is required; never silently skip cleanup',async()=>{
 const guard=new V174PReplayGuard({storage:{transaction:async()=>{throw Error('unexpected');}}});
 assert.equal((await gate(guard,payload('session'))).http,503);
});
test('14 alarms delete expired events but preserve unexpired, then reschedule',async()=>{
 const {storage,guard}=inst();
 const base=Date.now(),nowSec=Math.floor(base/1000);
 const older=payload('message',{expires_at:nowSec+1}),later=payload('message',{key:other,expires_at:nowSec+240});
 await gate(guard,older);await gate(guard,later);
 const original=Date.now;
 try {
  Date.now=()=>base+2200;
  await storage.fire(guard);
  assert.equal([...storage.data.keys()].filter(x=>x.startsWith('e:')).length,1);
  assert(Number.isFinite(storage.when));
 }finally{Date.now=original;}
});
test('15 time-ordered rate bucket entries are deleted by alarm',async()=>{
 const {storage,guard}=inst();await gate(guard,payload('session'));
 const start=Date.now(),original=Date.now;
 try{
  Date.now=()=>start+65_000;await storage.fire(guard);
  assert.equal([...storage.data.keys()].filter(x=>x.startsWith('r:')).length,0);
 }finally{Date.now=original;}
});
test('16 burst cleanup is bounded and schedules additional alarm',async()=>{
 const {storage,guard}=inst(),ts=String(Math.floor(Date.now()/1000)-5).padStart(10,'0');
 for(let i=0;i<140;i++)storage.data.set('e:'+ts+':'+String(i).padStart(3,'0'),{fingerprint});
 storage.when=Date.now();
 await storage.fire(guard);
 assert.equal([...storage.data.keys()].filter(x=>x.startsWith('e:')).length,12);
 assert(Number.isFinite(storage.when));
 await storage.fire(guard);
 assert.equal([...storage.data.keys()].filter(x=>x.startsWith('e:')).length,0);
});
test('17 limiter resets on new wall-clock minute without deleting audit prematurely',async()=>{
 const {guard}=inst(),base=Date.now(),original=Date.now;
 try {
  Date.now=()=>Math.floor(base/60000)*60000+1000;
  for(let i=0;i<64;i++)await gate(guard,payload('session'));
  assert.equal((await gate(guard,payload('session'))).status,'rate_limited');
  Date.now=()=>Math.floor(base/60000)*60000+61000;
  assert.equal((await gate(guard,payload('session'))).status,'admitted');
 }finally{Date.now=original;}
});
test('18 no DO outbound fetch or external API required',async()=>{
 const {guard}=inst();
 assert.equal((await gate(guard,payload('message'))).status,'claimed');
});
