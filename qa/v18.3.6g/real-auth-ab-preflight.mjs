/**
 * V18.3.6G REAL Auth A/B admission preflight, metadata/evidence-only.
 * This does NOT contact Supabase Auth, inspect JWTs, create sessions,
 * or return an ADMITTED status. Operator-supplied attestations are not
 * independently verified until reviewed privately by authorized parties.
 */
const SHA256=/^[0-9a-f]{64}$/;
function redactedDigest(value){return typeof value==='string' && SHA256.test(value);}
function present(value){return typeof value==='string' && value.length>0;}
function validOwner(o,slot,blockers){
  if(!o || typeof o!=='object'){blockers.push('OWNER_'+slot+'_PROOF_MISSING');return;}
  for(const k of ['principalHash','tenantHash','storeHash','consentHash','sessionEvidenceHash','membershipEvidenceHash']){
    if(!redactedDigest(o[k])) blockers.push('OWNER_'+slot+'_INVALID_'+k.toUpperCase());
  }
  if(o.sessionVerifiedByTrustedServer!==true)blockers.push('OWNER_'+slot+'_SESSION_UNVERIFIED');
  if(o.membershipCheckedServerSide!==true)blockers.push('OWNER_'+slot+'_STORE_MEMBERSHIP_UNVERIFIED');
  if(o.consentSignedAndCurrent!==true)blockers.push('OWNER_'+slot+'_CONSENT_UNVERIFIED');
  if(o.expiredOrRevoked!==false)blockers.push('OWNER_'+slot+'_REVOKED_OR_UNKNOWN');
}
export function assessPrivateAuthABReadiness(input){
  const blockers=[];
  if(!input || typeof input!=='object')return {status:'BLOCKED',blockers:['INPUT_MISSING'],evidenceScope:'redacted_metadata_only'};
  const s=input.schema||{};
  if(s.canonicalStoreTables!==2)blockers.push('CANONICAL_STORE_AUTHORITY_MISSING');
  if(s.commerceStoreColumns!==6)blockers.push('COMMERCE_STORE_COLUMNS_MISSING');
  if(!Number.isInteger(s.restrictiveStorePolicies)||s.restrictiveStorePolicies<6)blockers.push('RESTRICTIVE_STORE_RLS_MISSING');
  if(s.compositeConstraintsTested!==true)blockers.push('COMPOSITE_FK_EVIDENCE_MISSING');
  if(s.backupRestoreVerified!==true)blockers.push('BACKUP_RESTORE_NOT_VERIFIED');
  if(s.stagingMigrationApproved!==true)blockers.push('STAGING_CHANGE_NOT_APPROVED');
  const owners=input.owners||{};
  validOwner(owners.A,'A',blockers);
  validOwner(owners.B,'B',blockers);
  if(owners.A && owners.B){
    if(owners.A.principalHash===owners.B.principalHash)blockers.push('OWNERS_NOT_INDEPENDENT');
    if(owners.A.storeHash===owners.B.storeHash)blockers.push('STORE_SCOPES_NOT_DISTINCT');
    if(owners.A.tenantHash!==owners.B.tenantHash)blockers.push('NOT_SAME_TENANT');
  }
  const gates=input.gates||{};
  for(const k of ['trustedSessionVerifierApproved','membershipResolverApproved',
    'signedIssuerApproved','atomicNonceStoreApproved','privilegedGatewayReviewed','denyCrossStoreABVerified']){
    if(gates[k]!==true)blockers.push(k.toUpperCase()+'_MISSING');
  }
  const review=input.review||{};
  if(review.independentHumanReviewerApproved!==true||
      !redactedDigest(review.reviewEvidenceHash)||
      !present(review.reviewId))
    blockers.push('INDEPENDENT_SECURITY_REVIEW_MISSING');
  // This is only a readiness checklist. Booleans do NOT authenticate users.
  // Even with every field set, the operator must perform an actual private UAT.
  return Object.freeze({
    status:blockers.length===0?'EVIDENCE_PACKAGE_READY_FOR_PRIVATE_REVIEW':'BLOCKED',
    blockers:Object.freeze(blockers),
    evidenceScope:'redacted_metadata_only',
    realAuthVerified:false,
    tokensAccessed:false,
    productionAdmitted:false,
  });
}
export const verifiedStagingReadOnlySnapshot=Object.freeze({
  project:'tien404-staging',
  postgresVersion:'17.11',
  canonicalStoreTables:0,
  commerceStoreColumns:0,
  restrictiveStorePolicies:0,
  publicProducts:2,
  publicOrders:2,
  activeTenantMemberships:3,
  auditedAt:'2026-11-18',
});
