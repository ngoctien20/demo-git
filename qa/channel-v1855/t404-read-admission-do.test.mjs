import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateReadAdmission } from './read-admission-policy.mjs';

/**
 * Source-backed local SQLite adapter, not an actual Cloudflare runtime.
 * The exact production Durable Object class body is compiled without the
 * Cloudflare-specific import, with explicit shims for ctx and SQL storage.
 * This detects contract/transactional logic failures before hosted approval.
 */
const raw = readFileSync(new URL('./t404-read-admission-do.mjs', import.meta.url), 'utf8');
assert.match(raw, /import \{ DurableObject \} from 'cloudflare:workers'/);
assert.match(raw, /import \{ evaluateReadAdmission \} from '\.\/read-admission-policy\.mjs'/);
assert.match(raw, /this\.ctx\.storage\.transactionSync/);
assert.match(raw, /this\.ctx\.id\?\.name/);
const compiled = raw.replace(/^import [^\n]+\n/gm, '')
  .replace('export class T404ReadAdmission', 'class T404ReadAdmission');
class DurableObjectShim {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}
const T404ReadAdmission = Function('DurableObject', 'evaluateReadAdmission',
  compiled + '\nreturn T404ReadAdmission;')(DurableObjectShim, evaluateReadAdmission);

const make = (n, install = 'v1855-materials-sandbox') => ({
  installationId: install,
  operation: 'catalog.search',
  requestId: 'e12a0f02-8c0d-4ec8-8d31-' + n.toString(16).padStart(12,'0'),
  issuedAt: Date.now()
});

class FakeSQLite {
  row = null;
  reads = 0;
  writes = 0;
  txs = 0;
  sql = {
    exec: (sql, ...args) => {
      if (sql.startsWith('CREATE TABLE IF NOT EXISTS read_admission_state')) return { toArray: () => [] };
      if (sql.startsWith('SELECT json FROM read_admission_state')) {
        this.reads++;
        return { toArray: () => this.row === null ? [] : [{ json: this.row }] };
      }
      if (sql.startsWith('INSERT INTO read_admission_state')) {
        if (args.length !== 1 || typeof args[0] !== 'string') throw new Error('unexpected SQL arguments');
        this.row = args[0];
        this.writes++;
        return { toArray: () => [] };
      }
      throw new Error('unrecognized SQL: ' + sql);
    }
  };
  transactionSync(fn) {
    this.txs++;
    if (typeof fn !== 'function') throw new Error('not a callback');
    return fn();
  }
}

function stub(name) {
  const storage = new FakeSQLite();
  const ctx = {id:{name},storage};
  return {instance:new T404ReadAdmission(ctx,{}),storage};
}

test('source-backed DO first read performs SQL read/write inside a synchronous transaction', async()=>{
  const {instance,storage}=stub('t404-v1855:v1855-materials-sandbox');
  const result=await instance.authorizeRead(make(1));
  assert.equal(result.allowed,true);
  assert.equal(result.status,200);
  assert.equal(result.remaining,19);
  assert.equal(storage.txs,1);
  assert.equal(storage.reads,1);
  assert.equal(storage.writes,1);
  const state=JSON.parse(storage.row);
  assert.deepEqual(Object.keys(state),['accepted']);
  assert.equal(state.accepted.length,1);
  assert.deepEqual(Object.keys(state.accepted[0]).sort(),['at','id']);
});

test('30 concurrent requests serialize as 20 admitted and 10 rate-limited in source simulation', async()=>{
  const {instance,storage}=stub('t404-v1855:v1855-materials-sandbox');
  const decisions=await Promise.all(Array.from({length:30},(_,i)=>instance.authorizeRead(make(i+1))));
  assert.equal(decisions.filter(d=>d.allowed).length,20);
  assert.equal(decisions.filter(d=>d.code==='ADMISSION_RATE_LIMIT').length,10);
  assert.equal(storage.reads,30);
  assert.equal(storage.writes,20);
  assert.equal(JSON.parse(storage.row).accepted.length,20);
  assert.equal(storage.txs,30);
});

test('one installation cannot call a different named Durable Object instance',async()=>{
  const {instance,storage}=stub('t404-v1855:v1855-materials-sandbox');
  const mismatch=await instance.authorizeRead(make(1,'v1855-grocery-sandbox'));
  assert.equal(mismatch.allowed,false);
  assert.equal(mismatch.status,403);
  assert.equal(mismatch.code,'ADMISSION_INSTALLATION_MISMATCH');
  assert.equal(storage.txs,0);
  assert.equal(storage.reads,0);
  assert.equal(storage.writes,0);
});

test('each Sandbox installation has a distinct quota ledger',async()=>{
  const materials=stub('t404-v1855:v1855-materials-sandbox');
  const grocery=stub('t404-v1855:v1855-grocery-sandbox');
  const a=await Promise.all(Array.from({length:20},(_,i)=>materials.instance.authorizeRead(make(i+1))));
  assert.equal(a.every(x=>x.allowed),true);
  const denied=await materials.instance.authorizeRead(make(22));
  assert.equal(denied.status,429);
  const stillAvailable=await grocery.instance.authorizeRead(make(1,'v1855-grocery-sandbox'));
  assert.equal(stillAvailable.allowed,true);
  assert.equal(JSON.parse(materials.storage.row).accepted.length,20);
  assert.equal(JSON.parse(grocery.storage.row).accepted.length,1);
});

test('same UUID twice is a 409 with no second storage write',async()=>{
  const {instance,storage}=stub('t404-v1855:v1855-materials-sandbox');
  const request=make(17);
  const first=await instance.authorizeRead(request);
  assert.equal(first.allowed,true);
  const second=await instance.authorizeRead(request);
  assert.equal(second.allowed,false);
  assert.equal(second.status,409);
  assert.equal(second.code,'ADMISSION_REPLAY');
  assert.equal(storage.writes,1);
});

test('corrupted persisted JSON is fail-closed, never resets the ledger',async()=>{
  const {instance,storage}=stub('t404-v1855:v1855-materials-sandbox');
  storage.row='{malformed';
  const r=await instance.authorizeRead(make(1));
  assert.equal(r.allowed,false);
  assert.equal(r.status,503);
  assert.equal(r.code,'ADMISSION_STATE_CORRUPTED');
  assert.equal(storage.writes,0);
  assert.equal(storage.row,'{malformed');
});

test('semantically corrupted quota state is also fail-closed',async()=>{
  const {instance,storage}=stub('t404-v1855:v1855-materials-sandbox');
  storage.row=JSON.stringify({accepted:[{id:'bad',at:Date.now()}]});
  const r=await instance.authorizeRead(make(2));
  assert.equal(r.allowed,false);
  assert.equal(r.status,503);
  assert.equal(r.code,'ADMISSION_STATE_INVALID');
  assert.equal(storage.writes,0);
});

test('no customer, Store, Token or PII fields are stored even when caller injects them',async()=>{
  const {instance,storage}=stub('t404-v1855:v1855-materials-sandbox');
  const r=await instance.authorizeRead({...make(9),customerId:'person-123',storeId:'store-A',token:'SECRET'});
  assert.equal(r.allowed,true);
  for(const word of ['person-123','store-A','SECRET','customerId','storeId','token']){
    assert.equal(storage.row.includes(word),false);
  }
});

test('class has no public fetch() handler and does not expose customer-facing routes',()=>{
  assert.equal(typeof T404ReadAdmission.prototype.fetch,'undefined');
});
