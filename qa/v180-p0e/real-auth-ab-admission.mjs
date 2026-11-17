// TIEN404 V18.0-P0E — PRIVATE REAL-AUTH A/B evidence admission (metadata only).
// Pure, fail-closed document checker, not a JWT verifier.
// Never grant hosted database access based on self-reported evidence.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{64}$/i;
const blockedKeys = /(?:access.?token|refresh.?token|secret|private.?key|credential|bearer|authorization|password|raw.?jwt|service.?role)/i;
const baseFlags = [
 'signature_a_verified_externally','signature_b_verified_externally',
 'issuer_a_verified_externally','issuer_b_verified_externally',
 'audience_a_verified_externally','audience_b_verified_externally',
 'expiry_a_verified_externally','expiry_b_verified_externally',
 'session_a_active_verified_externally','session_b_active_verified_externally',
 'store_a_membership_verified_db','store_b_membership_verified_db',
 'positive_a_read_a','positive_b_read_b',
 'deny_a_read_b','deny_b_read_a','deny_outsider','deny_other_tenant',
 'deny_revoked_member','deny_expired_session','deny_anonymous',
 'server_side_store_resolution_verified','RLS_using_and_with_check_verified',
 'no_service_role_bypass_used','no_provider_send','no_customer_data_used'
];
export function inspectRealAuthAdmission(input){
 const blockers=[];
 if(input==null || typeof input!=='object' || Array.isArray(input))
  return Object.freeze({status:'BLOCKED',blockers:['INVALID_EVIDENCE_CONTAINER'],canMigrate:false,canPublish:false,canSend:false});
 const keysToCheck=[input,input.checks,input.evidence_hashes];
 if(keysToCheck.some(o=>o && typeof o==='object' && Object.keys(o).some(k=>blockedKeys.test(k))))
  blockers.push('RAW_SECRET_OR_TOKEN_FIELD_PROHIBITED');
 if(input.environment!=='PRIVATE_STAGING_NO_SEND')blockers.push('PRIVATE_STAGING_NO_SEND_REQUIRED');
 if(input.project_ref!=='ifxlvrhyjhbzbrkdsida')blockers.push('WRONG_SUPABASE_PROJECT');
 if(!UUID.test(input.tenant_id||''))blockers.push('INVALID_TENANT_ID');
 if(!UUID.test(input.store_a_id||'')||!UUID.test(input.store_b_id||'')||input.store_a_id===input.store_b_id)
  blockers.push('DISTINCT_STORE_A_B_REQUIRED');
 if(typeof input.actor_a_ref!=='string' || !SHA.test(input.actor_a_ref) ||
    typeof input.actor_b_ref!=='string'||!SHA.test(input.actor_b_ref)||
    input.actor_a_ref===input.actor_b_ref)
  blockers.push('DISTINCT_PRIVATE_ACTOR_FINGERPRINTS_REQUIRED');
 if(!input.evidence_hashes || typeof input.evidence_hashes!=='object' ||
    Array.isArray(input.evidence_hashes) ||
    ['auth_a','auth_b','rls_a_b','negative_cases','owner_scope'].some(k=>!SHA.test(input.evidence_hashes[k]||'')))
  blockers.push('INDEPENDENT_EVIDENCE_HASHES_MISSING');
 if(!input.checks || typeof input.checks!=='object' || Array.isArray(input.checks))
  blockers.push('CHECK_MATRIX_MISSING');
 else for(const f of baseFlags)if(input.checks[f]!==true)blockers.push('MISSING_'+f.toUpperCase());
 if(input.same_tenant_store_proof!=='INDEPENDENT_VERIFICATION_REQUIRED')
  blockers.push('STORE_SCOPE_ATTESTATION_REQUIRED');
 if(input.origin==='self_reported' || input.source==='self_reported')
  blockers.push('SELF_REPORT_IS_NOT_TRUSTED_PROOF');
 // Even complete metadata assertions MUST NOT automatically authorize a hosted change.
 return Object.freeze({
  status:blockers.length?'BLOCKED':'INDEPENDENT_REVIEW_REQUIRED',
  blockers,
  canMigrate:false,
  canPublish:false,
  canSend:false,
  canGrantRoles:false,
  canCreateUsers:false,
  realAuthAccepted:false
 });
}
export const expectedTestFlags=Object.freeze([...baseFlags]);
