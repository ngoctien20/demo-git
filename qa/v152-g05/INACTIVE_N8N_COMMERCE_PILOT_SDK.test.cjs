'use strict';
/**
 * G0.5 isolated Node22 source regression — executes trusted SDK Code-node JS
 * within a sandbox for synthetic fixtures, never n8n/Supabase/provider I/O.
 * This is supplementary to actual n8n manual execution 4360.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sdk=fs.readFileSync(path.join(__dirname,'INACTIVE_N8N_COMMERCE_PILOT_SDK.js'),'utf8');
const scripts=[...sdk.matchAll(/jsCode:("(?:\\.|[^"\\])*")/g)].map(m=>JSON.parse(m[1]));
assert.equal(scripts.length,4,'SDK must contain exactly four reviewed Code node scripts');

const T1='11111111-1111-4111-8111-111111111111';
const T2='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const registry=[
 ['MESSENGER','QA_PAGE_A',T1,SA,'QA_BOT_A_V1','ACTIVE',2000000000000],
 ['MESSENGER','QA_PAGE_B',T1,SB,'QA_BOT_B_V1','ACTIVE',2000000000000],
 ['ZALO_OA','QA_OA_B',T1,SB,'QA_BOT_B_V1','ACTIVE',2000000000000],
 ['ZALO_BOT','QA_BOT_ROUTE_A',T1,SA,'QA_BOT_A_V1','ACTIVE',2000000000000],
 ['WEBSITE','QA_WIDGET_C',T2,SC,'QA_BOT_C_V1','ACTIVE',2000000000000],
 ['MESSENGER','QA_PAGE_REVOKED',T1,SA,'QA_BOT_A_V1','REVOKED',2000000000000],
 ['MESSENGER','QA_PAGE_EXPIRED',T1,SA,'QA_BOT_A_V1','ACTIVE',1600000000000]
].map(([provider,installation_ref,tenant_id,store_id,bot_profile_version,binding_status,expires_at_ms])=>({
 provider,installation_ref,tenant_id,store_id,bot_profile_version,binding_status,
 expires_at_ms,registry_version:1,qa_owner_marker:true,qa_only:true,
 read_only:true,approval_scope:'QA_SYNTHETIC_NO_REAL_OWNER'}));
const catalog=[
 [T1,SA,'A002','QA áo mẫu A',159000,5],
 [T1,SA,'A003','QA sản phẩm riêng A',99000,4],
 [T1,SB,'A002','QA hàng mẫu B',259000,2],
 [T2,SC,'A002','QA hàng mẫu C',309000,8]
].map(([tenant_id,store_id,sku,product_name,price_vnd,stock])=>({
 tenant_id,store_id,sku,product_name,price_vnd,stock,active:true,
 catalog_revision:1,qa_only:true}));
const clone=x=>JSON.parse(JSON.stringify(x));

function run(source,items=[],refs={}){
 const wrappers=items.map(x=>({json:x}));
 const ref=name=>{
  if(!Object.hasOwn(refs,name))throw Error('UNAUTHORIZED_NODE_REF');
  const entries=refs[name].map(x=>({json:x}));
  return Object.freeze({
   first:()=>entries[0],
   all:()=>entries
  });
 };
 const context={$input:Object.freeze({
  all:()=>wrappers,
  first:()=>wrappers[0]
 }),$:ref};
 const output=vm.runInNewContext('(function(){'+source+'\n})()',context,{timeout:1000});
 return clone(output.map(x=>x.json));
}
function state(reg=registry,cat=catalog,caseMutator=()=>{}){
 const generated=run(scripts[0],[{}])[0];
 caseMutator(generated.cases);
 const g=run(scripts[1],reg)[0];
 const evalRefs={
  'Generate G05 Synthetic Ingress Cases':[generated],
  'Validate G05 Synthetic Installation Registry':[g],
  'Read G05 QA Installation Registry':reg
 };
 const result=run(scripts[2],cat,evalRefs)[0];
 return {generated,guard:g,result,final:()=>run(scripts[3],[result])[0]};
}

test('source contains only manual trigger, 4 Code nodes, and 2 QA Data Table GETs',()=>{
 assert.equal((sdk.match(/n8n-nodes-base\.manualTrigger/g)||[]).length,1);
 assert.equal((sdk.match(/n8n-nodes-base\.code/g)||[]).length,4);
 assert.equal((sdk.match(/n8n-nodes-base\.dataTable/g)||[]).length,2);
 assert.equal((sdk.match(/operation:'get'/g)||[]).length,2);
 for(const forbidden of ['n8n-nodes-base.webhook','n8n-nodes-base.httpRequest',
  'n8n-nodes-base.googleSheets','@n8n/n8n-nodes-langchain','newCredential(',
  'fetch(','axios(','createOrder(','sendMessage(']){
  assert.equal(sdk.includes(forbidden),false,forbidden);
 }
 assert.equal(sdk.includes('3KfooDe1hXk3yN0r'),true);
 assert.equal(sdk.includes('qOrmoXfIobogX16d'),true);
});
test('full 21 synthetic QA cases PASS with allow 6 deny 14 duplicate 1',()=>{
 const s=state();
 assert.equal(s.generated.cases.length,21);
 assert.equal(s.guard.row_count,7);
 const f=s.final();
 assert.equal(f.status,'G05_QA_21_OF_21_PASS_NO_SEND');
 assert.equal(f.passed,21);
 assert.equal(f.allowed,6);
 assert.equal(f.denied,14);
 assert.equal(f.duplicate,1);
 assert.equal(f.hosted_writes,0);
 assert.equal(f.provider_sends,0);
 assert.equal(f.orders_written,0);
 assert.equal(f.can_publish,false);
 assert.equal(f.release_status,'HOSTED_NO_GO');
});
test('same-Tenant Shop A/B read identical SKU with different trusted QA prices',()=>{
 const out=state().result.results;
 assert.equal(out[0].observed_total_vnd,318000);
 assert.equal(out[1].observed_total_vnd,518000);
 assert.equal(out[2].observed_total_vnd,259000);
 assert.equal(out[4].observed_total_vnd,309000);
});
test('replay case is actually rejected, not silently given a new event ID',()=>{
 const out=state().result.results;
 assert.equal(out[14].case_id,'QA15_DUPLICATE');
 assert.equal(out[14].actual,'DUPLICATE');
});
test('client Store/price/tenant/bot claims and insufficient stock are denied',()=>{
 const out=state().result.results;
 for(const i of [6,7,8,9,10,11,12,13,15,16,17,18,19,20])
  assert.equal(out[i].actual,'DENY',out[i].case_id);
});
test('missing QA registry row fails closed',()=>{
 assert.throws(()=>state(registry.slice(1)),/G05_QA_REGISTRY_COUNT_DRIFT/);
});
test('duplicate QA registry installation fails closed',()=>{
 const rows=clone(registry);
 rows[1].installation_ref=rows[0].installation_ref;
 assert.throws(()=>state(rows),/G05_QA_REGISTRY_AMBIGUOUS_INSTALLATION/);
});
test('swapped merchant Store mapping is refused',()=>{
 const rows=clone(registry);
 rows[0].store_id=SB;
 assert.throws(()=>state(rows),/G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT/);
});
test('invalid Owner marker is rejected, not mistaken for real proof',()=>{
 const rows=clone(registry);rows[0].qa_owner_marker=false;
 assert.throws(()=>state(rows),/G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT/);
});
test('legacy Store alias cannot replace canonical UUID test fixture',()=>{
 const rows=clone(registry);rows[0].store_id='QA_STORE_A';
 assert.throws(()=>state(rows),/G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT/);
});
test('unexpected credential column in registry is rejected',()=>{
 const rows=clone(registry);rows[0].credential='DO_NOT_READ_REAL_TOKENS';
 assert.throws(()=>state(rows),/G05_QA_REGISTRY_SCHEMA_DRIFT/);
});
test('expired installation suddenly marked valid fails fixture check',()=>{
 const rows=clone(registry);rows[6].expires_at_ms=2000000000000;
 assert.throws(()=>state(rows),/G05_QA_EXPIRED_FIXTURE_MUST_EXPIRE/);
});
test('catalog has no Store column => deny, never fallback to Tenant',()=>{
 const rows=clone(catalog);delete rows[0].store_id;
 assert.throws(()=>state(registry,rows),/G05_CATALOG_SOURCE_INVALID/);
});
test('tampered B price is refused, not recomputed by the LLM',()=>{
 const rows=clone(catalog);rows[2].price_vnd=1;
 assert.throws(()=>state(registry,rows),/G05_CATALOG_PRICE_OR_SCOPE_DRIFT/);
});
test('tampered catalog Tenant is rejected',()=>{
 const rows=clone(catalog);rows[2].tenant_id=T2;
 assert.throws(()=>state(registry,rows),/G05_CATALOG_PRICE_OR_SCOPE_DRIFT|G05_CATALOG_SOURCE_INVALID/);
});
test('duplicate Store+SKU catalog entry is rejected',()=>{
 const rows=clone(catalog);rows[2]={...rows[0]};
 assert.throws(()=>state(registry,rows),/G05_CATALOG_PRICE_OR_SCOPE_DRIFT/);
});
test('real customer data cannot enter fixture product schema',()=>{
 const rows=clone(catalog);rows[0].phone='0123456789';
 assert.throws(()=>state(registry,rows),/G05_CATALOG_SOURCE_INVALID/);
});
test('event ID corruption defeats replay fixture acceptance',()=>{
 const s=state(registry,catalog,cases=>{
  cases[14].event_id='QA_NEW_EVENT_NOT_DUPLICATE';
 });
 assert.throws(()=>s.final(),/G05_CASE_STATUS_MISMATCH_QA15_DUPLICATE/);
});
test('price expectation tampering fails final gate',()=>{
 const s=state(registry,catalog,cases=>{cases[0].expected_total_vnd=1});
 assert.throws(()=>s.final(),/G05_STORE_PRICE_MISMATCH_QA01_META_A/);
});
test('replay fixture cannot fake real provider signature or JWT',()=>{
 const f=state().final();
 for(const k of ['actual_owner_store_verified','real_provider_signature_verified',
 'real_jwt_rls_verified','can_publish'])assert.equal(f[k],false);
 for(const uuid of [T1,T2,SA,SB,SC])
  assert.equal(JSON.stringify(f).includes(uuid),false);
});
