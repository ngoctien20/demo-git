'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'n8n-manual-stages.json'),'utf8'));
const names=['03 - QA Synthetic Message Fixtures',
 '04 - Mock Page Resolver + Conversation Planner',
 '05 - HARD DENY Tool-Call Boundary',
 '06 - Safe Reply + QA Verdict (NO SEND)'];
function stage(name,items){
 const src=snapshot.stages[name];
 assert.equal(typeof src,'string');
 const script=new vm.Script('(function(){\n'+src+'\n})()');
 const rows=script.runInNewContext({$input:{
  first:()=>items[0]||null,all:()=>items
 }},{timeout:1300});
 return rows;
}
function pipeline(scenario='ALL'){
 let items=[{json:{scenario}}];
 for(const name of names)items=stage(name,items);
 return items.map(x=>x.json);
}
const all=pipeline('ALL');
test('01 source snapshot matches known manual workflow + is Inactive',()=>{
 assert.equal(snapshot.n8nWorkflow,'AuB26qIgAP8AfJhf');
 assert.equal(snapshot.inactive,true);
 assert.equal(snapshot.realMessengerSend,false);
 assert.equal(snapshot.actualHmacInThisLab,false);
 assert.equal(snapshot.realLlmInThisLab,false);
});
test('02 ALL returns 20 distinct ordered QA scenarios',()=>{
 assert.equal(all.length,20);
 assert.equal(new Set(all.map(x=>x.scenario)).size,20);
});
test('03 all 20 scenarios PASS without any I/O',()=>{
 for(const r of all){
 assert.equal(r.status,'PASS',r.scenario);
 assert.equal(r.googleSheetsWrites,0);
 assert.equal(r.hostedWrites,0);
 assert.equal(r.realOrders,0);
 assert.equal(r.stockWrites,0);
 assert.equal(r.providerSends,0);
 assert.equal(r.realToolExecutions,0);
 assert.equal(r.isRealMessengerOrder,false);
 }
});
test('04 signed flag explicitly lacks real HMAC verification',()=>{
 for(const r of all){
 assert.equal(r.realHmacVerifiedHere,false);
 assert.equal(r.realAIAgentCalled,false);
 assert.equal(r.stage,'MANUAL_STAGING_QA_NOT_MESSENGER');
 }
});
test('05 truthful pre-order state and mock-only confirmation',()=>{
 assert.equal(all.find(x=>x.scenario==='PREPARE_A').actualState,'QA_CONFIRMATION_REQUIRED');
 assert.equal(all.find(x=>x.scenario==='CONFIRM_A').actualState,'QA_MOCK_CONFIRMED_NOT_SAVED');
 assert.equal(all.find(x=>x.scenario==='REPLAY_A').actualState,'QA_MOCK_CONFIRMED_NOT_SAVED');
});
test('06 real create/manage/update tool proposals denied before invocation',()=>{
 for(const key of ['BLOCK_CREATE_ORDER','BLOCK_MANAGE_ORDER','BLOCK_UPDATE_ADDRESS']){
 const x=all.find(x=>x.scenario===key);
 assert.equal(x.status,'PASS');assert.equal(x.actualState,'DENIED');
 assert.equal(x.reason,'TOOL_DENIED_BEFORE_EXECUTION');
 }
});
test('07 external Meta Send proposal denied',()=>{
 const x=all.find(x=>x.scenario==='BLOCK_META_SEND');
 assert.equal(x.actualState,'DENIED');
 assert.equal(x.providerSends,0);
});
test('08 Shop B independent SKU pricing and price mismatch denied',()=>{
 assert.equal(all.find(x=>x.scenario==='QUOTE_B').actualState,'QA_REPLY_READY');
 assert.equal(all.find(x=>x.scenario==='CROSS_STORE_PRICE').reason,'EXPECTED_TOTAL_MISMATCH');
});
test('09 unsigned & unknown Page fixtures fail closed',()=>{
 assert.equal(all.find(x=>x.scenario==='BLOCK_UNSIGNED').actualState,'DENIED');
 assert.equal(all.find(x=>x.scenario==='BLOCK_UNKNOWN_PAGE').actualState,'DENIED');
});
test('10 synthetic Admin/storeOverride proposals fail closed',()=>{
 for(const key of ['BLOCK_FAKE_ADMIN','BLOCK_STORE_OVERRIDE']){
 assert.equal(all.find(x=>x.scenario===key).actualState,'DENIED');
 }
});
test('11 quote-only cannot create an order',()=>{
 assert.equal(all.find(x=>x.scenario==='QUOTE_NOT_ORDER').actualState,'QA_REPLY_READY');
 assert.equal(all.find(x=>x.scenario==='QUOTE_NOT_ORDER').realOrders,0);
});
test('12 another synthetic sender cannot confirm other sender pending',()=>{
 const r=all.find(x=>x.scenario==='BLOCK_OTHER_SENDER_CONFIRM');
 assert.equal(r.reason,'NO_PENDING_OR_OTHER_SENDER');
});
test('13 no live network, env secrets, callbacks or real order connectors',()=>{
 for(const [name,code] of Object.entries(snapshot.stages)){
 for(const forbidden of ['require(', 'axios(', 'fetch(', 'process.env',
 'graph.facebook.com','KrSn4DNR9ALX5ng4','createClient(','executeWorkflow(']){
 assert.equal(code.includes(forbidden),false,name+': '+forbidden);
 }
 }
});
test('14 unknown scenario cannot accidentally run a success scenario',()=>{
 const r=pipeline('NONEXISTENT_QA');
 assert.equal(r.length,0);
});
test('15 single QA scenario selection is reproducible',()=>{
 for(const r of all){
 const [single]=pipeline(r.scenario);
 if(['CONFIRM_A','REPLAY_A','BLOCK_OTHER_SENDER_CONFIRM'].includes(r.scenario)){
   // Test depends on preceding PREPARE_A in ALL; isolated execution must fail closed.
   assert.equal(single.actualState,'DENIED');
   assert.equal(single.status,'FAIL');
 }else{
   assert.equal(single.scenario,r.scenario);
   assert.equal(single.status,'PASS',r.scenario);
 }
 }
});
