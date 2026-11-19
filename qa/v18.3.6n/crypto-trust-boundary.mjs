/**
 * V18.3.6N — explicit design choice, not production authorization.
 *
 * Chosen offline-verifiable architectural direction:
 *  - Node native crypto Ed25519 verifies TIEN404 private issuer receipt
 *  - Supabase JWT issuer/audience/session validated independently
 *  - DB transaction rechecks authoritative session/membership, bounds operation
 *  - private RPC caller proof must be independently audited and provisioned
 *
 * No production credential or KMS key is present. The exact DB proof method
 * cannot be selected until PostgreSQL extension & secret-custody review.
 */
export const designDecision=Object.freeze({
 decisionId:'TIEN404_V1836N_CRYPTO_TRUST_BOUNDARY_PROPOSAL',
 preferred:'PRIVATE_BACKEND_NODE_ED25519_VERIFY_WITH_SAME_PG_AUTH_STORE_TRANSACTION',
 rejected:Object.freeze([
  'PUBLIC_OR_CLIENT_SERVICE_ROLE_PROXY',
  'JWT_SIGNATURE_ONLY_AS_ACTIVE_SESSION',
  'STATIC_K_QA_HMAC_FIXTURE_AS_PRODUCTION_KEY',
  'PGJWT_OR_PGSODIUM_WITHOUT_SUPPORTED_VERIFIER_QA',
  'DIRECT_UNTRUSTED_EXECUTE_SECURITY_DEFINER',
 ]),
 pending:Object.freeze([
  'PRODUCTION_PRIVATE_RPC_CALLER_PROOF',
  'ACTUAL_AUTH_SESSIONS_SQL_ACL',
  'CANONICAL_STORE_RLS_MIGRATION',
  'SIGNER_KEY_NONEXPORTABILITY_AND_ROTATION',
  'INDEPENDENT_HUMAN_SECURITY_REVIEW',
 ]),
 productionSelected:false,
 productionReleaseAdmitted:false,
});
export function assessProductionCryptoBoundary(evidence){
 const e=evidence&&typeof evidence==='object'?evidence:{};
 const blockers=[];
 if(e.nodeEd25519VerifierIndependentlyReviewed!==true)blockers.push('ED25519_GATEWAY_REVIEW_MISSING');
 if(e.supabaseJwksPinnedAndRotationTested!==true)blockers.push('SUPABASE_JWKS_TRUST_UNVERIFIED');
 if(e.authSessionAndStoreTransactionRealQa!==true)blockers.push('SAME_DB_AUTH_STORE_REAL_QA_MISSING');
 if(e.privateRpcIdentityChannelIndependentlyReviewed!==true)blockers.push('PRIVATE_RPC_IDENTITY_UNVERIFIED');
 if(e.productionKmsKeyCustodyAndRotationDrilled!==true)blockers.push('PRODUCTION_KMS_CUSTODY_UNVERIFIED');
 if(e.dbSignatureOrMacVerifierSupportedAndReviewed!==true)blockers.push('DB_CRYPTO_VERIFIER_NOT_APPROVED');
 if(e.noServiceRoleOrBypassRlsEscalationVerified!==true)blockers.push('SERVICE_ROLE_BYPASS_NOT_CLOSED');
 if(e.independentHumanSecurityReviewSigned!==true)blockers.push('HUMAN_SECURITY_REVIEW_NOT_SIGNED');
 if(e.usePublicSyntheticHmacKey===true)blockers.push('KNOWN_PUBLIC_QA_KEY_FORBIDDEN');
 if(e.useClientSuppliedStoreClaims===true)blockers.push('USER_STORE_AUTHORITY_FORBIDDEN');
 if(e.installPgSodiumWithoutApproval===true)blockers.push('UNAPPROVED_EXTENSION_INSTALL_FORBIDDEN');
 return Object.freeze({
  status:blockers.length?'NOT_READY':'EVIDENCE_PACKET_READY_FOR_OFFLINE_HUMAN_REVIEW',
  blockers:Object.freeze([...new Set(blockers)]),
  designDecision:designDecision.preferred,
  databaseCryptoMechanism:'UNSELECTED_PENDING_TRUST_REVIEW',
  realKeysAccessed:false,
  liveSignerConnected:false,
  deployed:false,
  productionSelected:false,
  productionAdmitted:false
 });
}
