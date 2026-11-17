'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,inspectBridge,expectedCallers}=require('./alias-bridge-preflight.cjs');
const now='2026-11-17T00:00:00.000Z';
const T1='11111111-1111-4111-8111-111111111111';
const T2='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function good(){
 return {
  contract:CONTRACT,mode:'SYNTHETIC_OR_PRIVATE_OFFLINE_ONLY',
  tenants:[{id:T1},{id:T2}],
  stores:[{id:SA,tenantId:T1,active:true},{id:SB,tenantId:T1,active:true},{id:SC,tenantId:T2,active:true}],
  aliases:[{alias:'tenant-alias-1',canonicalTenantId:T1,source:'INDEPENDENT_PRIVATE_REGISTRY_CLAIM'},
    {alias:'tenant-alias-2',canonicalTenantId:T2,source:'INDEPENDENT_PRIVATE_REGISTRY_CLAIM'}],
  installations:[
   {provider:'MESSENGER',installationRef:'page-qaa',tenantAlias:'tenant-alias-1',storeId:SA,enabled:true,revoked:false,
    expiresAt:'2027-01-01T00:00:00.000Z',providerSignatureExternallyVerified:true,ownerAttestationExternallyVerified:true,registryVersionPinned:true},
   {provider:'ZALO_OA',installationRef:'oa-qab',tenantAlias:'tenant-alias-1',storeId:SB,enabled:true,revoked:false,
    expiresAt:'2027-01-01T00:00:00.000Z',providerSignatureExternallyVerified:true,ownerAttestationExternallyVerified:true,registryVersionPinned:true},
   {provider:'WEBSITE',installationRef:'website-qac',tenantAlias:'tenant-alias-2',storeId:SC,enabled:true,revoked:false,
    expiresAt:'2027-01-01T00:00:00.000Z',providerSignatureExternallyVerified:true,ownerAttestationExternallyVerified:true,registryVersionPinned:true}
  ],
  callers:expectedCallers.map(workflowId=>({workflowId,usesTrustedServerStoreResolver:true,canonicalStoreIdRequired:true,
    staleTenantOnlyPathDisabled:true,authoritativeMembershipRecheck:true}))
 };
}
const run=x=>inspectBridge(x,now);
function negative(name,edit,code){
 test(name,()=>{
  const x=good();edit(x);
  const r=run(x);
  assert.equal(r.status,'STRUCTURAL_NO_GO');
  assert.ok(r.blockers.includes(code),JSON.stringify(r.blockers));
  assert.equal(r.canResolveRealStore,false);
  assert.equal(r.canMigrate,false);
 });
}
test('a correct synthetic multi-Store fixture is ONLY structurally ready; no live grants',()=>{
 const r=run(good());
 assert.equal(r.status,'STRUCTURAL_FIXTURE_READY_FOR_EXTERNAL_EVIDENCE_REVIEW');
 assert.deepEqual(r.blockers,[]);
 for(const k of ['canRelease','canResolveRealStore','canAuthorizeOrderRead','canCreateOrder','canMigrate','canChangeRls',
   'canPublish','actualAliasProofAuthenticated','actualOwnerProofAuthenticated','actualProviderSignatureVerifiedHere',
   'actualJwtVerifiedHere','customerDataDisclosed'])assert.equal(r[k],false);
 assert.deepEqual(r.inputCounts,{tenants:2,stores:3,aliases:2,installations:3,callers:3});
});
test('null packet keeps hard deny',()=>assert.equal(run(null).status,'STRUCTURAL_NO_GO'));
negative('rejects non-private mode',x=>x.mode='HOSTED', 'EXTERNAL_SOURCE_NOT_ALLOWED');
negative('rejects missing collection',x=>delete x.installations,'UNBOUNDED_OR_MISSING_COLLECTION');
negative('rejects unbounded collection',x=>x.installations=Array(101).fill(x.installations[0]),'UNBOUNDED_OR_MISSING_COLLECTION');
negative('rejects duplicate Tenant',x=>x.tenants.push({...x.tenants[0]}),'INVALID_OR_DUPLICATE_TENANT');
negative('rejects invalid UUID-form Tenant',x=>x.tenants[0].id='tenant-1','INVALID_OR_DUPLICATE_TENANT');
negative('rejects Store outside canonical Tenant',x=>x.stores[0].tenantId='33333333-3333-4333-8333-333333333333','INVALID_STORE_MEMBERSHIP_GRAPH');
negative('rejects duplicate Store',x=>x.stores.push({...x.stores[0]}),'INVALID_STORE_MEMBERSHIP_GRAPH');
negative('rejects disabled Store',x=>x.stores[0].active=false,'INVALID_STORE_MEMBERSHIP_GRAPH');
negative('rejects duplicate alias key',x=>x.aliases.push({...x.aliases[0]}),'UNKNOWN_AMBIGUOUS_OR_UNREVIEWED_TENANT_ALIAS');
negative('rejects alias Tenant that cannot be mapped',x=>x.aliases[0].canonicalTenantId='33333333-3333-4333-8333-333333333333','UNKNOWN_AMBIGUOUS_OR_UNREVIEWED_TENANT_ALIAS');
negative('rejects unreviewed alias origin',x=>x.aliases[0].source='CLIENT_CLAIM','UNKNOWN_AMBIGUOUS_OR_UNREVIEWED_TENANT_ALIAS');
negative('rejects unsupported provider',x=>x.installations[0].provider='UNKNOWN','INVALID_PROVIDER_INSTALLATION');
negative('rejects duplicate Page mapping to different Store',x=>{
 x.installations.push({...x.installations[0],storeId:SB});
},'AMBIGUOUS_PROVIDER_INSTALLATION');
negative('rejects provider binding to wrong Tenant',x=>x.installations[0].storeId=SC,'CROSS_TENANT_OR_UNKNOWN_STORE_BINDING');
negative('rejects provider binding to unknown Store',x=>x.installations[0].storeId='dddddddd-dddd-4ddd-8ddd-dddddddddddd','CROSS_TENANT_OR_UNKNOWN_STORE_BINDING');
negative('rejects revoked provider binding',x=>x.installations[0].revoked=true,'DISABLED_OR_REVOKED_INSTALLATION');
negative('rejects disabled provider binding',x=>x.installations[0].enabled=false,'DISABLED_OR_REVOKED_INSTALLATION');
negative('rejects expired binding',x=>x.installations[0].expiresAt='2026-11-16T00:00:00.000Z','EXPIRED_INSTALLATION_BINDING');
negative('rejects missing provider signature evidence marker',x=>x.installations[0].providerSignatureExternallyVerified=false,'INDEPENDENT_PROVIDER_OR_OWNER_EVIDENCE_MISSING');
negative('rejects missing owner evidence marker',x=>x.installations[0].ownerAttestationExternallyVerified=false,'INDEPENDENT_PROVIDER_OR_OWNER_EVIDENCE_MISSING');
negative('rejects unpinned private registry version',x=>x.installations[0].registryVersionPinned=false,'INDEPENDENT_PROVIDER_OR_OWNER_EVIDENCE_MISSING');
negative('rejects unchanged Tenant-only caller',x=>x.callers[0].staleTenantOnlyPathDisabled=false,'TENANT_ONLY_OR_UNTRUSTED_CALLER');
negative('rejects caller without canonical Store',x=>x.callers[0].canonicalStoreIdRequired=false,'TENANT_ONLY_OR_UNTRUSTED_CALLER');
negative('rejects caller that skips membership recheck',x=>x.callers[0].authoritativeMembershipRecheck=false,'TENANT_ONLY_OR_UNTRUSTED_CALLER');
negative('rejects omitted Catalog workflow',x=>x.callers=x.callers.filter(y=>y.workflowId!==expectedCallers[1]),'REQUIRED_COMMERCE_CALLER_UNREVIEWED');
negative('rejects duplicate caller',x=>x.callers.push({...x.callers[0]}),'INVALID_OR_DUPLICATE_CALLER');
test('no raw Tenant UUID, Store UUID, page/ref, or secret echoed from input',()=>{
 const x=good();x.rawSecret='UNPRINTABLE_SECRET';const r=run(x);const out=JSON.stringify(r);
 for(const secret of [T1,T2,SA,SB,SC,'page-qaa','UNPRINTABLE_SECRET'])assert.equal(out.includes(secret),false);
});
test('an all-green client-created report is never a source of authorization',()=>{
 const r=run(good());
 assert.notEqual(r.status,'HOSTED_AUTHORIZED');
 assert.equal(r.canRelease,false);
 assert.equal(r.actualOwnerProofAuthenticated,false);
});
