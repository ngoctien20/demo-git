/**
 * V18.3.6O — private RPC cryptographic proof admissibility MATRIX.
 *
 * This is design analysis only. No private keys, HMAC secrets, database
 * extension installations, network calls or production approvals.
 */
const CRITERIA=Object.freeze([
 'verifiedSupabaseIssuerAudienceAlgorithm',
 'activeAuthSessionCheckedInSameDatabaseTransaction',
 'canonicalTenantStoreMembershipCheckedWithRevision',
 'exactOperationAndResourceBound',
 'signedSubjectSessionJtiAndExpiry',
 'databaseSideNonceUniquenessVerified',
 'nonpublicRpcAndDeniedDirectTableGrants',
 'defaultAclAndLegacySecdefRoutesAudited',
 'noServiceRoleOrBypassRlsTrustEscalation',
 'privateSignerKeyCustodyAndRotationVerified',
 'replayOutageAndAmbiguousAckNegativeQa',
 'independentHumanSecurityReviewSigned',
]);
export const proofOptions=Object.freeze([
 Object.freeze({id:'P1_PRIVATE_NODE_ED25519_PLUS_DB_PUBLIC_KEY_VERIFY',
  category:'CONDITIONAL_CANDIDATE',
  description:'Node verifies issuer, DB checks a separate signed operation proof using a vetted public-key verifier',
  blocker:'NO_APPROVED_ED25519_SQL_VERIFIER_OR_DB_CALLER_IDENTITY'}),
 Object.freeze({id:'P2_PRIVATE_NODE_ED25519_PLUS_DB_HMAC',
  category:'CONDITIONAL_CANDIDATE',
  description:'Private backend sends exact bounded MAC; DB stores a separate protected symmetric verification secret',
  blocker:'PRODUCTION_HMAC_KEY_CUSTODY_AND_FUNCTION_ACL_NOT_VERIFIED'}),
 Object.freeze({id:'P3_PRIVATE_BACKEND_NARROW_DB_IDENTITY',
  category:'CONDITIONAL_CANDIDATE',
  description:'Dedicated non-bypass DB role + trusted transaction-bound authorization and no generic SQL proxy',
  blocker:'CALLER_IMPERSONATION_AND_ROLE_GRANT_REVIEW_MISSING'}),
 Object.freeze({id:'X1_CLIENT_SERVICE_ROLE',
  category:'REJECTED',
  description:'Browser, n8n or untrusted message directly forwards service-role secrets',
  blocker:'SERVICE_ROLE_BYPASS_AND_SECRET_EXPOSURE'}),
 Object.freeze({id:'X2_JWT_SIGNATURE_ONLY',
  category:'REJECTED',
  description:'Accept access JWT signature and claims without checking live session, Store authority',
  blocker:'REVOKED_JWT_MAY_BE_CRYPTO_VALID'}),
 Object.freeze({id:'X3_STATIC_QA_HMAC_KEY',
  category:'REJECTED',
  description:'Use committed V18.3.6K QA HMAC key as live production secret',
  blocker:'PUBLIC_QA_KEY_NOT_SECRET'}),
 Object.freeze({id:'X4_PGCRYPTO_HMAC_CALLED_ED25519',
  category:'REJECTED',
  description:'Claim pgcrypto HMAC-SHA256 is a supported Ed25519 verification implementation',
  blocker:'ALGORITHM_CONFUSION'}),
]);
const missingEvidence=(p)=>CRITERIA.filter(key=>p[key]!==true);
export function assessRpcProofOption(id,evidence){
 const o=proofOptions.find(p=>p.id===id);
 if(!o)return Object.freeze({status:'UNKNOWN_OPTION_BLOCKED',productionAdmitted:false});
 if(o.category==='REJECTED')return Object.freeze({
   option:id,status:'REJECTED',blockers:Object.freeze([o.blocker]),
   readyForHumanReview:false,productionAdmitted:false,
 });
 const x=evidence&&typeof evidence==='object'&&!Array.isArray(evidence)?evidence:{};
 const blockers=missingEvidence(x).map(name=>'MISSING_'+name);
 if(id==='P1_PRIVATE_NODE_ED25519_PLUS_DB_PUBLIC_KEY_VERIFY'&&
    x.supportedDatabaseEd25519VerifierPrivatelyProved!==true)
  blockers.push('ED25519_SQL_VERIFIER_UNPROVEN');
 if(id==='P2_PRIVATE_NODE_ED25519_PLUS_DB_HMAC'&&
    x.databaseHmacSecretIndependentFromIssuerKey!==true)
  blockers.push('INDEPENDENT_HMAC_SECRET_REQUIRED');
 if(id==='P3_PRIVATE_BACKEND_NARROW_DB_IDENTITY'&&
    x.pinnedPrivateDbCallerNoImpersonationVerified!==true)
  blockers.push('PRIVATE_DB_CALLER_IMPERSONATION_UNCLOSED');
 if(x.acceptsClientSuppliedStoreId===true)blockers.push('UNTRUSTED_STORE_CLAIM');
 if(x.reusesSupabaseJwtSigningSecret===true)blockers.push('JWT_KEY_REUSE_FORBIDDEN');
 if(x.usesCommittedFixtureSecret===true)blockers.push('QA_FIXTURE_KEY_FORBIDDEN');
 if(x.grantsExecuteToPublic===true)blockers.push('PUBLIC_EXECUTE_FORBIDDEN');
 return Object.freeze({
  option:id,
  status:blockers.length?'BLOCKED_CRYPTO_TRUST_GATE':'EVIDENCE_PACKET_READY_FOR_PRIVATE_REVIEW',
  blockers:Object.freeze([...new Set(blockers)]),
  readyForHumanReview:blockers.length===0,
  productionKeyProvisioned:false,
  actualDatabaseCryptoSupported:false,
  verifiedRealAuthSession:false,
  productionAdmitted:false,
 });
}
export function summarizeRpcOptions(){
 return Object.freeze({
  conditional:proofOptions.filter(x=>x.category==='CONDITIONAL_CANDIDATE').length,
  rejected:proofOptions.filter(x=>x.category==='REJECTED').length,
  criteria:CRITERIA.length,
  preferredGatewayLayer:'PRIVATE_NODE_ED25519_VERIFICATION',
  approvedDbVerificationMechanism:'NONE',
  productionAdmitted:false,
 });
}
export const proofCriteria=CRITERIA;
