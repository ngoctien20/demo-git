'use strict';
/** Offline reproduce exact G0.11 manual n8n Code node source. No DB/provider. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'INACTIVE_N8N_CRASH_RECOVERY_SDK.js'),'utf8');
const codes=[...source.matchAll(/jsCode:("(?:\\.|[^"\\])*")/g)].map(x=>JSON.parse(x[1]));
assert.equal(codes.length,3);
const clone=x=>JSON.parse(JSON.stringify(x));
function run(js,input){
 const v=input?.map(x=>({json:x}))||[{json:{}}];
 const ctx={$input:{first:()=>v[0],all:()=>v}};
 const result=vm.runInNewContext('(function(){'+js+'\n})()',ctx,{timeout:1000});
 return clone(result.map(x=>x.json));
}
function pipeline(mutateSource,mutateSummary){
 const generated=run(codes[0],[{}])[0];
 if(mutateSource)mutateSource(generated);
 const state=run(codes[1],[generated])[0];
 if(mutateSummary)mutateSummary(state);
 return {generated,state,final:()=>run(codes[2],[state])[0]};
}
test('workflow source only Manual + Code, no webhook, credentials, DB, Send or model',()=>{
 assert.equal((source.match(/n8n-nodes-base\.manualTrigger/g)||[]).length,1);
 assert.equal((source.match(/n8n-nodes-base\.code/g)||[]).length,3);
 for(const forbidden of ['n8n-nodes-base.webhook','n8n-nodes-base.httpRequest',
   'n8n-nodes-base.dataTable','n8n-nodes-base.postgres','n8n-nodes-base.supabase',
   'n8n-nodes-base.googleSheets','@n8n/n8n-nodes-langchain',
   'process.env','newCredential('])assert.equal(source.includes(forbidden),false,forbidden);
});
test('30/30 actual simulator steps and no-send guard pass',()=>{
 const r=pipeline().final();
 assert.equal(r.status,'G11_INACTIVE_CRASH_RECOVERY_30_OF_30_PASS');
 assert.equal(r.passed,30);assert.equal(r.cases,30);
 assert.equal(r.syntheticEventLedgerRows,6);
 assert.equal(r.manual_review_needed,1);
 assert.equal(r.realProviderEventsTested,0);
 assert.equal(r.provider_sends,0);assert.equal(r.orders_written,0);
 assert.equal(r.can_publish,false);
 assert.equal(r.durablePgProofHere,false);
});
test('worker crash then lease reclaim fences stale worker',()=>{
 const r=pipeline().state.results;
 assert.equal(r[0].actual,'claimed');
 assert.equal(r[1].actual,'leased');
 assert.equal(r[2].actual,'reclaimed');
 assert.equal(r[3].actual,'stale_worker');
 assert.equal(r[4].actual,'completed');
});
test('no send possible after uncertain boundary',()=>{
 const p=pipeline();
 for(const n of [8,9,10])assert.equal(p.state.results[n].actual,'manual_review');
 assert.equal(p.state.state_counts.SEND_UNCERTAIN,1);
});
test('DB completion outage never marks DONE until reclaimed later',()=>{
 const r=pipeline().state.results;
 assert.equal(r[23].actual,'denied_db');
 assert.equal(r[24].actual,'leased');
 assert.equal(r[25].actual,'reclaimed');
 assert.equal(r[26].actual,'completed');
});
test('client Store claim, wrong provider and all-green claims denied',()=>{
 const r=pipeline().state.results;
 for(const n of [17,18,19,20,27])assert.equal(r[n].actual,'denied_source');
});
test('same MID with changed payload conflict, not a silent duplicate',()=>{
 assert.equal(pipeline().state.results[6].actual,'conflict');
});
test('a direct self-claim that DB was tested is rejected before simulation',()=>{
 assert.throws(()=>pipeline(g=>g.database_used=true),/G11_UNTRUSTED_QA_SOURCE/);
});
test('a direct claim of real signed Meta inbound is rejected',()=>{
 assert.throws(()=>pipeline(g=>g.signed_provider_event_received=true),/G11_UNTRUSTED_QA_SOURCE/);
});
test('wrong number of synthetic scenarios is rejected',()=>{
 assert.throws(()=>pipeline(g=>g.cases.pop()),/G11_UNTRUSTED_QA_SOURCE/);
});
test('unknown client authority injected into an event is not accepted as schema',()=>{
 assert.throws(()=>pipeline(g=>g.cases[0].storeId='FAKE_MERCHANT'),
  /G11_QA_CASE_SCHEMA_DRIFT/);
});
test('altering operator/owner source to caller self-claim changes first PASS to DENY',()=>{
 const p=pipeline(g=>g.cases[0].authoritySource='CLIENT_SELF_ATTESTED');
 assert.throws(()=>p.final(),/G11_FAILED_CASE_QA_G11_01/);
});
test('falsely reporting a Send after legitimate case is refused at assertion',()=>{
 const p=pipeline(null,s=>s.provider_sends=1);
 assert.throws(()=>p.final(),/G11_UNSAFE_LIVE_RELEASE_OR_QA_COUNT/);
});
test('falsely reporting a Commerce read is refused at assertion',()=>{
 const p=pipeline(null,s=>s.commerce_reads=1);
 assert.throws(()=>p.final(),/G11_UNSAFE_LIVE_RELEASE_OR_QA_COUNT/);
});
test('an automatic retry of uncertain event is not considered pass',()=>{
 const p=pipeline(null,s=>s.results[9].actual='reclaimed');
 assert.throws(()=>p.final(),/G11_FAILED_CASE_QA_G11_10/);
});
test('if one manual-review event is lost the ledger-count assertion refuses pass',()=>{
 const p=pipeline(null,s=>s.state_counts.SEND_UNCERTAIN=0);
 assert.throws(()=>p.final(),/G11_FINAL_EVENT_LEDGER_DRIFT/);
});
test('silent order write cannot be represented as successful QA',()=>{
 const p=pipeline(null,s=>s.results[0].order_write=true);
 assert.throws(()=>p.final(),/G11_FAILED_CASE_QA_G11_01/);
});
test('results have no real PageID/MID/PSID or customer message',()=>{
 const s=JSON.stringify(pipeline().final());
 for(const x of ['9900000001','9900000011','sender_id','rawBody',
  'customer_phone','customer_name'])assert.equal(s.includes(x),false);
});
