'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const baseline=require('./hosted-schema-readonly-baseline.json');
const {CONTRACT,PROJECT,PARENT,EVIDENCE,PHASES,
 privateEvidenceReview,reviewFourRowBackfill,inspectCanaryPreflight,
 requestRealCanary}=require('./hosted-store-remediation-preflight.cjs');
const h=x=>crypto.createHash('sha256').update(x).digest('hex');
const clone=()=>structuredClone(baseline);
function fakeRecords(){return EVIDENCE.map((domain,i)=>({
 domain,evidenceRef:'EV-'+String(i).padStart(2,'0')+'OFFLINEONLY2026',
 sha256:h('synthetic ref '+domain),privateOperatorInspected:true,
 independentReviewerInspected:true,sourceTimestampVerified:true
}));}
function fakeLedger(){return ['products','products','orders','orders'].map((table,i)=>({
 table,rowDigest:h('QA fake row '+i),tenantDigest:h('QA fake tenant '+i),
 storeEvidenceRef:'EV-'+String(i).padStart(2,'0')+'BACKFILLQA2026',
 ownerVerified:true,reviewerVerified:true
}));}
const approvalKeys=[
 'independent_real_caller_review','official_provider_signature',
 'approved_encrypted_backup','independent_restore_pass',
 'verified_owner_four_row_mapping','approved_hosted_store_schema',
 'same_tenant_owner_a_b_get_only_rls_pass','revoked_staff_negative_pass',
 'private_pairing_claim_and_distinct_owner_confirm',
 'single_writer_transaction_and_replay_pass',
 'approved_revert_and_rollback_drill','approved_canary_change_window',
 'runtime_observability_thresholds_signed','independent_security_reviewer_signoff'
];
function green(){
 const b=clone();
 b.tables.stores.exists=b.tables.store_memberships.exists=true;
 for(const table of ['products','orders','customers']){
  b.tables[table].has_store_id=true;
  b.tables[table].old_select_policy=null;
 }
 const proofs=Object.fromEntries(approvalKeys.map(k=>[k,true]));
 return {b,proofs,parity:[{eventHash:h('synthetic event 1'),old:'DENY',candidate:'DENY'}]};
}
test('01 actual hosted baseline has no Store table or Store-scoped Commerce RLS',()=>{
 const b=clone();
 assert.equal(b.project_ref,PROJECT);assert.equal(b.inherited_head,PARENT);
 assert.equal(b.tables.products.row_count,2);
 assert.equal(b.tables.orders.row_count,2);
 assert.equal(b.tables.customers.row_count,0);
 assert.equal(b.tables.stores.exists,false);
 assert.equal(b.tables.store_memberships.exists,false);
 assert.equal(b.tables.products.legacy_unique_tenant_sku,true);
});
test('02 current real operator primary evidence is incomplete',()=>{
 const r=privateEvidenceReview({baseline});
 assert.equal(r.status,'EVIDENCE_INCOMPLETE');
 assert.equal(r.actualPrimaryPrivateFilesInspectedByCode,false);
 assert.equal(r.independentReviewerIdentityVerified,false);
 assert.equal(r.permissionToRunHosted,false);
});
test('03 even 8 all-green primary evidence references are only self-report',()=>{
 const r=privateEvidenceReview({baseline,records:fakeRecords()});
 assert.equal(r.status,'CLAIMED_REFERENCES_NEED_PRIMARY_SOURCE_REVIEW');
 assert.equal(r.historicalAndExternalCallersCertified,false);
 assert.equal(r.realBackupInspected,false);
 assert.equal(r.permissionToRevoke,false);
});
test('04 duplicate evidence domain or ref fails closed',()=>{
 const a=fakeRecords();a[1].domain=a[0].domain;
 assert.equal(privateEvidenceReview({baseline,records:a}).status,'EVIDENCE_INCOMPLETE');
 const b=fakeRecords();b[1].evidenceRef=b[0].evidenceRef;
 assert.equal(privateEvidenceReview({baseline,records:b}).status,'EVIDENCE_INCOMPLETE');
});
test('05 primary evidence source cannot contain raw JWT or private PII',()=>{
 const a=fakeRecords();a[0].rawJwt='forbidden';
 const r=privateEvidenceReview({baseline,records:a});
 assert(r.blockers.includes('PRIMARY_EVIDENCE_REFERENCE_REJECTED'));
});
test('06 missing and malformed evidence input fails closed without crashes',()=>{
 for(const records of [null,undefined,'verified',{approved:true},[]]){
  const r=privateEvidenceReview({baseline,records});
  assert.equal(r.permissionToRunHosted,false);
  assert.equal(r.status,'EVIDENCE_INCOMPLETE');
 }
});
test('07 exact hosted backfill size is 2 products and 2 orders',()=>{
 const r=reviewFourRowBackfill({baseline});
 assert.equal(r.currentProductRows,2);assert.equal(r.currentOrderRows,2);
 assert.equal(r.currentCustomerRows,0);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.canBackfill,false);
});
test('08 synthetic four-row owner ledger still never certifies actual mapping',()=>{
 const r=reviewFourRowBackfill({baseline,ledger:fakeLedger()});
 assert.equal(r.status,'SELF_REPORTED_MAPPING_ONLY');
 assert.equal(r.ownerToStoreMappingIndependentlyCertified,false);
 assert.equal(r.storesBackfilled,0);
 assert.equal(r.hostedWrites,0);
});
test('09 missing owner attestation or duplicate row digest cannot backfill',()=>{
 const l=fakeLedger();l[0].ownerVerified=false;
 assert(reviewFourRowBackfill({baseline,ledger:l}).blockers.includes(
   'OWNER_OR_REVIEWER_CLAIM_NOT_PROVIDED'));
 const d=fakeLedger();d[1].rowDigest=d[0].rowDigest;
 assert.equal(reviewFourRowBackfill({baseline,ledger:d}).status,'BLOCKED');
});
test('10 schema/row count drift blocks old backfill mapping',()=>{
 const b=clone();b.tables.orders.row_count=3;
 const r=reviewFourRowBackfill({baseline:b,ledger:fakeLedger()});
 assert.equal(r.status,'BLOCKED');
 assert(r.blockers.includes('HOSTED_BACKFILL_ROW_COUNTS_DRIFT_OR_PROJECT_INVALID'));
});
test('11 current hosted canary is NO-GO and old tenant policies remain',()=>{
 const r=inspectCanaryPreflight({baseline});
 assert.equal(r.status,'NO_GO');
 assert(r.blockers.includes('HOSTED_STORE_SCHEMA_MISSING'));
 assert(r.blockers.includes('COMMERCE_ROWS_NOT_STORE_SCOPED'));
 assert(r.blockers.includes('OLD_TENANT_WIDE_PERMISSIVE_RLS_PRESENT'));
 assert.equal(r.currentPublicRpcStillCallable,true);
 assert.equal(r.canaryAuthorized,false);
});
test('12 no authenticated Owner A/B and single-writer approval means NO-GO',()=>{
 const r=inspectCanaryPreflight({baseline});
 assert(r.blockers.includes('MISSING_SAME_TENANT_OWNER_A_B_GET_ONLY_RLS_PASS'));
 assert(r.blockers.includes('MISSING_APPROVED_CANARY_CHANGE_WINDOW'));
 assert(r.blockers.includes('MISSING_SINGLE_WRITER_TRANSACTION_AND_REPLAY_PASS'));
});
test('13 shadow must match status and include no PII',()=>{
 const g=green();
 g.parity=[{eventHash:h('qa-a'),old:'PENDING',candidate:'DENY'}];
 assert(inspectCanaryPreflight({baseline:g.b,proofs:g.proofs,parity:g.parity})
   .blockers.includes('SHADOW_AUTHORIZATION_PARITY_DIVERGED'));
 g.parity=[{eventHash:h('qa-a'),old:'PENDING',candidate:'PENDING',phone:'secret'}];
 assert(inspectCanaryPreflight({baseline:g.b,proofs:g.proofs,parity:g.parity})
   .blockers.includes('SHADOW_PARITY_FIXTURE_INVALID'));
});
test('14 fake all-green preflight cannot become a real canary approval',()=>{
 const g=green();
 const r=inspectCanaryPreflight({baseline:g.b,proofs:g.proofs,parity:g.parity});
 assert.equal(r.status,'PENDING_EXTERNAL_INDEPENDENT_AUTHORITY');
 assert.equal(r.canaryAuthorized,false);
 assert.equal(r.productionTrafficSwitched,false);
 assert.equal(r.providerSendAuthorized,false);
 assert.equal(r.databaseMigrationAuthorized,false);
 assert.equal(r.rpcRevokeAuthorized,false);
});
test('15 wrong project, changed workflow chain or old RPC state fails',()=>{
 for(const mod of [
  b=>{b.project_ref='other-project'},
  b=>{b.n8n_published.z2='different-workflow'},
  b=>{b.rpc.anon_execute=false}
 ]){
  const g=green();mod(g.b);
  assert.equal(inspectCanaryPreflight({
    baseline:g.b,proofs:g.proofs,parity:g.parity
  }).status,'NO_GO');
 }
});
test('16 legacy permissive product/order/customer RLS cannot be additive ORed',()=>{
 for(const table of ['products','orders','customers']){
  const g=green();g.b.tables[table].old_select_policy='TENANT_ONLY_LEGACY';
  assert(inspectCanaryPreflight({
    baseline:g.b,proofs:g.proofs,parity:g.parity
   }).blockers.includes('OLD_TENANT_WIDE_PERMISSIVE_RLS_PRESENT'));
 }
});
test('17 migration phases are reviewed and require independent authorization',()=>{
 assert(PHASES.includes('M3_COMPOSITE_STORE_FK_AND_UNIQUE'));
 assert(PHASES.includes('M4_ATOMIC_REPLACE_TENANT_RLS'));
 assert(PHASES.includes('M6_APPROVED_SINGLE_WRITER_CANARY'));
 assert.equal(CONTRACT,'T404_RPC5_REMEDIATION_CANARY_PREFLIGHT_V1');
});
test('18 source cannot run any actual canary',()=>{
 assert.throws(()=>requestRealCanary(),
  /RPC5_REAL_CANARY_REQUIRES_SEPARATE_CONTROLLER_APPROVAL/);
});
