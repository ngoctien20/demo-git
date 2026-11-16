import test from 'node:test';
import assert from 'node:assert/strict';
import {
 GATE_CONTRACT,assessReadOnlyHostedSnapshot,prepareOperatorHandoff,describeSafeCutover,
 exportRealBackup,applyHostedMigration,revokeLegacyRpc,publishMessengerCommerce
} from './hosted-recovery-rpc-gates.mjs';
const baseline={
 project_ref:'ifxlvrhyjhbzbrkdsida',tenants:2,products:2,orders:2,customers:0,
 canonical_stores_table:false,orders_store_id:false,
 anon_definer_rpc_executable:true,known_live_legacy_rpc_caller:true
};
const caller=['N8N_PUBLISHED','CLOUDFLARE_WORKERS_AND_PAGES','SUPABASE_EDGE',
 'WEBSITE_AND_MOBILE_CLIENTS','META_ZALO_PROVIDER_AND_EXTERNAL_APPS','UNKNOWN_AND_MANUAL_CALLERS'];
const recovery=['APP_POSTGRES_DATA','AUTH_USERS_AND_SESSIONS','STORAGE_METADATA_AND_OBJECT_BYTES',
 'ROLES_GRANTS_ACL','ENCRYPTED_OFFSITE_KEY_CUSTODY','INDEPENDENT_OFFHOST_RESTORE'];
const err=(fn,code)=>assert.throws(fn,new RegExp(code));

test('01 contract is operator-readiness only',()=>assert.match(GATE_CONTRACT,/OPERATOR_READINESS/));
test('02 real metadata snapshot has 2 Products and 2 Orders, not Store proof',()=>{
 const a=assessReadOnlyHostedSnapshot(baseline);
 assert.equal(a.hosted.products,2);assert.equal(a.hosted.orders,2);
 assert.equal(a.hosted_migration_allowed,false);
});
test('03 missing Store schema blocks migration',()=>{
 const a=assessReadOnlyHostedSnapshot(baseline);
 assert.ok(a.diagnostic_reasons.includes('CANONICAL_STORE_SCHEMA_ABSENT'));
});
test('04 anon definer RPC exposure is present',()=>{
 const a=assessReadOnlyHostedSnapshot(baseline);
 assert.ok(a.diagnostic_reasons.includes('PUBLIC_SECURITY_DEFINER_RPC_EXPOSURE'));
});
test('05 active legacy RPC caller must not be removed blindly',()=>{
 const a=assessReadOnlyHostedSnapshot(baseline);
 assert.ok(a.diagnostic_reasons.includes('ACTIVE_LEGACY_RPC_CALLER_REQUIRES_CUTOVER'));
});
test('06 wrong hosted project fingerprint denies',()=>{
 const a=assessReadOnlyHostedSnapshot({...baseline,project_ref:'another-project'});
 assert.ok(a.diagnostic_reasons.includes('PROJECT_SCOPE_NOT_VERIFIED'));
});
test('07 missing counts remain null, not assumed zero',()=>{
 const a=assessReadOnlyHostedSnapshot({project_ref:baseline.project_ref});
 assert.equal(a.hosted.orders,null);
 assert.ok(a.diagnostic_reasons.includes('LEGACY_ROW_COVERAGE_UNKNOWN'));
});
test('08 full-shaped metadata still never authorizes hosted migration',()=>{
 const a=assessReadOnlyHostedSnapshot({...baseline,canonical_stores_table:true,orders_store_id:true,
  anon_definer_rpc_executable:false,known_live_legacy_rpc_caller:false});
 assert.equal(a.hosted_migration_allowed,false);assert.equal(a.rpc_revoke_allowed,false);
});
test('09 empty evidence intake lists missing six caller domains',()=>{
 const a=prepareOperatorHandoff({});
 assert.equal(a.missing_caller_domains.length,6);
});
test('10 empty evidence intake lists missing six recovery domains',()=>{
 const a=prepareOperatorHandoff({});
 assert.equal(a.missing_recovery_domains.length,6);
});
test('11 4 invalid hashes do not count as owner row proof',()=>{
 const a=prepareOperatorHandoff({ownerRowDigests:['A','B','C','D']});
 assert.equal(a.row_digest_shape_complete,false);
});
test('12 duplicate owner row hash must be rejected',()=>{
 const a=prepareOperatorHandoff({ownerRowDigests:['a'.repeat(64),'b'.repeat(64),'c'.repeat(64),'c'.repeat(64)]});
 assert.equal(a.row_digest_shape_complete,false);
});
test('13 fake all-green metadata still cannot grant hosted authority',()=>{
 const a=prepareOperatorHandoff({
 callerDomains:caller,recoveryCoverage:recovery,
 ownerRowDigests:['a'.repeat(64),'b'.repeat(64),'c'.repeat(64),'d'.repeat(64)]});
 assert.equal(a.caller_coverage_complete_by_shape,true);
 assert.equal(a.recovery_coverage_complete_by_shape,true);
 assert.equal(a.row_digest_shape_complete,true);
 assert.equal(a.can_revoke_rpc,false);assert.equal(a.can_apply_store_migration,false);
});
test('14 independent real operator acceptance remains NOT VERIFIED',()=>{
 assert.equal(prepareOperatorHandoff({}).independent_real_operator_acceptance,'NOT_VERIFIED');
});
test('15 cutover plan places private restore before hosted expand',()=>{
 const plan=describeSafeCutover();
 assert.ok(plan.indexOf('G1_PRIVATE_INDEPENDENT_BACKUP_AUTH_STORAGE_ROLES_AND_REAL_RESTORE')<
  plan.indexOf('G4_APPROVE_EXACT_HOSTED_EXPAND_WITH_ROLLBACK'));
});
test('16 cutover plan places caller shadow before RPC revoke',()=>{
 const plan=describeSafeCutover();
 assert.ok(plan.indexOf('G6_PRIVATE_TRUSTED_RPC_REPLACEMENT_SHADOW_AND_COMPLETE_CALLER_INVENTORY')<
  plan.indexOf('G7_SEPARATE_AUTHORIZED_RPC_PRIVILEGE_CUTOVER_AND_ROLLBACK'));
});
test('17 hosted backup export is disabled',()=>err(exportRealBackup,'HOSTED_BACKUP_EXPORT_NOT_AUTHORIZED'));
test('18 hosted migration is disabled',()=>err(applyHostedMigration,'HOSTED_STORE_MIGRATION_NOT_AUTHORIZED'));
test('19 privileged RPC revoke is disabled',()=>err(revokeLegacyRpc,'LEGACY_RPC_REVOKE_NOT_AUTHORIZED'));
test('20 Messenger publish is disabled',()=>err(publishMessengerCommerce,'PUBLISHED_MESSENGER_CHANGE_NOT_AUTHORIZED'));
