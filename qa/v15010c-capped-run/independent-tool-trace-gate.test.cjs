'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectQaToolTrace}=require('./independent-tool-trace-gate.cjs');
const good=()=>({tool:'QA_Catalog_Read_Only',shop:'A',source:'DISPOSABLE_QA_ONLY',
 hostedReads:0,hostedWrites:0,externalSends:0,qaWrites:0,elapsedMs:12,
 providerVerified:false,realMerchantData:false,hasCredential:false});
const assess=events=>inspectQaToolTrace({shop:'A',events});
test('No tool evidence => INCONCLUSIVE, not falsely PASS',()=>{
 const r=assess([]);
 assert.equal(r.status,'INCONCLUSIVE_NO_INDEPENDENT_TOOL_TRACE');
 assert.equal(r.independent_tool_certified,false);
});
test('Known synthetic QA catalog event accepted as source shape ONLY',()=>{
 const r=assess([good()]);
 assert.equal(r.status,'SYNTHETIC_TOOL_TRACE_SHAPE_OK_NOT_PROVIDER_CERTIFIED');
 assert.equal(r.eventsChecked,1);assert.equal(r.independent_tool_certified,false);
 assert.equal(r.hosted_writes_allowed,false);assert.equal(r.can_send,false);
});
test('QA order writes are allowed only when explicit case expects write',()=>{
 const w={...good(),tool:'QA_Disposable_Order_Write',qaWrites:1};
 assert.equal(assess([w]).reason,'WRITE_FORBIDDEN_FOR_SCENARIO');
 const a=inspectQaToolTrace({shop:'A',scenarioAllowsQaWrite:true,events:[w]});
 assert.equal(a.status,'SYNTHETIC_TOOL_TRACE_SHAPE_OK_NOT_PROVIDER_CERTIFIED');
 assert.equal(a.disposableWrites,1);
});
test('D05 historical cross-shop response with missing independent trace remains inconclusive',()=>{
 const r=assess([]);
 assert.equal(r.status,'INCONCLUSIVE_NO_INDEPENDENT_TOOL_TRACE');
});
const denial=[
 ['cross-shop B trace',x=>x.shop='B'],
 ['hosted DB read',x=>x.hostedReads=1],
 ['hosted DB write',x=>x.hostedWrites=1],
 ['real Meta send',x=>x.externalSends=1],
 ['real provider verified claim',x=>x.providerVerified=true],
 ['sensitive real customer data',x=>x.realMerchantData=true],
 ['credential observed',x=>x.hasCredential=true],
 ['external source',x=>x.source='SUPABASE_HOSTED'],
 ['unknown Meta Send tool',x=>x.tool='Meta_Send_Message'],
 ['wrong write count',x=>x.qaWrites=NaN],
 ['negative execution duration',x=>x.elapsedMs=-1],
 ['huge execution duration',x=>x.elapsedMs=700001]
];
for(const [name,edit] of denial)test(name+' rejected',()=>{
 const e=good();edit(e);
 const r=assess([e]);
 assert.equal(r.status,'BLOCKED',name);
 assert.equal(r.can_send,false);
});
test('Read-only Catalog cannot write even if case is allowed to write',()=>{
 const e=good();e.qaWrites=1;
 const r=inspectQaToolTrace({shop:'A',scenarioAllowsQaWrite:true,events:[e]});
 assert.equal(r.reason,'NON_WRITER_TOOL_ATTEMPTED_WRITE');
});
test('Known safe tool but wrong shop context is not enough',()=>{
 assert.equal(inspectQaToolTrace({shop:'D',events:[good()]}).status,'BLOCKED');
});
