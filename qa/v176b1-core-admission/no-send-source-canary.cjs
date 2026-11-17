'use strict';
/* V17.6-B.1 fail-closed source-only canary: no file writes, no provider. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createCanary}=require('./independent-core-adapter.cjs');
const source=fs.readFileSync(path.join(__dirname,'../v171l-bot-security/zero-trust-bot-boundary.cjs'));
const sha256=crypto.createHash('sha256').update(source).digest('hex');
const outcomes=[];
function allow(name,fn){
  const r=fn(); // an error MUST terminate with nonzero exit status
  assert.equal(r.decision,'SOURCE_ONLY_READ_PLAN',name);
  assert.equal(r.actualDatabaseReads,0,name);
  outcomes.push({caseId:name,expectedDecision:'SOURCE_ONLY_READ_PLAN',
    actualDecision:r.decision,pass:true});
}
function denyDecision(name,fn){
  const r=fn();
  assert.equal(r.decision,'DENY',name);
  assert.equal(r.actualProviderSends,0,name);
  outcomes.push({caseId:name,expectedDecision:'DENY',
    actualDecision:r.decision,pass:true});
}
function denyError(name,fn,code){
  let actual=null;
  try{fn();}catch(e){actual=e;}
  assert.ok(actual instanceof Error,name+': must throw');
  assert.equal(actual.message,code,name+': exact reason');
  outcomes.push({caseId:name,expectedDecision:'DENY',actualDecision:'DENY',
    errorCode:actual.message,pass:true});
}
const a=createCanary(),as=a.boundary.admit(a.envelope());
allow('A_CATALOG_READ_PLAN',()=>a.authorize(as,'READ_PUBLIC_CATALOG',{sku:'SKU_A'}));
denyError('A_CROSS_STORE_CATALOG_DENIED',
  ()=>a.authorize(as,'READ_PUBLIC_CATALOG',{sku:'SKU_B'}),
  'TOOL_SERVER_CATALOG_SCOPE_DENIED');
denyDecision('A_SEND_MESSAGE_DENIED',()=>a.authorize(as,'SEND_MESSAGE',{}));
denyDecision('A_ORDER_CREATE_DENIED',()=>a.authorize(as,'CREATE_ORDER',{}));
const b=createCanary(),bs=b.boundary.admit(b.envelope({installationId:'QA_META_B'}));
allow('B_CATALOG_READ_PLAN',()=>b.authorize(bs,'READ_PUBLIC_CATALOG',{sku:'SKU_B'}));
denyError('B_CROSS_STORE_ORDER_DENIED',
  ()=>b.authorize(bs,'READ_OWN_ORDER_STATUS',{orderId:'ORDER_A'}),
  'TOOL_ORDER_GRANT_OR_CROSS_CHANNEL_IDENTITY_DENIED');

assert.equal(outcomes.length,6);
assert.equal(new Set(outcomes.map(x=>x.caseId)).size,6);
assert.equal(outcomes.filter(x=>x.actualDecision==='SOURCE_ONLY_READ_PLAN').length,2);
assert.equal(outcomes.filter(x=>x.actualDecision==='DENY').length,4);
assert.ok(outcomes.every(x=>x.pass&&x.actualDecision===x.expectedDecision));
const counters=[a.receipt(),b.receipt()];
const keys=['networkCalls','providerSends','modelCalls','hostedDbReads','hostedDbWrites','orderWrites','stockWrites'];
for(const receipt of counters){
 for(const k of keys)assert.equal(receipt[k],0,'unexpected instrumented effect '+k);
 assert.equal(receipt.productionRelease,'NO_GO');
 assert.equal(receipt.realJWT,false);
 assert.equal(receipt.realNativeProviderProof,false);
 assert.equal(receipt.hostedRLS,false);
}
const receipt={
 contract:'T404_V176B1_INDEPENDENT_CORE_SOURCE_CANARY_V2_FAIL_CLOSED',
 scope:'SOURCE_ONLY_SYNTHETIC_QA_HMAC_AND_IN_MEMORY_PORTS',
 sourceSha256:sha256,caseCount:outcomes.length,
 plannedReadCount:2,denyCount:4,outcomes,
 countedSideEffects:Object.fromEntries(keys.map(k=>[k,counters.reduce((n,x)=>n+x[k],0)])),
 realProviderNativeProof:false,realJwt:false,realHostedRls:false,
 sourcePolicyAttested:true,coreProductionAttached:false,productionRelease:'NO_GO'
};
process.stdout.write(JSON.stringify(receipt,null,2)+'\n');
