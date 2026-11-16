/**
 * TIEN404 CBOT-UAT-03 — operator readiness and cutover plan, SOURCE ONLY.
 * NOT a replacement for the separately maintained H11R.11 independent
 * real-world evidence intake; never authorizes a hosted grant, migration,
 * provider send, backup export, or live RPC invocation.
 */
export const GATE_CONTRACT='T404_CBOT03_OPERATOR_READINESS_V1';
const frozen=x=>Object.freeze(x);
const REQUIRED_CALLER_DOMAINS=frozen([
 'N8N_PUBLISHED','CLOUDFLARE_WORKERS_AND_PAGES','SUPABASE_EDGE',
 'WEBSITE_AND_MOBILE_CLIENTS','META_ZALO_PROVIDER_AND_EXTERNAL_APPS','UNKNOWN_AND_MANUAL_CALLERS'
]);
const REQUIRED_RECOVERY_COVERAGE=frozen([
 'APP_POSTGRES_DATA','AUTH_USERS_AND_SESSIONS','STORAGE_METADATA_AND_OBJECT_BYTES',
 'ROLES_GRANTS_ACL','ENCRYPTED_OFFSITE_KEY_CUSTODY','INDEPENDENT_OFFHOST_RESTORE'
]);
export function assessReadOnlyHostedSnapshot(snapshot){
 const s=snapshot&&typeof snapshot==='object'?snapshot:{};
 const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
 const hosted=frozen({
  project_ref:typeof s.project_ref==='string'?s.project_ref:'UNVERIFIED',
  tenants:count(s.tenants),products:count(s.products),orders:count(s.orders),customers:count(s.customers),
  canonical_stores_table:s.canonical_stores_table===true,
  orders_store_id:s.orders_store_id===true,
  anon_definer_rpc_executable:s.anon_definer_rpc_executable===true,
  known_live_legacy_rpc_caller:s.known_live_legacy_rpc_caller===true
 });
 const reasons=[];
 if(hosted.project_ref!=='ifxlvrhyjhbzbrkdsida')reasons.push('PROJECT_SCOPE_NOT_VERIFIED');
 if(!hosted.canonical_stores_table||!hosted.orders_store_id)reasons.push('CANONICAL_STORE_SCHEMA_ABSENT');
 if(hosted.anon_definer_rpc_executable)reasons.push('PUBLIC_SECURITY_DEFINER_RPC_EXPOSURE');
 if(hosted.known_live_legacy_rpc_caller)reasons.push('ACTIVE_LEGACY_RPC_CALLER_REQUIRES_CUTOVER');
 if(hosted.orders===null||hosted.products===null)reasons.push('LEGACY_ROW_COVERAGE_UNKNOWN');
 return frozen({contract:GATE_CONTRACT,source:'READ_ONLY_METADATA_UNTRUSTED_UNTIL_REVIEW',
   hosted,diagnostic_reasons:frozen(reasons),hosted_migration_allowed:false,rpc_revoke_allowed:false,
   provider_send_allowed:false,actual_restore_verified:false,operator_review_required:true});
}
export function prepareOperatorHandoff({callerDomains=[],recoveryCoverage=[],ownerRowDigests=[]}={}){
 const c=new Set(callerDomains),r=new Set(recoveryCoverage);
 const missingCaller=REQUIRED_CALLER_DOMAINS.filter(k=>!c.has(k));
 const missingRecovery=REQUIRED_RECOVERY_COVERAGE.filter(k=>!r.has(k));
 // The expected 4 rows are 2 Products and 2 Orders observed via metadata.
 // Synthetic hashes are NOT proof a human independently mapped actual Store ownership.
 const unique=new Set(ownerRowDigests.filter(x=>typeof x==='string'&&x.length>=32));
 const enoughRowDigestShape=ownerRowDigests.length===4&&unique.size===4;
 return frozen({
  contract:GATE_CONTRACT,source:'UNVERIFIED_SELF_REPORTED_METADATA',
  caller_coverage_complete_by_shape:missingCaller.length===0,
  recovery_coverage_complete_by_shape:missingRecovery.length===0,
  row_digest_shape_complete:enoughRowDigestShape,
  missing_caller_domains:frozen(missingCaller),missing_recovery_domains:frozen(missingRecovery),
  independent_real_operator_acceptance:'NOT_VERIFIED',
  real_merchant_store_mapping:'NOT_VERIFIED',
  actual_recovery:'NOT_CERTIFIED',
  can_export_hosted_backup:false,can_apply_store_migration:false,can_revoke_rpc:false,
  can_publish_messenger_adapter:false,can_send_live_provider:false,
  next_evidence:"Reuse H11R.11 PR #205 private attestation and H11R.10 PR #200 disposable PG17, then independent actual backup/restore and caller cutover"
 });
}
export function describeSafeCutover(){
 return frozen([
  'G0_VERIFY_LIVE_READ_ONLY_BASELINE',
  'G1_PRIVATE_INDEPENDENT_BACKUP_AUTH_STORAGE_ROLES_AND_REAL_RESTORE',
  'G2_SIGNED_OWNER_STORE_ROW_MAPPING_ALL_LEGACY_RECORDS',
  'G3_DISPOSABLE_PG17_STORE_JWT_RLS_AND_COMPATIBILITY_TESTS',
  'G4_APPROVE_EXACT_HOSTED_EXPAND_WITH_ROLLBACK',
  'G5_VERIFY_TWO_OWNERS_SAME_TENANT_HOSTED_JWT_DENIAL',
  'G6_PRIVATE_TRUSTED_RPC_REPLACEMENT_SHADOW_AND_COMPLETE_CALLER_INVENTORY',
  'G7_SEPARATE_AUTHORIZED_RPC_PRIVILEGE_CUTOVER_AND_ROLLBACK',
  'G8_NATIVE_META_ZALO_OWNERSHIP_AND_READ_ONLY_PILOT',
  'G9_OWNER_QA_ORDER_RECEIPT_AND_CROSS_CHANNEL_READ_ONLY_ACCEPTANCE'
 ]);
}
export function exportRealBackup(){throw Error('HOSTED_BACKUP_EXPORT_NOT_AUTHORIZED')}
export function applyHostedMigration(){throw Error('HOSTED_STORE_MIGRATION_NOT_AUTHORIZED')}
export function revokeLegacyRpc(){throw Error('LEGACY_RPC_REVOKE_NOT_AUTHORIZED')}
export function publishMessengerCommerce(){throw Error('PUBLISHED_MESSENGER_CHANGE_NOT_AUTHORIZED')}
