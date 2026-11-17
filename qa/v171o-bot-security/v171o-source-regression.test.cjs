'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const snapshot=require('./v171o-v1717-source-snapshot.json');

function runScript(jsCode,input){
  const context={$input:{first:()=>({json:input})}};
  const items=vm.runInNewContext('(function(){'+jsCode+'\n})()',context,{timeout:3500});
  assert.ok(Array.isArray(items) && items.length===1);
  return JSON.parse(JSON.stringify(items[0].json));
}
function step(index,input){
  assert.ok(snapshot.shadow.stages[index]);
  return runScript(snapshot.shadow.stages[index].jsCode,input);
}
function corpus(){return step(0,{});}
function classified(c=corpus()){return step(1,c);}
function guarded(c=corpus()){return step(2,classified(c));}
function finalized(c=corpus()){return step(3,guarded(c));}
function find(name,context='QA_MESSENGER',data=guarded()){
  const r=data.results.find(x=>x.name===name && x.context===context);
  assert.ok(r,'Missing '+name+'/'+context);
  return r;
}
function edit(name,context,patch,newExpectedBaseline,newExpectedDecision){
  const c=corpus(),f=c.cases.find(x=>x.name===name && x.context===context);
  assert.ok(f);
  Object.assign(f.payload,patch);
  if(newExpectedBaseline!==undefined)f.expectedBaseline=newExpectedBaseline;
  if(newExpectedDecision!==undefined)f.expectedDecision=newExpectedDecision;
  return find(name,context,guarded(c));
}
test('01 pinned Messenger published version exactly V17.17',()=>{
 assert.equal(snapshot.publishedMessenger.activeVersionId,'1064b1b3-d3f1-4a6b-a367-2414ba691522');
});
test('02 no original live workflow was modified',()=>{
 assert.equal(snapshot.liveWorkflowEditedByThisMilestone,false);
});
test('03 four published V17.15 nodes preserved',()=>{
 assert.equal(snapshot.publishedMessenger.publishedNodeNamesV1715.length,4);
});
test('04 original Messenger remains the same 32-node graph',()=>{
 assert.equal(snapshot.publishedMessenger.nodeCount,32);
});
test('05 staging has pinned ID',()=>{
 assert.equal(snapshot.shadow.workflowId,'2cBUCxHzFxvQX5Ix');
});
test('06 staging source pinned version',()=>{
 assert.equal(snapshot.shadow.versionId,'af68bb64-ec76-473a-919c-bde2ae728212');
});
test('07 staging inactive with no active release',()=>{
 assert.equal(snapshot.shadow.active,false);
 assert.equal(snapshot.shadow.activeVersionId,null);
});
test('08 staging cannot be called from other workflows',()=>{
 assert.equal(snapshot.shadow.callerPolicy,'none');
});
test('09 manual staging has zero credentials',()=>{
 assert.equal(snapshot.shadow.noCredentials,true);
});
test('10 QA graph has 1 manual trigger and 4 code nodes only',()=>{
 const n=snapshot.shadow.nodeTypes;
 assert.equal(n.length,5);
 assert.equal(n.filter(x=>x.type==='n8n-nodes-base.manualTrigger').length,1);
 assert.equal(n.filter(x=>x.type==='n8n-nodes-base.code').length,4);
});
test('11 no external IO or model nodes',()=>{
 const bad=snapshot.shadow.nodeTypes.filter(n=>!/manualTrigger|\.code$/.test(n.type));
 assert.deepEqual(bad,[]);
});
test('12 exact published V17.17 classifier function matches QA copied function',()=>{
 const original=snapshot.publishedMessenger.sourceNodeJsCode;
 const prefix=original.slice(0,original.indexOf('const result=classify('));
 assert.ok(prefix.length>1500);
 assert.ok(snapshot.shadow.stages[1].jsCode.startsWith(prefix));
});
test('13 published function has expected sensitive demo output-only scheme',()=>{
 const source=snapshot.publishedMessenger.sourceNodeJsCode;
 assert.match(source,/V1717_DEMO_TECH_ONLY/);
 assert.match(source,/qa_only_read_only/);
 assert.match(source,/canWrite:false/);
});
test('14 snapshot shadow has safe synthetic-only API contract',()=>{
 assert.equal(snapshot.shadow.syntheticOnly,true);
 assert.equal(snapshot.release,'HOSTED_NO_GO');
});
test('15 fixture count is 132',()=>{
 const c=corpus();assert.equal(c.total,132);assert.equal(c.cases.length,132);
});
test('16 fixture IDs are unique',()=>{
 const ids=corpus().cases.map(c=>c.caseId);
 assert.equal(new Set(ids).size,132);
});
test('17 all corpus consists of four identity/media contexts per intent',()=>{
 const c=corpus();for(const context of ['QA_MESSENGER','FOREIGN_PAGE','INVALID_SENDER','IMAGE_MEDIA'])
 assert.equal(c.cases.filter(x=>x.context===context).length,33);
});
test('18 source classifier expected category 132/132 exact',()=>{
 const r=classified();assert.equal(r.total,132);
 assert.ok(r.observations.every(x=>x.exactNormalizerMatched));
});
test('19 original normalizer never returns raw sender or raw chat in classification',()=>{
 const r=classified();assert.ok(r.observations.every(x=>x.normalizedDidNotReturnRawInput));
});
test('20 all 132 source and policy decisions pass',()=>{
 const r=guarded();assert.equal(r.total,132);assert.equal(r.passed,132);
 assert.ok(r.results.every(x=>x.passed));
});
test('21 exactly 124 decisions fail closed',()=>assert.equal(guarded().denied,124));
test('22 exactly 8 safe catalog read plans',()=>assert.equal(guarded().allowedReadPlans,8));
test('23 two U+0110 uppercase Vietnamese order misroutes detected',()=>{
 assert.equal(guarded().semanticDefects,2);
});
test('24 seven order-intent safety overrides enforced',()=>{
 assert.equal(guarded().shadowOverrides,7);
});
test('25 catalog lookup remains read-plan only',()=>assert.equal(find('catalog').decision,'READ_PLAN'));
test('26 recognized F101 stays read-plan only',()=>assert.equal(find('sku_f101').decision,'READ_PLAN'));
test('27 recognized F102 stays read-plan only',()=>assert.equal(find('sku_f102').decision,'READ_PLAN'));
test('28 benign English shirt price stays catalog read-plan',()=>assert.equal(find('shirt_en').decision,'READ_PLAN'));
test('29 injected model instructions after F101 cannot grant writes',()=>{
 const r=find('prompt_f101');
 assert.equal(r.decision,'READ_PLAN');
 assert.equal(r.providerSendAllowed,false);
 assert.equal(r.orderWriteAllowed,false);
});
test('30 upper case ĐẶT HÀNG incorrectly catalogued by original V17.17',()=>{
 const r=find('order_capital_D');
 assert.equal(r.baselineTopic,'__T404_CATALOG__');
 assert.equal(r.businessSemanticDeviation,true);
});
test('31 staging guard blocks ĐẶT HÀNG catalog downgrade',()=>assert.equal(find('order_capital_D').decision,'DENY'));
test('32 staging guard blocks ĐỔI ĐƠN catalog downgrade',()=>assert.equal(find('order_capital_Doi').decision,'DENY'));
test('33 ordinary Vietnamese order intent denied',()=>assert.equal(find('order').decision,'DENY'));
test('34 refunds and payment intents denied',()=>{
 assert.equal(find('refund').decision,'DENY');
 assert.equal(find('payment').decision,'DENY');
});
test('35 direct human support request cannot invoke catalog tool',()=>assert.equal(find('staff').decision,'DENY'));
test('36 wholesale request cannot directly invoke read tool',()=>assert.equal(find('wholesale').decision,'DENY'));
test('37 shipping intent cannot directly invoke read tool',()=>assert.equal(find('shipping').decision,'DENY'));
test('38 phone, email and OTP are never eligible tool input',()=>{
 for(const name of ['phone','phone84','email','otp'])assert.equal(find(name).decision,'DENY');
});
test('39 URLs and passwords are never eligible tool input',()=>{
 for(const name of ['url','token','secret','pass','admin'])assert.equal(find(name).decision,'DENY');
});
test('40 foreign Page / Store B is denied for all 33 intent samples',()=>{
 const r=guarded().results.filter(x=>x.context==='FOREIGN_PAGE');
 assert.equal(r.length,33);assert.ok(r.every(x=>x.decision==='DENY'&&x.baselineTopic===null));
});
test('41 invalid synthetic sender is denied for all 33 samples',()=>{
 const r=guarded().results.filter(x=>x.context==='INVALID_SENDER');
 assert.equal(r.length,33);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('42 media image attachments are denied by the text-only classifier',()=>{
 const r=guarded().results.filter(x=>x.context==='IMAGE_MEDIA');
 assert.equal(r.length,33);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('43 force valid Page to foreign Page denies simulated read',()=>{
 const x=edit('catalog','QA_MESSENGER',{pageId:'FORGED_STORE_B_PAGE'},null,'DENY');
 assert.equal(x.decision,'DENY');assert.equal(x.passed,true);
});
test('44 force valid sender to untrusted sender denies simulated read',()=>{
 const x=edit('catalog','QA_MESSENGER',{senderId:'../../admin'},null,'DENY');
 assert.equal(x.decision,'DENY');assert.equal(x.passed,true);
});
test('45 change product text into private key denial',()=>{
 const x=edit('catalog','QA_MESSENGER',{chatInput:'QA_CORE: token của cửa hàng'},'__T404_PRIVATE__','DENY');
 assert.equal(x.decision,'DENY');assert.equal(x.passed,true);
});
test('46 add forged Store B field cannot grant Store B',()=>{
 const x=edit('catalog','QA_MESSENGER',{storeId:'STORE_B'},'__T404_CATALOG__','READ_PLAN');
 assert.equal(x.decision,'READ_PLAN');
 assert.equal(x.authorizedStoreKey,'qa-store-a');
});
test('47 code cannot invoke real Commerce/Core',()=>{
 const r=guarded();
 assert.equal(r.actualCoreCalls,0);assert.equal(r.actualDbReads,0);
});
test('48 no provider sends or model calls',()=>{
 const r=guarded();assert.equal(r.actualRepliesSent,0);assert.equal(r.actualModels,0);
});
test('49 actual Store A/B JWT proof deliberately false',()=>{
 assert.equal(guarded().realJwtStoreAAndBVerified,false);
});
test('50 real Meta/Zalo signature proof deliberately false',()=>{
 assert.equal(snapshot.otherChannel.actualZaloSignatureProof,false);
});
test('51 no real Commerce order writes or customer export',()=>{
 const r=guarded();assert.equal(r.actualOrdersWritten,0);
 assert.equal(snapshot.actualCommerceWrite,0);
});
test('52 compiled output contains no raw synthetic chat text',()=>{
 const r=guarded();assert.equal(JSON.stringify(r).includes('customer@example.test'),false);
 assert.equal(JSON.stringify(r).includes('0912345678'),false);
});
test('53 no spurious real remote networks on staging nodes',()=>{
 for(const n of snapshot.shadow.stages){
  assert.doesNotMatch(n.jsCode,/\bfetch\s*\(|\baxios\b|\bprocess\.env\b|\bhttps?\.request\s*\(|\bchild_process\b/);
 }
});
test('54 final acceptance remains HOSTED NO-GO',()=>{
 const r=finalized();
 assert.equal(r.status,'V171O_PUBLISHED_V1717_SOURCE_STAGING_QA_PASS');
 assert.equal(r.productionRelease,'HOSTED_NO_GO');
});
test('55 local QA actors are not independent Store A/B JWT',()=>{
 assert.equal(snapshot.currentQaActorsBothSameStore,true);
 assert.equal(snapshot.hostedJwtProof,false);
});
test('56 hosted auth catalog counts do not prove a signed JWT login',()=>{
 assert.equal(snapshot.observedQaAuthUserCount,3);
 assert.equal(snapshot.realStoreAAndBJwtProof,false);
});
test('57 no role or privileged RPC modifications were performed',()=>{
 assert.equal(snapshot.liveWorkflowEditedByThisMilestone,false);
 assert.equal(snapshot.privilegedAnonRpcNeedsReview,'qa_shop_b_zalo_claim');
});
