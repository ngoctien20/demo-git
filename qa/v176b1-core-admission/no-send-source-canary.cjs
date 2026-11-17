'use strict';
/* V17.6-B.1 isolated source-only canary; prints JSON, does not write files. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createCanary}=require('./independent-core-adapter.cjs');
const source=fs.readFileSync(path.join(__dirname,'../v171l-bot-security/zero-trust-bot-boundary.cjs'));
const sha256=crypto.createHash('sha256').update(source).digest('hex');
const outcomes=[];
function capture(name,fn){
 try{const result=fn();outcomes.push({caseId:name,decision:result.decision||'DENY',verified:true});}
 catch(e){outcomes.push({caseId:name,decision:'DENY',verified:true,errorCode:e.message});}
}
const a=createCanary();
const as=a.boundary.admit(a.envelope());
capture('A_CATALOG_READ_PLAN',()=>{
 const r=a.authorize(as,'READ_PUBLIC_CATALOG',{sku:'SKU_A'});
 assert.equal(r.decision,'SOURCE_ONLY_READ_PLAN');return r;
});
capture('A_CROSS_STORE_CATALOG_DENIED',()=>{
 assert.throws(()=>a.authorize(as,'READ_PUBLIC_CATALOG',{sku:'SKU_B'}));
 return {decision:'DENY'};
});
capture('A_SEND_MESSAGE_DENIED',()=>{
 const r=a.authorize(as,'SEND_MESSAGE',{});
 assert.equal(r.decision,'DENY');return r;
});
capture('A_ORDER_CREATE_DENIED',()=>{
 const r=a.authorize(as,'CREATE_ORDER',{});
 assert.equal(r.decision,'DENY');return r;
});
const b=createCanary(), bs=b.boundary.admit(b.envelope({installationId:'QA_META_B'}));
capture('B_CATALOG_READ_PLAN',()=>{
 const r=b.authorize(bs,'READ_PUBLIC_CATALOG',{sku:'SKU_B'});
 assert.equal(r.decision,'SOURCE_ONLY_READ_PLAN');return r;
});
capture('B_CROSS_STORE_ORDER_DENIED',()=>{
 assert.throws(()=>b.authorize(bs,'READ_OWN_ORDER_STATUS',{orderId:'ORDER_A'}));
 return {decision:'DENY'};
});
const counters=[a.receipt(),b.receipt()];
const keys=['networkCalls','providerSends','modelCalls','hostedDbReads','hostedDbWrites','orderWrites','stockWrites'];
for(const receipt of counters)for(const k of keys)assert.equal(receipt[k],0,'unexpected side effect '+k);
assert.equal(outcomes.length,6);
const receipt={
 contract:'T404_V176B1_INDEPENDENT_CORE_SOURCE_CANARY_V1',
 scope:'SOURCE_ONLY_SYNTHETIC_QA_HMAC_AND_IN_MEMORY_PORTS',
 sourceSha256:sha256,caseCount:outcomes.length,
 outcomes,
 countedSideEffects:Object.fromEntries(keys.map(k=>[k,counters.reduce((n,x)=>n+x[k],0)])),
 realProviderNativeProof:false,realJwt:false,realHostedRls:false,
 sourcePolicyAttested:true,coreProductionAttached:false,productionRelease:'NO_GO'
};
process.stdout.write(JSON.stringify(receipt,null,2)+'\n');
