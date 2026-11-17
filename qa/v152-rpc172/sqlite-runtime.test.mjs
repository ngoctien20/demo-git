import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
const workerPath=fileURLToPath(new URL('./runtime/worker.mjs',import.meta.url));
async function setup(path){
 const mf=new Miniflare({modules:true,scriptPath:workerPath,compatibilityDate:'2026-11-17',
 durableObjects:{LEDGER:{className:'Rpc172ReplayLedger',useSQLite:true}},
 durableObjectsPersist:path,});
 const ns=await mf.getDurableObjectNamespace('LEDGER');
 return {mf,ns,stub:(name='tenant-qa_store-A')=>ns.getByName(name)};
}
const req=(nonce,operator_id='operator-A')=>new Request('https://private.invalid/internal/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nonce,operator_id})});
const claim=async(s,n,o)=>{const res=await s.fetch(req(n,o));return {status:res.status,...await res.json()}};
test('20 concurrent claims of one nonce: exactly one commits in actual Workerd SQLite',async()=>{const {mf,stub}=await setup();try{const s=stub();const results=await Promise.all(Array.from({length:20},()=>claim(s,'nonce-concurrent')));assert.equal(results.filter(x=>x.ok).length,1);assert.equal(results.filter(x=>x.reason==='REPLAY').length,19)}finally{await mf.dispose()}});
test('rate limit blocks 4th unique nonce for one operator',async()=>{const {mf,stub}=await setup();try{const s=stub();for(let i=0;i<3;i++)assert.equal((await claim(s,'nonce-rate-'+i)).ok,true);assert.equal((await claim(s,'nonce-rate-4')).reason,'RATE_LIMIT')}finally{await mf.dispose()}});
test('operator A quota does not consume operator B quota within the same store',async()=>{const {mf,stub}=await setup();try{const s=stub();for(let i=0;i<3;i++)await claim(s,'nonce-a-'+i,'operator-A');assert.equal((await claim(s,'nonce-b-1','operator-B')).ok,true)}finally{await mf.dispose()}});
test('distinct tenant/store identities remain isolated',async()=>{const {mf,stub}=await setup();try{assert.equal((await claim(stub('tenant-qa_store-A'),'nonce-shared')).ok,true);assert.equal((await claim(stub('tenant-qa_store-B'),'nonce-shared')).ok,true)}finally{await mf.dispose()}});
test('same nonce rejected after recreation of Miniflare instance with persisted SQLite',async()=>{const path=await mkdtemp(join(tmpdir(),'rpc172-do-'));try{let x=await setup(path);assert.equal((await claim(x.stub(),'nonce-persisted')).ok,true);await x.mf.dispose();x=await setup(path);try{assert.equal((await claim(x.stub(),'nonce-persisted')).reason,'REPLAY')}finally{await x.mf.dispose()}}finally{await rm(path,{recursive:true,force:true})}});
test('invalid input rejected with no quota consumed',async()=>{const {mf,stub}=await setup();try{const s=stub();let response=await s.fetch(new Request('https://private.invalid/internal/claim',{method:'POST',body:JSON.stringify({nonce:'!',operator_id:'operator-A'})}));assert.equal(response.status,400);assert.equal((await claim(s,'nonce-after-invalid')).ok,true)}finally{await mf.dispose()}});
test('private DO rejects invalid method and path',async()=>{const {mf,stub}=await setup();try{const s=stub();assert.equal((await s.fetch('https://private.invalid/')).status,404);assert.equal((await s.fetch(new Request('https://private.invalid/nope',{method:'POST'}))).status,404)}finally{await mf.dispose()}});
test('public Worker ingress always 404 and does not expose DO',async()=>{const {mf}=await setup();try{for(const method of ['GET','POST','PUT','DELETE']){const res=await mf.dispatchFetch('https://private.invalid/internal/claim',{method});assert.equal(res.status,404);assert.equal(await res.text(),'')}}finally{await mf.dispose()}});
