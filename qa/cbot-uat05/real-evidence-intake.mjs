/**
 * CBOT-UAT-05 — real evidence inventory and PRIVATE handoff classifier.
 * This checks only bounded, privacy-safe tool observations and opaque vault
 * receipt references. It does not inspect private vault objects, authenticate
 * natural persons, sign any owner decision, or issue hosted capabilities.
 *
 * Actual independent authority must be certified outside this process by the
 * authorized Controller, Security Reviewer and Backup/Channel Operator, using
 * H11R.11 PR #205 private intake. Self-reported "approved" fields are untrusted.
 */
export const CONTRACT='T404_CBOT_UAT05_EVIDENCE_GATE_V1';
export const EVIDENCE_KINDS=Object.freeze([
 'M0_FULL_OFFSITE_APP_AUTH_STORAGE_ACL_RESTORE',
 'M1_FOUR_ROW_MERCHANT_STORE_OWNER',
 'M2_TWO_STORE_SAME_TENANT_REAL_JWT_RLS',
 'RPC_SIX_DOMAIN_REAL_CALLER_ATTESTATION',
 'META_NATIVE_PAGE_APP_PERMISSION_AND_OWNER',
 'ZALO_NATIVE_OA_APP_OAUTH_OWNER',
 'PROVIDER_VERIFIED_CUSTOMER_LINK',
 'READ_ONLY_HOSTED_COMMERCE_ORDER_RECEIPT'
]);
const fatal=(code)=>{const e=new Error(code);e.code=code;throw e;};
const exact=(obj,fields)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.getPrototypeOf(obj)===Object.prototype&&
 Object.keys(obj).length===fields.length&&fields.every(k=>Object.hasOwn(obj,k));
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const safeRef=x=>typeof x==='string'&&/^EVID-[A-Z0-9_-]{8,50}$/.test(x);
const frozen=x=>Object.freeze(x);
const types=Object.freeze({
 META:'META_NATIVE_PAGE_APP_PERMISSION_AND_OWNER',
 ZALO:'ZALO_NATIVE_OA_APP_OAUTH_OWNER'
});
/**
 * Does NOT record raw file paths, Page ID, PSID, Zalo UID, token, snapshots,
 * signed data, biometric records or raw JWT. Those stay in private custody.
 */
export function intakePrivateVaultReference(input){
 if(!exact(input,['kind','vault_ref','vault_ref_sha256','operator_role','reviewer_role','source_class','receipt_status']))
   fatal('REDACTED_RECEIPT_EXACT_SCHEMA_REQUIRED');
 if(!EVIDENCE_KINDS.includes(input.kind)||!safeRef(input.vault_ref)||
    !sha(input.vault_ref_sha256)||!['CONTROLLER','MERCHANT_OWNER','CHANNEL_OPERATOR','BACKUP_OPERATOR'].includes(input.operator_role)||
    input.reviewer_role!=='SECURITY_REVIEWER'||
    input.operator_role===input.reviewer_role||
    input.source_class!=='PRIVATE_OFFLINE_OPERATOR_REFERENCE'||
    input.receipt_status!=='PENDING_INDEPENDENT_REVIEW')fatal('RECEIPT_REFERENT_OR_PROVENANCE_UNVERIFIED');
 return frozen({contract:CONTRACT,kind:input.kind,vault_ref:input.vault_ref,
   vault_ref_sha256:input.vault_ref_sha256,
   status:'OPAQUE_REFERENCE_RECEIVED_NOT_AUTHORIZED',
   independent_primary_source_inspected_by_this_process:false,
   legal_operator_identity_verified:false,
   private_full_restore_certified:false,
   allow_hosted_query:false,allow_rpc_revoke:false});
}
/**
 * Source metadata remains a bounded observation, not signed real owner proof.
 * A private receipt reference (even all eight present) can never authorize a
 * live action without a separate trusted, independently enforced release gate.
 */
export function auditRealEvidence(snapshot,{privateReferences=[],claimedApproval}={}){
 if(!snapshot||snapshot.contract!=='T404_CBOT_UAT05_OBSERVED_METADATA_V1'||
   snapshot.source_class!=='DIRECT_CONNECTED_READ_ONLY_OBSERVATIONS_WITH_EXPLICIT_LIMITS')
   fatal('OBSERVED_BASELINE_CONTRACT_REQUIRED');
 const db=snapshot.supabase||{},n=snapshot.n8n||{},c=snapshot.cloudflare||{},
       logs=snapshot.logs||{},p=snapshot.private_operator_evidence||{};
 const findings=[];
 const passed=[];
 if(db.status==='ACTIVE_HEALTHY'&&db.tenant_count===2&&db.product_count===2&&
    db.order_count===2&&db.customer_count===0){
   passed.push('STAGING_BUSINESS_ROW_COUNTS_OBSERVED');
 }else findings.push('BASELINE_ROW_COUNTS_MISMATCH_OR_UNVERIFIED');
 if(db.auth_user_count===3&&db.auth_session_count===5){
   passed.push('AUTH_METADATA_PRESENT_3_USERS_5_SESSIONS');
 }else findings.push('AUTH_METADATA_UNKNOWN_OR_CHANGED');
 if(db.storage_bucket_count===0&&db.storage_object_metadata_count===0){
   passed.push('HOSTED_STORAGE_METADATA_ZERO_AT_AUDIT_TIME');
 }else findings.push('STORAGE_METADATA_REQUIRES_FRESH_REVIEW');
 // Zero Storage metadata is not a full Auth or object-bytes backup.
 findings.push('FULL_AUTH_STORAGE_ACL_OFFSITE_RESTORE_NOT_INDEPENDENTLY_PROVEN');
 if(db.canonical_stores_present!==true||db.store_memberships_present!==true||
    db.orders_store_id_present!==true||db.products_store_id_present!==true)
   findings.push('NO_CANONICAL_HOSTED_STORE_OWNERSHIP');
 if(db.legacy_claim_security_definer===true&&db.legacy_claim_anon_execute===true)
   findings.push('PUBLIC_PRIVILEGED_LEGACY_RPC_STILL_EXPOSED');
 else if(db.legacy_claim_anon_execute!==false)
   findings.push('LEGACY_RPC_EXECUTE_GRANT_UNKNOWN');
 if(n.live_messenger_execution==='4176'&&n.live_messenger_hmac_verified===true&&
    n.live_messenger_meta_send_receipt===true&&n.live_messenger_order_tool_calls===0){
   passed.push('MESSENGER_LIVE01_SIGNED_WEBHOOK_RECEIPT_OBSERVED');
 }else findings.push('MESSENGER_LIVE01_BASELINE_UNCERTAIN');
 // A valid HMAC on one webhook does not establish provider Page admin / merchant.
 findings.push('META_NATIVE_PAGE_APP_AND_MERCHANT_OWNER_NOT_ATTESTED');
 if(n.zalo_v2_active_legacy_rpc_post===true)passed.push('ACTIVE_ZALO_LEGACY_RPC_CALLER_LOCATED');
 findings.push('ZALO_OA_NATIVE_APP_OWNER_OAUTH_NOT_ATTESTED');
 // Zalo Bot ingress is NOT Zalo OA or customer cross-channel consent.
 findings.push('CROSS_CHANNEL_CUSTOMER_LINK_NOT_ATTESTED');
 if(c.connected_account_worker_scripts_listed===23&&c.script_source_downloaded===23){
   passed.push('CONNECTED_CLOUDFLARE_WORKER_SOURCE_SCAN_23_OF_23');
 }else findings.push('CLOUDFLARE_SOURCE_SCAN_COVERAGE_UNKNOWN');
 if(c.literal_legacy_qa_shop_b_zalo_claim_matches===0){
   passed.push('NO_EXACT_LEGACY_RPC_LITERAL_IN_SCANNED_WORKERS');
 }
 findings.push('EXTERNAL_DYNAMIC_PAGES_WORKERS_AND_MANUAL_CALLERS_NOT_CLOSED');
 if(logs.legacy_rpc_path_mentions_in_selected_log_attributes===0){
   passed.push('NO_LEGACY_RPC_LITERAL_IN_BOUNDED_SELECTED_LOG_ATTRIBUTES');
 }
 findings.push('SHORT_RETAINED_LOG_WINDOW_CANNOT_PROVE_ZERO_CALLERS');
 findings.push('TWO_REAL_STORE_OWNER_JWT_RLS_PROOF_NOT_AVAILABLE');
 findings.push('HOSTED_COMMERCE_ORDER_READ_ONLY_PILOT_NOT_AUTHORIZED');
 const acceptedRefs=[];
 for(const item of privateReferences){
   const r=intakePrivateVaultReference(item);
   if(acceptedRefs.includes(r.kind))fatal('DUPLICATED_PRIVATE_EVIDENCE_KIND');
   acceptedRefs.push(r.kind);
 }
 const awaiting=EVIDENCE_KINDS.filter(kind=>!acceptedRefs.includes(kind));
 // Do not derive release from user-provided claimedApproval or 'all green' refs.
 return frozen({
  contract:CONTRACT,project:'TIEN404_STAGING',
  observedPassed:frozen(passed),
  blockers:frozen([...new Set(findings)]),
  privateReferencesReceived:acceptedRefs.length,
  awaitingPrivateEvidenceKinds:frozen(awaiting),
  claimedApprovalIgnored:claimedApproval!==undefined,
  privateHumanEvidenceVerifiedByThisProcess:false,
  hostedMetadataReadOnlyAllowed:true,
  hostedStoreOrderReadAllowed:false,
  nativeMetaPageSendAllowed:false,nativeZaloOaSendAllowed:false,
  privilegedRpcRevokeAllowed:false,hostedStoreMigrationAllowed:false,
  fullPrivateRecoveryAccepted:false,
  productionReleaseAllowed:false
 });
}
export function releaseHostedOrderReader(){fatal('REAL_OWNER_JWT_STORE_RLS_AND_RECOVERY_GATE_BLOCKED');}
export function issueMerchantChannelOwnership(){fatal('NATIVE_PROVIDER_OWNER_NOT_ATTESTED');}
export function revokeLegacyClaim(){fatal('RPC_SIX_DOMAIN_CALLER_CUTOVER_NOT_ATTESTED');}
