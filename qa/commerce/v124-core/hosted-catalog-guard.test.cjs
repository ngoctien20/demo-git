'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createRlsEnforcedQaCatalog}=require('./hosted-catalog-guard.cjs');
const {fixture}=require('./qa-harness.cjs');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const f=fixture(),ctx=f.ingress.verify(f.event('F01'));
const checked={role_name:'core_qa_a',bypass_rls:false,is_superuser:false,
 catalog_rls_active:true,bot_rls_active:true,can_read_credential_ref:false,
 can_read_catalog_source_ref:false,can_insert_bot:false,can_update_bot:false,can_delete_bot:false,
 can_insert_catalog:false,can_update_catalog:false,can_delete_catalog:false};
const product={tenant_key:ctx.tenantId,store_key:ctx.storeId,bot_key:ctx.botRef,
 sku:'F01',product_name:'Áo trắng QA',price_vnd:159000,stock:3,read_at:new Date()};
function client(row=checked,prod=product){
 const calls=[];
 return {calls,async query(sql,args=[]){
  calls.push({sql,args});
  if(sql.includes('row_security_active'))return {rowCount:1,rows:[row]};
  return {rowCount:prod?1:0,rows:prod?[prod]:[]};
 }};
}
const guard=role=>createRlsEnforcedQaCatalog({roleForContext:()=>role});

test('require trusted role-mapper; never publish this backend-only candidate by default',()=>{
 assert.throws(()=>createRlsEnforcedQaCatalog(),/CATALOG_ROLE_MAPPER_REQUIRED/);
 const index=readFileSync(join(__dirname,'index.cjs'),'utf8');
 assert.ok(!index.includes('hosted-catalog-guard.cjs'));
});
test('only trusted HMAC-derived Customer context with transactional client is accepted',async()=>{
 const g=guard('core_qa_a'),c=client();
 await assert.rejects(g.readProduct({context:{...ctx},sku:'F01',client:c}),/CATALOG_TRUSTED_SESSION_REQUIRED/);
 await assert.rejects(g.readProduct({context:ctx,sku:'F01'}),/CATALOG_TRUSTED_SESSION_REQUIRED/);
 await assert.rejects(g.readProduct({context:ctx,sku:'F01',client:{}}),/CATALOG_TRUSTED_SESSION_REQUIRED/);
 assert.equal(c.calls.length,0);
});
test('valid non-bypass PostgreSQL role reads only requested tenant/store/bot/SKU',async()=>{
 const c=client(),result=await guard('core_qa_a').readProduct({context:ctx,sku:'F01',client:c});
 assert.equal(result.priceVnd,159000);
 assert.equal(result.stock,3);
 assert.equal(result.source,'QA_BACKEND_READBACK');
 assert.equal(c.calls.length,2);
 assert.ok(c.calls[0].sql.includes("row_security_active('tien404_r1_qa.catalog'"));
 assert.deepEqual(c.calls[1].args,[ctx.tenantId,ctx.storeId,ctx.botRef,'F01']);
 assert.ok(!c.calls[1].sql.includes('credential_ref'));
});
test('wrong role, bypass RLS, privileged superuser, RLS disabled and unneeded grants fail closed',async()=>{
 const variants=[
 {field:'role_name',value:'core_qa_b'},{field:'role_name',value:'postgres'},
 {field:'bypass_rls',value:true},{field:'is_superuser',value:true},
 {field:'catalog_rls_active',value:false},{field:'bot_rls_active',value:false},
 {field:'can_read_credential_ref',value:true},{field:'can_read_catalog_source_ref',value:true},
 {field:'can_insert_bot',value:true},{field:'can_update_bot',value:true},{field:'can_delete_bot',value:true},
 {field:'can_insert_catalog',value:true},{field:'can_update_catalog',value:true},
 {field:'can_delete_catalog',value:true}
 ];
 for(const {field,value} of variants){
  const c=client({...checked,[field]:value});
  await assert.rejects(guard('core_qa_a').readProduct({context:ctx,sku:'F01',client:c}),
    /CATALOG_ROLE_UNSAFE/,field);
  assert.equal(c.calls.length,1,'Catalog SQL must not execute after failed '+field);
 }
});
test('unapproved expected role and missing metadata fail without reading product',async()=>{
 for(const role of ['postgres','authenticated','service_role','tien404_customer_unscoped', '']){
  const c=client();
  await assert.rejects(guard(role).readProduct({context:ctx,sku:'F01',client:c}),/CATALOG_ROLE_UNAPPROVED/);
  assert.equal(c.calls.length,0);
 }
 const c=client();c.query=async()=>({rowCount:0,rows:[]});
 await assert.rejects(guard('core_qa_a').readProduct({context:ctx,sku:'F01',client:c}),/CATALOG_ROLE_UNVERIFIED/);
});
test('wrong tenant/store/bot from SQL readback is never silently accepted',async()=>{
 for(const field of ['tenant_key','store_key','bot_key']){
  const p={...product,[field]:'qa-attacker'};
  const c=client(checked,p);
  // The underlying QA repository rejects a wrong bot_key earlier than the wrapper.
  await assert.rejects(guard('core_qa_a').readProduct({context:ctx,sku:'F01',client:c}),
    /CATALOG_(?:CROSS_SCOPE_REJECTED|SCOPE_DENIED)/);
  assert.equal(c.calls.length,2);
 }
});
