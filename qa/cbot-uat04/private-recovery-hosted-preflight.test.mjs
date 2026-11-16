import test from 'node:test';
import assert from 'node:assert/strict';
import {
 REPORT_CONTRACT,evaluateHostedReadOnlyPreflight,safeOperationalSequence,
 authorizeActualBackup,authorizeHostPilot,authorizeLegacyRpcRevoke
} from './private-recovery-hosted-preflight.mjs';
const hosted={
 tenant_count:2,product_count:2,order_count:2,customer_count:0,
 stores_present:false,store_memberships_present:false,
 orders_store_id_present:false,products_store_id_present:false,
 legacy_rpc_exists:true,legacy_rpc_definer:true,legacy_rpc_anon_execute:true,
 orders_rls_policy_count:1
};
const report=(metadata=hosted,receipts)=>evaluateHostedReadOnlyPreflight({
 projectRef:'ifxlvrhyjhbzbrkdsida',metadata,receipts});
const has=(x,reason)=>assert.ok(x.blockers.includes(reason));
const blockedAction=x=>assert.throws(x);

test('01 report contract explicit',()=>assert.match(REPORT_CONTRACT,/HOSTED_PREFLIGHT/));
test('02 actual observed hosted row counts redacted to metadata',()=>{
 const r=report();assert.equal(r.metadata.tenant_count,2);
 assert.equal(r.metadata.orders_rls_policy_count,1);
});
test('03 current hosted Store schema NO-GO',()=>{
 const r=report();has(r,'STORE_OWNERSHIP_SCHEMA_NOT_READY');
 assert.equal(r.can_run_hosted_order_lookup,false);
});
test('04 existing anon security definer RPC NO-GO',()=>has(report(),'LEGACY_PRIVILEGED_RPC_ANON_EXPOSURE'));
test('05 absent RPC ACL is unknown not safe',()=>{
 const x={...hosted,legacy_rpc_anon_execute:undefined};
 const r=report(x);has(r,'RPC_ACL_NOT_OBSERVED');has(r,'METADATA_INCOMPLETE_OR_UNKNOWN');
});
test('06 missing product/order counts are unknown not 0',()=>{
 const r=report({...hosted,order_count:undefined});assert.equal(r.metadata.order_count,null);
 has(r,'METADATA_INCOMPLETE_OR_UNKNOWN');
});
test('07 negative row count sanitized to null',()=>{
 const r=report({...hosted,product_count:-5});assert.equal(r.metadata.product_count,null);
});
test('08 fake external approved statement never promotes recovery',()=>{
 const r=report(hosted,{RECOVERY:{approved:true,fullRestore:true}});
 assert.equal(r.private_full_recovery_accepted,false);
});
test('09 signed synthetic H11R11 receipts never authorize hosted',()=>{
 const receipt={contract:'T404_H11R11_V1',cryptographicMetadataChecked:true,
  status:'SIGNED_METADATA_PENDING_EXTERNAL_VALIDATION',canRevokeRpc:false};
 const r=report(hosted,{RECOVERY:receipt,CALLER:receipt,STORE_OWNER:receipt});
 assert.equal(r.h11r11_metadata_receipt_shapes,3);
 assert.equal(r.can_apply_store_migration,false);
 assert.equal(r.can_change_rpc_acl,false);
});
test('10 all green input flags still cannot authorize hosted pilot',()=>{
 const x={...hosted,stores_present:true,store_memberships_present:true,
  orders_store_id_present:true,products_store_id_present:true,
  legacy_rpc_anon_execute:false};
 const r=report(x,{RECOVERY:{approved:true},CALLER:{approved:true},STORE_OWNER:{approved:true}});
 assert.equal(r.can_run_hosted_order_lookup,false);
});
test('11 wrong project fails closed',()=>{
 const r=evaluateHostedReadOnlyPreflight({projectRef:'other',metadata:hosted});
 has(r,'PROJECT_NOT_VERIFIED');
});
test('12 actual external operator remains NOT VERIFIED',()=>{
 const r=report();assert.equal(r.external_operator_receipt_verified,false);
 assert.equal(r.real_page_oa_proven,false);
});
test('13 metadata query is allowed without merchant customer PII',()=>{
 const r=report();assert.equal(r.can_run_metadata_only_preflight,true);
});
test('14 recovery gate precedes Store migration',()=>{
 const s=safeOperationalSequence();
 assert.ok(s.indexOf('INDEPENDENT_REAL_ENCRYPTED_AUTH_STORAGE_ACL_RESTORE_RECEIPT')<
  s.indexOf('AUTHORIZE_EXACT_EXPAND_ONLY_STORE_MIGRATION_AND_ROLLBACK'));
});
test('15 RPC caller shadow gate precedes privilege change',()=>{
 const s=safeOperationalSequence();
 assert.ok(s.indexOf('SIX_DOMAIN_CALLER_SHADOW_CUTOVER_WITH_ZERO_LEGACY_TRAFFIC')<
  s.indexOf('SEPARATE_APPROVAL_FOR_EXACT_PRIVILEGE_CHANGE_AND_ROLLBACK'));
});
test('16 actual private backup authorization is disabled',()=>blockedAction(authorizeActualBackup));
test('17 hosted order lookup cannot bypass JWT evidence',()=>blockedAction(authorizeHostPilot));
test('18 cannot revoke old privileged RPC from this candidate',()=>blockedAction(authorizeLegacyRpcRevoke));
