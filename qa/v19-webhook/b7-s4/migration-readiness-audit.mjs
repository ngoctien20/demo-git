// TIEN404 V19.0-B7-S4 — evidence-only migration preflight.
// Source + metadata diagnostic, NOT an admission token or a DB migration.
// Runs in CI on redacted, aggregated read-only Supabase metadata. Never writes.

export const STORE_TABLES=Object.freeze([
 "products","orders","customers","order_items","conversations","messages"
]);
const STOP=Object.freeze({
 productionAllowed:false,stagingDDLAllowed:false,realStoreAuthorityVerified:false,
 liveRpcV2Allowed:false,providerSendAllowed:false,hostedCanaryAllowed:false,
 realOwnerABVerified:false,customerDataBackfillAllowed:false
});
export function assessS4Readiness(snapshot){
 const blockers=[],warnings=[];
 if(!snapshot||typeof snapshot!=="object"||snapshot.project_ref!=="ifxlvrhyjhbzbrkdsida"){
  return Object.freeze({decision:"BLOCKED_INVALID_READONLY_SNAPSHOT",blockers:["SNAPSHOT_NOT_GROUNDED"],
    warnings, ...STOP});
 }
 const rows=Array.isArray(snapshot.tables)?snapshot.tables:[];
 for(const name of STORE_TABLES){
  const match=rows.filter(r=>r?.name===name);
  if(match.length!==1){
   blockers.push("MISSING_OR_DUPLICATE_TABLE_METADATA_"+name.toUpperCase());
   continue;
  }
  const r=match[0];
  if(r.has_tenant_id!==true)blockers.push("TENANT_SCOPE_ABSENT_"+name.toUpperCase());
  if(r.has_store_id!==true)blockers.push("STORE_ID_MISSING_"+name.toUpperCase());
  if(r.rls_enabled!==true||r.force_rls!==true)blockers.push("RLS_NOT_FORCED_"+name.toUpperCase());
  if(!Number.isSafeInteger(r.restrictive_policy_count)||
      r.restrictive_policy_count<1)blockers.push("STORE_RESTRICTIVE_RLS_MISSING_"+name.toUpperCase());
  if(!Number.isSafeInteger(r.row_count)||r.row_count<0)warnings.push("UNVERIFIED_AGGREGATE_COUNT_"+name.toUpperCase());
 }
 if(snapshot.registry?.public_stores!==true)blockers.push("CANONICAL_STORES_ABSENT");
 if(snapshot.registry?.public_store_memberships!==true)blockers.push("CANONICAL_STORE_MEMBERSHIPS_ABSENT");
 if(snapshot.registry?.app_private_store_channel_installations!==true)
  blockers.push("PRIVATE_INSTALLATION_AUTHORITY_ABSENT");
 if(snapshot.constraints?.store_composite_fk_present!==true)
  blockers.push("COMPOSITE_STORE_FOREIGN_KEYS_NOT_VERIFIED");
 if(snapshot.constraints?.store_scope_immutability_verified!==true)
  blockers.push("STORE_SCOPE_IMMUTABILITY_NOT_VERIFIED");
 if(snapshot.rpc_v1?.exists&&snapshot.rpc_v1.store_scoped!==true)
  blockers.push("EXISTING_TENANT_ONLY_PRODUCT_WRITER_INCOMPATIBLE");
 if(snapshot.constraints?.tenant_sku_unique===true&&
    snapshot.approvals?.sku_decision_D02_approved!==true)
  blockers.push("D02_SKU_UNIQUENESS_DECISION_OPEN");
 const callers=snapshot.caller_inventory||{};
 if(callers.render_workspace_selected_by_user!==true||
    callers.render_services_audited!==true)blockers.push("RENDER_CALLER_SCOPE_UNRESOLVED");
 if(callers.external_callers_closed!==true||
    callers.runtime_rpc_callers_closed!==true)blockers.push("RPC_WRITER_CALLER_INVENTORY_INCOMPLETE");
 const owners=snapshot.trusted_owner_ab||{};
 for(const [field,label] of [
  ["real_jwt_A_tested","REAL_OWNER_A_SESSION_NOT_VERIFIED"],
  ["real_jwt_B_tested","REAL_OWNER_B_SESSION_NOT_VERIFIED"],
  ["same_tenant_distinct_store_mapping_proven","SAME_TENANT_STORE_A_B_NOT_PROVEN"],
  ["positive_and_negative_store_RLS_tested","REAL_CROSS_STORE_RLS_NOT_TESTED"]
 ])if(owners[field]!==true)blockers.push(label);
 const a=snapshot.approvals||{};
 for(const [field,label] of [
  ["verified_backup_restore","BACKUP_RESTORE_PROOF_MISSING"],
  ["staging_schema_write_approved","STAGING_DDL_APPROVAL_MISSING"],
  ["independent_security_review","INDEPENDENT_SECURITY_REVIEW_MISSING"]
 ])if(a[field]!==true)blockers.push(label);

 const readyForReview=blockers.length===0;
 // A read-only report can at most enter external human review. Even perfectly
 // shaped client-supplied flags can never authorize a database write.
 return Object.freeze({
  decision:readyForReview?"PENDING_INDEPENDENT_SIGNED_APPROVAL":"BLOCKED_MIGRATION_NOT_READY",
  readyForReview,
  blockers:Object.freeze([...new Set(blockers)]),
  warnings:Object.freeze([...new Set(warnings)]),
  mappedLegacyRecords:0,
  evidenceType:"READ_ONLY_SCHEMA_METADATA_PLUS_AGGREGATE_COUNTS",
  ...STOP
 });
}
export function buildS4SafeReleasePlan(){
 return Object.freeze([
  {phase:0,name:"SOURCE_AND_BACKUP_ADMISSION",change:"NONE",requires:"privilege snapshot, PITR restore rehearsal, approved target and operator"},
  {phase:1,name:"CANONICAL_STORE_REGISTRY",change:"APPROVAL_REQUIRED",requires:"approved PR417 schema and real Store owner membership proof"},
  {phase:2,name:"ADDITIVE_STORE_COLUMNS_AND_FKS",change:"APPROVAL_REQUIRED",requires:"all writers compatible, old RPC controlled, D02 decided, restore tested"},
  {phase:3,name:"RESTRICTIVE_STORE_RLS",change:"APPROVAL_REQUIRED",requires:"real Owner A/B session verified, same Tenant cross-Store deny"},
  {phase:4,name:"LEGACY_MAPPING_AND_FK_VALIDATION",change:"APPROVAL_REQUIRED",requires:"signed per-row/private manifest, independent reviewer, exact CAS, ambiguity quarantine"},
  {phase:5,name:"PROTECTED_READ_ONLY_PILOT",change:"APPROVAL_REQUIRED",requires:"independent security QA, provider installation ownership and audit"},
  {phase:6,name:"VERSIONED_RPC_WRITER_CUTOVER",change:"SEPARATE_APPROVAL_REQUIRED",requires:"V1 caller closure, versioned V2 true auth, CAS/stock regression and rollback"}
 ]);
}
export default {fetch(){return new Response(null,{status:423});}};
