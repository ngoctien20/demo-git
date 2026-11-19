'use strict';
/**
 * V18.6.10 — offline evidence assessor, NOT an authorization, migration, or access-control service.
 * Do not import this into live request handling. Zero I/O except reading this public-safe JSON fixture.
 * Never treat a source snapshot, regardless of its content, as permission to revoke or deploy.
 */
const snapshot = require('./n8n-rpc-static-audit.json');
const VALID = Object.freeze({
  EVIDENCE_INVALID: 'EVIDENCE_INVALID',
  BACKUP_UNVERIFIED: 'BACKUP_UNVERIFIED',
  RESTORE_DRILL_MISSING: 'RESTORE_DRILL_MISSING',
  RPC_CALLER_EXISTS: 'PUBLISHED_ZALO_RPC_CALLER_EXISTS',
  OUTSIDE_N8N_UNAUDITED: 'OTHER_APP_RPC_CALLERS_UNAUDITED',
  DYNAMIC_RPC_UNAUDITED: 'DYNAMIC_RPC_REFERENCES_UNPROVEN',
  RENDER_UNAUDITED: 'RENDER_WORKSPACE_AND_LIVE_SOURCE_UNAUDITED',
  STORE_SCHEMA_ABSENT: 'STORE_RLS_AND_AUTHORITY_NOT_LIVE',
  PRODUCT_RPC_TENANT_ONLY: 'PRODUCT_WRITER_NOT_STORE_SCOPED',
  SKU_NOT_APPROVED: 'SKU_D02_OWNER_APPROVAL_REQUIRED',
  ROLE_NOT_APPROVED: 'STORE_OWNER_ROLE_APPROVAL_REQUIRED',
  REAL_AUTH_AB_NOT_VERIFIED: 'REAL_OWNER_AB_UAT_NOT_VERIFIED',
  INDEPENDENT_REVIEW: 'INDEPENDENT_PRIVATE_ATTESTATION_AND_CHANGE_APPROVAL_REQUIRED'
});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const isInt=x=>Number.isSafeInteger(x)&&x>=0;
const safeDenial=(blockers,meta)=>Object.freeze({
  version:'V18.6.10',status:'NO_GO',
  evidenceStatus:meta?'CURRENT_N8N_LIST_SCANNED_STATICALLY':'EVIDENCE_UNTRUSTED',
  scope:'SOURCE_ONLY_PRIVATE_ATTESTATION_REQUIRED',
  blockers:Object.freeze([...new Set(blockers)]),
  n8nCurrentListStaticCoverage:meta?171:0,
  liveRpcInvocationProved:false,
  backupRestoreVerified:false,
  independentOwnerDecisionVerified:false,
  revokeZaloRpcAnonExecuteAllowed:false,
  applySupabaseMigrationAllowed:false,
  changeProductRpcAllowed:false,
  rewirePublishedMessengerAllowed:false,
  grantStoreAuthorityAllowed:false,
  realOwnerAbUatApproved:false,
  providerSendAllowed:false,
  productionReady:false
});
function cohortsValid(scope){
  if(!plain(scope)||scope.totalListed!==171||scope.totalGraphDetailsRead!==171||
     scope.activeListed!==22||scope.inactiveListed!==149||scope.readFailures!==0||
     !Array.isArray(scope.scanCohorts)||scope.scanCohorts.length!==10)return false;
  let cursor=0,n=0,matches=0;
  for(const c of scope.scanCohorts){
    if(!plain(c)||!isInt(c.start)||!isInt(c.end)||!isInt(c.inspected)||!isInt(c.rpcMatches)||
       c.start!==cursor||c.end<c.start||c.inspected!==c.end-c.start+1)return false;
    cursor=c.end+1;n+=c.inspected;matches+=c.rpcMatches;
  }
  return cursor===171&&n===171&&matches===1;
}
function validate(e){
  if(!plain(e)||e.version!=='V18.6.10'||e.classification!=='COMPLETE_CURRENT_N8N_LIST_STATIC_NODE_PARAMETER_SCAN_ONLY'||
     e.method!=='CONNECTED_N8N_READ_ONLY_LIST_AND_WORKFLOW_DETAILS_DRAFT_PUBLISHED_WHEN_DIFFERENT'||
     !cohortsValid(e.scope)||!plain(e.supabase)||!plain(e.backup)||!plain(e.decisions)||!plain(e.safety)||
     !Array.isArray(e.literalRpcReferences)||e.literalRpcReferences.length!==1||
     !Array.isArray(e.patterns)||!Array.isArray(e.noDirectLiteralReferencesFoundFor)||
     !Array.isArray(e.doesNotProve))return false;
  const ref=e.literalRpcReferences[0];
  if(!plain(ref)||ref.rpc!=='qa_shop_b_zalo_claim'||ref.nodeType!=='n8n-nodes-base.httpRequest'||
     ref.nodeName!=='Submit pending claim for Shop B'||ref.workflowId!=='OgDZNSAvKEvhnAvn'||
     ref.parentPublishedWorkflowId!=='yIJk8LvJoLF40Z62'||ref.active!==true||
     ref.scope!=='published'||ref.httpMethod!=='POST'||ref.connectionVerifiedInV1869!==true||
     ref.actualRpcExecutionVerified!==false)return false;
  for(const p of ['save_merchant_product','qa_shop_b_zalo_claim','qa_owner_pairing','/rpc/','/rest/v1'])if(!e.patterns.includes(p))return false;
  for(const p of ['save_merchant_product','qa_owner_pairing'])if(!e.noDirectLiteralReferencesFoundFor.includes(p))return false;
  for(const p of ['NO_DYNAMIC_RPC_CALLS','NO_EXTERNAL_RENDER_OR_CLOUDFLARE_CALLERS','RPC_WAS_EXECUTED'])if(!e.doesNotProve.includes(p))return false;
  if(e.supabase.canonicalStoreTables!==0||e.supabase.sixCommerceTablesWithStoreId!==0||
     e.supabase.publicRestrictivePolicies!==0||e.supabase.skuConstraint!=='UNIQUE (tenant_id, sku)'||
     e.supabase.claimRpcAnonExecute!==true||e.supabase.productWriterAuthenticatedExecute!==true||
     e.supabase.productWriterStoreScoped!==false)return false;
  if(e.backup.status!=='UNKNOWN_NO_CONNECTED_BACKUP_LIST_ACTION'||
     e.backup.officialDocs!=='https://supabase.com/docs/guides/platform/backups')return false;
  if(e.decisions.canonicalDesignPr!==417||e.decisions.disposableFullDmlPgtapPr!==421||
     e.decisions.tenantOwnerRole!=='owner'||e.decisions.canonicalStoreOwnerRole!=='store_owner')return false;
  return Object.values(e.safety).every(v=>v===0);
}
function assess(e=snapshot){
  if(!validate(e))return safeDenial([VALID.EVIDENCE_INVALID,VALID.INDEPENDENT_REVIEW],false);
  const b=[VALID.INDEPENDENT_REVIEW];
  // We may know a literal caller exists while still being unable to prove its execution.
  if(e.literalRpcReferences.some(x=>x.active))b.push(VALID.RPC_CALLER_EXISTS);
  if(!e.decisions.rpcOtherAppCallersExhaustive)b.push(VALID.OUTSIDE_N8N_UNAUDITED);
  if(e.doesNotProve.includes('NO_DYNAMIC_RPC_CALLS'))b.push(VALID.DYNAMIC_RPC_UNAUDITED);
  if(!e.decisions.renderWorkspaceConfirmed||!e.decisions.renderLiveSourceAudited)b.push(VALID.RENDER_UNAUDITED);
  if(e.backup.lastSuccessfulBackupVerified!==true)b.push(VALID.BACKUP_UNVERIFIED);
  if(e.backup.restoreDrillPassed!==true)b.push(VALID.RESTORE_DRILL_MISSING);
  if(!e.decisions.skuD02OwnerApproved)b.push(VALID.SKU_NOT_APPROVED);
  if(!e.decisions.roleMappingOwnerApproved)b.push(VALID.ROLE_NOT_APPROVED);
  if(e.supabase.canonicalStoreTables!==2||e.supabase.sixCommerceTablesWithStoreId!==6||e.supabase.publicRestrictivePolicies<6)b.push(VALID.STORE_SCHEMA_ABSENT);
  if(e.supabase.productWriterStoreScoped!==true)b.push(VALID.PRODUCT_RPC_TENANT_ONLY);
  if(e.decisions.sameTenantStoreAbAcceptance!==true)b.push(VALID.REAL_AUTH_AB_NOT_VERIFIED);
  // Intentional hard stop. This module never grants real operations from file data,
  // even when every external evidence flag is manually changed to true.
  return safeDenial(b,true);
}
function assessBundled(){return assess(snapshot)}
module.exports={assess,assessBundled,validate,cohortsValid,VALID};
if(require.main===module){const a=assessBundled();console.log(JSON.stringify(a,null,2));if(a.status!=='NO_GO'||a.productionReady||a.applySupabaseMigrationAllowed)process.exitCode=2;}
