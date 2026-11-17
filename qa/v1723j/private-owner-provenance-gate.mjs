/**
 * V17.23J -- PUBLIC SOURCE-ONLY private-evidence schema readiness.
 * All inputs are UNTRUSTED metadata. This module cannot establish real owner,
 * independently verify JWT/provider proof or authorize hosted operations.
 * Keep original row IDs, owner information, tokens and signatures exclusively
 * inside the separate private authenticated RPC12 intake workflow.
 */
export const CONTRACT='T404_V1723J_FOUR_ROW_PRIVATE_PROVENANCE_REVIEW_V1';
export const REQUIRED_SLOTS=Object.freeze(['T1_PRODUCT','T1_ORDER','T2_PRODUCT','T2_ORDER']);
export const SAFE_EVIDENCE_CLASSES=Object.freeze(['original_source','merchant_attestation','independent_review']);
const canonical=/^[A-Z][A-Z0-9_]{2,60}$/;
function opaqueRef(value){return typeof value==='string' && /^REF_[A-Z0-9]{12,48}$/.test(value)}
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype}
const unique=(arr)=>Object.freeze([...new Set(arr)]);

export function reviewFourRowManifest(manifest) {
 const errors=[];
 if(!plain(manifest)||manifest.contract!==CONTRACT || !Array.isArray(manifest.slots)) errors.push('INVALID_CONTRACT_OR_SLOTS');
 const slots=Array.isArray(manifest?.slots)?manifest.slots:[];
 if(slots.length!==4)errors.push('EXACTLY_FOUR_ROW_SLOTS_REQUIRED');
 const observed=new Set(),refs=new Set();
 for(const item of slots){
  if(!plain(item)||!REQUIRED_SLOTS.includes(item.slot)||observed.has(item.slot)){
   errors.push('UNEXPECTED_OR_DUPLICATE_SLOT');continue;
  }
  observed.add(item.slot);
  if(!Array.isArray(item.evidence)||item.evidence.length!==3){errors.push('THREE_INDEPENDENT_EVIDENCE_CLASSES_REQUIRED');continue}
  const classes=new Set();
  for(const e of item.evidence){
   if(!plain(e)||!SAFE_EVIDENCE_CLASSES.includes(e.class)||classes.has(e.class)) {errors.push('DUPLICATE_OR_UNKNOWN_EVIDENCE_CLASS');continue}
   classes.add(e.class);
   if(!opaqueRef(e.ref)||refs.has(e.ref))errors.push('MISSING_OR_REUSED_OPAQUE_REF');
   else refs.add(e.ref);
   if(e.ownerId!==undefined||e.storeId!==undefined||e.rowId!==undefined||e.tenantId!==undefined||e.jwt!==undefined||e.signature!==undefined||e.rawSource!==undefined)
    errors.push('PRIVATE_IDENTITY_OR_RAW_EVIDENCE_NOT_ACCEPTED');
   if(!Object.keys(e).every(k=>k==='class'||k==='ref'))errors.push('EVIDENCE_EXTRA_FIELD_NOT_ALLOWED');
  }
  if(!Object.keys(item).every(k=>k==='slot'||k==='evidence'))errors.push('ROW_EXTRA_FIELD_NOT_ALLOWED');
 }
 if(observed.size!==4)errors.push('FOUR_DISTINCT_LEGACY_ROW_SLOTS_REQUIRED');
 if(!plain(manifest)||!Object.keys(manifest).every(k=>['contract','slots'].includes(k)))errors.push('TOP_LEVEL_EXTRA_FIELD_NOT_ALLOWED');
 return Object.freeze({
  status:errors.length?'STRUCTURAL_EVIDENCE_REJECTED':'STRUCTURAL_EVIDENCE_READY_FOR_PRIVATE_REVIEW',
  blockerCodes:unique(errors),
  slotsStructurallyChecked:observed.size,
  originalSourcesIndependentlyReviewed:false,
  merchantOwnerIdentityVerified:false,
  independentReviewerAuthorityVerified:false,
  storeOwnershipCertified:false,
  canBackfill:false,canApplyM1:false,canApplyM2M4:false,
  canReadRealOrder:false,canPublish:false
 });
}
const REQUIRED_AUTH_GATES=Object.freeze([
 'private_operator_authenticated_out_of_band',
 'independent_reviewer_authenticated_out_of_band',
 'merchant_owner_evidence_primary_sources_verified',
 'all_four_original_row_store_provenance_verified',
 'current_m0_restore_independently_accepted',
 'canonical_same_tenant_two_store_mapping_verified',
 'supabase_issuer_validated_jwt_a',
 'supabase_issuer_validated_jwt_b',
 'two_distinct_active_auth_sessions_rechecked',
 'store_membership_rbac_verified_database',
 'store_scoped_rls_negative_uat_independent',
 'verified_customer_pairing_challenge',
 'provider_native_signed_event_and_installation_verified',
 'no_send_and_no_write_hosted_guards_verified'
]);
export function inspectHostedJwtReadiness(packet={}) {
 const blockers=[];
 if(!plain(packet))blockers.push('INVALID_PACKET');
 if(packet?.mode!=='NO_SEND_READ_ONLY')blockers.push('ONLY_NO_SEND_READ_ONLY_ALLOWED');
 const claims=plain(packet?.claims)?packet.claims:{};
 for(const gate of REQUIRED_AUTH_GATES)if(claims[gate]!==true)blockers.push('MISSING_'+gate.toUpperCase());
 const invalidKeys=['jwt','access_token','refresh_token','service_role','password','raw_provider_header','private_owner_document','merchant_email','merchant_phone','private_key','store_id','tenant_id','user_metadata'];
 if(plain(packet)&&invalidKeys.some(k=>Object.hasOwn(packet,k)))blockers.push('PRIVATE_OR_CLIENT_TRUST_INPUT_REJECTED');
 if(plain(claims)&&invalidKeys.some(k=>Object.hasOwn(claims,k)))blockers.push('PRIVATE_OR_CLIENT_TRUST_INPUT_REJECTED');
 // Deliberate hard requirement for PRIVATE authenticated runtime admission:
 // even self-reported all-true flags NEVER authorize any real JWT or API call.
 blockers.push('INDEPENDENT_PRIVATE_VERIFIER_NOT_CONNECTED');
 return Object.freeze({
  status:'REAL_JWT_HOSTED_NO_GO',
  blockers:unique(blockers),
  selfReportedRequiredGateCount:REQUIRED_AUTH_GATES.filter(k=>claims[k]===true).length,
  actualCryptographicJwtVerification:false,
  realOwnerProofAccepted:false,
  realStoreABIsolationAccepted:false,
  providerSignatureAccepted:false,
  canSubmitJwt:false,canReadOrder:false,canSend:false,canWrite:false,
  canOpenAccess:false,canDeploy:false
 });
}
