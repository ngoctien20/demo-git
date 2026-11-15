'use strict';
/**
 * V14.4.2 — migration phase review ONLY, never a SQL executor.
 * Fields are machine-readable inventory evidence or documents supplied for
 * human review; even an apparently complete manifest cannot approve DDL.
 */
const TABLES=Object.freeze(['products','customers','orders','order_items','conversations','messages']);
const FNS=Object.freeze(['save_merchant_product','qa_owner_pairing','qa_shop_b_zalo_claim']);
const PHASES=Object.freeze([
 Object.freeze({id:'M0_RECOVERY',required:[
   'operator_archive_hash_rechecked','isolated_restore_from_real_archive_pass',
   'restore_integrity_check_pass','owner_approved_rollback_plan',
   'private_backup_copy_retained']}),
 Object.freeze({id:'M1_EXPAND',required:[
   'canonical_stores_memberships_design_approved',
   'knowledge_schema_and_permissions_reviewed',
   'schema_proposal_checked_for_pre_ddl_abort',
   'existing_workflow_writer_contract_audited']}),
 Object.freeze({id:'M2_OWNER_BACKFILL',required:[
   'owner_attribution_product_1','owner_attribution_product_2',
   'owner_attribution_order_1','owner_attribution_order_2',
   'independent_reviewer_signoff','row_ids_ledger_kept_private']}),
 Object.freeze({id:'M3_CONSTRAINTS',required:[
   'same_store_composite_fks_reviewed',
   'tenant_store_sku_unique_migration_reviewed',
   'all_null_store_rows_accounted_for',
   'existing_reader_writer_contracts_reviewed']}),
 Object.freeze({id:'M4_ATOMIC_RLS',required:[
   'all_six_old_permissive_policies_replace_plan',
   'all_six_store_select_policies_reviewed',
   'write_using_and_with_check_reviewed',
   'security_definer_function_paths_reviewed',
   'effective_permissions_and_views_reviewed',
   'rollback_of_committed_rls_policies_rehearsed']}),
 Object.freeze({id:'M5_ACCEPTANCE',required:[
   'two_real_same_tenant_shop_jwts_verified',
   'third_real_cross_tenant_jwt_verified',
   'revoked_staff_store_membership_verified',
   'positive_and_negative_products_orders_read_qa_pass',
   'additional_four_table_rls_qa_pass',
   'no_send_observability_and_manual_review_pass']})
]);
const BASELINE=Object.freeze({products:2,orders:2,customers:0,
 order_items:0,conversations:0,messages:0});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function inspectInventory(input){
 const problems=[];
 if(input?.source!=='SUPABASE_READ_ONLY_CATALOG_INSPECTION')problems.push('CATALOG_PROVENANCE_UNVERIFIED');
 if(input?.projectRef!=='ifxlvrhyjhbzbrkdsida')problems.push('WRONG_OR_UNVERIFIED_PROJECT');
 if(!/^17\./.test(input?.postgresVersion||''))problems.push('PG_MAJOR_NOT_17');
 const tables=input?.tables||{};
 for(const n of TABLES){
  const t=tables[n]||{};
  if(t.exists!==true)problems.push('MISSING_TABLE_'+n);
  if(t.rlsEnabled!==true||t.rlsForced!==true)problems.push('RLS_BASELINE_DRIFT_'+n);
  if(t.hasStoreId!==true)problems.push('STORE_ID_MISSING_'+n);
  if(t.hasTenantWidePermissiveRead!==false)problems.push('TENANT_PERMISSIVE_POLICY_PRESENT_'+n);
  if(t.rowCount!==BASELINE[n])problems.push('ROW_COUNT_DRIFT_'+n);
 }
 if(input?.storesExists!==true)problems.push('STORES_SCHEMA_NOT_APPLIED');
 if(input?.storeMembershipsExists!==true)problems.push('STORE_ASSIGNMENTS_NOT_APPLIED');
 if(input?.knowledgeReleasesExists!==true)problems.push('KNOWLEDGE_BACKEND_NOT_APPLIED');
 if(input?.productsUniqueTenantSku!==false)problems.push('SKU_UNIQUE_STILL_TENANT_LEVEL');
 for(const fn of FNS){
  const x=input?.functions?.[fn];
  if(!x||x.reviewedStoreScope!==true)problems.push('RPC_STORE_SCOPE_NOT_VERIFIED_'+fn);
 }
 return Object.freeze({mode:'READ_ONLY_SCHEMATIC_REVIEW',projectRef:'ifxlvrhyjhbzbrkdsida',
   status:problems.length?'PREFLIGHT_HAS_BLOCKERS':'SCHEMA_CLAIMS_NEED_INDEPENDENT_VALIDATION',
   blockers:Object.freeze(problems),canApplyMigration:false,canBackfill:false,
   canReplaceRls:false,canExecuteSql:false,
   note:'Counts/catalog never prove row ownership or restore validity.'});
}
function inspectPhaseDocs(documents={}){
 const phases=PHASES.map(p=>{
  const claims=p.required.filter(k=>documents[k]?.state==='REVIEWED_DOCUMENT'&&
   documents[k]?.source==='OWNER_OFFLINE_RECORD');
  const missing=p.required.filter(k=>!claims.includes(k));
  return Object.freeze({phase:p.id,status:missing.length?'NOT_READY':'CLAIMED_REQUIRES_INDEPENDENT_QA',
   claims:claims.length,missing:Object.freeze(missing),canRun:false});
 });
 return Object.freeze({mode:'PROPOSED_MIGRATION_PHASE_REVIEW',phases:Object.freeze(phases),
   status:'MIGRATION_EXECUTION_BLOCKED',
   // Even all evidence claims are NOT an executable authorization token.
   canApplyDDL:false,canAlterRLS:false,canBackfill:false,canCreateRoles:false,
   canTouchProduction:false,canSendProviderMessages:false});
}
function reviewOwnershipLedger(rows=[]){
 const expected=['products','products','orders','orders'];
 const code=[];
 if(!Array.isArray(rows)||rows.length!==4)code.push('EXACTLY_FOUR_RECORDS_REQUIRED');
 if(Array.isArray(rows)){
  const sorted=rows.map(r=>r?.table).sort();
  if(JSON.stringify(sorted)!==JSON.stringify(expected.sort()))
   code.push('PRODUCT_AND_ORDER_PAIR_REQUIRED');
  const unique=new Set();
  for(const x of rows){
   if(!x||!['products','orders'].includes(x.table)||
      !UUID.test(x.rowId||'')||!UUID.test(x.tenantId||'')||
      !UUID.test(x.canonicalStoreId||''))
    code.push('INVALID_ROW_STORE_TENANT_KEY');
   else{
     const k=x.table+':'+x.rowId;
     if(unique.has(k))code.push('DUPLICATE_LEDGER_ROW');
     unique.add(k);
   }
   if(x?.ownerVerified!==true||x?.independentReviewerVerified!==true||
      x?.sourceClass!=='PRIVATE_OWNER_EVIDENCE')
      code.push('OWNER_ATTRIBUTION_NOT_VERIFIED');
  }
 }
 return Object.freeze({status:code.length?'OWNERSHIP_UNVERIFIED':'PRIVATE_LEDGER_CLAIMS_REQUIRE_INDEPENDENT_REVIEW',
  blockedReasons:Object.freeze([...new Set(code)]),
  reportedRows:Array.isArray(rows)?rows.length:0,
  storesBackfilled:0,writeOperations:0,canBackfill:false,
  // No IDs, phone, addresses or owner evidence escape this response.
  resultIncludesRecordIds:false});
}
module.exports={TABLES,FNS,PHASES,BASELINE,inspectInventory,inspectPhaseDocs,reviewOwnershipLedger};
