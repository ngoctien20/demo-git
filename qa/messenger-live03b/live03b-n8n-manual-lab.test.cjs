'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'live03b-n8n-manual-lab.js'),'utf8');
function run(scenario='ALL'){
 const wrapped=new vm.Script('(function(){\n'+source+'\n})()');
 const output=wrapped.runInNewContext({$input:{first:()=>({json:{scenario}})}},{timeout:1200});
 return output.map(x=>x.json);
}
const cases=['BLOCK_CREATE_ORDER','BLOCK_MANAGE_ORDER','BLOCK_UPDATE_ADDRESS',
 'BLOCK_META_SEND','BLOCK_HTTP','BLOCK_UNKNOWN','BLOCK_UNVERIFIED',
 'BLOCK_FAKE_ADMIN','BLOCK_STORE_OVERRIDE','READ_CATALOG_A','QUOTE_SHOP_A',
 'ISOLATE_SHOP_B','BLOCK_SHOP_B_PRICE_A','BLOCK_QUOTE_AS_ORDER',
 'PREPARE_NO_WRITE','CONFIRM_MOCK_ONLY','BLOCK_CONFIRM_NO_TEXT',
 'REPLAY_MOCK_NO_DUPLICATE','BLOCK_INSUFFICIENT_STOCK','BLOCK_WRONG_TOTAL',
 'BLOCK_CROSS_SENDER_CONFIRM'];
test('01 all 21 fixture-only n8n scenarios pass',()=>{
 const r=run();assert.equal(r.length,21);
 for(const name of cases)assert.equal(r.find(x=>x.scenario===name)?.status,'PASS');
});
test('02 every scenario has zero writes, zero provider sends',()=>{
 for(const x of run()){assert.equal(x.googleSheetsWrites,0);assert.equal(x.orderWrites,0);
 assert.equal(x.hostedWrites,0);assert.equal(x.stockWrites,0);
 assert.equal(x.providerSends,0);assert.equal(x.externalToolCalls,0);
 assert.equal(x.isRealOrder,false);assert.equal(x.isRealMessengerTest,false);}
});
test('03 outcomes explicitly distinguish simulated "signed" flag from real HMAC',()=>{
 for(const x of run()){assert.equal(x.syntheticSignatureFlagOnly,true);
 assert.equal(x.realHmacValidationInThisLab,false);
 assert.equal(x.testMode,'INACTIVE_MANUAL_SYNTHETIC_QA_ONLY');}
});
test('04 n8n lab blocks all actual order-writer tools',()=>{
 for(const n of ['BLOCK_CREATE_ORDER','BLOCK_MANAGE_ORDER','BLOCK_UPDATE_ADDRESS']){
 const x=run(n)[0];assert.equal(x.scenario,n);assert.equal(x.status,'PASS');}
});
test('05 same SKU must have different prices for Shop A versus Shop B',()=>{
 assert.equal(run('QUOTE_SHOP_A')[0].status,'PASS');
 assert.equal(run('ISOLATE_SHOP_B')[0].status,'PASS');
 assert.equal(run('BLOCK_SHOP_B_PRICE_A')[0].status,'PASS');
});
test('06 signed-text mock confirmation cannot occur on mere LLM approval',()=>{
 assert.equal(run('BLOCK_CONFIRM_NO_TEXT')[0].status,'PASS');
 assert.equal(run('CONFIRM_MOCK_ONLY')[0].status,'PASS');
 assert.equal(run('BLOCK_CROSS_SENDER_CONFIRM')[0].status,'PASS');
});
test('07 unknown scenario fails closed',()=>{
 const r=run('DO_NOT_EXIST');assert.equal(r.length,1);assert.equal(r[0].status,'FAIL');
 assert.equal(r[0].externalToolCalls,0);assert.equal(r[0].orderWrites,0);
});
test('08 each selected scenario executes alone',()=>{
 for(const name of cases){const r=run(name);assert.equal(r.length,1);
 assert.equal(r[0].scenario,name);assert.equal(r[0].status,'PASS');}
});
test('09 source has no external I/O access, no credentials and no hard-coded real PSID',()=>{
 for(const banned of ['require(', 'fetch(', 'axios(', 'process.env','graph.facebook.com',
  'ngoctien20.app.n8n.cloud','createClient(', 'googleSheets.append(']){
 assert.equal(source.includes(banned),false,'forbidden I/O marker '+banned);}
});
