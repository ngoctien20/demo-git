import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
globalThis.crypto ||= webcrypto;
const source=readFileSync(new URL('./live02-nosend-worker.mjs',import.meta.url),'utf8');
assert.ok(source.includes('__QA_PUBLIC_JWK__'));
assert.ok(!source.includes('sendMessage(')&&!source.includes('await fetch('));
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const pub=await webcrypto.subtle.exportKey('jwk',keys.publicKey);
const code=source.replace('__QA_PUBLIC_JWK__',JSON.stringify(pub));
const app=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
const H=x=>x.repeat(64);
const scope={grant_id:'qa_live02_test_01',tenant_hash:H('a'),store_hash:H('b'),bot_hash:H('c'),recipient_hash:H('d'),session_hash:H('e'),event_hash:H('f')};
const fixture=(extra={})=>JSON.stringify({kind:'TIEN404_LIVE02_QA_V1',...scope,ts_ms:Date.now(),expected_revision:0,sequence:1,reserve_tokens:100,...extra});
const grant={...scope,issued_ms:Date.now()-1000,expires_ms:Date.now()+60000,status:'QA_ARMED',environment:'OFFLINE_QA'};
const db=(over={})=>({prepare(sql){return {bind(){return {async first(){return sql.includes('z145z_live01_grants')?({...grant,...over.grant}):{replies_claimed:1,model_calls_claimed:1,tokens_reserved:100}},async all(){if(over.reject)throw Error('DB_DENIED');return {results:over.duplicate?[]:[{event_hash:H('f')}]}}}}}}});
async function signature(raw){const b=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode('TIEN404-LIVE02-QA-V1\nPOST\n/v1/qa/claim\n'+raw));return Buffer.from(b).toString('base64url')}
async function call(path,raw='',sig='',environment={LIVE02_DB:db()},method='POST'){const headers={'content-type':'application/json'};if(sig)headers['x-tien404-qa-signature']=sig;return app.fetch(new Request('https://qa.invalid/'+path,{method,headers,...(method==='GET'?{}:{body:raw||'{}'})}),environment)}
test('health no-send and D1 bound',async()=>{const r=await call('health','','',{LIVE02_DB:db()},'GET');const j=await r.json();assert.equal(r.status,200);assert.equal(j.d1_bound,true);assert.equal(j.sends,0)});
test('permanent send/webhook lock 423',async()=>{for(const p of ['v1/send','v1/provider/send','webhook/zalo'])assert.equal((await call(p)).status,423)});
test('unsigned input rejected 401',async()=>{assert.equal((await call('v1/qa/claim',fixture())).status,401)});
test('malformed input rejected 400',async()=>{assert.equal((await call('v1/qa/claim','{oops')).status,400)});
test('unexpected field and fourth sequence rejected 422',async()=>{assert.equal((await call('v1/qa/claim',fixture({verified:true}))).status,422);assert.equal((await call('v1/qa/claim',fixture({sequence:4}))).status,422)});
test('signed QA accepted and no sends',async()=>{const raw=fixture(),r=await call('v1/qa/claim',raw,await signature(raw)),j=await r.json();assert.equal(r.status,200);assert.equal(j.sends,0);assert.equal(j.status,'QA_ATOMIC_RESERVED')});
test('signed cross-shop mismatch rejected 403',async()=>{const raw=fixture({store_hash:H('a')}),r=await call('v1/qa/claim',raw,await signature(raw));assert.equal(r.status,403)});
test('signed duplicate rejected 409',async()=>{const raw=fixture(),r=await call('v1/qa/claim',raw,await signature(raw),{LIVE02_DB:db({duplicate:true})});assert.equal(r.status,409)});
test('D1 atomic denial fail closed 409',async()=>{const raw=fixture(),r=await call('v1/qa/claim',raw,await signature(raw),{LIVE02_DB:db({reject:true})});assert.equal(r.status,409)});
test('expired grant rejected 403',async()=>{const raw=fixture(),r=await call('v1/qa/claim',raw,await signature(raw),{LIVE02_DB:db({grant:{expires_ms:Date.now()-10000}})});assert.equal(r.status,403)});
