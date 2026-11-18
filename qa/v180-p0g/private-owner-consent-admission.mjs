// TIEN404 AI V18.0-P0G — PRIVATE OWNER ADMISSION: SOURCE-ONLY EVIDENCE CHECKER.
// Zero network / zero Supabase login / zero JWT parsing / zero provider calls.
// All public source and CI examples use aggregates or synthetic random receipt labels.
// A receipt, JSON flag, user count or unsigned session row can NEVER authorize a real store.
import {inspectCompatibility, noSendUatCases} from '../v180-p0f/store-auth-compat-preflight.mjs';

const unsafeKey=/^(?:access[_-]?token|refresh[_-]?token|authorization|api[_-]?key|secret|client[_-]?secret|service[_-]?role|password|jwt|raw[_-]?jwt|private[_-]?key|email|phone|user[_-]?id|session[_-]?id|otp|code|bearer)$/i;
const receipt=/^qa-receipt:[a-f0-9]{32}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const denied=(kind,issues,extra={})=>Object.freeze({
 kind,status:'NO_GO',issues:Object.freeze([...issues]),
 sourceOnly:true,canReadAggregates:true,
 canOperateWithRealJWT:false,canChangeHostedSchema:false,canGrantStoreMembership:false,
 canRunHostedAB:false,canSendProvider:false,canPublish:false,
 ...extra
});
const sensitive=(value,depth=0)=>{
 if(depth>8)return true;
 if(!value||typeof value!=='object')return false;
 return Object.entries(value).some(([key,v])=>unsafeKey.test(key)||sensitive(v,depth+1));
};
export function evaluateOwnerCohort(cohort,compatSnapshot){
 const issues=[];
 if(!cohort||typeof cohort!=='object'||Array.isArray(cohort))
  return denied('P0G_COHORT',['AGGREGATE_EVIDENCE_MISSING']);
 if(cohort.project_ref!=='ifxlvrhyjhbzbrkdsida'||
 cohort.environment!=='TIEN404_SUPABASE_STAGING'||
 cohort.data_class!=='AGGREGATE_ONLY_NO_IDENTIFIERS_NO_SECRETS')
  issues.push('UNTRUSTED_COHORT_OR_TARGET');
 if(sensitive(cohort))issues.push('PERSONAL_IDENTIFIERS_OR_SECRETS_IN_EVIDENCE');
 const auth=cohort.auth_cohort||{};
 const qa=cohort.legacy_qa_owner_pairing||{};
 const store=cohort.hosted_store_authority||{};
 const validInt=v=>Number.isSafeInteger(v)&&v>=0;
 const numbers=[
 auth.active_tenant_membership_rows,auth.active_owner_tenant_membership_rows,
 auth.confirmed_not_banned_active_memberships,
 auth.eligible_members_with_unexpired_session_record,
 auth.same_tenant_two_owner_session_record_groups,
 auth.same_tenant_two_member_session_record_groups,
 qa.challenges_total,qa.challenges_unused_and_unexpired,qa.challenges_used,
 qa.claims_total,qa.claims_confirmed,qa.channel_identities_nonrevoked,
 qa.order_ownership_verified,store.public_stores_tables,
 store.public_store_membership_tables,store.public_commerce_store_id_columns,
 store.store_scoped_product_rpc_count
 ];
 if(numbers.some(n=>!validInt(n)))issues.push('INVALID_AGGREGATE_COUNTS');
 if(auth.active_tenant_membership_rows!==3 ||
  auth.active_owner_tenant_membership_rows!==3 ||
  auth.eligible_members_with_unexpired_session_record!==2)
  issues.push('COHORT_CHANGED_REQUIRES_NEW_PRIVATE_READ_ONLY_QUERY');
 if(auth.same_tenant_two_owner_session_record_groups!==0)
  issues.push('COHORT_CHANGED_REQUIRES_NEW_PRIVATE_READ_ONLY_QUERY');
 issues.push('NO_PAIR_OF_ELIGIBLE_SAME_TENANT_OWNER_SESSION_RECORDS');
 if(auth.real_jwt_signature_verified!==false ||
  auth.real_jwt_session_id_correlated!==false ||
  auth.real_jwt_issuer_audience_verified!==false ||
  auth.unexpired_session_record_is_real_jwt_proof!==false)
   issues.push('UNVERIFIED_JWT_CLAIM_IN_AGGREGATE');
 if(qa.challenges_unused_and_unexpired===0)issues.push('NO_FRESH_QA_PAIRING_CHALLENGE');
 if(qa.claims_confirmed===0)issues.push('NO_CONFIRMED_QA_PAIRING_CLAIM');
 if(qa.channel_identities_nonrevoked===0)issues.push('NO_ACTIVE_QA_CROSS_CHANNEL_IDENTITY');
 if(qa.legacy_pairing_is_trusted_store_owner!==false)
   issues.push('LEGACY_QA_PAIRING_CANNOT_ATTEST_STORE_OWNER');
 if(store.public_stores_tables===0 || store.public_store_membership_tables===0 ||
    store.public_commerce_store_id_columns===0)
   issues.push('CANONICAL_HOSTED_STORE_AUTHORITY_MISSING');
 if(store.canonical_two_store_owner_proof!==false)
   issues.push('STORE_OWNER_PROOF_NOT_ESTABLISHED');
 const compat=inspectCompatibility(compatSnapshot);
 if(!compat.sourceOnlyMatrixReady)issues.push('P0F_COMPATIBILITY_DRIFT');
 return denied('P0G_COHORT',[...new Set(issues)],
 {exactAggregateReadOnlyVerified:!issues.includes('INVALID_AGGREGATE_COUNTS') &&
   !issues.includes('UNTRUSTED_COHORT_OR_TARGET') &&
   !issues.includes('COHORT_CHANGED_REQUIRES_NEW_PRIVATE_READ_ONLY_QUERY'),
 realOwnerABVerified:false,realJWTVerified:false});
}
export function evaluatePrivateConsent(cohort,compatSnapshot,envelope){
 const baseline=evaluateOwnerCohort(cohort,compatSnapshot);
 const issues=[];
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))
  return denied('P0G_PRIVATE_CONSENT',[...baseline.issues,'PRIVATE_CONSENT_NOT_COLLECTED']);
 if(sensitive(envelope))issues.push('SENSITIVE_FIELD_MUST_NEVER_BE_SHARED');
 if(envelope.target!=='QA_PRIVATE_NO_SEND')issues.push('NO_SEND_PRIVATE_ENVIRONMENT_REQUIRED');
 if(envelope.founder_authorized_private_read_only!==true)
   issues.push('FOUNDER_PRIVATE_READ_ONLY_AUTHORIZATION_REQUIRED');
 if(envelope.owner_a_consented!==true||envelope.owner_b_consented!==true)
   issues.push('TWO_SEPARATE_ACCOUNT_CONSENTS_REQUIRED');
 if(envelope.independent_operator_review!==true)
   issues.push('INDEPENDENT_REVIEW_NOT_ATTESTED');
 const a=envelope.owner_a_receipt_ref, b=envelope.owner_b_receipt_ref;
 if(!receipt.test(a||'')||!receipt.test(b||'')||a===b)
   issues.push('TWO_DISTINCT_OPAQUE_RECEIPT_REFERENCES_REQUIRED');
 if(envelope.receipt_storage!=='PROTECTED_PRIVATE_EVIDENCE_REGISTRY')
   issues.push('PRIVATE_EVIDENCE_STORAGE_REQUIRED');
 if(envelope.real_auth_session_verified_by_operator!==true)
   issues.push('PRIVATE_AUTH_SESSION_VERIFICATION_NOT_ATTESTED');
 if(envelope.server_side_canonical_store_registry_verified!==true)
   issues.push('TRUSTED_STORE_AUTHORITY_NOT_ATTESTED');
 if(!uuid.test(envelope.canonical_tenant_uuid||'')||
    !uuid.test(envelope.canonical_store_a_uuid||'')||
    !uuid.test(envelope.canonical_store_b_uuid||'')||
    envelope.canonical_store_a_uuid===envelope.canonical_store_b_uuid)
   issues.push('SAME_TENANT_DIFFERENT_STORE_UUIDS_REQUIRED');
 // No public uploader or repo metadata can independently authenticate consent.
 // Existing Supabase schema has no canonical store registry: never promote.
 return denied('P0G_PRIVATE_CONSENT',
 [...new Set([...baseline.issues,...issues,
  'CONSENT_JSON_SELF_ASSERTION_IS_NOT_PROOF',
  'NO_REAL_HOSTED_STORE_AB_ADMISSION'])],
 {privateEvidenceReviewPrepared:issues.length===0,
  realOwnerABVerified:false,realJWTVerified:false});
}
export function inspectRealReadOnlyHandshake(cohort,compatSnapshot,packet){
 const baseline=evaluateOwnerCohort(cohort,compatSnapshot);
 const issues=[];
 if(!packet||typeof packet!=='object'||Array.isArray(packet))
   return denied('P0G_REAL_AUTH_HANDSHAKE',[...baseline.issues,'NO_PRIVATE_OPERATOR_HANDSHAKE']);
 if(sensitive(packet))issues.push('PERSONAL_IDENTIFIERS_OR_TOKENS_IN_PACKET');
 if(packet.scope!=='READ_ONLY_NO_SEND')issues.push('READ_ONLY_SCOPE_REQUIRED');
 if(packet.auth_a_via_official_get_user!==true || packet.auth_b_via_official_get_user!==true)
   issues.push('TWO_OFFICIAL_AUTH_GETUSER_CHECKS_REQUIRED');
 if(packet.session_a_correlated_privately!==true || packet.session_b_correlated_privately!==true)
   issues.push('TWO_PRIVATELY_VERIFIED_SESSION_REFERENCES_REQUIRED');
 if(packet.signatures_and_iss_aud_exp_verified_privately!==true)
   issues.push('REAL_JWT_VERIFICATION_REQUIRED');
 if(packet.owner_scopes_read_from_authoritative_registry!==true)
   issues.push('AUTHORITATIVE_STORE_SCOPE_NOT_VERIFIED');
 if(packet.cross_store_negative_checks_executed===true)
   issues.push('UNAUTHORIZED_HOSTED_AB_TEST_CLAIM');
 if(packet.provider_messages_sent!==false)issues.push('PROVIDER_SEND_MUST_BE_FALSE');
 if(packet.database_writes!==false)issues.push('HOSTED_DATABASE_WRITES_MUST_BE_FALSE');
 if(packet.result!=='NO_GO' && packet.result!=='NOT_RUN')issues.push('INVALID_REAL_AUTH_RESULT');
 return denied('P0G_REAL_AUTH_HANDSHAKE',[...new Set([...baseline.issues,...issues])],
 {realAuthHandshakeExecuted:false,privateOperatorReviewNeeded:true});
}
export function inheritedNoSendMatrix(){
 return Object.freeze(noSendUatCases().map(c=>Object.freeze({...c})));
}
