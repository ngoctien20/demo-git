import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHostedStorePreflightSnapshot,inspectPrivateUatReceipt,
 evaluateRealUatAdmission,getUatOperatorPlan,channelUatScopes,
 commerceReadSurfaces} from './v17-7c-hosted-uat-admission-offline.mjs';
const NOW=1794912000000;
const VERSIONS={
 ZALO_BOT:'2d912cb0-007f-452f-9536-b92ba12a03e6',
 MESSENGER:'1064b1b3-d3f1-4a6b-a367-2414ba691522',
 WEBSITE:'c81929d4-ab55-4c24-8659-795842739e24'
};
const WF={
 ZALO_BOT:'yIJk8LvJoLF40Z62',
 MESSENGER:'Z7FdV7uDvApfbURQ',
 WEBSITE:'wgkkmT7q4lm4HyuA'
};
const surfaces=()=>commerceReadSurfaces.map(name=>({
 name,rls:true,forceRls:true,tenantIdField:true,
 storeIdField:false,storePolicyScope:'TENANT_ONLY'
}));
const actual=()=>({publicSurfaces:surfaces(),
 qaStoreTotals:{tenantCount:2,maxDistinctStoresInOneTenant:1}});
const safe=r=>{
 for(const key of ['realProviderVerified','realStoreJwtVerified',
   'realSameTenantABVerified','realCrossStoreDenied',
   'publicChannelSendAllowed','commerceReadAllowed',
   'commerceWriteAllowed','canPublish'])
   assert.equal(r[key],false,key);
};
test('current real DB schema is RLS tenant-only and cannot pass store security',()=>{
 const r=inspectHostedStorePreflightSnapshot(actual());
 assert.equal(r.readyShape,false);
 assert.equal(r.reason,'STORE_QUALIFIED_RLS_POLICY_MISSING');
 assert.deepEqual(r.blockedTables,[...commerceReadSurfaces].sort());safe(r);
});
test('real QA mapping also lacks same tenant Store A/B when policy fixed',()=>{
 const x=actual();for(const t of x.publicSurfaces)t.storePolicyScope='TRUSTED_STORE_JOIN';
 const r=inspectHostedStorePreflightSnapshot(x);
 assert.equal(r.reason,'SAME_TENANT_TWO_STORE_QA_FIXTURE_MISSING');safe(r);
});
test('fake complete metadata still not real JWT or RLS proof',()=>{
 const x=actual();
 for(const t of x.publicSurfaces)t.storePolicyScope='TRUSTED_STORE_JOIN';
 x.qaStoreTotals.maxDistinctStoresInOneTenant=2;
 const r=inspectHostedStorePreflightSnapshot(x);
 assert.equal(r.readyShape,true);safe(r);
});
test('schema missing a Commerce surface is denied',()=>{
 const x=actual();x.publicSurfaces.pop();
 assert.equal(inspectHostedStorePreflightSnapshot(x).reason,'COMMERCE_SURFACE_INVENTORY_INCOMPLETE');
});
test('duplicated table name cannot stand in for other surface',()=>{
 const x=actual();x.publicSurfaces[5].name='products';
 assert.equal(inspectHostedStorePreflightSnapshot(x).readyShape,false);
});
test('RLS disabled is rejected',()=>{
 const x=actual();x.publicSurfaces[0].rls=false;
 assert.equal(inspectHostedStorePreflightSnapshot(x).reason,'TENANT_RLS_METADATA_NOT_ESTABLISHED');
});
test('FORCE RLS missing is rejected',()=>{
 const x=actual();x.publicSurfaces[0].forceRls=false;
 assert.equal(inspectHostedStorePreflightSnapshot(x).reason,'TENANT_RLS_METADATA_NOT_ESTABLISHED');
});
test('tenant scope column missing is rejected',()=>{
 const x=actual();x.publicSurfaces[0].tenantIdField=false;
 assert.equal(inspectHostedStorePreflightSnapshot(x).reason,'TENANT_RLS_METADATA_NOT_ESTABLISHED');
});
test('direct Store policy requires a Store column',()=>{
 const x=actual();for(const t of x.publicSurfaces)t.storePolicyScope='STORE_DIRECT';
 assert.equal(inspectHostedStorePreflightSnapshot(x).reason,'STORE_COLUMN_REQUIRED_FOR_DIRECT_POLICY');
});
test('missing snapshot fails closed',()=>{
 assert.equal(inspectHostedStorePreflightSnapshot(null).readyShape,false);
});
function receipt(channel='ZALO_BOT'){
 const e={channel,workflowId:WF[channel],workflowVersion:VERSIONS[channel],
  caseRef:'case-Z-0001',stage:'INGRESS_NO_SEND',
  recordedAtMs:NOW,correlationDigest:'a'.repeat(64),
  evidenceSource:'SYNTHETIC_QA_ONLY'};
 const expected={offlineMode:'SYNTHETIC_QA_ONLY',
  noSend:true,noCommerceWrite:true,nowMs:NOW,
  pinnedWorkflowVersion:VERSIONS[channel]};
 return {e,expected};
}
function deniedReceipt(reason,mutate,channel='ZALO_BOT'){
 const x=receipt(channel);mutate(x);
 const r=inspectPrivateUatReceipt(x.e,x.expected);
 assert.equal(r.readyShape,false,JSON.stringify(r));
 assert.equal(r.reason,reason);safe(r);
}
for(const channel of channelUatScopes)test(channel+' redacted synthetic receipt is NOT real UAT',()=>{
 const x=receipt(channel),r=inspectPrivateUatReceipt(x.e,x.expected);
 assert.equal(r.readyShape,true);safe(r);
 assert.equal(r.independentHostedReviewerRequired,true);
 assert.equal(JSON.stringify(r).includes(x.e.workflowVersion),false);
});
test('OA must wait for owner grant',()=>{
 const x=receipt();x.e.channel='ZALO_OA';
 const r=inspectPrivateUatReceipt(x.e,x.expected);
 assert.equal(r.reason,'UNSUPPORTED_OR_BLOCKED_OA_CHANNEL');safe(r);
});
test('Telegram receipt cannot masquerade as customer ingress',()=>{
 const x=receipt();x.e.channel='TELEGRAM';
 assert.equal(inspectPrivateUatReceipt(x.e,x.expected).readyShape,false);
});
test('unknown workflow target rejected',()=>deniedReceipt(
 'WORKFLOW_ID_OR_VERSION_DRIFT',x=>x.e.workflowId='unauthorized'));
test('workflow version drift rejected',()=>deniedReceipt(
 'WORKFLOW_ID_OR_VERSION_DRIFT',x=>x.e.workflowVersion='wrong-version'));
test('undefined pinned version never accepted',()=>deniedReceipt(
 'WORKFLOW_ID_OR_VERSION_DRIFT',x=>{delete x.expected.pinnedWorkflowVersion;delete x.e.workflowVersion}));
test('bad correlation digest rejected',()=>deniedReceipt(
 'MINIMAL_EVIDENCE_SHAPE_INVALID',x=>x.e.correlationDigest='not-sha'));
test('unknown UAT stage rejected',()=>deniedReceipt(
 'MINIMAL_EVIDENCE_SHAPE_INVALID',x=>x.e.stage='SEND_APPROVED'));
test('missing receipt ref rejected',()=>deniedReceipt(
 'MINIMAL_EVIDENCE_SHAPE_INVALID',x=>x.e.caseRef=''));
test('real provider proof spoofed as source rejected',()=>deniedReceipt(
 'UNSUPPORTED_EXTERNAL_ATTESTATION_IN_OFFLINE_MODULE',x=>x.e.evidenceSource='ZALO_APPROVED'));
test('expired receipt rejected',()=>deniedReceipt(
 'EVIDENCE_RECEIPT_OUT_OF_TIMEBOX',x=>x.e.recordedAtMs=NOW-600000));
test('future receipt rejected',()=>deniedReceipt(
 'EVIDENCE_RECEIPT_OUT_OF_TIMEBOX',x=>x.e.recordedAtMs=NOW+600000));
test('live mode never accepted',()=>deniedReceipt(
 'PRIVATE_UAT_GATE_NOT_GRANTED',x=>x.expected.offlineMode='LIVE'));
test('send-enabled UAT not accepted',()=>deniedReceipt(
 'PRIVATE_UAT_GATE_NOT_GRANTED',x=>x.expected.noSend=false));
test('write-enabled UAT not accepted',()=>deniedReceipt(
 'PRIVATE_UAT_GATE_NOT_GRANTED',x=>x.expected.noCommerceWrite=false));
for(const key of ['authorization','cookie','access_token','secret','phone',
 'email','message','jwt','session_token','raw_payload','customer_name','storeId','price']){
 test('refuse '+key+' in receipt',()=>deniedReceipt(
   'SENSITIVE_OR_UNTRUSTED_EVIDENCE_FIELD',x=>x.e[key]='never-in-evidence'));
}
for(const channel of channelUatScopes)test(channel+' operator plan never executes',()=>{
 const plan=getUatOperatorPlan(channel);
 assert.equal(plan.noExecute,true);
 assert.equal(plan.workflowId,WF[channel]);
 assert.equal(plan.activities.length,7);safe(plan);
});
test('OA cannot create hosted operator plan without owner grant',()=>{
 const r=getUatOperatorPlan('ZALO_OA');
 assert.equal(r.reason,'NO_HOSTED_UAT_PLAN_FOR_THIS_CHANNEL');safe(r);
});
test('self-reported all-green owner proof cannot unlock release',()=>{
 const r=evaluateRealUatAdmission({
  realProviderVerified:true,realStoreJwtVerified:true,
  realSameTenantABVerified:true,approved:true,send:true
 });
 assert.equal(r.required.length,7);assert.equal(r.noSend,true);
 assert.equal(r.noCommerceWrite,true);safe(r);
});
