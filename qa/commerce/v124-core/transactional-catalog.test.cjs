'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createTransactionalQaCatalog}=require('./transactional-catalog.cjs');
const {fixture}=require('./qa-harness.cjs');
const {readFileSync}=require('node:fs'),{join}=require('node:path');

const f=fixture(),a=f.ingress.verify(f.event('Shop ơi F01 còn không?'));
const b=f.ingress.verify(f.event('F01 có giá bao nhiêu?',{botRef:'qa-bot-b'}));
const getRole=ctx=>ctx.storeId==='qa-store-a'?'core_qa_a':ctx.storeId==='qa-store-b'?'core_qa_b':null;
const validMeta=role=>({role_name:role,bypass_rls:false,is_superuser:false,
 catalog_rls_active:true,bot_rls_active:true,
 can_read_credential_ref:false,can_read_catalog_source_ref:false,
 can_insert_bot:false,can_update_bot:false,can_delete_bot:false,
 can_insert_catalog:false,can_update_catalog:false,can_delete_catalog:false});
function makePool(role,{failAt=null,rollbackFails=false,productScope=null,delay=0}={}){
 const calls=[],released=[],product={
  tenant_key:role==='core_qa_a'?'qa-tenant-a':'qa-tenant-b',
  store_key:role==='core_qa_a'?'qa-store-a':'qa-store-b',
  bot_key:role==='core_qa_a'?'qa-bot-a':'qa-bot-b',sku:'F01',
  product_name:'Hàng mẫu QA',price_vnd:role==='core_qa_a'?159000:199000,
  stock:role==='core_qa_a'?3:5,read_at:new Date()};
 return {calls,released,connectCalls:0,
  async connect(){
   this.connectCalls++;
   return {async query(sql,args=[]){
     calls.push({sql,args});
     if(delay && sql.includes('FROM tien404_r1_qa.catalog AS c'))
       await new Promise(resolve=>setTimeout(resolve,delay));
     if(rollbackFails && sql==='ROLLBACK')throw Error('ROLLBACK_FAILED');
     if(sql===failAt)throw Error('PG_TEST_FAULT');
     if(sql.includes('row_security_active'))return {rowCount:1,rows:[validMeta(role)]};
     if(sql.includes('FROM tien404_r1_qa.catalog AS c'))return {rowCount:1,rows:[{...product,...productScope}]};
     return {rowCount:0,rows:[]};
    },release(broken){released.push(!!broken);}};
  }};
}
function create(pools,mapper=getRole){
 return createTransactionalQaCatalog({roleForContext:mapper,poolForContext:ctx=>pools[ctx.storeId]});
}
test('Candidate is backend-only and cannot bypass core publication gates',()=>{
 const entry=readFileSync(join(__dirname,'index.cjs'),'utf8');
 const file=readFileSync(join(__dirname,'transactional-catalog.cjs'),'utf8');
 assert.ok(!entry.includes('transactional-catalog.cjs'));
 assert.ok(!file.includes('SET ROLE'));
 assert.ok(!file.includes('service_role'));
 assert.ok(!file.includes('SECURITY DEFINER'));
 assert.equal(createTransactionalQaCatalog({
   roleForContext:()=> 'core_qa_a',poolForContext:()=>makePool('core_qa_a')
 }).kind,'OWNED_READ_ONLY_PG_TRANSACTION_QA_NOT_HOSTED');
});
test('No unverified customer, forged client, invalid SKU or missing server pool may access database',async()=>{
 const pool=makePool('core_qa_a'),adapter=create({'qa-store-a':pool});
 for(const args of [{context:{...a},sku:'F01'},{context:a,sku:'F-01'},
  {context:a,sku:'F01',client:{query:()=>{}}}]){
  await assert.rejects(adapter.readProduct(args));
 }
 assert.equal(pool.connectCalls,0);
 assert.throws(()=>createTransactionalQaCatalog({}),/CATALOG_TRUSTED_POOL_MAPPER_REQUIRED/);
 await assert.rejects(create({'qa-store-a':null}).readProduct({context:a,sku:'F01'}),/CATALOG_TRUSTED_POOL_REQUIRED/);
});
test('Own read-only PostgreSQL transaction protects role proof and catalog SELECT on one lease',async()=>{
 const pool=makePool('core_qa_a');
 const row=await create({'qa-store-a':pool}).readProduct({context:a,sku:'F01'});
 assert.equal(row.priceVnd,159000);
 assert.equal(row.stock,3);
 assert.equal(pool.connectCalls,1);
 assert.equal(pool.calls[0].sql,'BEGIN READ ONLY');
 assert.deepEqual(pool.calls.slice(1,4).map(x=>x.sql),[
  'SET LOCAL row_security = on',"SET LOCAL statement_timeout = '2s'",
  "SET LOCAL idle_in_transaction_session_timeout = '4s'"]);
 assert.ok(pool.calls[4].sql.includes('row_security_active'));
 assert.ok(pool.calls[5].sql.includes('FROM tien404_r1_qa.catalog AS c'));
 assert.deepEqual(pool.calls[5].args,['qa-tenant-a','qa-store-a','qa-bot-a','F01']);
 assert.equal(pool.calls.at(-1).sql,'COMMIT');
 assert.deepEqual(pool.released,[false]);
 assert.equal(pool.calls.some(x=>x.sql==='ROLLBACK'),false);
});
test('A/B separate configured pools concurrently return only own prices and release both leases',async()=>{
 const pa=makePool('core_qa_a',{delay:7}),pb=makePool('core_qa_b',{delay:2});
 const adapter=create({'qa-store-a':pa,'qa-store-b':pb});
 const [ra,rb]=await Promise.all([adapter.readProduct({context:a,sku:'F01'}),
   adapter.readProduct({context:b,sku:'F01'})]);
 assert.equal(ra.priceVnd,159000);assert.equal(rb.priceVnd,199000);
 assert.deepEqual(pa.released,[false]);assert.deepEqual(pb.released,[false]);
 assert.deepEqual(pa.calls.at(-1).sql,'COMMIT');assert.deepEqual(pb.calls.at(-1).sql,'COMMIT');
});
test('Wrong or swapped pool role is denied, with rollback and no catalog SELECT',async()=>{
 const pa=makePool('core_qa_a'),pb=makePool('core_qa_b');
 const adapter=create({'qa-store-a':pb,'qa-store-b':pa});
 await assert.rejects(adapter.readProduct({context:a,sku:'F01'}),/CATALOG_ROLE_UNSAFE/);
 await assert.rejects(adapter.readProduct({context:b,sku:'F01'}),/CATALOG_ROLE_UNSAFE/);
 for(const p of [pa,pb]){
   assert.deepEqual(p.released,[false]);
   assert.equal(p.calls.at(-1).sql,'ROLLBACK');
   assert.equal(p.calls.some(x=>x.sql.includes('FROM tien404_r1_qa.catalog AS c')),false);
 }
});
test('Revoked server binding prevents borrowing and does not read products',async()=>{
 let allowed=true;const pool=makePool('core_qa_a');
 const adapter=createTransactionalQaCatalog({
  roleForContext:()=>allowed?'core_qa_a':null,
  poolForContext:()=>pool
 });
 await adapter.readProduct({context:a,sku:'F01'});
 allowed=false;
 await assert.rejects(adapter.readProduct({context:a,sku:'F01'}),/CATALOG_ROLE_UNAPPROVED/);
 assert.equal(pool.connectCalls,1);
});
test('Bad bot/tenant/store readback aborts transaction, never commits or leaks product',async()=>{
 for(const change of [{tenant_key:'qa-tenant-b'},{store_key:'qa-store-b'},{bot_key:'qa-bot-b'}]){
  const pool=makePool('core_qa_a',{productScope:change});
  await assert.rejects(create({'qa-store-a':pool}).readProduct({context:a,sku:'F01'}),
   /CATALOG_(?:SCOPE_DENIED|CROSS_SCOPE_REJECTED)/);
  assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
  assert.deepEqual(pool.released,[false]);
 }
});
test('Query fails: rollback lease, rollback itself fails: discard broken session',async()=>{
 const p=makePool('core_qa_a',{failAt:"SET LOCAL statement_timeout = '2s'"});
 await assert.rejects(create({'qa-store-a':p}).readProduct({context:a,sku:'F01'}),/PG_TEST_FAULT/);
 assert.deepEqual(p.released,[false]);
 assert.equal(p.calls.at(-1).sql,'ROLLBACK');
 const bad=makePool('core_qa_a',{failAt:"SET LOCAL statement_timeout = '2s'",rollbackFails:true});
 await assert.rejects(create({'qa-store-a':bad}).readProduct({context:a,sku:'F01'}),/PG_TEST_FAULT/);
 assert.deepEqual(bad.released,[true]);
 const begin=makePool('core_qa_a',{failAt:'BEGIN READ ONLY'});
 await assert.rejects(create({'qa-store-a':begin}).readProduct({context:a,sku:'F01'}),/PG_TEST_FAULT/);
 assert.deepEqual(begin.released,[true]);
});
