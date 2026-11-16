'use strict';
/**
 * V15 Sales Lite P0-E -- FREE-TIER logical backup COVERAGE REVIEW ONLY.
 * This tool cannot authenticate a controller, execute an export, verify a
 * remote vault, grant a database permission or certify restore.
 * Never interpret a syntactically valid ticket manifest as approval.
 */
const FIELDS=Object.freeze({
  roles:'SUPABASE_ROLE_DUMP_REVIEW',
  application_schema:'SUPABASE_APPLICATION_SCHEMA_DUMP_REVIEW',
  application_data:'SUPABASE_APPLICATION_DATA_DUMP_REVIEW',
  auth_users_sessions:'AUTH_MANAGED_DATA_SEPARATE_REVIEW',
  storage_metadata:'STORAGE_METADATA_SEPARATE_REVIEW',
  storage_object_bytes:'STORAGE_OBJECT_BACKUP_SEPARATE_REVIEW',
  extensions_rls_rpc:'DATABASE_SECURITY_OBJECTS_REVIEW',
  migration_history:'MIGRATION_CHAIN_REVIEW',
  edge_functions:'EDGE_FUNCTION_SOURCE_REVIEW',
  n8n_workflows:'N8N_EXPORT_AND_VERSIONS_REVIEW',
  channel_credentials:'PRIVATE_CHANNEL_CONFIG_RECONCILIATION',
  encrypted_offsite_vault:'PRIVATE_VAULT_CUSTODY_REVIEW',
  independently_restorable:'INDEPENDENT_ISOLATED_RESTORE_REVIEW'
});
const EXTERNAL=new Set([
  'auth_users_sessions','storage_metadata','storage_object_bytes',
  'edge_functions','n8n_workflows','channel_credentials'
]);
const KEY=/^SEC-[A-Z0-9_-]{12,64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function fail(reason,gaps){
 return Object.freeze({
  status:'BLOCKED', reason, missing:Object.freeze([...gaps]),
  coverage_verified:false,backed_up_real_data:false,
  source_controller_verified:false,independent_security_verified:false,
  real_owner_verified:false,private_vault_verified:false,
  real_restore_verified:false,may_export:false,may_restore:false,
  may_apply_migration:false,may_grant_or_edit_rls:false,
  may_send_provider:false,may_write_orders:false,
  can_certify_backup:false,source_only:true
 });
}
function reviewCoveragePlan(plan){
 const all=Object.keys(FIELDS);
 if(!plain(plan)||Object.keys(plan).sort().join(',')!=='contract,coverage,project,scope'||
    plan.contract!=='TIEN404_V15_P0E_COVERAGE_V1'||
    plan.project!=='ifxlvrhyjhbzbrkdsida'||
    plan.scope!=='REVIEW_ONLY_NO_EXPORT'||
    !plain(plan.coverage))return fail('WRONG_SCOPE_OR_SCHEMA',all);
 const seen=new Set(),bad=[],missing=[];
 for(const key of Object.keys(plan.coverage)){
   if(!Object.hasOwn(FIELDS,key)){bad.push(key);continue;}
   const x=plan.coverage[key];
   if(!plain(x)||Object.keys(x).sort().join(',')!=='method_status,review_ticket,source_class'||
       x.source_class!==FIELDS[key]||
       x.method_status!=='PENDING_PRIVATE_REVIEW'||
       !KEY.test(x.review_ticket)||seen.has(x.review_ticket))bad.push(key);
   else seen.add(x.review_ticket);
 }
 for(const key of all)if(!Object.hasOwn(plan.coverage,key))missing.push(key);
 if(bad.length)return fail('INVALID_OR_UNTRUSTED_REFERENCE',[...missing,...bad]);
 if(missing.length)return fail('UNASSESSED_BACKUP_COVERAGE',missing);
 // Even perfect-looking references cannot verify excluded managed schemas
 // or any real backup bytes. No authority is granted from source code.
 return fail('INDEPENDENT_PRIVATE_COVERAGE_AND_OWNER_APPROVAL_REQUIRED',[]);
}
function coverageWarnings(){
 return Object.freeze({
  cli_default: 'Supabase db dump normally excludes application DATA and custom ROLES unless explicitly requested.',
  managed_schemas: 'Supabase CLI default dump excludes managed auth/storage schemas; validate actual version/flags and plan recovery separately.',
  storage_objects: 'DB backup cannot restore Storage API object bytes; plan separate verified object copy.',
  other_services: 'n8n workflows, provider credentials, Edge Functions, secrets, Cloudflare and web assets need separate recovery inventories.',
  integrity_not_restore: 'Checksum is file integrity only; isolated restore and authenticated Store RLS must be tested independently.'
 });
}
module.exports={FIELDS,EXTERNAL,reviewCoveragePlan,coverageWarnings};
