'use strict';
/**
 * RPC.10-G0.3 — READ-ONLY PUBLISHED CALLER + COMMERCE DATA TABLE migration gate.
 *
 * Input is a SANITIZED metadata-only scan of connected n8n. Its booleans are
 * UNTRUSTED observations, not cryptographic proof of runtime auth. Does not
 * implement an adapter, inspect customer rows, call a model, connect to n8n,
 * mutate database, publish workflow or permit real hosted cutover.
 */
const CONTRACT='T404_RPC10_G03_PUBLISHED_CALLER_SCOPE_V1';
const EXPECTED=Object.freeze({
 '5Eeh8hbpsoNhuiVo':{name:'COMMERCE_TENANT_RESOLVER',version:'a99c7350-7aea-446d-bdc5-4b10f52c3ad1',kind:'COMMERCE'},
 'oOOXicKXGkBskKqh':{name:'COMMERCE_CATALOG',version:'e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696',kind:'COMMERCE'},
 'igPOsSbEgd4NgtRA':{name:'COMMERCE_CART',version:'eff32e20-a6d0-4975-88b8-107eae752b4b',kind:'COMMERCE'},
 'Y0WLykMtNAldbgL0':{name:'COMMERCE_V3_BUSINESS_CORE_SANDBOX',version:'3d8b7f89-2058-4a2a-8919-e5ff92c3c484',kind:'COMMERCE'},
 'Z7FdV7uDvApfbURQ':{name:'LEGACY_MESSENGER_DEMO',version:'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92',kind:'LEGACY_DEMO'}
});
const BUSINESS=Object.freeze(['TIEN404_COMMERCE_CHANNELS','TIEN404_COMMERCE_TENANTS',
 'TIEN404_COMMERCE_PRODUCTS','TIEN404_COMMERCE_ORDERS','TIEN404_COMMERCE_AUDIT',
 'TIEN404_COMMERCE_V3_STORE_RULES_SANDBOX','TIEN404_COMMERCE_V3_PRICE_RULES_SANDBOX',
 'TIEN404_COMMERCE_V3_NOTIFICATION_OUTBOX_SANDBOX']);
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,k)=>plain(x)&&Object.keys(x).length===k.length&&k.every(z=>Object.hasOwn(x,z));
const nonnegative=x=>Number.isSafeInteger(x)&&x>=0&&x<=500;
const instant=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)&&Number.isFinite(Date.parse(x));
function audit(snapshot,nowIso='2026-11-17T02:30:00Z'){
 const fail=new Set(),issue=x=>fail.add(x);
 if(!exact(snapshot,['contract','source','capturedAtUtc','workflowObservations','tableObservations','authority']))
  return summary(['INVALID_OR_OVERBROAD_SNAPSHOT']);
 if(snapshot.contract!==CONTRACT||snapshot.source!=='CONNECTED_N8N_METADATA_READ_ONLY')
  issue('SOURCE_NOT_TRUSTED_AS_PUBLISHED_METADATA');
 if(!instant(nowIso)||!instant(snapshot.capturedAtUtc)||
    Date.parse(snapshot.capturedAtUtc)>Date.parse(nowIso)+60000||
    Date.parse(nowIso)-Date.parse(snapshot.capturedAtUtc)>24*60*60*1000)
  issue('SNAPSHOT_STALE_OR_INVALID');
 if(!Array.isArray(snapshot.workflowObservations)||snapshot.workflowObservations.length!==5)
  issue('FIVE_REQUIRED_WORKFLOWS_NOT_COMPLETE');
 const seen=new Set(),obs=Array.isArray(snapshot.workflowObservations)&&
  snapshot.workflowObservations.length<=5?snapshot.workflowObservations:[];
 for(const w of obs){
  if(!exact(w,['workflowId','activeVersion','published','kind','codeReadsTenant',
    'codeReadsStore','dataReadsTenant','dataReadsStore','trustedStoreResolverDeployed',
    'activeMembershipRecheckDeployed','storeScopedWriteAuthDeployed','demoDataIsolated'])){
    issue('WORKFLOW_OBSERVATION_FORMAT_INVALID');continue;
  }
  const spec=EXPECTED[w.workflowId];
  if(!spec||seen.has(w.workflowId)){issue('UNKNOWN_OR_DUPLICATE_WORKFLOW');continue;}
  seen.add(w.workflowId);
  if(!w.published||w.activeVersion!==spec.version||w.kind!==spec.kind)
   issue('PUBLISHED_VERSION_OR_KIND_DRIFT');
  if(spec.kind==='COMMERCE'){
   if(w.codeReadsTenant!==true||w.dataReadsTenant!==true)
    issue('EXPECTED_TENANT_CALLER_SCAN_INCOMPLETE');
   if(w.codeReadsStore!==true||w.dataReadsStore!==true)
    issue('TENANT_ONLY_CODE_OR_QUERY_WITHOUT_STORE_SCOPE');
   if(w.trustedStoreResolverDeployed!==true||w.activeMembershipRecheckDeployed!==true)
    issue('TRUSTED_STORE_MEMBERSHIP_RUNTIME_MISSING');
   if(w.storeScopedWriteAuthDeployed!==true)
    issue('STORE_WRITE_AUTHORIZATION_NOT_REVIEWED');
  }else{
   if(w.demoDataIsolated!==true)issue('LEGACY_DEMO_DATA_MIXING_RISK');
   // A legacy bot may be live but must not be counted as Commerce acceptance.
   if(w.trustedStoreResolverDeployed!==false)
    issue('LEGACY_MESSENGER_NOT_SCOPED_TO_COMMERCE');
  }
 }
 for(const id of Object.keys(EXPECTED))if(!seen.has(id))issue('REQUIRED_PUBLISHED_CALLER_NOT_INSPECTED');
 if(!Array.isArray(snapshot.tableObservations)||snapshot.tableObservations.length<8||
    snapshot.tableObservations.length>100)
  issue('COMMERCE_TABLE_INVENTORY_INCOMPLETE');
 const tableSeen=new Set(),tables=Array.isArray(snapshot.tableObservations)&&snapshot.tableObservations.length<=100?
  snapshot.tableObservations:[];
 for(const t of tables){
  if(!exact(t,['table','tenantColumn','storeColumn','dataReadOperation','storage'])||
    typeof t.table!=='string'||!t.table.startsWith('TIEN404_COMMERCE_')||
    tableSeen.has(t.table)){issue('INVALID_DUPLICATE_OR_UNKNOWN_TABLE');continue;}
  tableSeen.add(t.table);
  if(t.tenantColumn!==true)issue('TABLE_TENANT_SCOPE_NOT_REVIEWED');
  if(t.storeColumn!==true)issue('TABLE_STORE_SCOPE_MISSING');
  if(t.dataReadOperation!==true)issue('TABLE_READER_CONTRACT_NOT_REVIEWED');
  if(t.storage!=='N8N_DATA_TABLE')issue('TABLE_SOURCE_TYPE_MISMATCH');
 }
 for(const t of BUSINESS)if(!tableSeen.has(t))issue('REQUIRED_COMMERCE_BUSINESS_TABLE_NOT_INSPECTED');
 const authority=snapshot.authority;
 if(!exact(authority,['realFourRowMerchantOwnerAttested','independentReviewerAttested',
    'canonicalHostedStoreRegistryVerified','realSameTenantJwtTested',
    'independentCurrentRecoveryAccepted','fullCallerInventoryApproved']))
    issue('AUTHORITY_CONTRACT_INVALID');
 else{
  if(authority.realFourRowMerchantOwnerAttested!==true||
     authority.independentReviewerAttested!==true)
   issue('REAL_FOUR_ROW_STORE_OWNERSHIP_NOT_ATTESTED');
  if(authority.canonicalHostedStoreRegistryVerified!==true)
   issue('CANONICAL_STORE_REGISTRY_NOT_VERIFIED');
  if(authority.realSameTenantJwtTested!==true)
   issue('REAL_SAME_TENANT_JWT_ISOLATION_NOT_TESTED');
  if(authority.independentCurrentRecoveryAccepted!==true)
   issue('CURRENT_RECOVERY_NOT_ACCEPTED');
  if(authority.fullCallerInventoryApproved!==true)
   issue('CALLER_INVENTORY_NOT_APPROVED');
 }
 // No inspector, JSON boolean or static pass may authorize production.
 return summary([...fail].sort(),{observedWorkflows:obs.length,observedTables:tables.length,
  publishedCommerceVersionCount:seen.size});
}
function summary(blockers,counts={}){
 return Object.freeze({contract:CONTRACT,
  status:'PUBLISHED_COMMERCE_STORE_CUTOVER_NO_GO',
  blockers:Object.freeze([...new Set(blockers)].sort()),
  counts:Object.freeze({...counts}),
  actualStoreOwnedFourRowDataAuthenticated:false,
  runtimeProviderBindingVerifiedHere:false,
  realSignedJwtValidatedHere:false,
  isProductionCutoverApproved:false,
  canPublish:false,canMerge:false,canMigrate:false,
  canAssignStore:false,canChangeRls:false,canReadHostedCommerce:false,
  canSendProvider:false,canModifyCredentials:false,canAuthorizeBilling:false,
  realCustomerRowsAccessed:0});
}
module.exports=Object.freeze({CONTRACT,EXPECTED,BUSINESS,audit});
if(require.main===module){
 try{
  const input=require('node:fs').readFileSync(0,'utf8');
  if(input.length>65536)throw Error('UNTRUSTED_TOO_BIG');
  console.log(JSON.stringify(audit(JSON.parse(input),new Date().toISOString()),null,2));
  process.exitCode=3; // NO GO, even if a forged packet says true
 }catch(_e){
  process.stderr.write('RPC10_G03_INVALID_INPUT_NO_PRIVATE_DATA_ECHO\n');
  process.exitCode=2;
 }
}
