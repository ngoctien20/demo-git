'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),crypto=require('node:crypto');
const s=require('./v171n-shadow-snapshot.json');
function stage(index,input={}){
 const source=s.source[index]?.jsCode;
 assert.equal(typeof source,'string');
 const ctx={
  Buffer,
  require:(name)=>{if(name==='crypto')return crypto;throw Error('QA_EXTERNAL_IMPORT_REFUSED');},
  $input:{first:()=>({json:input})}
 };
 const out=vm.runInNewContext('(function(){'+source+'\n})()',ctx,{timeout:4000});
 assert.equal(out?.length,1);
 return JSON.parse(JSON.stringify(out[0].json));
}
const generated=()=>stage(0,{});
const evaluated=(x=generated())=>stage(1,x);
const chain=(input=generated())=>{
 const e=stage(1,input),n=stage(2,e),c=stage(3,n),r=stage(4,c),a=stage(5,r);
 return {e,n,c,r,a};
};
const isDenied=(name,ch)=>{
 const f=evaluated().observations.find(x=>x.scenario===name&&x.channel===ch);
 assert.ok(f,'No fixture '+name+' '+ch);
 return f.decision;
};
function mutate(name,ch,changes){
 const batch=generated();const c=batch.cases.find(c=>c.scenario===name&&c.channel===ch);
 assert.ok(c,'Missing '+name+' '+ch);
 Object.assign(c,changes,{expectedDecision:'DENY'});
 const r=evaluated(batch).observations.find(x=>x.caseId===c.caseId);
 return r;
}
test('01 source contract and correct isolated staging ID',()=>{
 assert.equal(s.stagingWorkflowId,'99eZrseGb4d650at');assert.equal(s.source.length,6);
});
test('02 exact real staged version is pinned',()=>assert.equal(s.stagingVersionId,'4635bed6-a274-4f8a-902b-0bbd39aa9221'));
test('03 original Messenger Published V17.15 version frozen',()=>assert.equal(s.publishedVersionPreserved,'2b869035-fe39-46fb-a253-18fefe4ecbfd'));
test('04 newer V17.17 draft remains untouched',()=>assert.equal(s.laterUnpublishedDraftPreserved,'1064b1b3-d3f1-4a6b-a367-2414ba691522'));
test('05 four original V17.15 nodes accounted for',()=>assert.equal(s.v1715OriginalNodesPreserved.length,4));
test('06 explicitly source-derived, not credential-bearing workflow clone',()=>{
 assert.equal(s.verbatimProductionNodesCopied,false);assert.equal(s.sourceDerivedReplicaOnly,true);
});
test('07 staging is inactive with no active version',()=>{
 assert.equal(s.stagingActive,false);assert.equal(s.stagingActiveVersionId,null);
});
test('08 does not accept subworkflow callers',()=>assert.equal(s.stagingCallerPolicy,'none'));
test('09 only manual trigger and code stages, no credential',()=>{
 assert.equal(s.nodeTypes.length,7);assert.equal(s.stagingNoCredentials,true);
 assert.equal(s.nodeTypes.filter(n=>n.type==='n8n-nodes-base.code').length,6);
 assert.equal(s.nodeTypes.filter(n=>n.type==='n8n-nodes-base.manualTrigger').length,1);
});
test('10 no external node types, no outbound model or customer send',()=>{
 assert.equal(s.stagingNoExternalNodes,true);
 for(const n of s.nodeTypes)assert.ok(['n8n-nodes-base.code','n8n-nodes-base.manualTrigger'].includes(n.type));
});
test('11 static guard against production credential and external socket usage',()=>{
 for(const p of s.source){
  assert.doesNotMatch(p.jsCode,/\bprocess\.env\b|\bfetch\s*\(|\bhttps?\.request\s*\(|\baxios\b|\bchild_process\b|\$http\b/);
 }
});
test('12 actual source test emits 144 synthetic signed fixtures',()=>{
 const p=generated();assert.equal(p.total,144);assert.equal(p.cases.length,144);
 assert.equal(p.qaOnly,true);assert.equal(p.syntheticOnly,true);
});
test('13 all fixture case IDs unique',()=>{
 const a=generated().cases;assert.equal(new Set(a.map(c=>c.caseId)).size,a.length);
});
test('14 72 Messenger and 72 Zalo cases',()=>{
 const a=generated().cases;
 assert.equal(a.filter(c=>c.channel==='MESSENGER').length,72);
 assert.equal(a.filter(c=>c.channel==='ZALO').length,72);
});
test('15 two independent installations per channel',()=>{
 const a=generated().cases;for(const ch of ['MESSENGER','ZALO']){
  assert.equal(new Set(a.filter(c=>c.channel===ch).map(c=>c.installationId)).size,2);
 }
});
test('16 nominal end-to-end 144/144 accepted source assertions',()=>{
 const x=chain();assert.equal(x.e.total,144);assert.equal(x.e.passed,144);
 assert.equal(x.a.passed,144);assert.equal(x.a.status,'V171N_STAGING_SIMULATED_QA_PASS');
});
test('17 exactly 132 deny 8 simulated reads 4 proposals',()=>{
 const r=evaluated();assert.equal(r.denied,132);assert.equal(r.readPlans,8);
 assert.equal(r.proposalPlans,4);
});
test('18 same Tenant Store A and B legitimate catalog plans',()=>{
 const r=evaluated().observations.filter(x=>x.scenario==='legitimate Store catalog');
 assert.equal(r.length,4);assert.ok(r.every(x=>x.decision==='READ_PLAN'));
 assert.deepEqual(new Set(r.map(x=>x.storeId)),new Set(['STORE_A','STORE_B']));
});
test('19 own order read remains only an offline plan',()=>{
 const r=evaluated().observations.filter(x=>x.scenario==='legitimate own order status');
 assert.equal(r.length,4);assert.ok(r.every(x=>x.decision==='READ_PLAN'));
});
test('20 proposed order never executes a write',()=>{
 const e=evaluated();assert.equal(e.proposalPlans,4);assert.equal(e.actualOrderWrites,0);
});
test('21 real provider signed/ownership proof FALSE',()=>{
 assert.equal(s.realProviderSignatureProof,false);assert.equal(s.realMetaOwnershipProof,false);
 assert.equal(s.realZaloOaOwnershipProof,false);
});
test('22 real JWT and hosted Store/RLS proof FALSE',()=>{
 assert.equal(s.hostedJwtStoreRlsProof,false);
});
test('23 4 replay duplicate signed events denied',()=>{
 const r=evaluated().observations.filter(x=>x.scenario==='duplicate signed event replay');
 assert.equal(r.length,4);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('24 forged Page/OA destination denied',()=>{
 for(const ch of ['MESSENGER','ZALO'])assert.equal(isDenied('forged Page OA destination',ch),'DENY');
});
test('25 deliberately invalid MAC denied for both native-shape algorithms',()=>{
 for(const ch of ['MESSENGER','ZALO'])assert.equal(isDenied('fake signed header',ch),'DENY');
});
test('26 provider event out of timestamp window denied',()=>{
 for(const ch of ['MESSENGER','ZALO'])assert.equal(isDenied('stale signed event',ch),'DENY');
});
test('27 bot reply echo denied',()=>{
 for(const ch of ['MESSENGER','ZALO'])assert.equal(isDenied('self echo',ch),'DENY');
});
test('28 no model or public Send from cloned guard',()=>{
 const x=chain();assert.equal(x.e.actualProviderSends,0);assert.equal(x.e.actualModels,0);
 assert.equal(x.a.providerMessagesSent,0);
});
test('29 no actual Core or database read',()=>{
 const x=chain();assert.equal(x.c.actualDbReads,0);assert.equal(x.c.actualCoreInvocations,0);
});
test('30 normalized outputs are fake, no original chat sender or PII',()=>{
 const x=chain();assert.equal(x.n.normalized.length,4);
 assert.ok(x.n.normalized.every(v=>v.maskedSender==='V171N_QA_NO_PII'&&v.rawCustomerTextRetained===false));
});
test('31 v17.15 simulated reply gate cannot invoke actual Send',()=>{
 const x=chain();assert.equal(x.r.realMessengerReplySent,false);
 assert.equal(x.r.customerResponseTextReturned,false);
});
test('32 final release remains hosted no-go',()=>{
 const x=chain();assert.equal(x.a.release,'HOSTED_NO_GO');
 assert.equal(x.a.originalMessengerModified,false);
});
test('33 cross Store SKU denied Messenger',()=>assert.equal(isDenied('cross Store SKU','MESSENGER'),'DENY'));
test('34 cross Store SKU denied Zalo',()=>assert.equal(isDenied('cross Store SKU','ZALO'),'DENY'));
test('35 cross Store order denied Messenger',()=>assert.equal(isDenied('cross Store order','MESSENGER'),'DENY'));
test('36 cross Store order denied Zalo',()=>assert.equal(isDenied('cross Store order','ZALO'),'DENY'));
test('37 cross Store order grant denied both channels',()=>{
 for(const ch of ['MESSENGER','ZALO'])assert.equal(isDenied('cross Store grant',ch),'DENY');
});
test('38 fake expected price/quantity rejected',()=>{
 for(const ch of ['MESSENGER','ZALO']){
  assert.equal(isDenied('fake price 1 VND',ch),'DENY');
  assert.equal(isDenied('oversize quantity',ch),'DENY');
 }
});
test('39 customer consent/identity checked',()=>{
 for(const ch of ['MESSENGER','ZALO']){
  assert.equal(isDenied('false customer approval',ch),'DENY');
  assert.equal(isDenied('wrong sender grant',ch),'DENY');
 }
});
test('40 image/doc prompt injection not authorized',()=>{
 for(const ch of ['MESSENGER','ZALO']){
  assert.equal(isDenied('prompt injection image',ch),'DENY');
  assert.equal(isDenied('prompt injection knowledge',ch),'DENY');
 }
});
test('41 unauthorized write/send/admin/HTTP tools fail closed',()=>{
 const r=evaluated().observations.filter(x=>/unauthorized|arbitrary URL fetch/.test(x.scenario));
 assert.equal(r.length,24);assert.ok(r.every(x=>x.decision==='DENY'));
});
test('42 injected fake tenant cannot override trusted binding',()=>{
 const r=mutate('legitimate Store catalog','MESSENGER',{tenantId:'TENANT_OTHER'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('43 injected fake Store cannot override trusted binding',()=>{
 const r=mutate('legitimate Store catalog','ZALO',{storeId:'STORE_OTHER'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('44 injected isAdmin cannot grant tool call',()=>{
 const r=mutate('legitimate Store catalog','MESSENGER',{isAdmin:true});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('45 injected userRole cannot grant tools',()=>{
 const r=mutate('legitimate Store catalog','ZALO',{userRole:'SUPER_ADMIN'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('46 injected ownerVerified cannot grant Store',()=>{
 const r=mutate('legitimate Store catalog','MESSENGER',{ownerVerified:true});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('47 injected order access grant cannot read other customer',()=>{
 const r=mutate('legitimate own order status','ZALO',{orderAccessGrant:'FAKE'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('48 tampered raw request signature rejected',()=>{
 const r=mutate('legitimate Store catalog','MESSENGER',{rawBody:'{"tampered":true}'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('49 alternate Zalo App ID denied despite re-created fake MAC',()=>{
 const r=mutate('legitimate Store catalog','ZALO',{appId:'OTHER_APP_ID'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('50 forged installation cannot access original Store',()=>{
 const r=mutate('legitimate Store catalog','MESSENGER',{installationId:'OTHER_INSTALL'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('51 altered recipient destination cannot access A',()=>{
 const r=mutate('legitimate Store catalog','ZALO',{destinationId:'QA_OA_B'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('52 altered customer sender fails native-shaped signed binding',()=>{
 const r=mutate('legitimate own order status','MESSENGER',{senderId:'OTHER_ID'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('53 model tool proposal cannot make side-effecting create_order call',()=>{
 const r=mutate('legitimate Store catalog','MESSENGER',{action:'CREATE_ORDER'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('54 model tool proposal cannot make side-effecting send call',()=>{
 const r=mutate('legitimate Store catalog','ZALO',{action:'SEND_MESSAGE'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('55 product image cannot grant even catalog query',()=>{
 const r=mutate('legitimate Store catalog','MESSENGER',{origin:'PRODUCT_IMAGE'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('56 malicious URL cannot grant catalog query',()=>{
 const r=mutate('legitimate Store catalog','ZALO',{chatInput:'QA_CORE: https://attacker.example'});
 assert.equal(r.decision,'DENY');assert.equal(r.passed,true);
});
test('57 successful in-memory simulation leaves no hosted data effects',()=>{
 const x=chain();assert.equal(x.e.actualOrderWrites,0);
 assert.equal(x.e.actualDbReads,undefined);assert.equal(s.actualDbWrites,0);
 assert.equal(s.actualCustomerMessagesSent,0);
});
