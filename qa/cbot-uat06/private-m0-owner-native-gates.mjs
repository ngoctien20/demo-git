/**
 * TIEN404 CBOT-UAT-06 — PRIVATE OPERATOR ACCEPTANCE PREFLIGHT, OFFLINE ONLY.
 *
 * PURPOSE: Turn independently retained local operator/vault evidence references
 * into a sanitized list of checklist gaps without accessing the private files.
 *
 * TRUST BOUNDARY: This module does NOT authenticate real people, provider native
 * permissions, signatures, a live JWT, actual backup integrity or restore.
 * An all-green self-reported packet MUST NEVER authorize a hosted operation.
 *
 * Dependencies are REUSED, not duplicated:
 *  - PR #198: Inspect-TIEN404-RPC7-M0.ps1 (existing archive, local read-only)
 *  - PR #205: H11R.11 independently enrolled private witness metadata protocol
 *  - PR #200/#212: disposable PG17 compatibility (not hosted signed JWT)
 *  - PR #214: real Page-owner evidence/one-responder canary requirements
 */
export const CONTRACT='T404_CBOT_UAT06_PRIVATE_OPERATOR_PREFLIGHT_V1';
export const TARGET_PROJECT='ifxlvrhyjhbzbrkdsida';
export const PARENT_SHA='1c563db7f874f5c3f48e73ccc2e30de75a6d52a4';
export const REQUIRED_ROLES=Object.freeze([
 'CONTROLLER','SECURITY_REVIEWER','BACKUP_OPERATOR','MERCHANT_OWNER','CHANNEL_OPERATOR'
]);
export const M0_DOMAINS=Object.freeze([
 'APP_POSTGRES_ROWS_AND_SCHEMA',
 'AUTH_IDENTITIES_AND_RECOVERY_LOGIN',
 'ROLE_ACL_RLS_AND_EXTENSION_CONFIG',
 'STORAGE_METADATA_AND_EXTERNAL_OBJECT_BYTES',
 'ENCRYPTED_OFFSITE_RESTORE_AND_KEY_CUSTODY',
 'RETENTION_RPO_RTO_AND_ROLLBACK'
]);
export const META_DOMAINS=Object.freeze([
 'BUSINESS_PORTFOLIO_PAGE_ACCESS','APP_PAGE_ASSOCIATION',
 'APP_MESSAGES_SUBSCRIPTION','PAGE_SUBSCRIBED_APPS',
 'PAGE_MESSAGING_PERMISSION_STATUS','MERCHANT_CONSENT_AND_QA_RECIPIENT'
]);
export const ZALO_DOMAINS=Object.freeze([
 'NATIVE_OA_ADMIN_ACCESS','NATIVE_OA_APP_BINDING',
 'OAUTH_SCOPE_AND_APP_PERMISSION','OA_WEBHOOK_SIGNATURE_VALIDATION',
 'MERCHANT_STORE_CONSENT','QA_RECIPIENT_AND_REPLAY_POLICY'
]);
const safeRef=x=>typeof x==='string'&&/^EVID-[A-Z0-9_-]{8,52}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const pure=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const freeze=x=>Object.freeze(x);

function inspectRoleActors(roles) {
 if(!Array.isArray(roles)||roles.length!==REQUIRED_ROLES.length)fail('FIVE_ROLE_REFERENCES_REQUIRED');
 const covered=new Set(),actors=new Set();
 for(const r of roles){
  if(!pure(r,['role','actor_digest','source_ref'])||
    !REQUIRED_ROLES.includes(r.role)||!hash(r.actor_digest)||!safeRef(r.source_ref)||
    covered.has(r.role)||actors.has(r.actor_digest))fail('ROLES_NOT_INDEPENDENT_BY_METADATA');
  covered.add(r.role);actors.add(r.actor_digest);
 }
 if(REQUIRED_ROLES.some(r=>!covered.has(r)))fail('REQUIRED_ROLE_MISSING');
 // Unique opaque actor digests are a *shape check*, not real human ID proof.
 return covered.size;
}
function inspectDomains(rows,allowed,kind){
 if(!Array.isArray(rows)||rows.length!==allowed.length)fail(kind+'_COVERAGE_MISSING');
 const set=new Set(),covered=new Set();
 for(const row of rows){
  if(!pure(row,['domain','evidence_ref','evidence_sha256','reviewed_in_private_vault'])||
    !allowed.includes(row.domain)||!safeRef(row.evidence_ref)||
    !hash(row.evidence_sha256)||typeof row.reviewed_in_private_vault!=='boolean'||
    set.has(row.domain))fail(kind+'_INVALID_OR_DUPLICATE_DOMAIN');
  set.add(row.domain);
  if(row.reviewed_in_private_vault===true)covered.add(row.domain);
 }
 return {covered:covered.size,missing_review:allowed.filter(d=>!covered.has(d))};
}
function inspectRows(rows){
 if(!Array.isArray(rows)||rows.length!==4)fail('FOUR_LEGACY_BUSINESS_ROWS_REQUIRED');
 let p=0,o=0;const ids=new Set(),ownershipRefs=new Set(),notReviewed=[];
 for(const row of rows){
  if(!pure(row,['type','row_digest','tenant_digest','store_digest',
   'merchant_owner_proof_ref','reviewer_proof_ref','independently_reviewed'])||
   !['PRODUCT','ORDER'].includes(row.type)||
   ![row.row_digest,row.tenant_digest,row.store_digest].every(hash)||
   !safeRef(row.merchant_owner_proof_ref)||!safeRef(row.reviewer_proof_ref)||
   typeof row.independently_reviewed!=='boolean'||
   ids.has(row.row_digest))fail('LEGACY_ROW_CLAIM_SHAPE_OR_DUPLICATION');
  ids.add(row.row_digest);
  // An owner may own multiple real rows, but every row needs its own evidence
  // and an independent reviewer. Here only claim shape is examined.
  if(row.type==='PRODUCT')p++;else o++;
  if(!row.independently_reviewed)notReviewed.push(row.type);
  ownershipRefs.add(row.merchant_owner_proof_ref);
 }
 if(p!==2||o!==2)fail('LEGACY_ROW_TYPE_COUNT_MISMATCH');
 return {rows:4,products:p,orders:o,unreviewed_rows:notReviewed.length,unique_claim_refs:ownershipRefs.size};
}
function inspectArchive(archive){
 const keys=['rpc7_contract','receipt_ref','existing_archive_sha256','archive_bytes',
   'scope','local_toc_classification','prior_sha_match','prior_size_match',
   'actual_offhost_restore_ref','actual_restore_independent_reviewer_ref'];
 if(!pure(archive,keys)||archive.rpc7_contract!=='T404_RPC7_LOCAL_EXISTING_ARCHIVE_RECEIPT_INPUT_V1'||
 !safeRef(archive.receipt_ref)||!hash(archive.existing_archive_sha256)||
 !Number.isSafeInteger(archive.archive_bytes)||archive.archive_bytes<=0||
 !['FULL_SERVICE','APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN'].includes(archive.scope)||
 !['PARTIAL','INCOMPLETE','FULL_TOC_COVERAGE','UNKNOWN'].includes(archive.local_toc_classification)||
 ![archive.prior_sha_match,archive.prior_size_match].every(x=>typeof x==='boolean')||
 !(archive.actual_offhost_restore_ref===null||safeRef(archive.actual_offhost_restore_ref))||
 !(archive.actual_restore_independent_reviewer_ref===null||safeRef(archive.actual_restore_independent_reviewer_ref)))
 fail('RPC7_ARCHIVE_METADATA_UNVERIFIED');
 return {
  local_receipt_shape_valid:true,
  prior_reference_matches:archive.prior_sha_match&&archive.prior_size_match,
  // Full TOC coverage is not an independent Auth+Storage offsite restore.
  actual_restore_reference_present:!!archive.actual_offhost_restore_ref &&
       !!archive.actual_restore_independent_reviewer_ref,
  possible_partial_scope:archive.scope!=='FULL_SERVICE'||
       archive.local_toc_classification!=='FULL_TOC_COVERAGE'
 };
}
export function auditPrivateOperatorPacket(packet,{nowMs=()=>Date.now()}={}){
 if(!pure(packet,['contract','project_ref','parent_sha','captured_at_ms','expires_at_ms',
 'roles','existing_archive','m0_evidence','legacy_store_claims',
 'meta_page','zalo_oa','claimed_approval']))fail('STRICT_PRIVATE_PACKET_SHAPE_REQUIRED');
 if(packet.contract!==CONTRACT||packet.project_ref!==TARGET_PROJECT||
 packet.parent_sha!==PARENT_SHA||packet.claimed_approval!=='NO_HOSTED_ACTION')
 fail('PROJECT_PARENT_OR_AUTHORITY_SCOPE_INVALID');
 const t=nowMs();
 if(!Number.isSafeInteger(t)||!Number.isSafeInteger(packet.captured_at_ms)||
 !Number.isSafeInteger(packet.expires_at_ms)||packet.captured_at_ms>t+5000||
 packet.expires_at_ms<=t||packet.captured_at_ms<t-600000||
 packet.expires_at_ms-packet.captured_at_ms>900000||
 packet.expires_at_ms<=packet.captured_at_ms)
 fail('PRIVATE_EVIDENCE_RECEIPT_EXPIRED');
 const roleCount=inspectRoleActors(packet.roles);
 const archive=inspectArchive(packet.existing_archive);
 const m0=inspectDomains(packet.m0_evidence,M0_DOMAINS,'M0');
 const rows=inspectRows(packet.legacy_store_claims);
 const meta=inspectDomains(packet.meta_page,META_DOMAINS,'META');
 const zalo=inspectDomains(packet.zalo_oa,ZALO_DOMAINS,'ZALO');
 const gaps=[];
 if(!archive.prior_reference_matches)gaps.push('PREVIOUS_ARCHIVE_BASELINE_MISMATCH');
 if(archive.possible_partial_scope)gaps.push('ARCHIVE_SCOPE_OR_TOC_PARTIAL');
 if(!archive.actual_restore_reference_present)gaps.push('REAL_OFFHOST_RESTORE_WITNESS_REFERENCE_MISSING');
 if(m0.missing_review.length)gaps.push('M0_PRIVATE_COVERAGE_UNREVIEWED');
 if(rows.unreviewed_rows)gaps.push('MERCHANT_OWNER_FOUR_ROW_CLAIMS_UNREVIEWED');
 if(meta.missing_review.length)gaps.push('META_PAGE_APP_NATIVE_PROOF_UNREVIEWED');
 if(zalo.missing_review.length)gaps.push('ZALO_OA_APP_NATIVE_PROOF_UNREVIEWED');
 // REAL independent proof validation must occur outside this code with the
 // actual native provider and independently vetted private Security Reviewer.
 gaps.push('EXTERNAL_HUMAN_AND_RAW_EVIDENCE_ATTESTATION_REQUIRED');
 gaps.push('REAL_HOSTED_OWNER_JWT_RLS_AND_CUSTOMER_LINK_NOT_VERIFIED');
 return freeze({
  contract:CONTRACT,status:'PRIVATE_METADATA_SCREENED_NOT_AUTHORIZED',
  roles_shape_count:roleCount,
  archive_prior_reference_matches:archive.prior_reference_matches,
  archive_partial_coverage_possible:archive.possible_partial_scope,
  archived_external_restore_ref_present:archive.actual_restore_reference_present,
  m0_evidence_domain_count:m0.covered,
  legacy_business_rows_claimed:rows.rows,
  business_rows_missing_review:rows.unreviewed_rows,
  meta_proof_domain_count:meta.covered,
  zalo_proof_domain_count:zalo.covered,
  missing_evidence:frozen([...new Set(gaps)]),
  // All evidence refs/digests remain private and never leave the interpreter.
  actual_archive_read_by_this_code:false,
  external_witness_identity_authenticated:false,
  native_meta_page_role_verified:false,native_zalo_oa_admin_verified:false,
  real_merchant_store_mapping_certified:false,
  independent_full_m0_recovery_certified:false,
  hosted_store_order_reader_authorized:false,
  hosted_rpc_revoke_authorized:false,
  hosted_store_migration_authorized:false,
  messenger_zalo_provider_send_authorized:false,
  production_merge_authorized:false
 });
}
export function releaseHostedStoreRead(){fail('M0_M1_NATIVE_AUTHORITY_EXTERNAL_CERTIFICATION_REQUIRED');}
export function revokeHostedRpc(){fail('REAL_CALLER_MIGRATION_AND_PRIVILEGE_APPROVAL_REQUIRED');}
export function authorizeActualRestore(){fail('REAL_BACKUP_OPERATOR_APPROVAL_REQUIRED');}
