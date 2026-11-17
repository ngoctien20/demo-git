// Four original Commerce records require authenticated Merchant and independent reviewer.
// This OFFLINE validator never authorizes DB migrations based only on self-reported receipts.
const slots={P1:'PRODUCT',P2:'PRODUCT',O1:'ORDER',O2:'ORDER'};
export function inspectEvidencePacket(input){
 const reasons=[]; const rs=Array.isArray(input?.records)?input.records:[];
 if(rs.length!==4)reasons.push('EXACT_FOUR_REQUIRED');
 const seen=new Set();for(const r of rs){
  if(!r||slots[r.slot]!==r.kind||seen.has(r.slot)){reasons.push('INVALID_SLOT');continue;}
  seen.add(r.slot);
  if(r.stage!=='REVIEWED'||r.malwareScan!=='CLEAN'||r.sourceAuthenticity!=='VERIFIED')reasons.push(r.slot+'_PRIMARY_SOURCE_PENDING');
  if(!r.merchantUserVerified||!r.merchantOwnerApproved||!r.reviewerUserVerified||!r.reviewerApproved||r.merchantAuthUserId===r.reviewerAuthUserId)reasons.push(r.slot+'_INDEPENDENT_APPROVAL_PENDING');
  if(!r.canonicalStoreVerifiedByRegistry)reasons.push(r.slot+'_STORE_AUTHORITY_PENDING');
 }
 for(const slot of Object.keys(slots))if(!seen.has(slot))reasons.push(slot+'_MISSING');
 // External authorities, detached signatures and source records are not verified here:
 reasons.push('ORIGINAL_SOURCE_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED_HERE');
 reasons.push('SIGNED_MERCHANT_REVIEWER_ATTESTATIONS_NOT_VERIFIED_HERE');
 reasons.push('REAL_JWT_AB_AND_RECOVERY_NOT_VERIFIED');
 return Object.freeze({status:'FOUR_ROW_OWNER_HOSTED_NO_GO',reasons:[...new Set(reasons)],canMigrate:false,canBackfill:false,canRevokeRpc:false,canSend:false,canReadCrossStore:false,canRelease:false});
}