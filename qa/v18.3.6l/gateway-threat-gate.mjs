/**
 * V18.3.6L protected-gateway P0/P1 evidence register.
 * The register is audit-oriented and cannot close an actual threat without
 * independent signed/private evidence. Never grants operation permissions.
 */
export const threatRegister=Object.freeze([
 {id:'L-P0-01',severity:'P0',name:'External Auth revoke after check, before DB commit',
  require:'AUTHORITATIVE_REVOCATION_RACE_PROOF'},
 {id:'L-P0-02',severity:'P0',name:'Missing canonical Store authority and A/B same-tenant proof',
  require:'REAL_CANONICAL_STORE_AND_OWNER_AB_PROOF'},
 {id:'L-P0-03',severity:'P0',name:'Privileged DB executor bypasses RLS or accepts forged scope',
  require:'PRIVILEGED_SQL_ACL_AND_FORGERY_NEGATIVE_PROOF'},
 {id:'L-P0-04',severity:'P0',name:'Static synthetic K HMAC fixture could be copied to production',
  require:'PRODUCTION_KEY_CUSTODY_AND_ROTATION_ATTESTATION'},
 {id:'L-P0-05',severity:'P0',name:'No independent human security authorization',
  require:'INDEPENDENT_HUMAN_SIGNED_DECISION'},
 {id:'L-P0-06',severity:'P0',name:'Provider/merchant consent and installation authority unverified',
  require:'REAL_PROVIDER_AND_OWNER_CONSENT'},
 {id:'L-P1-01',severity:'P1',name:'Nonce cleanup, HA/PITR and rollback unproven',
  require:'RECOVERY_AND_NONCE_RETENTION_QA'},
 {id:'L-P1-02',severity:'P1',name:'PostgREST exposure/legacy RPC routes not inventoried',
  require:'REAL_FUNCTION_EXECUTE_GRANT_INVENTORY'},
 {id:'L-P1-03',severity:'P1',name:'Data operation not guaranteed inside verified authority transaction',
  require:'PRODUCTION_OPERATION_TRANSACTION_PROOF'},
]);
const SHA=/^[0-9a-f]{64}$/;
export function assessGatewayThreatReview(evidence) {
  const e=evidence&&typeof evidence==='object'?evidence:{};
  const hashes=e.proofHashes&&typeof e.proofHashes==='object'?e.proofHashes:{};
  const unresolved=[];
  for(const threat of threatRegister){
    // Plain string hashes are evidence references, NOT evidence of closure.
    if(!SHA.test(hashes[threat.require]||''))unresolved.push(threat.id);
  }
  if(!SHA.test(e.reviewerHash||''))unresolved.push('REVIEWER_ID_MISSING');
  if(!SHA.test(e.implementerHash||''))unresolved.push('IMPLEMENTER_ID_MISSING');
  if(e.reviewerHash && e.implementerHash && e.reviewerHash===e.implementerHash)
    unresolved.push('REVIEWER_NOT_INDEPENDENT');
  if(!SHA.test(e.reviewedCommitDigest||''))unresolved.push('REVIEWED_CODE_HASH_MISSING');
  if(e.reviewerSignaturePrivatelyVerified!==true)
    unresolved.push('INDEPENDENT_REVIEW_SIGNATURE_UNVERIFIED');
  // No configured hash or boolean can establish real reviewer attestation.
  return Object.freeze({
    status:unresolved.length?'BLOCKED':'EVIDENCE_INDEX_READY_FOR_INDEPENDENT_REVIEW',
    unresolved:Object.freeze(unresolved),
    p0Total:threatRegister.filter(x=>x.severity==='P0').length,
    p1Total:threatRegister.filter(x=>x.severity==='P1').length,
    verifiedThreatClosures:0,
    independentHumanReviewCompleted:false,
    protectedGatewayAdmitted:false,
    productionAdmitted:false,
  });
}
