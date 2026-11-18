'use strict';
// V18.6.8 Source-only migration gate; DOES NOT connect to Supabase or authorize any operation.
const fs = require('node:fs');
const path = require('node:path');
const EXPECTED = Object.freeze(['products','customers','orders','order_items','conversations','messages']);
const ALL_APPROVAL_KEYS = Object.freeze([
  'canonicalDesignPr417Approved','pgTapPr421Released','storeRoleContractApproved','skuScopeD02Approved',
  'backupRestoreVerified','legacyMappingManifestReviewed','ownerABRealSessionsVerified',
  'storeRlsRealABVerified','privilegedRpcReplacementApproved','serviceRoleBypassAudited',
  'migrationExecutionApproved'
]);
const DENIAL = Object.freeze({
  SNAPSHOT_INVALID:'SNAPSHOT_INVALID',STORE_TABLES_MISSING:'STORE_TABLES_MISSING',
  COMMERCE_STORE_SCOPE_MISSING:'COMMERCE_STORE_SCOPE_MISSING',STORE_RLS_MISSING:'STORE_RLS_MISSING',
  TENANT_SKU_UNDECIDED:'TENANT_SKU_UNDECIDED',PRIVILEGED_RPC_TENANT_ONLY:'PRIVILEGED_RPC_TENANT_ONLY',
  RPC_CALLER_INVENTORY_INCOMPLETE:'RPC_CALLER_INVENTORY_INCOMPLETE',
  RENDER_DEPLOY_SOURCE_UNVERIFIED:'RENDER_DEPLOY_SOURCE_UNVERIFIED',
  LIVE_AUTH_WORKER_UNVERIFIED:'LIVE_AUTH_WORKER_UNVERIFIED',
  MISSING_OWNER_APPROVALS:'MISSING_OWNER_APPROVALS',
  UNSAFE_DEMO_COMMERCE_MIXING:'UNSAFE_DEMO_COMMERCE_MIXING',
  INDEPENDENT_ATTESTATION_REQUIRED:'INDEPENDENT_ATTESTATION_REQUIRED'
});
const result=(blockers,valid)=>Object.freeze({
 version:'V18.6.8',classification:'SOURCE_ONLY_MIGRATION_PREFLIGHT',
 status:'BLOCKED', validMetadata:valid, blockers:Object.freeze([...blockers]),
 deployApproved:false, databaseMutationApproved:false, accessGrantChangeApproved:false,
 privilegedRpcChangeApproved:false, publishedWorkflowChangeApproved:false,
 realOwnerABApproved:false, productionReady:false, externalAttestationRequired:true
});
const isBool=x=>typeof x==='boolean';
function evaluate(snapshot){
 if(!snapshot || typeof snapshot!=='object' || Array.isArray(snapshot)||
    snapshot.version!=='V18.6.8'||snapshot.classification!=='LIVE_STAGING_READ_ONLY_METADATA_NOT_DEPLOYMENT_EVIDENCE'||
    snapshot.scope!=='public'||snapshot.source!=='SUPABASE_STAGING_PG_CATALOG_READ_ONLY'||
    !Array.isArray(snapshot.expectedCommerceTables)||JSON.stringify(snapshot.expectedCommerceTables)!==JSON.stringify(EXPECTED)||
    !snapshot.privilegedProductWriter||!snapshot.otherPaths||!snapshot.approval||!snapshot.commerceRowsAggregate||
    !ALL_APPROVAL_KEYS.every(k=>isBool(snapshot.approval[k]))||
    ![snapshot.canonicalTablesFound,snapshot.commerceTablesWithStoreId,snapshot.publicRestrictivePolicies].every(x=>Number.isInteger(x)&&x>=0)||
    Object.values(snapshot.commerceRowsAggregate).some(x=>!Number.isInteger(x)||x<0)||
    snapshot.privilegedProductWriter.stagingSchemaWriteExecuted!==false){
   return result([DENIAL.SNAPSHOT_INVALID],false);
 }
 const b=[];const block=(test,code)=>{if(test)b.push(code)};
 block(snapshot.canonicalTablesFound!==2,DENIAL.STORE_TABLES_MISSING);
 block(snapshot.commerceTablesWithStoreId!==6,DENIAL.COMMERCE_STORE_SCOPE_MISSING);
 block(snapshot.publicRestrictivePolicies<6,DENIAL.STORE_RLS_MISSING);
 block(snapshot.productSkuConstraint==='UNIQUE (tenant_id, sku)'&&!snapshot.approval.skuScopeD02Approved,DENIAL.TENANT_SKU_UNDECIDED);
 const w=snapshot.privilegedProductWriter;
 block(w.name!=='public.save_merchant_product'||w.storeAware!==true,DENIAL.PRIVILEGED_RPC_TENANT_ONLY);
 block(w.callerInventoryExhaustive!==true,DENIAL.RPC_CALLER_INVENTORY_INCOMPLETE);
 block(snapshot.otherPaths.renderDeployedSourceVerified!==true,DENIAL.RENDER_DEPLOY_SOURCE_UNVERIFIED);
 block(snapshot.otherPaths.realSupabaseAuthOnWorkerVerified!==true,DENIAL.LIVE_AUTH_WORKER_UNVERIFIED);
 block(snapshot.otherPaths.demoSeparateFromCommerce!==true,DENIAL.UNSAFE_DEMO_COMMERCE_MIXING);
 block(!ALL_APPROVAL_KEYS.every(k=>snapshot.approval[k]===true),DENIAL.MISSING_OWNER_APPROVALS);
 // Signed owner approval and trusted-runtime identity / RLS proof CANNOT be inferred
 // from an editable JSON or a GitHub CI job. This gate always denies changes.
 b.push(DENIAL.INDEPENDENT_ATTESTATION_REQUIRED);
 return result(b,true);
}
function evaluateBundled(){return evaluate(JSON.parse(fs.readFileSync(path.join(__dirname,'staging-metadata.snapshot.json'),'utf8')))}
module.exports={evaluate,evaluateBundled,DENIAL,ALL_APPROVAL_KEYS};
if(require.main===module){console.log(JSON.stringify(evaluateBundled(),null,2));}
