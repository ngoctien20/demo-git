'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const real=require('./g3r-hosted-auth-eligibility-evidence.json');
const {inspect,CONTRACT,NUMERIC,BOOL}=require('./g3r-hosted-auth-eligibility.cjs');
const clone=()=>JSON.parse(JSON.stringify(real));
const noAuth=out=>{
 assert.equal(out.status,'HOSTED_STORE_AUTH_AND_JWT_NO_GO');
 for(const k of ['liveAuthJwtVerified','independentMerchantOwnersVerified',
   'authenticatedStoreMembershipsVerified','customerLinkVerified',
   'canReadHostedOrders','canMigrateM1','canExecuteAtomicM2M4',
   'canReplaceLivePolicies','canRevokePublicRpc','canUseServiceRole',
   'canSendProvider','canChangeN8nPublished','canExecuteRealJwtUat',
   'canEnableCrossChannel','canRelease'])
  assert.equal(out[k],false,k);
 const s=JSON.stringify(out);
 for(const secret of ['bot_token','api_key','bearer','auth.users','https://',
   'customer_phone','merchant_email'])assert.equal(s.includes(secret),false);
};
test('real hosted metadata has 2 owner AUTH subjects in 1 Tenant, but NO Store role UAT',()=>{
 const out=inspect(clone());noAuth(out);
 assert.equal(out.code,'G3R_METADATA_AUDITED_NO_REAL_JWT');
 assert.equal(out.scopedQaActorSlotsAvailable,true);
 assert.equal(out.realAuthSessionEvidenceObserved,false);
 assert.equal(out.realStoreOwnerMappingEstablished,false);
 assert.equal(out.missingActualHostedStoreColumnCount,6);
 assert.ok(out.blockers.includes('CANONICAL_STORE_COLUMNS_AND_MEMBERSHIP_NOT_HOSTED'));
 assert.ok(out.blockers.includes('TWO_STORES_IN_ONE_TENANT_NOT_PROVISIONED'));
 assert.ok(out.blockers.includes('LEGACY_TENANT_PERMISSIVE_POLICY_OR_BYPASS_RISK'));
 assert.ok(out.blockers.includes('REAL_DISTINCT_AUTH_JWT_AND_CURRENT_SESSIONS_NOT_VERIFIED'));
 assert.ok(out.blockers.includes('FOUR_ORIGINAL_ROW_STORE_OWNERSHIP_NOT_ATTESTED'));
});
test('no extra Auth users required for disposable PG17 synthetic A/B',()=>{
 const x=inspect(clone());noAuth(x);
 assert.equal(x.disposablePg17CanProceedWithoutNewUsers,true);
});
test('false owner-slot counts remove readiness but never authorize migration',()=>{
 const r=clone();
 r.tenants_with_two_distinct_owner_auth_ids=0;
 r.max_distinct_owner_auth_ids_one_tenant=1;
 const out=inspect(r);noAuth(out);
 assert.equal(out.scopedQaActorSlotsAvailable,false);
 assert.ok(out.blockers.includes('TWO_OWNER_AUTH_SUBJECT_SLOTS_NOT_PRESENT'));
});
test('all forged green booleans and perfect store schema CANNOT enable real JWT',()=>{
 const r=clone();
 r.six_store_id_count=6;
 r.canonical_stores_exist=true;
 r.canonical_store_memberships_exist=true;
 r.same_tenant_two_store_qa_count=1;
 r.permissive_read_policy_count=0;
 r.store_predicate_policy_count=6;
 r.anon_executable_privileged_rpc_count=0;
 r.authenticated_privileged_rpc_count=0;
 r.public_privileged_rpc_count=0;
 r.synthetic_bot_dry_run_count=0;
 r.synthetic_owner_paired_rows=0;
 for(const k of BOOL)r[k]=true;
 r.approved_for_disposable_rehearsal=true;
 const out=inspect(r);noAuth(out);
 assert.equal(out.realAuthSessionEvidenceObserved,false);
 assert.equal(out.canReadHostedOrders,false);
 assert.ok(out.blockers.includes('SELF_DECLARED_LIVE_APPROVAL_NOT_AUTHORITY'));
});
test('new extra permissive policy never fixes Tenant-wide legacy OR',()=>{
 const r=clone();
 r.six_store_id_count=6;
 r.canonical_stores_exist=true;
 r.canonical_store_memberships_exist=true;
 r.permissive_read_policy_count=12;
 r.store_predicate_policy_count=6;
 const out=inspect(r);noAuth(out);
 assert.ok(out.blockers.includes('LEGACY_TENANT_PERMISSIVE_POLICY_OR_BYPASS_RISK'));
});
test('one anon SECURITY DEFINER RPC is an admission blocker, not exploit claim',()=>{
 const r=clone(),out=inspect(r);noAuth(out);
 assert.equal(r.anon_executable_privileged_rpc_count,1);
 assert.ok(out.blockers.includes('PRIVILEGED_RPC_TENANT_ONLY_CALLERS_NEED_RECONCILIATION'));
 assert.equal(out.canRevokePublicRpc,false);
});
test('actual SQL COUNT strings normalized only when safe',()=>{
 const r=clone();
 for(const key of NUMERIC)r[key]=String(r[key]);
 const out=inspect(r);noAuth(out);
 assert.equal(out.scopedQaActorSlotsAvailable,true);
});
for(const key of NUMERIC){
 test('negative numeric '+key+' rejected',()=>{
  const r=clone();r[key]=-1;const out=inspect(r);noAuth(out);
  assert.equal(out.code,'UNTRUSTED_SQL_NUMERIC_FIELD');
 });
 test('malformed numeric '+key+' rejected',()=>{
  const r=clone();r[key]='1 OR TRUE';const out=inspect(r);noAuth(out);
  assert.equal(out.code,'UNTRUSTED_SQL_NUMERIC_FIELD');
 });
}
for(const key of BOOL){
 test('malformed approval/identity boolean '+key+' rejected',()=>{
  const r=clone();r[key]='true';const out=inspect(r);noAuth(out);
  assert.equal(out.code,'UNTRUSTED_SQL_BOOLEAN_FIELD');
 });
}
for(const field of ['jwt','accessToken','merchantOriginalRecord','rawIdentity',
 'authUserId','customerPhone','ownerSignature','originalTenantUuid',
 'newGrant','secret','credentials']){
 test('forged private field '+field+' blocked',()=>{
  const r=clone();r[field]='NOT_TRUSTED';const out=inspect(r);noAuth(out);
  assert.equal(out.code,'UNTRUSTED_OR_WRONG_STAGING_METADATA_PACKET');
 });
}
for(const [k,bad] of [
 ['contract','SPOOFED_SOURCE'],['collected_from','SELF_REPORT'],
 ['project_ref','other-project'],['canonical_migration_parent_pr',383],
 ['release','READY_TO_DEPLOY'],['audit_date_jst','2027-01-01']
]){
 test('metadata source pin '+k+' cannot drift',()=>{
  const r=clone();r[k]=bad;const out=inspect(r);noAuth(out);
  assert.equal(out.code,'UNTRUSTED_OR_WRONG_STAGING_METADATA_PACKET');
 });
}
test('missing metadata fails closed',()=>{
 const out=inspect(null);noAuth(out);
 assert.equal(out.code,'UNTRUSTED_OR_WRONG_STAGING_METADATA_PACKET');
});
test('data changes or actual real JWT request in a supposedly READ ONLY snapshot stops',()=>{
 for(const field of ['migrations_applied_this_phase','live_auth_requests_executed',
   'customer_order_rows_read','raw_auth_identifiers_collected']){
  const r=clone();r[field]=1;const out=inspect(r);noAuth(out);
  assert.ok(out.blockers.includes('READ_ONLY_SCOPE_VIOLATION_STOP'));
 }
});
test('source contract constant pinned',()=>{
 assert.equal(CONTRACT,'TIEN404_RPC10_G3R_REAL_AUTH_ELIGIBILITY_READONLY_V1');
});
