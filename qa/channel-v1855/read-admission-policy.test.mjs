import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReadAdmission, READ_WINDOW_MS, READ_MAX_PER_WINDOW } from './read-admission-policy.mjs';

const NOW = 1_900_000_000_000;
const reqId = n => '00000000-0000-4000-8000-' + n.toString(16).padStart(12, '0');
const make = (n, time = NOW, installationId = 'v1855-materials-sandbox', operation = 'catalog.search') =>
  ({installationId,operation,requestId:reqId(n),issuedAt:time});
const feed = (state, n, time = NOW) => evaluateReadAdmission(state, make(n, time), time);

test('allows the first authorized Sandbox read and persists only request ID/timestamp', () => {
  const result=feed(null,1);
  assert.equal(result.allowed,true);
  assert.equal(result.status,200);
  assert.equal(result.remaining, READ_MAX_PER_WINDOW-1);
  assert.deepEqual(result.nextState,{accepted:[{id:reqId(1),at:NOW}]});
  assert.equal(JSON.stringify(result.nextState).includes('tenantId'),false);
});

test('rejects a repeated exact request ID inside the freshness window', () => {
  const first=feed(null,1);
  const repeat=feed(first.nextState,1,NOW+200);
  assert.equal(repeat.allowed,false);
  assert.equal(repeat.status,409);
  assert.equal(repeat.code,'ADMISSION_REPLAY');
  assert.equal(repeat.nextState,null);
});

test('enforces strict rolling quota of 20 per 60 seconds', () => {
  let state=null;
  for(let n=1;n<=READ_MAX_PER_WINDOW;n++){
    const r=feed(state,n,NOW+n);
    assert.equal(r.allowed,true,'admitted '+n);
    state=r.nextState;
  }
  const blocked=feed(state,READ_MAX_PER_WINDOW+1,NOW+100);
  assert.equal(blocked.allowed,false);
  assert.equal(blocked.status,429);
  assert.equal(blocked.code,'ADMISSION_RATE_LIMIT');
  assert.equal(blocked.nextState,null);
  const later=feed(state,READ_MAX_PER_WINDOW+1,NOW+READ_WINDOW_MS+201);
  assert.equal(later.allowed,true);
  assert.equal(later.remaining,READ_MAX_PER_WINDOW-1);
  assert.equal(later.nextState.accepted.length,1);
});

test('denies malformed, stale and future-dated timestamps', () => {
  for(const bad of [NOW-READ_WINDOW_MS-1,NOW+READ_WINDOW_MS+1,0,'1900000000000',NaN]){
    const r=evaluateReadAdmission(null,make(1,bad),NOW);
    assert.equal(r.allowed,false,String(bad));
    assert.equal(r.status,403);
  }
});

test('denies unknown installations, writes, private reads and invalid request ID', () => {
  for(const r of [
    make(1,NOW,'other-install','catalog.search'),
    make(1,NOW,'v1855-materials-sandbox','order.read'),
    make(1,NOW,'v1855-materials-sandbox','order.create'),
    {...make(1),requestId:'not-a-uuid'},
  ]){
    const a=evaluateReadAdmission(null,r,NOW);
    assert.equal(a.allowed,false);
    assert.equal(a.status,403);
  }
});

test('accepts legitimate grocery Sandbox cart preview',()=>{
  const r=evaluateReadAdmission(null,make(7,NOW,'v1855-grocery-sandbox','cart.preview'),NOW);
  assert.equal(r.allowed,true);
  assert.equal(r.nextState.accepted.length,1);
});

test('never changes persistent state on denial',()=>{
  const first=feed(null,1);
  const initial=JSON.stringify(first.nextState);
  const deny=evaluateReadAdmission(first.nextState,make(1),NOW+1);
  assert.equal(deny.nextState,null);
  assert.equal(JSON.stringify(first.nextState),initial);
});

test('invalid stored state fails closed rather than resetting the quota',()=>{
  for(const state of [7,'bad',[],{accepted:undefined},{accepted:'bad'}]){
    const r=feed(state,2);
    assert.equal(r.allowed,false);
    assert.equal(r.status,503);
    assert.equal(r.code,'ADMISSION_STATE_INVALID');
  }
});

test('prunes expired valid records without relaxing ledger constraints',()=>{
  const previous={accepted:Array.from({length:READ_MAX_PER_WINDOW},(_,i)=>({id:reqId(i+1),at:NOW-READ_WINDOW_MS-5}))};
  const result=feed(previous,100,NOW);
  assert.equal(result.allowed,true);
  assert.equal(result.nextState.accepted.length,1);
  assert.equal(result.nextState.accepted[0].id,reqId(100));
});

test('production and multi-tenant identities are never present in persisted quota state',()=>{
  const request={...make(2),tenantId:'injected',storeId:'store-B',customerId:'private'};
  const result=evaluateReadAdmission(null,request,NOW);
  assert.equal(result.allowed,true); // policy does not trust / serialize extra fields
  const persisted=JSON.stringify(result.nextState);
  for(const term of ['tenantId','storeId','customerId','injected','store-B','private']){
    assert.equal(persisted.includes(term),false);
  }
});

test('oversized persistent ledgers are rejected, never silently cleared',()=>{
  const previous={accepted:Array.from({length:READ_MAX_PER_WINDOW+1},(_,i)=>({id:reqId(i+1),at:NOW-READ_WINDOW_MS-5}))};
  const result=feed(previous,100,NOW);
  assert.equal(result.allowed,false);
  assert.equal(result.status,503);
  assert.equal(result.code,'ADMISSION_STATE_INVALID');
});

test('malformed ledger entry cannot reset quota, even if already expired',()=>{
  for(const entry of [
    null,
    1,
    {id:'bad',at:NOW},
    {id:reqId(5),at:NOW+1},
    {id:reqId(5),at:-1},
    {id:reqId(5),at:'1900000000000'},
    {id:reqId(5),at:NOW,extra:'unexpected'},
    [],
  ]){
    const result=feed({accepted:[entry]},2,NOW);
    assert.equal(result.allowed,false,JSON.stringify(entry));
    assert.equal(result.status,503);
  }
});

test('duplicate request IDs already stored in ledger are corruption',()=>{
  const previous={accepted:[{id:reqId(1),at:NOW-100},{id:reqId(1),at:NOW-50}]};
  const result=feed(previous,2,NOW);
  assert.equal(result.allowed,false);
  assert.equal(result.code,'ADMISSION_STATE_INVALID');
});

test('unsupported ledger properties and storage clock rollback are blocked',()=>{
  const extra=feed({accepted:[],untrusted:'stray'},2,NOW);
  assert.equal(extra.allowed,false);
  assert.equal(extra.status,503);
  const clockRollback=feed({accepted:[{id:reqId(1),at:NOW+1}]},2,NOW);
  assert.equal(clockRollback.allowed,false);
  assert.equal(clockRollback.code,'ADMISSION_STATE_INVALID');
});
