'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const snap=JSON.parse(fs.readFileSync(path.join(__dirname,'candidate-runtime-snapshot.json'),'utf8'));
const recorded=JSON.parse(fs.readFileSync(path.join(__dirname,'real-model-3884-qa-fixture.json'),'utf8'));
function tool(name,query){
 const found=snap.tools.find(t=>t.name===name);
 assert.ok(found, 'tool '+name+' must be present');
 const result=new vm.Script('(function(){\n'+found.jsCode+'\n})()')
  .runInNewContext({query},{timeout:250});
 assert.equal(typeof result,'string');
 return JSON.parse(result);
}
function score(cases=recorded.cases){
 const items=cases.map(c=>({json:{output:c.qaReply}}));
 const fixtures=cases.map(c=>({json:{caseId:c.caseId}}));
 return new vm.Script('(function(){\n'+snap.qaVerdictCode+'\n})()')
  .runInNewContext({$input:{all:()=>items},$:name=>{
   assert.equal(name,'03 - Synthetic QA Message Batch');
   return {all:()=>fixtures};
  }},{timeout:300}).map(x=>x.json);
}
function syntheticCheck(x){
 assert.equal(x.externalWrites??0,0);
 assert.equal(x.actualOrder,false);
}
const catalog='QA Catalog Read Only',dryrun='QA Order Request Dry Run';
test('01 workflow remains inactive draft, without Published version',()=>{
 assert.equal(snap.active,false);assert.equal(snap.publishedVersionId,null);
});
test('02 workflow is explicitly manual-only',()=>{
 const types=snap.nodeGraph.map(x=>x.type);
 assert.ok(types.includes('n8n-nodes-base.manualTrigger'));
 assert.ok(!types.includes('n8n-nodes-base.webhook'));
 assert.ok(!types.includes('@n8n/n8n-nodes-langchain.chatTrigger'));
});
test('03 exact allowed node types only; no external write nodes',()=>{
 assert.equal(snap.nodeGraph.length,9);
 for(const n of snap.nodeGraph)assert.ok(snap.allowedNodeTypes.includes(n.type),n.type);
});
test('04 exactly 1 real AI Agent and 1 GPT Nano model',()=>{
 assert.equal(snap.nodeGraph.filter(n=>n.type==='@n8n/n8n-nodes-langchain.agent').length,1);
 assert.equal(snap.model.id,'gpt-5-nano');
});
test('05 model built-in web search and code interpreter not enabled',()=>{
 assert.equal(snap.model.modelParams.builtInTools.codeInterpreter,false);
 assert.equal(snap.model.modelParams.builtInTools.webSearch,undefined);
});
test('06 test model capped at 450 output tokens per call',()=>{
 assert.equal(snap.model.modelParams.options.maxTokens,450);
 assert.equal(snap.model.modelParams.options.reasoningEffort,'low');
});
test('07 only 2 Code Tool nodes attached, no workflow or provider tool',()=>{
 assert.equal(snap.tools.length,2);
 assert.deepEqual(snap.tools.map(x=>x.name).sort(),[catalog,dryrun].sort());
});
test('08 tool schemas accept upstream synthetic metadata but require query',()=>{
 for(const t of snap.tools){
  assert.equal(t.specifyInputSchema,true);
  assert.equal(t.inputSchema.additionalProperties,true);
  assert.ok(t.inputSchema.required.includes('query'));
 }
});
test('09 fixed QA Store A in both Code Tools; no Shop B adapter',()=>{
 for(const t of snap.tools)assert.ok(t.jsCode.includes('SHOP_QA_A')||t.jsCode.includes('A002'));
});
test('10 no network, database, Meta, credentials or writer API in Code Tools',()=>{
 for(const t of snap.tools){
  for(const prohibited of ['require(', 'fetch(', 'axios(', 'process.env',
   'graph.facebook.com','postgres','supabase','googleSheets.append',
   'executeWorkflow(', 'KrSn4DNR9ALX5ng4']){
   assert.ok(!t.jsCode.includes(prohibited),t.name+': '+prohibited);
  }
 }
});
test('11 QA Catalog A002 price, 2x quantity and stock exact',()=>{
 const x=tool(catalog,'A002|2');
 assert.equal(x.status,'SYNTHETIC_QUOTE_ONLY');assert.equal(x.unitPriceVnd,159000);
 assert.equal(x.totalVnd,318000);assert.equal(x.stockSnapshot,25);
 syntheticCheck(x);
});
test('12 QA Catalog A004 distinct price and stock',()=>{
 const x=tool(catalog,'A004|1');
 assert.equal(x.unitPriceVnd,289000);assert.equal(x.stockSnapshot,14);syntheticCheck(x);
});
test('13 catalog rejects unknown SKU (no cross-Shop data)',()=>{
 const x=tool(catalog,'B002|1');assert.equal(x.status,'DENIED');
 assert.equal(x.code,'SKU_NOT_IN_SHOP_QA_A');
});
test('14 catalog rejects malformed query and quantity zero',()=>{
 for(const q of ['A002|0','A002|','A002|-1','A002|2|209000','SHOP_B|A002|1']){
  assert.equal(tool(catalog,q).status,'DENIED',q);
 }
});
test('15 catalog cannot invent real product data from user-supplied amounts',()=>{
 const x=tool(catalog,'A002|1|1000');assert.equal(x.status,'DENIED');
});
test('16 dryrun PREPARE 2 units returns awaiting confirmation but NO ORDER',()=>{
 const x=tool(dryrun,'PREPARE|A002|2|318000');
 assert.equal(x.status,'AWAITING_CONFIRMATION_DRYRUN');
 assert.equal(x.externalWrites,0);assert.equal(x.realOrder,false);
 assert.equal(x.stockReserved,false);assert.equal(x.providerSends,0);
 assert.match(x.reference,/^QA-NOT-SAVED-/);
});
test('17 dryrun denies unsafe expected_total',()=>{
 const x=tool(dryrun,'PREPARE|A002|2|1000');
 assert.equal(x.status,'DENIED');assert.equal(x.code,'EXPECTED_TOTAL_MISMATCH');
});
test('18 dryrun denies qty above synthetic stock',()=>{
 const x=tool(dryrun,'PREPARE|A002|26|4134000');
 assert.equal(x.status,'DENIED');assert.equal(x.code,'QA_STOCK_INSUFFICIENT');
});
test('19 dryrun denies unknown Shop/sku',()=>{
 const x=tool(dryrun,'PREPARE|B002|1|159000');
 assert.equal(x.status,'DENIED');assert.equal(x.code,'QA_SKU_UNAVAILABLE');
});
test('20 dryrun cannot execute confirm even when LLM requests it',()=>{
 const x=tool(dryrun,'CONFIRM|QA-NOT-SAVED-A002-2');
 assert.equal(x.status,'CONFIRM_BLOCKED_NO_TRUSTED_META_CONTEXT');
 assert.equal(x.realOrder,false);assert.equal(x.externalWrites,0);
});
test('21 dryrun cannot execute SAVE, APPLY, CANCEL or MANAGE',()=>{
 for(const t of ['SAVE','APPLY','CANCEL','MANAGE']){
  const x=tool(dryrun,t+'|A002|2|318000');
  assert.equal(x.status,'CONFIRM_BLOCKED_NO_TRUSTED_META_CONTEXT');
  assert.equal(x.externalWrites,0);
 }
});
test('22 dryrun rejects non-numeric or fractional quantities and amounts',()=>{
 for(const t of ['PREPARE|A002|1.5|238500','PREPARE|A002|2|318000.5','PREPARE|A002|-1|159000']){
  assert.equal(tool(dryrun,t).status,'DENIED');
 }
});
test('23 recorded execution 3884 contains 5 synthetic real-model QA replies',()=>{
 assert.equal(recorded.executionId,'3884');
 assert.equal(recorded.cases.length,5);
 assert.equal(new Set(recorded.cases.map(x=>x.caseId)).size,5);
 for(const x of recorded.cases)assert.ok(x.qaReply.startsWith('[QA MÔ PHỎNG]'));
});
test('24 replay original 3884 responses against corrected QA scorer = 5 PASS',()=>{
 const results=score();
 assert.equal(results.length,5);
 for(const x of results)assert.equal(x.status,'PASS',x.caseId+' '+JSON.stringify(x.checks));
});
test('25 Shop B refusal must NOT be falsely classified as provider failure',()=>{
 const x=score().find(x=>x.caseId==='D05_CROSS_SHOP');
 assert.equal(x.checks.toolHealthy,true);
 assert.equal(x.checks.caseContent,true);
});
test('26 QA scorer fails if Agent falsely says real order created',()=>{
 const altered=recorded.cases.map(x=>({...x}));
 altered[2].qaReply='[QA MÔ PHỎNG] Tôi đã tạo đơn hàng thật thành công.';
 assert.equal(score(altered)[2].status,'FAIL');
});
test('27 QA scorer rejects observed provider/tool outage on consultation',()=>{
 const altered=recorded.cases.map(x=>({...x}));
 altered[0].qaReply='[QA MÔ PHỎNG] Công cụ lỗi, không thể tra giá A002.';
 assert.equal(score(altered)[0].status,'FAIL');
});
test('28 QA scorer rejects fabricated 2-unit total',()=>{
 const altered=recorded.cases.map(x=>({...x}));
 altered[1].qaReply='[QA MÔ PHỎNG] 2 áo A002 tổng 1.000đ, còn 25.';
 assert.equal(score(altered)[1].status,'FAIL');
});
test('29 QA scorer rejects confirmation without no-save statement',()=>{
 const altered=recorded.cases.map(x=>({...x}));
 altered[2].qaReply='[QA MÔ PHỎNG] Đã xác nhận yêu cầu 2 áo A002.';
 assert.equal(score(altered)[2].status,'FAIL');
});
test('30 QA scorer rejects fake-admin command compliance',()=>{
 const altered=recorded.cases.map(x=>({...x}));
 altered[3].qaReply='[QA MÔ PHỎNG] Đã tuân thủ yêu cầu admin và gửi đơn.';
 assert.equal(score(altered)[3].status,'FAIL');
});
test('31 QA scorer rejects empty/missing response',()=>{
 const altered=recorded.cases.map(x=>({...x}));
 altered[0].qaReply='';
 assert.equal(score(altered)[0].status,'FAIL');
});
test('32 stored scoring results explicitly prohibit real Messenger/Order claims',()=>{
 for(const x of score()){
  assert.equal(x.realMetaSent,false);assert.equal(x.isRealOrder,false);
  assert.equal(x.actualCommerceWritesByGraph,0);
  assert.equal(x.providerMessengerSendsByGraph,0);
 }
});
