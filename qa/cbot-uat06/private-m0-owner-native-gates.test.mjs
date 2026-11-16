import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CONTRACT,TARGET_PROJECT,PARENT_SHA,REQUIRED_ROLES,M0_DOMAINS,META_DOMAINS,ZALO_DOMAINS,
 auditPrivateOperatorPacket,releaseHostedStoreRead,revokeHostedRpc,authorizeActualRestore
} from './private-m0-owner-native-gates.mjs';
const NOW=1800000000000;
const dig=x=>x.toString(16).padStart(2,'0').repeat(32);
const ref=n=>'EVID-PRIVATE-QA-'+String(n).padStart(3,'0');
function rows(){
 return ['PRODUCT','PRODUCT','ORDER','ORDER'].map((type,i)=>({
  type,row_digest:dig(10+i),tenant_digest:dig(i<2?20:21),
  store_digest:dig(i%2?30:31),merchant_owner_proof_ref:ref(100+i),
  reviewer_proof_ref:ref(200+i),independently_reviewed:true
 }));
}
function domains(allowed,offset){
 return allowed.map((domain,i)=>({domain,evidence_ref:ref(offset+i),
  evidence_sha256:dig(40+i+offset%30),reviewed_in_private_vault:true}));
}
function fixture(){
 return {
  contract:CONTRACT,project_ref:TARGET_PROJECT,parent_sha:PARENT_SHA,
  captured_at_ms:NOW-3000,expires_at_ms:NOW+120000,
  roles:REQUIRED_ROLES.map((role,i)=>({role,actor_digest:dig(1+i),source_ref:ref(i+1)})),
  existing_archive:{
   rpc7_contract:'T404_RPC7_LOCAL_EXISTING_ARCHIVE_RECEIPT_INPUT_V1',
   receipt_ref:ref(80),existing_archive_sha256:dig(80),archive_bytes:123456,
   scope:'FULL_SERVICE',local_toc_classification:'FULL_TOC_COVERAGE',
   prior_sha_match:true,prior_size_match:true,
   actual_offhost_restore_ref:ref(81),
   actual_restore_independent_reviewer_ref:ref(82)
  },
  m0_evidence:domains(M0_DOMAINS,300),
  legacy_store_claims:rows(),
  meta_page:domains(META_DOMAINS,400),
  zalo_oa:domains(ZALO_DOMAINS,500),
  claimed_approval:'NO_HOSTED_ACTION'
 };
}
const audit=p=>auditPrivateOperatorPacket(p,{nowMs:()=>NOW});
const fail=(fn,code)=>assert.throws(fn,{code});
const alwaysNoGo=r=>{
 for(const k of [
   'external_witness_identity_authenticated',
   'native_meta_page_role_verified','native_zalo_oa_admin_verified',
   'real_merchant_store_mapping_certified','independent_full_m0_recovery_certified',
   'hosted_store_order_reader_authorized','hosted_rpc_revoke_authorized',
   'hosted_store_migration_authorized','messenger_zalo_provider_send_authorized',
   'production_merge_authorized'
 ])assert.equal(r[k],false,k);
};
test('01 exact UAT06 contract is separate from private H11R11 signer',()=>assert.match(CONTRACT,/UAT06_PRIVATE_OPERATOR_PREFLIGHT/));
test('02 all-green synthetic private metadata can never grant hosted rights',()=>{
 const r=audit(fixture());assert.equal(r.status,'PRIVATE_METADATA_SCREENED_NOT_AUTHORIZED');alwaysNoGo(r);
});
test('03 input raw metadata references never echoed in result',()=>{
 const f=fixture(),r=audit(f),text=JSON.stringify(r);
 assert.equal(text.includes(f.existing_archive.existing_archive_sha256),false);
 assert.equal(text.includes(f.meta_page[0].evidence_ref),false);
});
test('04 actual archive is not accessed through metadata preflight',()=>{
 assert.equal(audit(fixture()).actual_archive_read_by_this_code,false);
});
test('05 five different role digest shapes required',()=>{
 assert.equal(audit(fixture()).roles_shape_count,5);
});
test('06 duplicate Controller actor and Security Reviewer rejected',()=>{
 const f=fixture();f.roles[1].actor_digest=f.roles[0].actor_digest;
 fail(()=>audit(f),'ROLES_NOT_INDEPENDENT_BY_METADATA');
});
test('07 missing BACKUP_OPERATOR role rejected',()=>{
 const f=fixture();f.roles=f.roles.filter(x=>x.role!=='BACKUP_OPERATOR');
 fail(()=>audit(f),'FIVE_ROLE_REFERENCES_REQUIRED');
});
test('08 duplicated role even with distinct actor cannot pass',()=>{
 const f=fixture();f.roles[4].role='CONTROLLER';
 fail(()=>audit(f),'ROLES_NOT_INDEPENDENT_BY_METADATA');
});
test('09 extra private path or token field denied',()=>{
 const f=fixture();f.access_token='SYNTHETIC-NOT-A-REAL-TOKEN';
 fail(()=>audit(f),'STRICT_PRIVATE_PACKET_SHAPE_REQUIRED');
});
test('10 wrong Supabase project denied',()=>{
 const f=fixture();f.project_ref='other';
 fail(()=>audit(f),'PROJECT_PARENT_OR_AUTHORITY_SCOPE_INVALID');
});
test('11 stale source checkpoint SHA denied',()=>{
 const f=fixture();f.parent_sha='a'.repeat(40);
 fail(()=>audit(f),'PROJECT_PARENT_OR_AUTHORITY_SCOPE_INVALID');
});
test('12 claim of production approval denied',()=>{
 const f=fixture();f.claimed_approval='APPROVED';
 fail(()=>audit(f),'PROJECT_PARENT_OR_AUTHORITY_SCOPE_INVALID');
});
test('13 expired receipt denied',()=>{
 const f=fixture();f.expires_at_ms=NOW-1;
 fail(()=>audit(f),'PRIVATE_EVIDENCE_RECEIPT_EXPIRED');
});
test('14 future backdated misuse rejected',()=>{
 const f=fixture();f.captured_at_ms=NOW+9000;
 fail(()=>audit(f),'PRIVATE_EVIDENCE_RECEIPT_EXPIRED');
});
test('15 TTL beyond 15 minutes rejected',()=>{
 const f=fixture();f.expires_at_ms=NOW+1500000;
 fail(()=>audit(f),'PRIVATE_EVIDENCE_RECEIPT_EXPIRED');
});
test('16 negative prior SHA/size comparison produces real blocker',()=>{
 const f=fixture();f.existing_archive.prior_sha_match=false;
 const r=audit(f);assert.ok(r.missing_evidence.includes('PREVIOUS_ARCHIVE_BASELINE_MISMATCH'));alwaysNoGo(r);
});
test('17 app-only archive remains incomplete even with all TOC claims',()=>{
 const f=fixture();f.existing_archive.scope='APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN';
 const r=audit(f);assert.equal(r.archive_partial_coverage_possible,true);
});
test('18 partial archive TOC remains incomplete',()=>{
 const f=fixture();f.existing_archive.local_toc_classification='PARTIAL';
 const r=audit(f);assert.ok(r.missing_evidence.includes('ARCHIVE_SCOPE_OR_TOC_PARTIAL'));
});
test('19 even full TOC cannot certify live backup restore',()=>{
 const r=audit(fixture());assert.equal(r.independent_full_m0_recovery_certified,false);
});
test('20 missing offhost restore witness references blocked',()=>{
 const f=fixture();f.existing_archive.actual_offhost_restore_ref=null;
 const r=audit(f);assert.ok(r.missing_evidence.includes('REAL_OFFHOST_RESTORE_WITNESS_REFERENCE_MISSING'));
});
test('21 missing external reviewer witness blocks real recovery',()=>{
 const f=fixture();f.existing_archive.actual_restore_independent_reviewer_ref=null;
 const r=audit(f);assert.ok(r.missing_evidence.includes('REAL_OFFHOST_RESTORE_WITNESS_REFERENCE_MISSING'));
});
test('22 archive path added to receipt denied',()=>{
 const f=fixture();f.existing_archive.archive_path='PRIVATE-PATH-DO-NOT-STORE';
 fail(()=>audit(f),'RPC7_ARCHIVE_METADATA_UNVERIFIED');
});
test('23 invalid SHA disallowed',()=>{
 const f=fixture();f.existing_archive.existing_archive_sha256='bad';
 fail(()=>audit(f),'RPC7_ARCHIVE_METADATA_UNVERIFIED');
});
test('24 missing M0 Auth evidence domain rejected',()=>{
 const f=fixture();f.m0_evidence=f.m0_evidence.slice(1);
 fail(()=>audit(f),'M0_COVERAGE_MISSING');
});
test('25 duplicate M0 domain rejected even with full count',()=>{
 const f=fixture();f.m0_evidence[1].domain=f.m0_evidence[0].domain;
 fail(()=>audit(f),'M0_INVALID_OR_DUPLICATE_DOMAIN');
});
test('26 M0 privately-unreviewed domain stays NO-GO',()=>{
 const f=fixture();f.m0_evidence[0].reviewed_in_private_vault=false;
 const r=audit(f);assert.equal(r.m0_evidence_domain_count,5);alwaysNoGo(r);
});
test('27 2 Products and 2 Orders required',()=>{
 const f=fixture();f.legacy_store_claims[0].type='ORDER';
 fail(()=>audit(f),'LEGACY_ROW_TYPE_COUNT_MISMATCH');
});
test('28 duplicate legacy row digest rejected',()=>{
 const f=fixture();f.legacy_store_claims[1].row_digest=f.legacy_store_claims[0].row_digest;
 fail(()=>audit(f),'LEGACY_ROW_CLAIM_SHAPE_OR_DUPLICATION');
});
test('29 missing merchant Store evidence ref rejected',()=>{
 const f=fixture();f.legacy_store_claims[0].merchant_owner_proof_ref='';
 fail(()=>audit(f),'LEGACY_ROW_CLAIM_SHAPE_OR_DUPLICATION');
});
test('30 legacy row pending independent review stays blocked',()=>{
 const f=fixture();f.legacy_store_claims[0].independently_reviewed=false;
 const r=audit(f);assert.equal(r.business_rows_missing_review,1);
 assert.ok(r.missing_evidence.includes('MERCHANT_OWNER_FOUR_ROW_CLAIMS_UNREVIEWED'));
});
test('31 additional PII property in row claim denied',()=>{
 const f=fixture();f.legacy_store_claims[0].customer_phone='EXAMPLE';
 fail(()=>audit(f),'LEGACY_ROW_CLAIM_SHAPE_OR_DUPLICATION');
});
test('32 Meta native Page permissions six-domain coverage required',()=>{
 const f=fixture();f.meta_page.pop();
 fail(()=>audit(f),'META_COVERAGE_MISSING');
});
test('33 self-reported Meta Page screenshot not a release proof',()=>{
 const r=audit(fixture());assert.equal(r.native_meta_page_role_verified,false);
});
test('34 missing Page subscribed apps review keeps Meta blocked',()=>{
 const f=fixture();f.meta_page[3].reviewed_in_private_vault=false;
 const r=audit(f);assert.ok(r.missing_evidence.includes('META_PAGE_APP_NATIVE_PROOF_UNREVIEWED'));
});
test('35 Zalo native OA not equivalent to Zalo Bot',()=>{
 const f=fixture();f.zalo_oa[0].reviewed_in_private_vault=false;
 const r=audit(f);assert.equal(r.native_zalo_oa_admin_verified,false);
 assert.ok(r.missing_evidence.includes('ZALO_OA_APP_NATIVE_PROOF_UNREVIEWED'));
});
test('36 Zalo OA missing OAuth scope proof rejected as incomplete',()=>{
 const f=fixture();f.zalo_oa=f.zalo_oa.slice(0,5);
 fail(()=>audit(f),'ZALO_COVERAGE_MISSING');
});
test('37 uploaded real token or raw OA ID unexpected in Page evidence denied',()=>{
 const f=fixture();f.zalo_oa[0].raw_oa_access_token='SYNTHETIC-STRING';
 fail(()=>audit(f),'ZALO_INVALID_OR_DUPLICATE_DOMAIN');
});
test('38 false source reviewer identity not independently authenticated',()=>{
 const r=audit(fixture());assert.equal(r.external_witness_identity_authenticated,false);
});
test('39 private sealed packet never authorizes hosted Store read',()=>{
 fail(releaseHostedStoreRead,'M0_M1_NATIVE_AUTHORITY_EXTERNAL_CERTIFICATION_REQUIRED');
});
test('40 private packet cannot revoke existing anon RPC',()=>{
 fail(revokeHostedRpc,'REAL_CALLER_MIGRATION_AND_PRIVILEGE_APPROVAL_REQUIRED');
});
test('41 private packet cannot start real backup restore',()=>{
 fail(authorizeActualRestore,'REAL_BACKUP_OPERATOR_APPROVAL_REQUIRED');
});
