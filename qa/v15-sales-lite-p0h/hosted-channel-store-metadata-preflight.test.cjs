'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {FIELDS,BOOLS,TRUST_REQUIRED,evaluateHostedChannelStorePreflight}=
 require('./hosted-channel-store-metadata-preflight.cjs');
const file=path.resolve(__dirname,'hosted-observed-metadata-20261116.json');
const observed=JSON.parse(fs.readFileSync(file,'utf8'));
const snapshot=()=>structuredClone(observed.snapshot);
const blocked=r=>{
 assert.equal(r.status,'NO_GO');
 assert.equal(r.metadata_only,true);
 for(const flag of ['real_provider_account_verified','real_merchant_owner_verified',
 'hosted_jwt_rls_verified','real_commerce_price_verified','private_backup_restored',
 'can_read_hosted_catalog','can_send','can_create_order','can_write_orders',
 'can_reconfigure_n8n','can_apply_migration','can_access_secrets','can_publish'])
  assert.equal(r[flag],false,flag);
 assert.equal(r.provider_sends,0);
 assert.equal(r.orders_written,0);
 assert.equal(r.paid_model_calls,0);
};
test('real observed 2026-11-16 aggregate has clear non-synthetic source provenance',()=>{
 assert.equal(observed.source,'SUPABASE_STAGING_METADATA_READ_ONLY_EXECUTE_SQL');
 assert.equal(observed.evidence_class,
  'REAL_HOSTED_AGGREGATE_METADATA_NOT_PROVIDER_OR_OWNER_PROOF');
 assert.equal(observed.project_ref,'ifxlvrhyjhbzbrkdsida');
 assert.equal(observed.observed_date_jst,'2026-11-16');
});
test('real HOSTED evidence states NO binding/Store/RLS; not a QA-only guess',()=>{
 const v=evaluateHostedChannelStorePreflight(snapshot());blocked(v);
 for(const reason of [
  'NO_REAL_PRIVATE_PROVIDER_ACCOUNT_BINDINGS',
  'CANONICAL_STORE_TABLE_ABSENT',
  'CANONICAL_STORE_MEMBERSHIP_TABLE_ABSENT',
  'COMMERCE_CORE_LACKS_STORE_SCOPE',
  'HOSTED_STORE_RLS_PRODUCT_POLICY_MISSING',
  'TENANT_ONLY_PRODUCT_RLS_CANNOT_PROVE_SAME_TENANT_SHOP_ISOLATION'
 ]) assert.ok(v.reasons.includes(reason),reason);
});
test('real metadata identifies one-platform-per-Tenant schema constraint',()=>{
 const v=evaluateHostedChannelStorePreflight(snapshot());blocked(v);
 assert.ok(v.reasons.includes('TENANT_PLATFORM_PK_LIMITS_MULTI_STORE_MULTI_ACCOUNT_MAPPING'));
 assert.equal(snapshot().legacy_tenant_platform_pk,1);
});
test('private channel mapping has RLS and no direct anon/auth SELECT, not owner proof',()=>{
 const v=evaluateHostedChannelStorePreflight(snapshot());blocked(v);
 assert.equal(v.observations.private_channel_table_not_directly_client_readable,true);
 assert.equal(v.real_provider_account_verified,false);
 assert.equal(snapshot().private_channel_binding_rows,0);
});
test('real QA identities explicitly are synthetic only, not provider verified',()=>{
 const v=evaluateHostedChannelStorePreflight(snapshot());blocked(v);
 assert.equal(snapshot().qa_bot_rows,2);
 assert.equal(snapshot().qa_synthetic_bot_rows,2);
 assert.ok(v.reasons.includes('QA_BOTS_SYNTHETIC_NOT_REAL_PROVIDER_AUTHORITY'));
});
test('tenant agent config present is pilot_lab only, not a Store binding',()=>{
 const v=evaluateHostedChannelStorePreflight(snapshot());blocked(v);
 assert.ok(v.reasons.includes('AGENT_CONFIGS_PREVIEW_ONLY'));
 assert.equal(snapshot().tenant_agent_config_rows,1);
});
test('QA tenant identity mapping cannot replace canonical hosted Store',()=>{
 const v=evaluateHostedChannelStorePreflight(snapshot());blocked(v);
 assert.ok(v.reasons.includes('QA_IDENTITY_MAP_CANNOT_REPLACE_CANONICAL_STORE'));
});
test('fully populated FUTURE metadata still is not a real native provider or JWT proof',()=>{
 const x=snapshot();
 Object.assign(x,{
  private_channel_binding_rows:3,canonical_store_tables:1,store_membership_tables:1,
  products_store_id_columns:1,orders_store_id_columns:1,
  store_scoped_product_select_policies:1,tenant_scoped_product_select_policies:0,
  legacy_tenant_platform_pk:0,qa_bot_rows:0,qa_synthetic_bot_rows:0,
  qa_identity_map_rows:0,tenant_agent_config_rows:0,preview_lab_config_rows:0,
 });
 const v=evaluateHostedChannelStorePreflight(x);blocked(v);
 assert.deepEqual(v.reasons,['REAL_PRIVATE_PROVIDER_AND_HOSTED_JWT_PROOFS_STILL_REQUIRED']);
});
test('client-injected real owner and provider verified flags are rejected',()=>{
 for(const k of ['native_signature_real','merchant_verified','store_id','tenant_id',
  'email','token','secret_ref','raw_message','provider_account_id']){
  const x=snapshot();x[k]='attacker';
  const v=evaluateHostedChannelStorePreflight(x);blocked(v);
  assert.deepEqual(v.reasons,['INVALID_OR_UNTRUSTED_METADATA_SCHEMA']);
 }
});
test('unknown output keys are rejected even when they claim approval',()=>{
 const x=snapshot();x.can_read_hosted_catalog=true;
 const v=evaluateHostedChannelStorePreflight(x);blocked(v);
 assert.deepEqual(v.reasons,['INVALID_OR_UNTRUSTED_METADATA_SCHEMA']);
});
test('empty/untyped/array/class metadata cannot allow Commerce read',()=>{
 for(const x of [null,undefined,{},[],42,'PASS',new Date(),Object.create(null)]){
  const v=evaluateHostedChannelStorePreflight(x);blocked(v);
  assert.ok(v.reasons.includes('INVALID_OR_UNTRUSTED_METADATA_SCHEMA'));
 }
});
test('partial metadata and wrong contract rejected',()=>{
 const x=snapshot();delete x.tenant_rows;blocked(evaluateHostedChannelStorePreflight(x));
 const y=snapshot();y.preflight_contract='REAL_BACKEND_AUTHORIZED';
 blocked(evaluateHostedChannelStorePreflight(y));
});
test('negative, fractional and unsafe counts fail closed',()=>{
 for(const value of [-1,0.5,Number.MAX_SAFE_INTEGER,Infinity,'0',null]){
  const x=snapshot();x.private_channel_binding_rows=value;
  const v=evaluateHostedChannelStorePreflight(x);blocked(v);
  assert.deepEqual(v.reasons,['INVALID_AGGREGATE_VALUE']);
 }
});
test('invalid permissions booleans fail closed',()=>{
 for(const value of [1,0,null,'false',undefined]){
  const x=snapshot();x.private_channel_rls_enabled=value;
  const v=evaluateHostedChannelStorePreflight(x);blocked(v);
  assert.deepEqual(v.reasons,['INVALID_SECURITY_BOOLEAN']);
 }
});
test('client-exposed private binding table is flagged and never authorizes read',()=>{
 for(const prop of ['private_channel_rls_enabled','private_channel_anon_select',
   'private_channel_authenticated_select']){
  const x=snapshot();x[prop]=prop==='private_channel_rls_enabled'?false:true;
  const v=evaluateHostedChannelStorePreflight(x);blocked(v);
  assert.ok(v.reasons.includes('PRIVATE_CHANNEL_TABLE_CLIENT_EXPOSURE_REVIEW_REQUIRED'));
 }
});
test('duplicate provider account binding flags ambiguity',()=>{
 const x=snapshot();x.private_channel_binding_rows=2;
 x.duplicate_provider_account_bindings=1;
 const v=evaluateHostedChannelStorePreflight(x);blocked(v);
 assert.ok(v.reasons.includes('PROVIDER_ACCOUNT_BINDING_AMBIGUOUS'));
});
test('binding to nonexistent tenant must fail closed',()=>{
 const x=snapshot();x.private_channel_binding_rows=1;
 x.orphan_provider_tenant_bindings=1;
 const v=evaluateHostedChannelStorePreflight(x);blocked(v);
 assert.ok(v.reasons.includes('ORPHAN_PROVIDER_TENANT_BINDING'));
});
test('provider registry rows without unique binding constraint are not usable',()=>{
 const x=snapshot();x.private_channel_binding_rows=1;
 x.provider_account_unique_constraints=0;
 const v=evaluateHostedChannelStorePreflight(x);blocked(v);
 assert.ok(v.reasons.includes('PROVIDER_ACCOUNT_UNIQUENESS_NOT_ENFORCED'));
});
test('impossible QA and agent counters never pass silently',()=>{
 const x=snapshot();x.qa_synthetic_bot_rows=3;
 assert.ok(evaluateHostedChannelStorePreflight(x).reasons.includes('INCONSISTENT_QA_BOT_COUNTS'));
 const y=snapshot();y.preview_lab_config_rows=2;
 assert.ok(evaluateHostedChannelStorePreflight(y).reasons.includes('INCONSISTENT_TENANT_AGENT_CONFIG_COUNTS'));
});
test('real proof checklist explicitly separates native provider, owner, RLS and restore',()=>{
 for(const code of [
  'NATIVE_PROVIDER_SIGNED_ACCOUNT_ID_AND_EVENT',
  'PRIVATE_MERCHANT_OWNER_CONSENT_FOR_EXACT_PROVIDER_ACCOUNT',
  'AUTHENTICATED_CANONICAL_TENANT_STORE_MEMBERSHIP',
  'HOSTED_ACTUAL_JWT_RLS_A_B_C_WITH_LEAST_PRIVILEGED_READER',
  'INDEPENDENT_BACKUP_RESTORE_AND_APPROVED_SCHEMA_MIGRATION']){
  assert.ok(TRUST_REQUIRED.includes(code));
 }
});
test('aggregate field count matches actual hosted snapshot, no raw secret keys',()=>{
 assert.equal(Object.keys(snapshot()).length,FIELDS.length+BOOLS.length+1);
 const raw=fs.readFileSync(file,'utf8');
 for(const k of ['external_account_ref','secret_ref','recipient_ref','owner_ref',
   'password','customer_name','phone','page_access_token','jwt']){
  assert.equal(raw.includes('"'+k+'"'),false,k);
 }
});
