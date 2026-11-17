'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const snap=require('./v171p-n8n-source-snapshot.json');

function sourceRun(index,input){
 const node=snap.staging.source[index];
 assert.ok(node?.code);
 const context={$input:{first:()=>({json:input})}};
 const output=vm.runInNewContext('(function(){'+node.code+'\n})()',context,{timeout:3000});
 assert.equal(output.length,1);
 return JSON.parse(JSON.stringify(output[0].json));
}
function fixtures(){return sourceRun(0,{});}
function gate(input=fixtures()){return sourceRun(1,input);}
function preview(input=gate()){return sourceRun(2,input);}
function finish(input=preview()){return sourceRun(3,input);}
function row(name,profile,source=fixtures()){
 const i=PROFILES.indexOf(profile);
 assert.ok(i>=0,'Unknown known fixture profile');
 // A payload may spoof installation/authUserId; pin case to the trusted
 // fixture generator's immutable sequential group, never client labels.
 const r=source.cases.find(x=>x.name===name &&
   Math.floor((Number(String(x.caseId).slice(2))-1)/52)===i);
 assert.ok(r,'Missing: '+name+' @ '+profile);
 return r;
}
const PROFILES=[
 'MESSENGER:QA_PAGE_A','MESSENGER:QA_PAGE_B',
 'ZALO:QA_OA_A','ZALO:QA_OA_B'
];
function actualResult(name,profile,source=gate()){
 const fixture=row(name,profile);
 const result=source.results.find(x=>x.caseId===fixture.caseId);
 assert.ok(result);
 return result;
}
function mutate(name,profile,patch){
 const input=fixtures(), f=row(name,profile,input);
 Object.assign(f,patch,{expected:'DENY'});
 const g=gate(input),result=g.results.find(x=>x.caseId===f.caseId);
 assert.ok(result);
 return result;
}
test('01 snapshot has exact isolated n8n QA ID and immutable source',()=>{
 assert.equal(snap.staging.workflowId,'p5OsIaB0NkMDFMw7');
 assert.equal(snap.staging.workflowVersionId,'dec4b734-ab6a-4cdc-b449-bf052b703118');
});
test('02 parent V17.1O remained Draft and unchanged at fork point',()=>{
 assert.equal(snap.parentDraftPr,283);
 assert.equal(snap.parentsSourceSha,'db8f3f55e3986be535c769224e26d696ab88df0e');
});
test('03 live Messenger V17.17 was preserved',()=>{
 assert.equal(snap.publishedPreserved.messengerVersionId,'1064b1b3-d3f1-4a6b-a367-2414ba691522');
});
test('04 live Zalo V17.19 was preserved',()=>{
 assert.equal(snap.publishedPreserved.zaloVersionId,'2d912cb0-007f-452f-9536-b92ba12a03e6');
});
test('05 V17.15 nodes remain on Published Messenger',()=>{
 assert.equal(snap.publishedPreserved.allMessengerV1715NodesStillPresent,true);
});
test('06 new workflow stays INACTIVE',()=>{
 assert.equal(snap.staging.active,false);
 assert.equal(snap.staging.publishedVersionId,null);
});
test('07 no workflow callers can bypass QA Manual Trigger',()=>{
 assert.equal(snap.staging.callerPolicy,'none');
});
test('08 no credentials or external connector are mounted in QA',()=>{
 assert.equal(snap.staging.noCredentials,true);
 assert.equal(snap.staging.manualOnly,true);
});
test('09 graph consists only of one manual trigger + four Code nodes',()=>{
 const t=snap.staging.nodes.map(x=>x.type);
 assert.equal(t.length,5);
 assert.equal(t.filter(x=>x==='n8n-nodes-base.code').length,4);
 assert.equal(t.filter(x=>x==='n8n-nodes-base.manualTrigger').length,1);
});
test('10 source scripts have no network, subprocess, secrets, PostgREST calls',()=>{
 for(const n of snap.staging.source)
   assert.doesNotMatch(n.code,/\bfetch\s*\(|\baxios\b|\bhttps?\.request\s*\(|\bprocess\.env\b|\$http\b|\bchild_process\b/);
});
test('11 fixture dataset exactly 208',()=>{
 const f=fixtures();assert.equal(f.total,208);assert.equal(f.cases.length,208);
});
test('12 fixture case IDs globally unique',()=>{
 const f=fixtures();assert.equal(new Set(f.cases.map(x=>x.caseId)).size,208);
});
test('13 52 QA case IDs per protected profile including a forged installation',()=>{
 const f=fixtures();
 for(let i=0;i<PROFILES.length;i++){
  const group=f.cases.filter(c=>Math.floor((Number(String(c.caseId).slice(2))-1)/52)===i);
  assert.equal(group.length,52);
  assert.equal(group.filter(c=>c.installationId==='FAKE_INSTALLATION').length,1);
  assert.equal(group.filter(c=>c.installationId===PROFILES[i].split(':')[1]).length,51);
 }
});
test('14 four profiles represent two separate fake owner IDs under one fake Tenant',()=>{
 const f=fixtures();
 assert.equal(new Set(f.cases.map(x=>x.tenantIdHint)).size,1);
 assert.equal(new Set(f.cases.map(x=>x.authUserIdHint)).size,2);
 assert.equal(new Set(f.cases.filter(x=>x.installationId!=='FAKE_INSTALLATION').map(x=>x.installationId)).size,4);
});
test('15 no real JWT or signed provider proof in fixtures',()=>{
 const f=fixtures();assert.equal(f.realJwtVerified,false);assert.equal(f.realProviderOwnerVerified,false);
 assert.equal(f.actualReaderAttached,false);
});
test('16 guarded source exactly 208 of 208 expected decisions',()=>{
 const r=gate();assert.equal(r.passed,208);assert.equal(r.total,208);
 assert.ok(r.results.every(x=>x.passed===true));
});
test('17 exactly 196 denied actions',()=>assert.equal(gate().denied,196));
test('18 8 Store-scoped synthetic catalogue read plans',()=>assert.equal(gate().catalogPlans,8));
test('19 4 fake OrderAccessGrant read-only order plans',()=>assert.equal(gate().orderStatusPlans,4));
test('20 12 fake Reader previews are never hosted reads',()=>{
 const r=preview();assert.equal(r.previews.length,12);
 assert.ok(r.previews.every(x=>x.canReadHostedDatabase===false&&x.dataSource==='SYNTHETIC_CODE_ONLY'));
});
test('21 immutable final gate emits NO-GO',()=>{
 const r=finish();assert.equal(r.qaStatus,'V171P_STORE_AUTH_READER_SOURCE_ONLY_ACCEPTANCE_PASS');
 assert.equal(r.release,'HOSTED_NO_GO');
});
test('22 final workflow has no real PostgREST, Commerce, AI or provider sends',()=>{
 const r=preview();assert.equal(r.actualPostgrestRequests,0);
 assert.equal(r.actualCustomerDataRead,0);assert.equal(r.realCommerceReaderInvocations,0);
 assert.equal(r.actualCommerceWrites,0);assert.equal(r.actualProviderMessagesSent,0);
});
test('23 current hosted registry is TWO stores across TWO tenants, not same tenant',()=>{
 const e=snap.supabaseReadOnlyAsObserved;
 assert.equal(e.distinctMappedTenants,2);
 assert.equal(e.distinctMappedStores,2);
 assert.equal(e.sameTenantDistinctStoreOwnerPairs,0);
 assert.equal(e.tenantsWithTwoActiveSessionMembers,0);
});
test('24 two owner Store mappings do not equal two verified JWT sessions',()=>{
 const e=snap.supabaseReadOnlyAsObserved;
 assert.equal(e.exactStoreOwnerBindingLinks,2);
 assert.equal(e.realTwoOwnerJwtAttested,false);
});
test('25 legacy core policies are tenant only, not Store scoped',()=>{
 const e=snap.supabaseReadOnlyAsObserved;
 assert.equal(e.legacyStoreScopedPolicies,0);
 assert.equal(e.legacyTenantScopedPolicies,3);
});
test('26 provider authority intentionally cannot admit actual Meta/Zalo',()=>{
 const e=snap.providerAuthority;
 assert.equal(e.realMetaSignedQaEventAttested,false);
 assert.equal(e.realZaloSignedQaEventAttested,false);
 assert.equal(e.realPageOaOwnershipAttested,false);
});
test('27 fake positive catalogue plans never escape own Store',()=>{
 for(const p of PROFILES){
   const r=actualResult('own catalog preview',p);
   assert.equal(r.decision,'SIMULATED_CATALOG_READ_PLAN');
   assert.ok(['STORE_A','STORE_B'].includes(r.storeId));
 }
});
test('28 fake own OrderStatus plans never access DB',()=>{
 for(const p of PROFILES){
  const r=actualResult('own order status scoped',p);
  assert.equal(r.decision,'SIMULATED_ORDER_STATUS_PLAN');
  assert.equal(r.actualCommerceReaderExecuted,false);
 }
});
test('29 catalogue preview returns A and B different synthetic prices',()=>{
 const p=preview().previews.filter(x=>x.kind==='CATALOG');
 assert.equal(new Set(p.map(x=>x.storeId)).size,2);
 assert.equal(new Set(p.map(x=>x.priceVnd)).size,2);
});
test('30 order preview never contains customer phone, address or PII',()=>{
 const p=preview().previews;
 assert.ok(p.every(x=>!Object.hasOwn(x,'phone')&&!Object.hasOwn(x,'address')&&!Object.hasOwn(x,'customerName')));
});
test('31 fake customer event never creates an order',()=>{
 const r=finish();assert.equal(r.actualCommerceWrites,0);
 assert.equal(r.actualProviderSends,0);
});
test('32 no actual independent provider or JWT receipt anywhere',()=>{
 assert.equal(snap.supabaseReadOnlyAsObserved.realTwoOwnerJwtAttested,false);
 assert.equal(snap.providerAuthority.realMetaSignedQaEventAttested,false);
 assert.equal(snap.providerAuthority.realZaloSignedQaEventAttested,false);
});
const denied=[
'cross Store catalog','cross Store order','wrong customer sender grant',
'foreign customer Store grant','missing order access grant',
'expired auth session','disabled owner Store binding','disabled channel installation',
'wrong Page OA destination','unknown installation ID','spoof tenant ID',
'spoof store ID','spoof auth user ID','client declares owner','client declares admin',
'client declares service role','client supplies jwt','client supplies user metadata',
'client supplies app metadata','client supplies order grant',
'client supplies provider signature flag','client supplies credential',
'client supplies modelWriteAllowed','wrong auth server receipt',
'wrong provider receipt','signed provider proof missing',
'JWT verified by source only','provider proof verified by source only',
'signed event stale','sender self echo','rate limited','replay cache denied',
'duplicate event replay','unauthorized send','unauthorized create order',
'unauthorized update order','unauthorized change price','unauthorized change stock',
'unauthorized credential read','arbitrary URL fetch','image injection provenance',
'catalog injection provenance','RAG injection provenance','invalid query payload',
'invalid excessive query','propose order cannot execute write',
'customer cross-channel identity without challenge','unknown new tool',
'forced production admission attempt'
];
for(const scenario of denied)test('reject across four Store/channel profiles: '+scenario,()=>{
 for(const p of PROFILES){
   const r=actualResult(scenario,p);
   assert.equal(r.decision,'DENY');
   assert.equal(r.actualWrites,0);
   assert.equal(r.actualSends,0);
 }
});
const forged=[
 ['tenant scope','tenantId','OTHER_TENANT'],
 ['Store scope','storeId','OTHER_STORE'],
 ['Auth subject','authUserId','ATTACKER'],
 ['admin claim','isAdmin',true],
 ['self-signed token','jwt','FAKE_JWT'],
 ['user metadata','user_metadata',{role:'owner'}],
 ['app metadata','app_metadata',{role:'owner'}],
 ['provider signature','signatureVerified',true],
 ['OrderAccessGrant','orderAccessGrant','FAKE'],
 ['credential','credential','NO_REAL_TOKEN'],
 ['model write flag','modelCanWrite',true],
 ['other customer','accessGrantSenderId','OTHER_SENDER'],
 ['other Store order','orderId','ORDER_OTHER'],
 ['other Store SKU','sku','SKU_OTHER'],
 ['unknown source','source','REAL_PROVIDER_CALLBACK'],
 ['fake auth receipt','authReceipt','INDEPENDENT_VERIFIED'],
 ['fake provider receipt','providerReceipt','INDEPENDENT_VERIFIED'],
 ['fake production admission','admissionMode','REAL_PRODUCTION'],
 ['expired auth','jwtSessionActive',false],
 ['inactive owner','ownershipActive',false],
 ['inactive Page','installationActive',false],
 ['replay outage','atomicReplayAccepted',false],
 ['rate outage','rateAllowed',false],
 ['invalid event id','eventId','../ATTACK'],
 ['SQL injection','query',"' OR 1=1; --"],
 ['control character','query','SKU_A\nDELETE'],
 ['SSRF URL','query','http://169.254.169.254'],
 ['HTML command','query','<script>alert(1)</script>'],
 ['oversized search','query','x'.repeat(125)]
];
for(const [label,key,value] of forged)test('deny forged otherwise eligible Store read plan: '+label,()=>{
 const target=['accessGrantSenderId','orderId'].includes(key)?'own order status scoped':'own catalog preview';
 const r=mutate(target,'MESSENGER:QA_PAGE_A',{[key]:value});
 assert.equal(r.decision,'DENY');
 assert.equal(r.passed,true);
});
test('last source QA must not claim real Store JWT proof',()=>{
 assert.equal(snap.release,'HOSTED_NO_GO');
 assert.equal(snap.realCommerceReaderConnected,false);
 assert.equal(snap.actualDatabaseReads,0);
});
