'use strict';
/**
 * V18.6.9: metadata-only risk assessment. NEVER an approval service or a migration runner.
 * In particular a caller's existence cannot be ignored just because no execution was seen.
 * Hosted authorization and release approval must come from an independent private process.
 */
const {deepStrictEqual} = require('node:assert/strict');
const ORIGINAL = require('./caller-evidence.json');
const K = Object.freeze({
  INVALID:'EVIDENCE_INVALID', ACTIVE_RPC_CALLER:'ACTIVE_PUBLISHED_RPC_CALLER',
  NO_REPLACEMENT:'NO_VERIFIED_REPLACEMENT_AND_REGRESSION',
  OTHER_CALLERS:'CALLER_INVENTORY_PARTIAL', STORE_SCHEMA:'STORE_AUTHORITY_ABSENT',
  PRODUCT_WRITER:'PRODUCT_WRITER_TENANT_ONLY', SKU:'SKU_D02_UNAPPROVED',
  ROLE:'STORE_OWNER_ROLE_UNAPPROVED', BACKUP:'BACKUP_RESTORE_NOT_VERIFIED',
  RENDER:'RENDER_NOT_AUDITED', OWNERS:'REAL_OWNER_AB_NOT_VERIFIED',
  PRIVATE_APPROVAL:'PRIVATE_INDEPENDENT_APPROVAL_REQUIRED'
});
const deny = (code, blockers=[K.INVALID]) => Object.freeze({
  version:'V18.6.9', code, status:'NO_GO',
  activeRpcRevocationAllowed:false, storeSchemaMigrationAllowed:false,
  storeOwnerRoleCutoverAllowed:false, skuConstraintChangeAllowed:false,
  publishN8nAllowed:false, realAuthAbUatAllowed:false,
  productionReady:false, oauthLiveAllowed:false,
  verifiedExecutionOfRpc:false, validatedRealOwnerSessions:false,
  blockers:Object.freeze([...new Set(blockers)]),
  approvalRequired:true, independentPrivateEvidenceRequired:true
});
const isPlain = value => value && typeof value==='object' && !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype;
function assess(evidence=ORIGINAL) {
  if(!isPlain(evidence)||evidence.version!=='V18.6.9'||
     evidence.classification!=='PARTIAL_RUNTIME_GRAPH_AND_METADATA_NOT_EXECUTION_PROOF'||
     !isPlain(evidence.n8n)||!isPlain(evidence.n8n.claimCaller)||
     !isPlain(evidence.supabase)||!isPlain(evidence.decisions)||!isPlain(evidence.safety)||
     evidence.n8n.workflowsListed!==170||evidence.n8n.activeWorkflows!==22||
     evidence.n8n.activeWorkflowsGraphInspected!==22||
     evidence.n8n.claimCaller.rpcName!=='qa_shop_b_zalo_claim'||
     evidence.n8n.claimCaller.httpMethod!=='POST'||
     Object.values(evidence.safety).some(x=>x!==false)) return deny(K.INVALID);
  const b=[];
  const add=(condition,k)=>{if(condition)b.push(k)};
  const w=evidence.n8n.claimCaller, s=evidence.supabase, d=evidence.decisions;
  add(w.parentActive===true&&w.childActive===true&&w.parentPublished===true&&w.childPublished===true&&w.parentCallerEnabled===true&&w.childRpcNodeEnabled===true,K.ACTIVE_RPC_CALLER);
  add(w.possiblePrivateQaWrite===true,K.NO_REPLACEMENT);
  add(evidence.n8n.activeGraphScanDoesNotProveAllCallersFound===true||d.rpcCallerInventoryComplete!==true,K.OTHER_CALLERS);
  add(s.canonicalStoreTableCount!==2||s.commerceStoreIdColumns!==6||s.restrictivePublicPolicies<6,K.STORE_SCHEMA);
  add(s.privilegedProductWriterStoreScoped!==true,K.PRODUCT_WRITER);
  add(d.skuScopeD02==='PENDING_OWNER_APPROVAL',K.SKU);
  add(d.roleContractApproved!==true||d.mappingApproved!==true||d.lastActiveStoreOwnerProtectionApproved!==true,K.ROLE);
  add(d.backupAndRestoreProven!==true,K.BACKUP);
  add(d.renderDeployedWriterSourcesReviewed!==true,K.RENDER);
  add(w.pageOrOwnerSessionVerified!==true,K.OWNERS);
  add(true,K.PRIVATE_APPROVAL);
  // Even a tampered all-green JSON is not an authoritative release attestation.
  return deny(b.length?'MISSING_VERIFIED_PRECONDITIONS':'INDEPENDENT_ATTESTATION_REQUIRED',b);
}
function assessBundled(){return assess(ORIGINAL)}
module.exports = {assess,assessBundled,K};
if(require.main===module) {
  const outcome=assessBundled();
  console.log(JSON.stringify(outcome,null,2));
  if(outcome.status!=='NO_GO'||outcome.activeRpcRevocationAllowed||outcome.productionReady)process.exitCode=2;
}
