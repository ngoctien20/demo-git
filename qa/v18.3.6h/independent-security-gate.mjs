/**
 * V18.3.6H — cryptographically checked reviewer evidence, OFFLINE ONLY.
 * An Ed25519 test signature does NOT establish that a real independent
 * human reviewed this system. This function NEVER returns ADMITTED.
 */
import {verify as verifySignature,createHash} from 'node:crypto';
const SHA=/^[a-f0-9]{64}$/;
const HEX40=/^[0-9a-f]{40}$/;
const deny=(list,code)=>list.push(code);
const KEYS=['scope','audience','environment','build_sha','reviewer_hash','implementer_hash',
  'nonce_proof_hash','auth_contract_hash','admission_evidence_hash','issued_at',
  'expires_at','p0_findings_closed'];
export function assessIndependentSecurityGate({receipt,reviewerKeys,clock,staging}={}) {
  const blockers=[];
  if (!receipt || !reviewerKeys || !(reviewerKeys instanceof Map) ||
      typeof clock!=='function' || !staging) {
    return Object.freeze({status:'BLOCKED',blockers:['EVIDENCE_OR_REVIEWER_REGISTRY_MISSING'],
      realHumanReviewed:false,stagingApproved:false,productionAdmitted:false});
  }
  const {kid,payload,signature}=receipt;
  const now=Math.floor(clock()/1000);
  if (!payload || typeof payload!=='object' || Array.isArray(payload) ||
      Object.keys(payload).length!==KEYS.length ||
      KEYsMissing(payload)) deny(blockers,'INVALID_REVIEW_PAYLOAD');
  let signatureValid=false;
  if(typeof kid==='string' && /^[a-z0-9-]{3,64}$/.test(kid) &&
     typeof signature==='string' && /^[A-Za-z0-9_-]+$/.test(signature)) {
    const pub=reviewerKeys.get(kid);
    if(pub && pub.type==='public' && pub.asymmetricKeyType==='ed25519'){
      const bytes=Buffer.from(signature,'base64url');
      if(bytes.length===64 && bytes.toString('base64url')===signature){
        try { signatureValid=verifySignature(null,Buffer.from(JSON.stringify(payload)),pub,bytes); }
        catch { signatureValid=false; }
      }
    }
  }
  if(!signatureValid)deny(blockers,'REVIEWER_SIGNATURE_NOT_VERIFIED');
  if (payload && typeof payload==='object') {
    if(payload.scope!=='V18.3.6H-READONLY-PREFLIGHT' ||
       payload.audience!=='tien404-private-human-security-review' ||
       payload.environment!=='offline_disposable')
      deny(blockers,'WRONG_REVIEW_SCOPE');
    if(!HEX40.test(payload.build_sha||'') ||
       ![payload.reviewer_hash,payload.implementer_hash,payload.nonce_proof_hash,
         payload.auth_contract_hash,payload.admission_evidence_hash].every(x=>typeof x==='string' && SHA.test(x)))
      deny(blockers,'INVALID_EVIDENCE_DIGEST');
    if(payload.reviewer_hash===payload.implementer_hash)
      deny(blockers,'REVIEWER_NOT_INDEPENDENT');
    if(payload.p0_findings_closed!==true)
      deny(blockers,'P0_FINDINGS_OPEN');
    if(!Number.isSafeInteger(payload.issued_at)||
      !Number.isSafeInteger(payload.expires_at) ||
      payload.issued_at>now || payload.expires_at<=now ||
      payload.expires_at-payload.issued_at>86400)
      deny(blockers,'REVIEW_EXPIRED');
  }
  if(staging.canonicalStoreTables!==2 || staging.commerceStoreColumns!==6 ||
    !Number.isInteger(staging.restrictiveStorePolicies) || staging.restrictiveStorePolicies<6)
    deny(blockers,'CANONICAL_STORE_STAGING_NOT_READY');
  if(staging.realAuthABAccepted!==true || staging.independentOwnerConsentVerified!==true)
    deny(blockers,'REAL_AUTH_AND_OWNER_PROOF_MISSING');
  if(staging.backupAndRollbackApproved!==true)
    deny(blockers,'BACKUP_AND_ROLLBACK_NOT_APPROVED');
  // Distinguish a signed evidence package from a verified independent human.
  // Even fully synthetic PASS cannot approve Auth A/B admission or production.
  return Object.freeze({
    status:blockers.length===0?'EVIDENCE_READY_FOR_SEPARATE_HUMAN_ADMISSION':'BLOCKED',
    blockers:Object.freeze(blockers),
    reviewerCryptoSignatureValid:signatureValid,
    realHumanReviewed:false,
    stagingApproved:false,
    productionAdmitted:false,
  });
}
function KEYsMissing(obj){return KEYS.some(k=>!Object.hasOwn(obj,k));}
export function digestPlaceholder(value){return createHash('sha256').update(String(value)).digest('hex');}
