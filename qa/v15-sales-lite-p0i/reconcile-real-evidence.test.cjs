'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {REQUIRED_HOSTED,REQUIRED_EVIDENCE,evaluateP0i}=require('./reconcile-real-evidence.cjs');
const record=JSON.parse(fs.readFileSync(path.join(__dirname,'real-hosted-reconciliation-20261116.json'),'utf8'));
const copy=()=>structuredClone(record);
function locked(r){
 assert.equal(r.status,'NO_GO');
 for(const x of ['can_export','can_restore','can_apply_migration','can_backfill',
  'can_change_rls','can_revoke_rpc','can_read_real_commerce',
  'can_send_provider','can_write_orders','can_merge',
  'native_merchant_provider_proof_certified',
  'actual_hosted_restore_certified','real_signed_jwt_rls_certified']){
  assert.equal(r[x],false,x);
 }
 assert.equal(r.source_only,true);
}
test('actual Supabase aggregate observation is exact metadata with no IDs',()=>{
 assert.equal(record.project_ref,'ifxlvrhyjhbzbrkdsida');
 assert.equal(record.source,'SUPABASE_STAGING_SQL_AGGREGATE_AND_N8N_METADATA_READ_ONLY');
 assert.equal(record.hosted.contract,'V15_P0I_HOSTED_DECISION_PREFLIGHT_V1');
 assert.equal(Object.keys(record.hosted).length,REQUIRED_HOSTED.length+1);
});
test('real 2 Products+2 Orders need explicit Store ownership, no default backfill',()=>{
 const r=evaluateP0i(copy());locked(r);
 assert.equal(r.legacy_rows_needing_private_attribution,4);
 assert.ok(r.reasons.includes('LEGACY_PRODUCTS_AND_ORDERS_NOT_STORE_SCOPED'));
});
test('real provider registry empty and QA pairings do not count',()=>{
 const r=evaluateP0i(copy());locked(r);
 assert.ok(r.reasons.includes('NO_INDEPENDENT_PROVIDER_TO_TENANT_BINDING'));
 assert.ok(r.reasons.includes('QA_PAIRINGS_NOT_REAL_MERCHANT_OR_PROVIDER_PROOF'));
 assert.equal(record.hosted.private_channel_bindings,0);
 assert.equal(record.hosted.qa_paired,2);
});
test('seven permissive Tenant-only RLS policies are not Store isolation',()=>{
 const r=evaluateP0i(copy());locked(r);
 assert.equal(record.hosted.legacy_tenant_permissive_policies,7);
 assert.equal(record.hosted.store_scoped_policies,0);
 assert.ok(r.reasons.includes('TENANT_PERMISSIVE_SELECT_POLICY_CANNOT_CERTIFY_SAME_TENANT_STORE_ISOLATION'));
});
test('original Tenant SKU and platform PK constraints require migration design',()=>{
 const r=evaluateP0i(copy());locked(r);
 assert.ok(r.reasons.includes('LEGACY_TENANT_SKU_UNIQUE_REQUIRES_CUTOVER_PLAN'));
 assert.ok(r.reasons.includes('LEGACY_TENANT_PLATFORM_PK_LIMITS_MULTI_STORE_CHANNELS'));
});
test('Messenger webhook success is distinct from native Page owner/consent proof',()=>{
 const r=evaluateP0i(copy());locked(r);
 assert.ok(r.reasons.includes('WEBHOOK_EXECUTION_SUCCESS_NOT_NATIVE_PAGE_OWNERSHIP_CERTIFICATION'));
 assert.equal(record.n8n.messenger.last_checked_webhook_successes,4);
 assert.equal(record.evidence.meta_native_page_admin_and_consent,'NOT_INDEPENDENTLY_VERIFIED');
});
test('Zalo V1/V2 successful manual executions are not OA admin permission',()=>{
 const r=evaluateP0i(copy());locked(r);
 assert.ok(r.reasons.includes('MANUAL_ZALO_EXECUTIONS_NOT_NATIVE_PROVIDER_PROOF'));
 assert.equal(record.evidence.zalo_oa_native_admin_and_consent,'NOT_INDEPENDENTLY_VERIFIED');
});
test('backup/restore, owner and hosted JWT never certified from a GitHub reference',()=>{
 const r=evaluateP0i(copy());locked(r);
 for(const name of Object.keys(REQUIRED_EVIDENCE))
   assert.ok(r.missing_independent_proofs.includes(name),name);
 assert.equal(record.evidence.real_encrypted_staging_backup,'NOT_CERTIFIED');
 assert.equal(record.evidence.independent_restore_drill,'NOT_CERTIFIED');
});
test('existing independent PRs are reused rather than duplicating migrations',()=>{
 const r=evaluateP0i(copy());locked(r);
 assert.equal(r.recommended_existing_migration_pr,189);
 assert.equal(r.recommended_existing_jwt_matrix_pr,143);
 assert.equal(r.recommended_existing_owner_backup_pr,135);
});
test('unknown operator approval, credentials or private account values are rejected',()=>{
 for(const key of ['meta_page_id','zalo_oa_id','access_token','auth_user_id','customer_phone','approved']){
  const v=copy();v[key]='untrusted';const r=evaluateP0i(v);locked(r);
  assert.ok(r.reasons.includes('UNTRUSTED_OR_MALFORMED_AGGREGATE_EVIDENCE'));
 }
});
test('missing source, foreign project, altered contract fail closed',()=>{
 const cases=[null,undefined,[],{},'approved'];
 for(const x of cases)locked(evaluateP0i(x));
 for(const [k,val] of [['source','UNVERIFIED'],['project_ref','another-project'],
   ['contract','APPROVED']]){
  const v=copy();v[k]=val;locked(evaluateP0i(v));
 }
});
test('all user-declared human evidence APPROVED flags fail closed',()=>{
 for(const key of Object.keys(REQUIRED_EVIDENCE)){
  const v=copy();v.evidence[key]='APPROVED';const r=evaluateP0i(v);
  locked(r);assert.ok(r.reasons.includes('UNTRUSTED_PRIVATE_CERTIFICATION_CLAIM'));
 }
});
test('unapproved release flags never pass even if metadata is unchanged',()=>{
 for(const key of ['schema_expand','hosted_read_only_commerce_pilot','provider_send','order_write']){
  const v=copy();v.decision[key]='GO';const r=evaluateP0i(v);
  locked(r);assert.ok(r.reasons.includes('UNAUTHORIZED_RELEASE_CLAIM'));
 }
});
test('future complete metadata still cannot substitute private external proof',()=>{
 const v=copy();const h=v.hosted;
 Object.assign(h,{private_channel_bindings:3,store_tables:1,store_member_tables:1,
  product_store_columns:1,order_store_columns:1,
  legacy_tenant_permissive_policies:0,store_scoped_policies:7,
  product_tenant_sku_unique:0,channel_tenant_platform_pk:0,
  qa_paired:0,qa_confirmed_claims:0,qa_synthetic_bots:0});
 v.n8n.messenger.last_checked_webhook_successes=0;
 v.n8n.zalo_v1.recent_checked_executions_manual_only=false;
 v.n8n.zalo_v2.recent_checked_executions_manual_only=false;
 const r=evaluateP0i(v);locked(r);
 assert.ok(r.reasons.includes('METADATA_GREEN_STILL_REQUIRES_PRIVATE_PROOFS_AND_APPROVAL'));
});
test('invalid/negative, fractional or string counts cannot authorize anything',()=>{
 for(const bad of [-1,1.5,'1',null,Number.NaN,Number.POSITIVE_INFINITY]){
  const v=copy();v.hosted.legacy_products=bad;const r=evaluateP0i(v);
  locked(r);assert.ok(r.reasons.includes('INVALID_HOSTED_COUNT'));
 }
});
test('no sensitive raw field or actual provider identifiers are committed',()=>{
 const s=fs.readFileSync(path.join(__dirname,'real-hosted-reconciliation-20261116.json'),'utf8');
 for(const bad of ['"external_account_ref"','"secret_ref"','"owner_ref"',
   '"recipient_ref"','"access_token"','"refresh_token"','"customer_name"',
   '"raw_user_meta_data"','"phone"','"email"']){
  assert.equal(s.includes(bad),false,bad);
 }
});
test('the exact preflight SQL is a read-only aggregate transaction',()=>{
 const sql=fs.readFileSync(path.resolve(__dirname,
 '../../docs/ai-handoff/V15_P0I_REAL_HOSTED_MIGRATION_IMPACT_READ_ONLY.sql'),'utf8');
 const code=sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
 assert.match(code,/BEGIN TRANSACTION READ ONLY\s*;/);
 assert.match(code,/COMMIT\s*;/);
 for(const bad of [/\bINSERT\s+INTO\b/i,/\bUPDATE\s+public\./i,
  /\bDELETE\s+FROM\b/i,/\bCREATE\s+TABLE\b/i,/\bALTER\s+TABLE\b/i,
  /\bGRANT\s+/i,/\bREVOKE\s+/i,/\bCOPY\s+/i,/\bpg_get_functiondef\s*\(/i]){
  assert.doesNotMatch(code,bad);
 }
});
