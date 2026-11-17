import {describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {runInDurableObject,evictDurableObject} from 'cloudflare:test';

const endpoint='https://durable.internal/private/claim-once';
const ACCOUNT='ac01685529c0a31fc185335f07648edf';
const WORKER='tien404-v174p-private-qa-issuer';
const newStub=()=>env.V174P_PERMIT_LEDGER_LOCAL.get(
 env.V174P_PERMIT_LEDGER_LOCAL.idFromName('LOCAL_FIRST_UPLOAD_'+crypto.randomUUID()));
const item=(extras={})=>({
 nonce_hash:'a'.repeat(64),permit_hash:'b'.repeat(64),
 operator_subject_hash:'c'.repeat(64),account_id:ACCOUNT,worker_name:WORKER,
 phase:'FIRST_UPLOAD_INACTIVE_ONLY',expires_at:Date.now()+180000,...extras
});
async function claim(stub,data,opts={}){
 const response=await stub.fetch(new Request(endpoint,{method:opts.method||'POST',
  headers:{'Content-Type':opts.contentType||'application/json'},
  body:JSON.stringify(data)}));
 return {http:response.status,...await response.json()};
}
describe('4B.3 REAL local Workerd SQLite one-use permit ledger — never hosted',()=>{
 it('01 first claim yields durable receipt and hard disables upload permission',async()=>{
  const stub=newStub();
  const r=await claim(stub,item());
  expect(r.http).toBe(200);
  expect(r.claimed).toBe(true);
  expect(r.durable_commit_confirmed).toBe(true);
  expect(r.upload_authorized).toBe(false);
  expect(r.cloudflare_hosted).toBe(false);
  expect(r.receipt_id).toMatch(/^[a-f0-9-]{36}$/);
  await runInDurableObject(stub,async(_instance,state)=>{
   expect(state.storage.sql.databaseSize).toBeGreaterThan(0);
   const rows=state.storage.sql.exec('SELECT nonce_hash,worker_name FROM claims').toArray();
   expect(rows).toHaveLength(1);
   expect(rows[0].worker_name).toBe(WORKER);
  });
 });
 it('02 20-way concurrent identical claims: exactly one wins',async()=>{
  const stub=newStub();
  const results=await Promise.all(Array.from({length:20},()=>claim(stub,item())));
  expect(results.filter(x=>x.http===200)).toHaveLength(1);
  expect(results.filter(x=>x.http===409)).toHaveLength(19);
 });
 it('03 different signed nonces cannot create second first-upload target',async()=>{
  const stub=newStub();
  expect((await claim(stub,item())).http).toBe(200);
  expect((await claim(stub,item({nonce_hash:'d'.repeat(64),permit_hash:'e'.repeat(64)}))).http).toBe(409);
 });
 it('04 durable row survives actual SQLite Durable Object eviction',async()=>{
  const stub=newStub();
  expect((await claim(stub,item())).http).toBe(200);
  await evictDurableObject(stub);
  expect((await claim(stub,item({nonce_hash:'f'.repeat(64)}))).http).toBe(409);
 });
 it('05 even a different operator cannot overwrite the consumed target',async()=>{
  const stub=newStub();
  expect((await claim(stub,item())).http).toBe(200);
  const other=await claim(stub,item({nonce_hash:'d'.repeat(64),operator_subject_hash:'e'.repeat(64)}));
  expect(other.http).toBe(409);
 });
 it('06 malformed, expired, wrong-account and wrong-target claims never commit',async()=>{
  const stub=newStub();
  expect((await claim(stub,item({nonce_hash:'not-hex'}))).http).toBe(400);
  expect((await claim(stub,item({account_id:'bad-account'}))).http).toBe(400);
  expect((await claim(stub,item({worker_name:'tien404-v175e2-durable-replay-nosend-staging'}))).http).toBe(400);
  expect((await claim(stub,item({expires_at:Date.now()-1000}))).http).toBe(400);
  await runInDurableObject(stub,async(_instance,state)=>{
   expect(state.storage.sql.exec('SELECT nonce_hash FROM claims').toArray()).toHaveLength(0);
  });
 });
 it('07 oversized body, method and invalid media type are blocked',async()=>{
  const stub=newStub();
  expect((await claim(stub,item(),{method:'PUT'})).http).toBe(405);
  expect((await claim(stub,item(),{contentType:'text/plain'})).http).toBe(415);
  expect((await claim(stub,item({junk:'x'.repeat(1500)}))).http).toBe(413);
 });
 it('08 first committed claim is still durable after invalid second request',async()=>{
  const stub=newStub();
  expect((await claim(stub,item())).http).toBe(200);
  expect((await claim(stub,item({worker_name:'other-worker'}))).http).toBe(400);
  expect((await claim(stub,item())).http).toBe(409);
 });
});
