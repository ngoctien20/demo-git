// Scanner verdict and reviewer state contract. This DOES NOT validate original
// merchant provenance and cannot approve Store ownership or hosted cutover.
export const SCAN_STATES=Object.freeze({pending:'PENDING_MALWARE_SCAN',clean:'SCANNED_CLEAN',rejected:'MALWARE_REJECTED'});
export async function acceptScannerVerdict({receiptId,scannerEnvelope,scanner,ledger}){
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(receiptId||'')||
    typeof scanner?.verifySignature!=='function'||typeof ledger?.transitionFromPending!=='function')
  return Object.freeze({status:'SCAN_GATE_UNAVAILABLE',accepted:false});
 let verdict;
 try{verdict=await scanner.verifySignature(scannerEnvelope);}catch{return Object.freeze({status:'INVALID_SCANNER_IDENTITY',accepted:false});}
 if(!verdict||verdict.receiptId!==receiptId||!['CLEAN','INFECTED','SUSPICIOUS'].includes(verdict.verdict)||
    !/^[a-f0-9]{64}$/.test(verdict.sourceSha256||'')||verdict.scannerVersion===undefined)
  return Object.freeze({status:'INVALID_SCANNER_VERDICT',accepted:false});
 const next=verdict.verdict==='CLEAN'?SCAN_STATES.clean:SCAN_STATES.rejected;
 let committed=false;
 try{committed=await ledger.transitionFromPending({receiptId,sha256:verdict.sourceSha256,next,scannerVersion:String(verdict.scannerVersion)});}catch{}
 if(committed!==true)return Object.freeze({status:'STALE_OR_INCONSISTENT_SCAN',accepted:false});
 return Object.freeze({status:next,accepted:true,ownerApproved:false,canRelease:false});
}
export function assessReviewReadiness({merchant,reviewer,scan,record}){
 const blockers=[];
 if(!merchant?.verifiedAuth||!merchant?.verifiedAccess||!merchant?.signedConsent)blockers.push('MERCHANT_IDENTITY_OR_CONSENT_MISSING');
 if(!reviewer?.verifiedAuth||!reviewer?.verifiedAccess||!reviewer?.independentAssignment||
    merchant?.authUserId===reviewer?.authUserId)blockers.push('INDEPENDENT_REVIEWER_NOT_VERIFIED');
 if(scan?.status!==SCAN_STATES.clean)blockers.push('MALWARE_SCANNING_NOT_CLEAN');
 if(!record?.originalSourceRegistryMatched||!record?.privateBindingVerified)blockers.push('ORIGINAL_ROW_PROVENANCE_UNVERIFIED');
 // Source-only code cannot independently certify signer authority or original proof.
 blockers.push('EXTERNAL_PRIMARY_SOURCE_AND_SIGNER_ATTESTATION_REQUIRED');
 return Object.freeze({status:'PRIVATE_OWNER_REVIEW_NO_GO',blockers,canAssignStore:false,canMigrate:false,canApproveHosted:false});
}