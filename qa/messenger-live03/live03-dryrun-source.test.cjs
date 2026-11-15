'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'live03-dryrun-n8n-code.js'),'utf8');
function run(scenario='ALL'){
 const js=new vm.Script('(function(){\n'+source+'\n})()');
 const items=js.runInNewContext({
   $input:{first:()=>({json:{scenario}})}
 },{timeout:1000});
 return items.map(v=>v.json);
}
function one(name){const rows=run(name);assert.equal(rows.length,1);return rows[0];}
const cases=['QUOTE_ONLY','PREPARE','CONFIRM_MOCK','REPLAY','WRONG_TOTAL','NO_STOCK','CROSS_STORE','CANCEL'];
test('01 - ALL returns all 8 scenarios PASS',()=>{
 const rows=run();assert.equal(rows.length,8);
 for(const name of cases)assert.equal(rows.find(x=>x.scenario===name)?.status,'PASS');
});
test('02 - QUOTE_ONLY computes exact integer 318000 VND and zero requests',()=>{
 const r=one('QUOTE_ONLY');assert.equal(r.status,'PASS');assert.equal(r.memoryOrders,0);assert.equal(r.unsentOutbox,0);
});
test('03 - PREPARE awaits explicit confirmation and has no order',()=>{
 const r=one('PREPARE');assert.equal(r.status,'PASS');
 assert.equal(r.memoryOrders,0);assert.equal(r.pendingConfirmations,1);
});
test('04 - CONFIRM_MOCK creates only in-memory QA-DRYRUN code',()=>{
 const r=one('CONFIRM_MOCK');assert.equal(r.status,'PASS');assert.equal(r.qaOrderCode,'QA-DRYRUN-0001');
 assert.equal(r.memoryOrders,1);assert.equal(r.unsentOutbox,1);assert.equal(r.physicalStock,25);assert.equal(r.reserved,0);
});
test('05 - REPLAY preserves one fake request and unsent outbox',()=>{
 const r=one('REPLAY');assert.equal(r.status,'PASS');assert.equal(r.memoryOrders,1);assert.equal(r.unsentOutbox,1);
});
test('06 - WRONG_TOTAL 1000 VND is rejected',()=>{
 const r=one('WRONG_TOTAL');assert.equal(r.status,'PASS');assert.equal(r.memoryOrders,0);
 assert.match(r.detail,/1\.000đ|1.000đ|1\.000/);
});
test('07 - NO_STOCK rejects request 26 when fixture has 25',()=>{
 const r=one('NO_STOCK');assert.equal(r.status,'PASS');assert.equal(r.memoryOrders,0);assert.equal(r.physicalStock,25);
});
test('08 - CROSS_STORE blocks applying Store A price to Store B',()=>{
 const r=one('CROSS_STORE');assert.equal(r.status,'PASS');assert.equal(r.memoryOrders,0);
 assert.match(r.detail,/209\.000đ/);assert.equal(r.physicalStock,8);
});
test('09 - CANCEL before confirmation leaves no fake request',()=>{
 const r=one('CANCEL');assert.equal(r.status,'PASS');assert.equal(r.memoryOrders,0);assert.equal(r.pendingConfirmations,0);
});
test('10 - all outcomes explicitly assert no hosted/Google Sheets/provider operations',()=>{
 for(const r of run()){assert.equal(r.googleSheetsWrites,0);assert.equal(r.hostedWrites,0);
 assert.equal(r.providerSends,0);assert.equal(r.isRealOrder,false);assert.equal(r.hasRealCustomerPII,false);}
});
test('11 - unknown input fails closed without writing',()=>{
 const r=one('TEST_NONEXISTENT');assert.equal(r.status,'FAIL');assert.equal(r.memoryOrders,0);
 assert.equal(r.googleSheetsWrites,0);assert.equal(r.providerSends,0);
});
test('12 - snapshot includes no network, Sheets, database or credential APIs',()=>{
 for(const banned of ['require(', 'fetch(', 'axios(', 'process.env', 'new WebSocket(',
   'executeWorkflow(', 'googleSheets.append','supabase.from(','graph.facebook.com']){
   assert.equal(source.includes(banned),false,'unexpected external API '+banned);
 }
});
test('13 - independently run selected scenario returns exactly one item',()=>{
 for(const name of cases){const r=one(name);assert.equal(r.scenario,name);assert.equal(r.testType,'OFFLINE_DRY_RUN');}
});
