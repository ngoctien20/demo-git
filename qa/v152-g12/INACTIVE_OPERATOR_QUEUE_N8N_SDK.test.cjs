'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sdk=fs.readFileSync(path.join(__dirname,'INACTIVE_OPERATOR_QUEUE_N8N_SDK.js'),'utf8');
const codes=[...sdk.matchAll(/jsCode:("(?:\\.|[^"\\])*")/g)].map(m=>JSON.parse(m[1]));
assert.equal(codes.length,3);
const clone=x=>JSON.parse(JSON.stringify(x));
function run(js,rows){
 const items=(rows||[{}]).map(x=>({json:x}));
 const result=vm.runInNewContext('(function(){'+js+'\n})()',{
  $input:{first:()=>items[0],all:()=>items}
 },{timeout:1200});
 return clone(result.map(r=>r.json));
}
function qa(modifyFixture,modifySummary){
 const fixture=run(codes[0])[0];if(modifyFixture)modifyFixture(fixture);
 const computed=run(codes[1],[fixture])[0];
 if(modifySummary)modifySummary(computed);
 return {fixture,computed,assert:()=>run(codes[2],[computed])[0]};
}
test('topology stays exactly Manual + three Code nodes, no provider/db/AI',()=>{
 assert.equal((sdk.match(/n8n-nodes-base\.manualTrigger/g)||[]).length,1);
 assert.equal((sdk.match(/n8n-nodes-base\.code/g)||[]).length,3);
 for(const forbidden of ['n8n-nodes-base.webhook','n8n-nodes-base.httpRequest',
  'n8n-nodes-base.dataTable','n8n-nodes-base.postgres',
  'n8n-nodes-base.googleSheets','@n8n/n8n-nodes-langchain',
  'process.env','newCredential('])assert.equal(sdk.includes(forbidden),false);
});
test('all 26 exact synthetic steps pass and production remains NO-GO',()=>{
 const result=qa().assert();
 assert.equal(result.status,'G12_INACTIVE_RESTRICTED_OPERATOR_QA_26_OF_26_PASS');
 assert.equal(result.passed,26);
 assert.equal(result.original_send_uncertain_still_blocked,1);
 assert.equal(result.provider_sends,0);
 assert.equal(result.orders_written,0);
 assert.equal(result.can_publish,false);
 assert.equal(result.cutover_status,'HOSTED_NO_GO');
});
test('three review cases are synthetic and source ledger untouched',()=>{
 const x=qa().computed;
 assert.equal(x.case_count,3);
 assert.equal(x.review_states.RESOLVED,3);
 assert.equal(x.immutable_original_states.SEND_UNCERTAIN,1);
 assert.equal(x.immutable_original_states.LEASED,2);
 assert.equal(x.actual_pg17_db_used,false);
});
test('idempotent re-scan creates no new tickets',()=>{
 const x=qa().computed.results;
 assert.equal(x[0].actual,'queued_3');
 assert.equal(x[1].actual,'already_queued');
});
test('second operator cannot override active claim, expired worker is fenced',()=>{
 const x=qa().computed.results;
 assert.equal(x[2].actual,'claimed');
 assert.equal(x[3].actual,'busy');
 assert.equal(x[4].actual,'reclaimed');
 assert.equal(x[5].actual,'fenced');
});
test('reviewer must inspect exact evidence digest, independently',()=>{
 const x=qa().computed.results;
 for(const index of [7,19])
  assert.equal(x[index].actual,'not_independently_verified');
});
test('uncertain send cannot be closed as simple no-send',()=>{
 const x=qa().computed.results;
 assert.equal(x[8].actual,'uncertain_send_denied');
 assert.equal(x[9].actual,'review_recorded_no_send');
 assert.equal(x[10].actual,'denied_auto_retry');
});
test('operator resolving timeout case does not authorize sending',()=>{
 const x=qa().computed.results;
 assert.equal(x[14].actual,'review_recorded_no_send');
 assert.equal(x[15].actual,'denied_auto_retry');
});
test('forged provider, actor, Store and simulated outage are refused',()=>{
 const x=qa().computed.results;
 for(const i of [22,23,25])assert.equal(x[i].actual,'denied_source');
 assert.equal(x[24].actual,'denied_db');
});
test('fake claim of actual pg17 backend is rejected, source not DB',()=>{
 assert.throws(()=>qa(x=>{x.actual_db_access=true}),/G12_QA_SOURCE_UNTRUSTED/);
});
test('client claim of real independent operator credentials cannot promote source',()=>{
 assert.throws(()=>qa(x=>{x.real_operator_authority_verified=true}),/G12_QA_SOURCE_UNTRUSTED/);
});
test('claims of real signed Meta delivery are rejected',()=>{
 assert.throws(()=>qa(x=>{x.actual_provider_received=true}),/G12_QA_SOURCE_UNTRUSTED/);
});
test('client-supplied extra real Page ID field on one review step rejected',()=>{
 assert.throws(()=>qa(x=>{x.actions[0].page_id='fake'}),/G12_OPERATOR_CASE_SCHEMA_INVALID/);
});
test('modified scenario ID fails source order',()=>{
 assert.throws(()=>qa(x=>{x.actions[0].id='QA_G12_999'}),/G12_OPERATOR_CASE_SCHEMA_INVALID/);
});
test('tampered event source original SEND_UNCERTAIN is rejected',()=>{
 assert.throws(()=>qa(x=>{x.events[0].original_state='DONE_NO_SEND'}),/G12_QA_EVENT_SOURCE_DRIFT/);
});
test('falsely reporting provider send as success is rejected',()=>{
 const x=qa(null,s=>{s.provider_sends=1});
 assert.throws(()=>x.assert(),/G12_OPERATOR_QA_NOT_RESTRICTED/);
});
test('fake final approval after case mismatch is refused',()=>{
 const x=qa(null,s=>{s.results[0].actual='GO_LIVE'});
 assert.throws(()=>x.assert(),/G12_CASE_FAILED_QA_G12_01/);
});
test('case count incorrect makes release refusal explicit',()=>{
 const x=qa(null,s=>{s.case_count=2});
 assert.throws(()=>x.assert(),/G12_OPERATOR_QA_NOT_RESTRICTED/);
});
test('final QA never returns real Page, PSID, MID or customer content',()=>{
 const r=qa().assert(),s=JSON.stringify(r);
 for(const secret of ['2379295362359912','customer_name',
  'rawBody','access_token','phone','PSID','message_text'])
  assert.equal(s.includes(secret),false,secret);
});
