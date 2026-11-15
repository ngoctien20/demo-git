'use strict';
/**
 * TIEN404 AI V14.4.1 — Source-only, fail-closed release evidence REVIEW.
 *
 * NEVER an authorization service. This module cannot run SQL, fetch auth
 * sessions, merge PRs, deploy a gateway, send a message or approve a release.
 * Even fully claimed gate evidence requires independent hosted verification.
 */
const PROJECT='ifxlvrhyjhbzbrkdsida';
const PULL_REQUESTS=Object.freeze([
 Object.freeze({number:86,version:'V14.2 Store RLS/Knowledge',head:'635e1d8e634556887eb35fd318b892c740177a9e',base:'work/v141-shop-knowledge-brain-offline-staging',ci:43718874247}),
 Object.freeze({number:94,version:'V14.3 Messenger Widget',head:'02c480d6925234631a94c9ad1c5b705b07c4128d',base:'work/v136m5-private-event-store-readiness-offline-20261115',ci:43716550115}),
 Object.freeze({number:95,version:'V13.6M.7 Durable Replay',head:'ad35baec097a7e8289518ec66ff74b1a19f1b3d3',base:'work/v136m6-hosted-replay-keyrotation-retention-offline-20261115',ci:43716811550}),
 Object.freeze({number:97,version:'V14.4 Widget Gate',head:'67ccf9334e81f346f2aebdc1fbf1bf7ec0275e32',base:'work/v143-unified-channel-widget-staging-20261115',ci:43720672744})
]);
const TABLES=Object.freeze(['products','customers','orders','order_items','conversations','messages']);
const RPCS=Object.freeze(['qa_owner_pairing','qa_shop_b_zalo_claim','save_merchant_product']);
const GATES=Object.freeze([
 'operator_backup_bytes_verified',
 'isolated_restore_from_actual_archive_passed',
 'rollback_plan_signed_off_by_owner',
 'canonical_store_schema_approved',
 'six_table_store_fks_and_rls_reviewed',
 'old_permissive_tenant_policies_removed_atomically',
 'all_four_legacy_rows_owner_attributed',
 'all_three_security_definer_rpcs_reviewed',
 'real_same_tenant_two_store_jwt_tests_passed',
 'real_cross_tenant_negative_jwt_tests_passed',
 'restricted_staff_and_revoked_auth_tests_passed',
 'merchant_knowledge_publication_reviewed',
 'private_messenger_page_binding_verified',
 'real_meta_app_page_permission_verified',
 'hosted_event_replay_atomic_and_rotation_tested',
 'hosted_widget_domain_owner_verified',
 'hosted_widget_session_abuse_and_quota_tested',
 'subscription_denial_verified',
 'combined_branch_source_regression_passed',
 'separate_owner_scope_approval_granted'
]);
const isSHA=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
function reviewPrGraph(entries,merge={}){
 const byId=new Map();
 for(const x of Array.isArray(entries)?entries:[]){
  if(!x||!Number.isInteger(x.number)||byId.has(x.number))
    return Object.freeze({status:'INVALID_PR_EVIDENCE',drift:['duplicate_or_invalid_pr'],mergeReady:false,canMerge:false,canDeploy:false});
  byId.set(x.number,x);
 }
 const drift=[];
 for(const p of PULL_REQUESTS){
  const x=byId.get(p.number);
  if(!x){drift.push('missing_pr_'+p.number);continue;}
  if(x.head!==p.head||!isSHA(x.head))drift.push('changed_head_'+p.number);
  if(x.base!==p.base)drift.push('changed_base_'+p.number);
  if(x.state!=='open'||x.draft!==true||x.merged!==false)
    drift.push('unexpected_pr_lifecycle_'+p.number);
  if(x.ciConclusion!=='success')drift.push('missing_green_ci_'+p.number);
 }
 // A branch may be Git-mergeable yet still be unsafe/incompatible in runtime.
 // merge-tree is TEXT conflict rehearsal only, not schema or API contract QA.
 const info=['97_plus_95','combined_plus_86'].map(k=>Object.freeze({
  pair:k,observation:merge?.[k]===true?'CLEAN_TEXT_ONLY_REHEARSAL':'NOT_RECONCILED'
 }));
 return Object.freeze({
  status:drift.length?'SNAPSHOT_DRIFT_REAUDIT_REQUIRED':'SNAPSHOT_MATCHES_READ_ONLY_AUDIT',
  drift:Object.freeze(drift),offlineMergeObservations:Object.freeze(info),
  branchesDiverged:true,sourceIntegrationReviewed:false,
  canMerge:false,canDeploy:false,mergeReady:false
 });
}
function reviewHosted({projectRef,graph,db,receipts={},productionTarget=false}={}){
 const problems=[];
 if(projectRef!==PROJECT)problems.push('UNVERIFIED_STAGING_PROJECT');
 if(graph?.drift?.length||graph?.status!=='SNAPSHOT_MATCHES_READ_ONLY_AUDIT')
  problems.push('PR_HEAD_OR_CI_NOT_CURRENTLY_VERIFIED');
 if(productionTarget!==false)problems.push('PRODUCTION_TARGET_DENIED');
 if(!db||db.source!=='READ_ONLY_SUPABASE_SCHEMA_AUDIT'||db.projectRef!==PROJECT)
  problems.push('DB_EVIDENCE_NOT_GROUNDED');
 else{
  if(TABLES.some(x=>db.tables?.[x]?.hasStoreId!==true))
   problems.push('SIX_TABLES_NOT_STORE_SCOPED');
  if(db.storesExists!==true||db.storeMembershipsExists!==true)
   problems.push('CANONICAL_STORE_SCHEMA_ABSENT');
  if(TABLES.some(x=>db.tables?.[x]?.tenantOnlyPermissiveSelect!==false))
   problems.push('TENANT_WIDE_PERMISSIVE_RLS_ACTIVE_OR_UNKNOWN');
  if(db.productsUniqueTenantSku===true)
   problems.push('LEGACY_TENANT_SKU_UNIQUENESS');
  if(db.productCount!==2||db.orderCount!==2)
   problems.push('FOUR_ROW_BASELINE_DRIFT_REVERIFY_OWNERS');
  if(RPCS.some(x=>db.rpcs?.[x]?.reviewedScoped!==true))
   problems.push('SECURITY_DEFINER_PATHS_NOT_STORE_REVIEWED');
 }
 const reviewClaims=GATES.filter(k=>receipts[k]?.claimed===true &&
  receipts[k]?.category==='OWNER_SUPPLIED_DOCUMENT_FOR_REVIEW');
 const absent=GATES.filter(k=>!reviewClaims.includes(k));
 if(absent.length)problems.push('INCOMPLETE_HOSTED_EVIDENCE');
 // Even claiming every gate as true cannot issue deployment authorization.
 // Independent signatures, JWT results, backup restore, ACLs and approvals
 // must be checked outside this source-only module by authorized reviewers.
 return Object.freeze({
  mode:'EVIDENCE_PREPARATION_ONLY',
  projectRef:PROJECT,status:'HOSTED_RELEASE_BLOCKED',
  blockers:Object.freeze(problems),notDocumented:Object.freeze(absent),
  claimCount:reviewClaims.length,gateCount:GATES.length,
  evidenceClass:'UNTRUSTED_OPERATOR_CLAIMS_UNTIL_INDEPENDENTLY_VERIFIED',
  canMigrate:false,canBackfill:false,canAlterRls:false,canMerge:false,
  canPublish:false,canSendMeta:false,canSendZalo:false,
  canDeployWidget:false,canChangeCredentials:false,
  canUseServiceRoleForRlsProof:false,
  realUserJwtRlsVerified:false,restoreVerified:false,
  productionReady:false
 });
}
function reportSnapshot(){
 return Object.freeze({
  source:'READ_ONLY_CONNECTOR_AUDIT_MANIFEST',version:'V14.4.1',projectRef:PROJECT,
  heads:PULL_REQUESTS.map(x=>({number:x.number,head:x.head,base:x.base,ci:x.ci})),
  comment:'Frozen 2026-11-15 audit snapshot. Re-check live GitHub before acting. NOT signed authorization.'
 });
}
module.exports={PROJECT,PULL_REQUESTS,TABLES,RPCS,GATES,reviewPrGraph,reviewHosted,reportSnapshot};
