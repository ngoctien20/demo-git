import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEMO_CATALOG,calculateDemo,formatVnd,parseVnd} from '../assets/tester-sandbox.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Synthetic catalog is immutable and explicitly not a real store catalog',()=>{
 assert.ok(Object.isFrozen(DEMO_CATALOG));
 assert.ok(DEMO_CATALOG.every(Object.isFrozen));
 assert.equal(DEMO_CATALOG.length,3);
 assert.equal(formatVnd(159000),'159.000đ');
 assert.ok(read('assets/tester-sandbox.mjs').includes('LOCAL QA PRACTICE ONLY'));
});
test('Local practice computes quote without writing an order',()=>{
 const a=calculateDemo({sku:'QA-DEMO-01',quantity:'2'});
 assert.equal(a.code,'ok');assert.equal(a.total,318000);
 const b=calculateDemo({sku:'qa-demo-02',quantity:'18'});
 assert.equal(b.code,'ok');assert.equal(b.total,2862000);
 const c=calculateDemo({sku:'QA-DEMO-03',quantity:'4'});
 assert.equal(c.code,'ok');assert.equal(c.total,316000);
});
test('Reject invalid quantity, missing SKU and insufficient stock safely',()=>{
 for(const v of ['0','-2','1.5','1e3','<img>',''])assert.equal(calculateDemo({sku:'QA-DEMO-01',quantity:v}).code,'invalid_quantity');
 assert.equal(calculateDemo({sku:'QA-UNKNOWN',quantity:'1'}).code,'not_found');
 assert.equal(calculateDemo({sku:'QA-DEMO-01',quantity:'26'}).code,'out_of_stock');
 assert.equal(calculateDemo({sku:'QA-DEMO-02',quantity:'19'}).code,'out_of_stock');
});
test('VND fixed-price guard does not accept price suggestion or decimals',()=>{
 assert.equal(parseVnd('159.000'),159000);
 assert.equal(parseVnd('159000'),159000);
 assert.equal(parseVnd('159.5'),null);
 assert.equal(parseVnd('159.000,50'),null);
 assert.equal(calculateDemo({sku:'QA-DEMO-01',quantity:'2',offeredPrice:'100000'}).code,'price_mismatch');
 assert.equal(calculateDemo({sku:'QA-DEMO-01',quantity:'1',offeredPrice:'159.000'}).code,'ok');
 assert.equal(calculateDemo({sku:'QA-DEMO-01',quantity:'1',offeredPrice:'159.5'}).code,'invalid_price');
});
test('Tester practice is visible only for assigned Sheets in authenticated workspace',()=>{
 const js=read('assets/tester-portal.js'),html=read('tester.html');
 for(const item of ['renderPractice()','renderDemoPractice(pane)',"state.modules.some(m=>m.module_id==='sheets')",
  "from './tester-sandbox.mjs'","const output=calculateDemo","function canSave()"]){
  assert.ok(js.includes(item),item);
 }
 assert.ok(html.includes('data-page="practice"'));
 assert.ok(js.includes('không chạy AI thật')||js.includes('không phải AI'));
 assert.ok(!read('assets/tester-sandbox.mjs').includes('fetch('));
 assert.ok(!read('assets/tester-sandbox.mjs').includes('/webhook/'));
});
test('Admin grants/assigns only ready synthetic module with readback',()=>{
 const src=read('assets/tester-admin.js');
 for(const item of ['assignSafeSheetsToTester','TESTER_NOT_APPROVED','SAFE_MODULE_NOT_READY',
 "module_id:'sheets',active:true",'ASSIGNMENT_READBACK_FAILED',"Date.parse(valid.data.expires_at)<=Date.now()"])
  assert.ok(src.includes(item),item);
 assert.ok(src.includes('Giao Sheets mẫu'));
});
test('Strict Render build exposes only public synthetic helper, not SQL fixtures',()=>{
 const build=read('scripts/build-auth-preview.mjs');
 assert.ok(build.includes("'assets/tester-sandbox.mjs'"));
 const out=new URL('../auth-preview-dist/',import.meta.url);
 if(fs.existsSync(out)){
   assert.ok(fs.existsSync(new URL('assets/tester-sandbox.mjs',out)));
   assert.ok(!fs.existsSync(new URL('qa/tester_portal/V12_2_SYNTHETIC_SHEETS_PRACTICE_CANDIDATES.sql',out)));
 }
});
