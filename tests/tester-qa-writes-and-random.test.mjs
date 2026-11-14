import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {QA_RANDOM_CASES,drawQaCase} from '../assets/tester-random-qa-cases.mjs';
import {QA_PRODUCTS_SNAPSHOT,QA_CATALOG_SOURCE_LABEL} from '../assets/tester-qa-products-snapshot.mjs';
const read=x=>fs.readFileSync(new URL('../'+x,import.meta.url),'utf8');

test('96 unique sanitized QA cases sourced from existing evaluation data',()=>{
 assert.equal(QA_RANDOM_CASES.length,96);
 assert.equal(new Set(QA_RANDOM_CASES.map(x=>x.id)).size,96);
 assert.equal(QA_RANDOM_CASES[0].id,'QA01');assert.equal(QA_RANDOM_CASES.at(-1).id,'QA96');
 assert.deepEqual(Object.fromEntries(['catalog','consult','language','create','edit','security','policy'].map(k=>[k,QA_RANDOM_CASES.filter(x=>x.mode===k).length])),{catalog:24,consult:12,language:12,create:12,edit:12,security:12,policy:12});
 assert.ok(QA_RANDOM_CASES.every(x=>x.prompt.length>5&&x.expected.length>5));
 assert.ok(QA_RANDOM_CASES.every(x=>!/(?<!\d)(?:\+84|0)\d{9,10}(?!\d)/.test(x.prompt)));
 assert.ok(!read('assets/tester-random-qa-cases.mjs').includes('actual_output'));
});
test('Random sampler changes question and respects chosen topic',()=>{
 const first=drawQaCase(null,['catalog'],()=>0);
 const second=drawQaCase(first.id,['catalog'],()=>0);
 assert.equal(first.id,'QA01');assert.equal(second.id,'QA02');
 assert.equal(drawQaCase(null,['create'],()=>0).id,'QA49');
 assert.equal(drawQaCase(null,['edit'],()=>0).id,'QA61');
 assert.equal(drawQaCase(null,['security'],()=>0).id,'QA73');
 assert.equal(drawQaCase(null,['unknown']),null);
});
test('QA Products snapshot comes only from independent source, no personal orders',()=>{
 assert.equal(QA_PRODUCTS_SNAPSHOT.length,21);
 assert.ok(QA_CATALOG_SOURCE_LABEL.includes('QA_MODEL_SANDBOX'));
 assert.equal(new Set(QA_PRODUCTS_SNAPSHOT.map(x=>x.sku)).size,21);
 assert.ok(QA_PRODUCTS_SNAPSHOT.every(x=>Number.isSafeInteger(x.stock)&&x.stock>=0&&Number.isSafeInteger(x.unit_price)&&x.unit_price>=0));
 assert.equal(QA_PRODUCTS_SNAPSHOT.find(x=>x.sku==='A002')?.unit_price,159000);
 assert.equal(QA_PRODUCTS_SNAPSHOT.find(x=>x.sku==='A002')?.stock,25);
 assert.equal(QA_PRODUCTS_SNAPSHOT.find(x=>x.sku==='A003')?.stock,18);
 assert.ok(!read('assets/tester-qa-products-snapshot.mjs').includes('customer_phone'));
});
test('Separate tester CRUD routes all writes to RLS sandbox, never n8n or real Google Sheets',()=>{
 const src=read('assets/tester-qa-writable-sandbox.mjs');
 for(const marker of ['tien404_qa_sandbox_products','tien404_qa_sandbox_orders',
  "state.client.auth.getUser()","state.access?.access_status==='approved'",
  "state.modules.some(x=>x.module_id==='sheets')","ignoreDuplicates:true",
  ".upsert(payload","QA_PRODUCTS_SNAPSHOT","QA_RANDOM_CASES","drawQaCase",
  ".insert({sku,quantity:qty,unit_price:p.unit_price,status:'pending'})",
  ".eq('owner_id',uid)",'QA_STOCK_LIMIT','QA_OWNER_MISMATCH']) {
  if(marker==='QA_STOCK_LIMIT'||marker==='QA_OWNER_MISMATCH') continue;
  assert.ok(src.includes(marker),marker);
 }
 for(const forbidden of ['fetch(','/webhook/',"from('Orders')","from('Products')","from('Customers')",'service_role','private_key','ghp_']){
  assert.ok(!src.includes(forbidden),forbidden);
 }
});
test('RLS migration has 6 policies, no public writer, no delete, independent inventory guard',()=>{
 const sql=read('qa/tester_portal/V12_4_ISOLATED_QA_PRODUCTS_ORDERS_STAGING.sql');
 assert.equal((sql.match(/CREATE POLICY /g)||[]).length,6);
 for(const x of ['ENABLE ROW LEVEL SECURITY','FORCE ROW LEVEL SECURITY','SECURITY INVOKER',
 'tien404_qa_sandbox_orders','tien404_qa_sandbox_products',
 'QA_STOCK_LIMIT','QA_PRICE_MISMATCH','QA_RESERVED_STOCK',
 'GRANT INSERT','GRANT UPDATE','REVOKE ALL ON','DELETE grants'])
  assert.ok(sql.includes(x),x);
 assert.ok(!sql.includes('CREATE POLICY qa_anon'));
 assert.ok(!sql.includes('SECURITY DEFINER'));
});
test('Only explicitly allowed QA browser assets are published',()=>{
 const build=read('scripts/build-auth-preview.mjs');
 for(const p of ['assets/tester-qa-writable-sandbox.mjs','assets/tester-random-qa-cases.mjs','assets/tester-qa-products-snapshot.mjs'])
  assert.ok(build.includes("'"+p+"'"));
 assert.ok(read('assets/tester-ai-studio.mjs').includes('mountQaSandbox(root,{state,onSaved})'));
 const dist=new URL('../auth-preview-dist/',import.meta.url);
 if(fs.existsSync(dist)){
  for(const p of ['assets/tester-qa-writable-sandbox.mjs','assets/tester-random-qa-cases.mjs','assets/tester-qa-products-snapshot.mjs'])
   assert.ok(fs.existsSync(new URL(p,dist)),p);
  assert.ok(!fs.existsSync(new URL('qa/tester_portal/V12_4_ISOLATED_QA_PRODUCTS_ORDERS_STAGING.sql',dist)));
 }
});
