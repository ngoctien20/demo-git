'use strict';
// V17.1M exact source snapshot from inactive n8n QA, no external access.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const snapshot=require('./v171m-n8n-qa-snapshot.json');
function code(name){const found=snapshot.securityCode.find(x=>x.name===name);assert.ok(found);return found.jsCode;}
function run(jsCode,input){
 const c={$input:{first:()=>({json:input})}};
 const value=vm.runInNewContext('(function(){'+jsCode+'\n})()',c,{timeout:2000});
 assert.ok(Array.isArray(value)&&value.length===1&&value[0]?.json);
 return JSON.parse(JSON.stringify(value[0].json));
}
function seed(){return run(code('Generate Synthetic Security Fixtures Store A B'),{});}
function evaluate(batch=seed()){return run(code('Evaluate Trusted Store and Tool Gate NO SEND'),batch);}
function finalize(result=evaluate()){return run(code('Assert No Send No Write and Hosted NO GO'),result);}
function find(batch,name,channel){const item=batch.cases.find(x=>x.name===name&&x.channel===channel);assert.ok(item,name+':'+channel);return item;}
function decision(name,channel){const output=evaluate();const item=output.results.find(x=>x.name===name&&x.channel===channel);assert.ok(item,name+':'+channel);return item.decision;}
function mutated(name,channel,patch){
 const batch=seed(),target=find(batch,name,channel);
 Object.assign(target,patch,{expected:'DENY'});
 const out=evaluate(batch);
 return out.results.find(x=>x.caseId===target.caseId);
}
test('01 snapshot bound to exact workflow ID',()=>assert.equal(snapshot.n8nWorkflowId,'dtyaL3RnuNQQwpMX'));
test('02 exact workflow version checkpoint immutable',()=>assert.equal(snapshot.n8nVersionId,'01fad246-5e17-4b58-a43a-63b4376d0296'));
test('03 draft manual-only and inactive',()=>{
 assert.equal(snapshot.active,false);assert.equal(snapshot.activeVersionId,null);
 assert.equal(snapshot.manualOnly,true);
});
test('04 no credential-bearing nodes in snapshot',()=>assert.equal(snapshot.noCredentials,true));
test('05 graph exactly manual trigger and 3 Code nodes',()=>{
 assert.equal(snapshot.nodeTypes.length,4);
 assert.equal(snapshot.nodeTypes.filter(x=>x.type==='n8n-nodes-base.code').length,3);
 assert.equal(snapshot.nodeTypes.filter(x=>x.type==='n8n-nodes-base.manualTrigger').length,1);
});
test('06 no network or process access from fixture evaluator',()=>{
 for(const part of snapshot.securityCode){
   assert.doesNotMatch(part.jsCode,/\bfetch\s*\(|\brequire\s*\(|\bprocess\.env\b|\baxios\b|\$http\b/);
 }
});
test('07 generator creates 192 synthetic cases',()=>{
 const s=seed();assert.equal(s.fixtureOnly,true);
 assert.equal(s.syntheticCaseCount,192);assert.equal(s.cases.length,192);
});
test('08 case identifiers unique',()=>{
 const s=seed();assert.equal(new Set(s.cases.map(x=>x.caseId)).size,192);
});
test('09 exactly 64 tests per channel',()=>{
 const s=seed();for(const ch of ['MESSENGER','ZALO','WEBSITE'])
 assert.equal(s.cases.filter(x=>x.channel===ch).length,64);
});
test('10 Store A/B have two valid registered installations per channel; forged third is denied',()=>{
 const s=seed();
 for(const ch of ['MESSENGER','ZALO','WEBSITE']){
   const selected=s.cases.filter(x=>x.channel===ch);
   const trusted=new Set(selected.map(x=>x.installationId).filter(x=>x.startsWith('QA_')));
   assert.equal(trusted.size,2);
   assert.ok(selected.some(x=>x.installationId==='OTHER_INSTALLATION'));
   assert.equal(decision('unknown installation',ch),'DENY');
 }
});
test('11 baseline source code outputs 192/192 correct decisions',()=>{
 const r=evaluate();assert.equal(r.total,192);assert.equal(r.passed,192);
 assert.ok(r.results.every(x=>x.passed===true));
});
test('12 exact simulated result distribution',()=>{
 const r=evaluate();assert.equal(r.denied,168);
 assert.equal(r.readOnlyPlans,18);assert.equal(r.proposalPlans,6);
});
test('13 Messenger Store A legitimate scoped catalog read is simulated',()=>assert.equal(decision('benign catalog read','MESSENGER'),'SIMULATED_READ_ONLY'));
test('14 Zalo Store A legitimate scoped catalog read is simulated',()=>assert.equal(decision('benign catalog read','ZALO'),'SIMULATED_READ_ONLY'));
test('15 Website Store A legitimate scoped catalog read is simulated',()=>assert.equal(decision('benign catalog read','WEBSITE'),'SIMULATED_READ_ONLY'));
test('16 Messenger Store B legitimate scoped catalog read is simulated',()=>assert.equal(decision('same tenant B own catalog','MESSENGER'),'SIMULATED_READ_ONLY'));
test('17 Zalo Store B legitimate scoped catalog read is simulated',()=>assert.equal(decision('same tenant B own catalog','ZALO'),'SIMULATED_READ_ONLY'));
test('18 Website Store B legitimate scoped catalog read is simulated',()=>assert.equal(decision('same tenant B own catalog','WEBSITE'),'SIMULATED_READ_ONLY'));
test('19 Store A cannot lookup Store B SKU',()=>{
 for(const ch of ['MESSENGER','ZALO','WEBSITE'])
 assert.equal(decision('model tries to read other Store SKU',ch),'DENY');
});
test('20 Store B cannot lookup Store A SKU',()=>{
 for(const ch of ['MESSENGER','ZALO','WEBSITE'])
 assert.equal(decision('same tenant B cannot read A SKU',ch),'DENY');
});
test('21 Store A cannot read Store B order ID',()=>{
 for(const ch of ['MESSENGER','ZALO','WEBSITE'])
 assert.equal(decision('order IDOR across Store',ch),'DENY');
});
test('22 Store B cannot read Store A order ID',()=>{
 for(const ch of ['MESSENGER','ZALO','WEBSITE'])
 assert.equal(decision('same tenant B cannot read A order',ch),'DENY');
});
test('23 attacker claimed Store and Tenant never override registry',()=>{
 const r=evaluate().results;
 assert.ok(r.filter(x=>/forged foreign/.test(x.name)).every(x=>x.decision==='DENY'));
});
test('24 spoofed Page, installation and native-shape signature blocked',()=>{
 const r=evaluate().results;
 assert.ok(r.filter(x=>/wrong provider destination|unknown installation|fake provider sign marker/.test(x.name)).every(x=>x.decision==='DENY'));
});
test('25 replay fixtures rejected in all channels',()=>{
 const r=evaluate().results;
 assert.equal(r.filter(x=>x.name==='replay duplicate of first fixture').length,3);
 assert.ok(r.filter(x=>x.name==='replay duplicate of first fixture').every(x=>x.decision==='DENY'));
});
test('26 stale, future and echo inbound events denied',()=>{
 const r=evaluate().results.filter(x=>/expired signed event|future signed event|bot self echo/.test(x.name));
 assert.equal(r.length,9);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('27 rate limit and inactive merchant registration denied',()=>{
 const r=evaluate().results.filter(x=>/rate quota blocked|inactive merchant installation/.test(x.name));
 assert.equal(r.length,6);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('28 order access requires user challenge and matching Store',()=>{
 const r=evaluate().results.filter(x=>/order without challenge|order with grant from other Store|order without matched customer/.test(x.name));
 assert.equal(r.length,9);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('29 cross-channel read requires both identity challenges',()=>{
 const r=evaluate().results.filter(x=>/cross-channel.*missing|cross-channel without both/.test(x.name));
 assert.equal(r.length,9);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('30 high risk Commerce and send tools denied by default',()=>{
 const r=evaluate().results.filter(x=>/model writes order|model updates order|model cancels order|model marks order paid|model changes price|model changes stock|model changes debt|model sends Messenger|model changes token|model publishes workflow|arbitrary HTTP download|customer message triggers export/.test(x.name));
 assert.equal(r.length,36);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('31 fake 1 VND order quote denied',()=>assert.equal(decision('proposal fake 1 VND','MESSENGER'),'DENY'));
test('32 Store B must not borrow Store A unit price',()=>assert.equal(decision('same tenant B cannot use A price','ZALO'),'DENY'));
test('33 stock insufficient, float VND and no customer consent denied',()=>{
 const r=evaluate().results.filter(x=>/proposal without confirmation|proposal stock exhausted|proposal float VND/.test(x.name));
 assert.equal(r.length,9);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('34 knowledge, product image, website and tool result prompt injection cannot grant authority',()=>{
 const r=evaluate().results.filter(x=>/prompt injection from/.test(x.name));
 assert.equal(r.length,15);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('35 model proposals never create order or decrement stock',()=>{
 const r=evaluate();assert.equal(r.actualOrderWrites,0);
 assert.equal(r.actualStockWrites,0);assert.equal(r.actualPriceWrites,0);
});
test('36 no provider send, HTTP, customer order read or LLM call',()=>{
 const r=evaluate();assert.equal(r.actualCustomerReplies,0);
 assert.equal(r.actualExternalHttpRequests,0);assert.equal(r.actualCustomerOrderReads,0);
 assert.equal(r.actualBotModelCalls,0);
});
test('37 no authority claims from QA fixture',()=>{
 const r=evaluate();assert.equal(r.realPageOaOwnerVerified,false);
 assert.equal(r.realStoreJwtRlsVerified,false);assert.equal(r.liveReleaseAllowed,false);
});
test('38 final assertion accepts only full green QA and reports hosted NO-GO',()=>{
 const out=finalize();assert.equal(out.passed,192);
 assert.equal(out.qaStatus,'V171M_SYNTHETIC_SECURITY_QA_PASSED');
 assert.equal(out.hostedStatus,'HOSTED_NO_GO');assert.equal(out.productionDeployment,false);
});
test('39 mutate B legitimate product into A catalog: denied',()=>{
 const r=mutated('same tenant B own catalog','ZALO',{sku:'SKU_A_001'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('40 mutate B order grant Store to A: denied',()=>{
 const r=mutated('same tenant B own order status','MESSENGER',{orderGrantStore:'STORE_A'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('41 mutate B order to A cross-Store: denied',()=>{
 const r=mutated('same tenant B own order status','WEBSITE',{requestedOrderId:'ORDER_A_001'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('42 mutate A client-store authority claim: denied',()=>{
 const r=mutated('benign catalog read','MESSENGER',{claimedStoreId:'STORE_B'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('43 mutate legitimate signature test marker to false: denied',()=>{
 const r=mutated('benign catalog read','ZALO',{syntheticSignaturePass:false});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('44 mutate native event provider destination: denied',()=>{
 const r=mutated('same tenant B own catalog','WEBSITE',{destinationId:'QA_SITE_A'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('45 mutate B price quote to A pricing: denied',()=>{
 const r=mutated('same tenant B quoted order preview','MESSENGER',{expectedTotalVnd:159000});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('46 mutate order confirmation to missing: denied',()=>{
 const r=mutated('benign order preview','ZALO',{customerConfirmed:false});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('47 mutate B event to replay another B fixture: denied',()=>{
 const batch=seed(),b=batch.cases.find(c=>c.name==='same tenant B own catalog'&&c.channel==='ZALO');
 const target=batch.cases.find(c=>c.name==='same tenant B own order status'&&c.channel==='ZALO');
 assert.ok(b&&target);target.eventId=b.eventId;target.expected='DENY';
 const result=evaluate(batch).results.find(c=>c.caseId===target.caseId);
 assert.equal(result.decision,'DENY');assert.equal(result.passed,true);
});
test('48 injected fake data cannot extend QA with actual browser actions',()=>{
 const r=evaluate();assert.equal(r.actualDataTableWrites,0);
 assert.equal(snapshot.actualProviderSends,0);assert.equal(snapshot.release,'HOSTED_NO_GO');
});
