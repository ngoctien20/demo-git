'use strict';
// RPC.10 offline-only six-surface release guard. Input is UNTRUSTED sanitized metadata.
// Never reads DB, authenticates humans, grants permissions or authorizes migrations.
const CORE=Object.freeze(['products','orders','customers','order_items','conversations','messages']);
const PRIVATE=Object.freeze(['channel_secrets','order_idempotency','audit_events','tenant_agent_configs']);
const FKS=Object.freeze([
 'product_store_tenant','customer_store_tenant','order_store_tenant',
 'order_to_customer_same_store','order_item_to_order_same_store',
 'order_item_to_product_same_store','message_to_conversation_same_store','conversation_store_tenant'
]);
const PROJECT='ifxlvrhyjhbzbrkdsida';
function inspect(s){
 const issues=[],add=x=>{if(!issues.includes(x))issues.push(x)};
 if(!s||typeof s!=='object'||Array.isArray(s)){
  return Object.freeze({contract:'T404_RPC10_NOHOST_GUARD_V1',status:'HOSTED_NO_GO',
    blockers:['SNAPSHOT_INVALID'],canMigrate:false,canRelease:false,
    actualOwnerStoreVerified:false,authenticatedEvidenceVerified:false});
 }
 if(s.projectRef!==PROJECT||s.environment!=='staging')add('PROJECT_SCOPE_MISMATCH');
 const c=s.counts||{};
 if(c.tenants!==2||c.products!==2||c.orders!==2||c.customers!==0||c.activeTenantOwners!==3)
  add('HOSTED_BASELINE_DRIFT_OR_MISSING');
 if(s.canonicalStoresPresent!==true||s.storeMembershipsPresent!==true)
  add('CANONICAL_STORE_SCHEMA_MISSING');
 for(const name of CORE){
  const t=s.tables?.[name];
  if(!t||typeof t!=='object'){add('MISSING_SURFACE_'+name.toUpperCase());continue;}
  if(t.rlsEnabled!==true||t.forceRls!==true)add('RLS_INCOMPLETE_'+name.toUpperCase());
  if(t.tenantId!==true||t.storeId!==true)add('TENANT_STORE_COLUMNS_MISSING_'+name.toUpperCase());
  if(t.legacyTenantPermissiveSelect!==false)add('LEGACY_TENANT_READ_POLICY_'+name.toUpperCase());
  if(t.storeScopedReadPolicy!==true)add('STORE_READ_POLICY_MISSING_'+name.toUpperCase());
  if(t.writerCompatibilityReviewed!==true)add('WRITER_COMPATIBILITY_UNREVIEWED_'+name.toUpperCase());
 }
 for(const name of FKS)if(s.constraints?.[name]!==true)add('M3_CONSTRAINT_MISSING_'+name.toUpperCase());
 if(s.constraints?.skuUniquenessPerStore!==true||s.constraints?.legacyTenantSkuUniqueRemoved!==true)
  add('SKU_STILL_TENANT_SCOPED');
 for(const name of PRIVATE){
  const v=s.scopeClassification?.[name];
  if(!v||!['STORE_SCOPED_REVIEWED','TENANT_SHARED_WITH_EXPLICIT_ISOLATION'].includes(v.decision)||
    v.independentReview!==true)add('PRIVATE_OR_SHARED_SURFACE_UNREVIEWED_'+name.toUpperCase());
 }
 const slots=s.fourRowOwnership;
 if(!Array.isArray(slots)||slots.length!==4)add('REAL_FOUR_ROW_LEDGER_INCOMPLETE');
 else{
  const exp=['T1:PRODUCT:1','T1:ORDER:1','T2:PRODUCT:1','T2:ORDER:1'];
  const got=slots.map(x=>x?.alias);
  if(new Set(got).size!==4||exp.some(x=>!got.includes(x)))add('REAL_FOUR_ROW_LEDGER_INVALID');
  if(slots.some(x=>x?.merchantPrimarySourceVerified!==true||
    x?.canonicalStoreProofVerified!==true||x?.independentReviewerVerified!==true))
    add('REAL_OWNER_ORIGIN_UNATTESTED');
 }
 const auth=s.authority||{};
 for(const name of ['independentRestorationVerified','authAndStorageRecoveryScoped',
  'merchantOwnerSignaturesVerifiedOutOfBand','operatorAndReviewerSeparated',
  'maintenanceWindowApproved','callerInventoryApproved','realJwtRlsTestPassed',
  'noWriteNoSendPostcheckPassed','rollbackDrillApproved'])
  if(auth[name]!==true)add('AUTHORITY_MISSING_'+name.toUpperCase());
 // Self-reported flags are never real authorization. No hosted operation entrypoint exists.
 return Object.freeze({contract:'T404_RPC10_NOHOST_GUARD_V1',
  status:issues.length?'HOSTED_NO_GO':'STRUCTURAL_SELF_REPORT_REQUIRES_EXTERNAL_ATTESTATION',
  blockers:Object.freeze(issues),canMigrate:false,canBackfill:false,canReplaceRls:false,
  canRevokeRpc:false,canRelease:false,actualOwnerStoreVerified:false,
  authenticatedEvidenceVerified:false,independenceAndBackupCertified:false,sourceDataDisclosed:false});
}
module.exports=Object.freeze({inspect,CORE,PRIVATE,FKS,PROJECT});
if(require.main===module){
 try{
  const input=require('node:fs').readFileSync(0,'utf8');
  if(input.length>64000)throw Error('INPUT_TOO_LARGE');
  const r=inspect(JSON.parse(input));
  console.log(JSON.stringify(r,null,2));
  process.exitCode=r.status==='HOSTED_NO_GO'?3:2; // Never exit success as authorization.
 }catch(_e){console.error('RPC10_INVALID_INPUT_KEEP_PRIVATE');process.exitCode=2;}
}