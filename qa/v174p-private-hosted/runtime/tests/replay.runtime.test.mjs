import {describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {runInDurableObject,runDurableObjectAlarm,evictDurableObject} from 'cloudflare:test';

const domain='https://durable.internal/gate';
const now=()=>Math.floor(Date.now()/1000);
const key='A'.repeat(43),finger='B'.repeat(43);
function newStub(label){
 const id=env.V174P_REPLAY_DO.idFromName('T404_QA_'+label+'_'+crypto.randomUUID());
 return env.V174P_REPLAY_DO.get(id);
}
async function gate(stub,body){
 const r=await stub.fetch(new Request(domain,{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
 return {http:r.status,...await r.json()};
}
const session=()=>({kind:'session'});
const message=(extras={})=>({kind:'message',key,fingerprint:finger,expires_at:now()+240,...extras});
async function keys(stub,prefix){
 return await runInDurableObject(stub,async(_,state)=>[...(await state.storage.list({prefix})).keys()]);
}
describe('V17.4P production-candidate Durable Object on LOCAL real Workers runtime (never hosted)',()=>{
 it('atomic 16-way duplicate replay: exactly 1 first claim / 15 duplicates',async()=>{
  const stub=newStub('concurrent');
  const all=await Promise.all(Array.from({length:16},()=>gate(stub,message())));
  expect(all.filter(x=>x.status==='claimed')).toHaveLength(1);
  expect(all.filter(x=>x.status==='duplicate')).toHaveLength(15);
  expect(await keys(stub,'e:')).toHaveLength(1);
 });
 it('conflicting fingerprint rejected and no secondary event inserted',async()=>{
  const stub=newStub('conflict');
  expect((await gate(stub,message())).status).toBe('claimed');
  expect((await gate(stub,message({fingerprint:'C'.repeat(43)}))).status).toBe('conflict');
  expect(await keys(stub,'e:')).toHaveLength(1);
 });
 it('per-object 64 session admissions + 65th rate-limit; independent second object',async()=>{
  const first=newStub('rateA'),second=newStub('rateB');
  for(let i=0;i<64;i++)expect((await gate(first,session())).status).toBe('admitted');
  expect((await gate(first,session())).status).toBe('rate_limited');
  expect((await gate(second,session())).status).toBe('admitted');
 });
 it('SQLite KV data survives real Durable Object eviction/reinstantiation',async()=>{
  const stub=newStub('eviction');
  expect((await gate(stub,message())).status).toBe('claimed');
  await evictDurableObject(stub);
  expect((await gate(stub,message())).status).toBe('duplicate');
  expect(await keys(stub,'e:')).toHaveLength(1);
 });
 it('SQLite storage and alarm APIs are present and scheduled',async()=>{
  const stub=newStub('sqlite');
  expect((await gate(stub,session())).status).toBe('admitted');
  await runInDurableObject(stub,async(_,state)=>{
   expect(state.storage.sql.databaseSize).toBeGreaterThan(0);
   expect((await state.storage.list({prefix:'r:'})).size).toBe(1);
   expect(await state.storage.getAlarm()).toBeTypeOf('number');
  });
 });
 it('real alarm deletes expired keys while retaining unexpired keys',async()=>{
  const stub=newStub('alarm');
  expect((await gate(stub,session())).status).toBe('admitted');
  const expired=String(now()-5).padStart(10,'0');
  const fresh=String(now()+200).padStart(10,'0');
  await runInDurableObject(stub,async(_,state)=>{
   await state.storage.put('e:'+expired+':'+key,{fingerprint:finger});
   await state.storage.put('e:'+fresh+':'+key,{fingerprint:finger});
   await state.storage.setAlarm(Date.now()+1000);
  });
  expect(await runDurableObjectAlarm(stub)).toBe(true);
  const remaining=await keys(stub,'e:');
  expect(remaining.some(k=>k.startsWith('e:'+expired+':'))).toBe(false);
  expect(remaining.some(k=>k.startsWith('e:'+fresh+':'))).toBe(true);
 });
 it('cleanup backlog of 140 expired events is bounded at 128 per alarm',async()=>{
  const stub=newStub('backlog');
  expect((await gate(stub,session())).status).toBe('admitted');
  const expired=String(now()-10).padStart(10,'0');
  await runInDurableObject(stub,async(_,state)=>{
   for(let i=0;i<140;i++){
    await state.storage.put('e:'+expired+':'+String(i).padStart(3,'0'),{fingerprint:finger});
   }
   await state.storage.setAlarm(Date.now()+1000);
  });
  expect(await runDurableObjectAlarm(stub)).toBe(true);
  expect(await keys(stub,'e:')).toHaveLength(12);
  expect(await runDurableObjectAlarm(stub)).toBe(true);
  expect(await keys(stub,'e:')).toHaveLength(0);
 });
 it('directly called invalid/expired internal claims fail closed',async()=>{
  const stub=newStub('badclaim');
  const invalid=await gate(stub,message({expires_at:now()-1}));
  expect(invalid.http).toBe(400);
  expect(await keys(stub,'e:')).toHaveLength(0);
 });
});
