// TIEN404 V18.0-P0S — SOURCE-ONLY private verifier integration review.
// This is a checklist assessor, NOT an Auth verifier, Access decision, HTTP route,
// deployment approval, identity attestation, JWT consumer or receipt issuer.
// Never pass bearer tokens, PII, raw session IDs or secrets into this assessor.
const checks=Object.freeze([
 ['privateAccessApp','NO_PRIVATE_ACCESS_APPLICATION','access','appScoped'],
 ['signedAccessJWT','ACCESS_JWT_NOT_SERVER_VERIFIED','access','signedJwtVerifiedAtOrigin'],
 ['pinnedAccessAudience','ACCESS_AUDIENCE_NOT_PINNED','access','audiencePinned'],
 ['directOriginBlocked','DIRECT_ORIGIN_BYPASS_UNRESOLVED','access','directOriginBlocked'],
 ['denyNoAccessHeader','ACCESS_ASSERTION_MISSING_DENY_UNTESTED','access','denyMissingAssertionTested'],
 ['noBypassPolicy','ACCESS_BYPASS_POLICY_UNREVIEWED','access','noBypassPolicyApproved'],
 ['exactPrivateEndpoint','PRIVATE_ENDPOINT_NOT_REVIEWED','access','privateEndpointScoped'],
 ['ownerLocalPair','P0O_LOCAL_PAIR_NOT_RECEIVED','owners','localComparisonReceived'],
 ['ownerConsentA','OWNER_A_PRIVATE_CONSENT_MISSING','owners','consentAIndependentlyVerified'],
 ['ownerConsentB','OWNER_B_PRIVATE_CONSENT_MISSING','owners','consentBIndependentlyVerified'],
 ['realSignedA','OWNER_A_SIGNED_SESSION_NOT_VERIFIED','owners','liveSignedJwtA'],
 ['realSignedB','OWNER_B_SIGNED_SESSION_NOT_VERIFIED','owners','liveSignedJwtB'],
 ['differentActors','DISTINCT_OWNER_PAIR_NOT_SERVER_ATTESTED','owners','distinctSubjectsSameTenantServerVerified'],
 ['supabaseSignature','SUPABASE_SIGNATURE_ISSUER_AUDIENCE_UNREVIEWED','server','signedClaimsValidationReviewed'],
 ['liveUser','LIVE_AUTH_USER_LOOKUP_UNREVIEWED','server','liveUserLookupReviewed'],
 ['liveSession','CURRENT_SESSION_CORRELATION_UNREVIEWED','server','currentSessionLookupReviewed'],
 ['revokeNegative','SESSION_REVOCATION_NEGATIVE_UAT_MISSING','server','revocationNegativeTested'],
 ['trustedOwner','TENANT_OWNER_AUTHORITY_UNREVIEWED','server','activeOwnerMembershipReviewed'],
 ['privilegedMinScope','SESSION_LOOKUP_PRIVILEGE_UNAPPROVED','server','leastPrivilegeCredentialApproved'],
 ['atomicConsent','ATOMIC_CONSENT_RECEIPT_UNREVIEWED','server','atomicConsentAndReplayReviewed'],
 ['redactedAudit','SENSITIVE_AUDIT_REDACTION_UNREVIEWED','operations','auditNoTokenPiiVerified'],
 ['rateBound','RATE_LIMIT_TIMEOUT_UNREVIEWED','operations','rateLimitAndTimeoutVerified'],
 ['restoreReady','HOSTED_ROLLBACK_NOT_APPROVED','operations','rollbackEvidenceReviewed'],
 ['securitySignoff','INDEPENDENT_SECURITY_REVIEW_PENDING','operations','securityReviewerApproved']
]);
export const P0S_CHECK_CODES=Object.freeze(checks.map(x=>x[1]));
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// Evidence flags reflect REVIEW METADATA ONLY. They are not authenticators.
export function assessPrivateVerifierReadiness(input) {
 const value=isRecord(input)?input:{};
 const unmet=[];
 for(const [,code,section,key] of checks) {
   if(!isRecord(value[section])||value[section][key]!==true) unmet.push(code);
 }
 const checklistComplete=unmet.length===0;
 return Object.freeze({
   phase:'V18.0-P0S',
   status:checklistComplete?'CHECKLIST_COMPLETE_INDEPENDENT_APPROVAL_STILL_REQUIRED':'INTEGRATION_NO_GO',
   checkedCount:checks.length,
   unmetCount:unmet.length,
   unmet:Object.freeze(unmet),
   // Never authorize hosted/private endpoint based on self-asserted metadata.
   realOwnerPairAuthenticated:false,
   protectedEndpointDeploymentAuthorized:false,
   verifiedAccessTokensAccepted:false,
   signedReceiptIssued:false,
   canonicalStoreAuthority:false,
   storeReadAuthorized:false,
   orderReadAuthorized:false,
   providerSendAuthorized:false,
   productionApproved:false
 });
}
