'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPostgresKnowledgeRepository,membershipSQL,knowledgeSQL}=require('./postgres-repository.cjs');
const deny=(fn,code)=>assert.rejects(fn(),e=>e?.code===code);
const memberRow={tenant_id:'tenant-a',store_id:'store-a',user_id:'user-a',
 role:'SHOP_OWNER',active:true,tenant_membership_active:true,
 staff_store_assignment_active:false};
test('Member lookup parameterized and joins BOTH store and tenant membership',async()=>{
 let called;
 const repo=createPostgresKnowledgeRepository({query:async(...args)=>{called=args;return {rows:[memberRow]}}});
 const r=await repo.lookupStoreAssignment({user_id:'user-a',store_id:'store-a'});
 assert.equal(r.source,'AUTHORITATIVE_DATABASE');assert.equal(r.tenant_id,'tenant-a');
 assert.deepEqual(called[1],['user-a','store-a']);
 assert.match(called[0],/sm\.user_id=\$1/);assert.match(called[0],/sm\.store_id=\$2/);
 assert.match(called[0],/JOIN public\.tenant_memberships/);assert.match(called[0],/AND tm\.active/);
});
test('Injection-like store text remains bound data, never merged into SQL',async()=>{
 let seen;
 const repo=createPostgresKnowledgeRepository({query:async(...args)=>{seen=args;return {rows:[]}}});
 await repo.lookupStoreAssignment({user_id:"a' OR 1=1--",store_id:'store-b'});
 assert.deepEqual(seen[1],["a' OR 1=1--",'store-b']);
 assert.equal(seen[0].includes('1=1--'),false);
});
test('Read uses exact tenant+store keys and public published gate',async()=>{
 let called;
 const repo=createPostgresKnowledgeRepository({query:async(...args)=>{called=args;return {rows:[{
  tenant_id:'tenant-a',store_id:'store-a',version:'knowledge-a-1',state:'PUBLISHED',
  revision:2,entries:[]
 }]}}});
 const r=await repo.readPublishedKnowledge({tenant_id:'tenant-a',store_id:'store-a',role:'CUSTOMER_PUBLIC_READ'});
 assert.equal(r.state,'PUBLISHED');assert.equal(r.source,'AUTHORITATIVE_DATABASE');
 assert.deepEqual(called[1],['tenant-a','store-a']);
 assert.match(called[0],/r\.tenant_id=\$1/);assert.match(called[0],/r\.store_id=\$2/);
 assert.match(called[0],/i\.visibility='PUBLIC'/);
 assert.match(called[0],/r\.state='PUBLISHED'/);
 assert.match(called[0],/r\.merchant_approved_by IS NOT NULL/);
});
test('No unrestricted read role accepted',()=>deny(()=>createPostgresKnowledgeRepository({
 query:async()=>({rows:[]})
}).readPublishedKnowledge({tenant_id:'tenant-a',store_id:'store-a',role:'STAFF_ONLY'}),'KNOWLEDGE_READ_SCOPE_INVALID'));
test('No query handler rejected',()=>assert.throws(()=>createPostgresKnowledgeRepository(),e=>e.code==='SQL_QUERY_ADAPTER_MISSING'));
test('Malformed SQL adapter result rejected',()=>deny(()=>createPostgresKnowledgeRepository({
 query:async()=>({notRows:[]})
}).lookupStoreAssignment({user_id:'user-a',store_id:'store-a'}),'ASSIGNMENT_QUERY_FAILED'));
test('No user membership yields null, not another store',async()=>{
 const repo=createPostgresKnowledgeRepository({query:async()=>({rows:[]})});
 const r=await repo.lookupStoreAssignment({user_id:'user-a',store_id:'store-b'});
 assert.equal(r,null);
});
test('Zero matching published release yields null, not draft',async()=>{
 const repo=createPostgresKnowledgeRepository({query:async()=>({rows:[]})});
 const r=await repo.readPublishedKnowledge({tenant_id:'tenant-a',store_id:'store-b',role:'CUSTOMER_PUBLIC_READ'});
 assert.equal(r,null);
});
test('Multiple release rows are invalid — fail closed',()=>deny(()=>createPostgresKnowledgeRepository({
 query:async()=>({rows:[{},{}]})
}).readPublishedKnowledge({tenant_id:'tenant-a',store_id:'store-a',role:'CUSTOMER_PUBLIC_READ'}),'KNOWLEDGE_QUERY_FAILED'));
test('No database mutate methods available',()=>{
 const repo=createPostgresKnowledgeRepository({query:async()=>({rows:[]})});
 assert.equal(repo.createOrder,undefined);assert.equal(repo.createDraft,undefined);
 assert.equal(repo.publish,undefined);assert.equal(repo.updateRls,undefined);
});
test('No broad tenant-only SKU lookup in adapter',()=>{
 assert.equal(/where.+tenant_id=\$1.+(?<!store_id=)\s*limit/i.test(membershipSQL),false);
 assert.match(knowledgeSQL,/r\.store_id=\$2/);
});
test('Knowledge query filters expired and unverified public rows at SQL layer',()=>{
 assert.match(knowledgeSQL,/i\.expires_at>now\(\)/);
 assert.match(knowledgeSQL,/i\.source_status='VERIFIED'/);
 assert.match(knowledgeSQL,/i\.merchant_approved/);
});
