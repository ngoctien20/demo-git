'use strict';
/** TIEN404 V17.1K-S1: hostile merchant intake and independent review gate.
 * A URL is untrusted TEXT. Never fetch it, render as clickable preview,
 * dereference it in a workflow, or pass it as a model tool argument.
 * Standalone source-only QA; independent hosted callbacks needed for live.
 */
const crypto=require('node:crypto');
const VERSION='T404_V171K_S1_ZERO_TRUST_MERCHANT_INTAKE_V1';
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const deny=x=>{throw Error(x)};
function prepareUntrustedLink({tenantId,storeId,submissionId,rawLink}={}){
 if(!id(tenantId)||!id(storeId)||!id(submissionId)||
   typeof rawLink!=='string'||rawLink.length<12||rawLink.length>2048||
   rawLink!==rawLink.trim()||/[\u0000-\u001f\u007f\x60<>"'\\]/.test(rawLink))
   deny('LINK_UNTRUSTED_TEXT_REFUSED');
 let u;
 try{u=new URL(rawLink);}catch{deny('LINK_PARSER_REFUSED');}
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||
    u.search||u.hash||!u.hostname.includes('.')||
    u.hostname.endsWith('.local')||u.hostname.endsWith('.localhost')||
    u.hostname.endsWith('.internal')||
    /^\d+(\.\d+){3}$/.test(u.hostname)||u.hostname.startsWith('[')||
    u.hostname.includes('%')||rawLink.includes('@')||
    rawLink.includes('%2f')||rawLink.includes('%2F'))
   deny('LINK_SCHEME_CREDENTIAL_HOST_OR_TOKEN_REFUSED');
 const fingerprint=crypto.createHash('sha256').update(rawLink).digest('hex');
 return Object.freeze({version:VERSION,tenantId,storeId,submissionId,
   source:'UNTRUSTED_CUSTOMER_TEXT_ONLY',displayHostname:u.hostname,
   urlSha256:fingerprint,originalUrlReturned:false,
   linkClickable:false,autoPreviewAllowed:false,
   dnsQueries:0,networkRequests:0,canAdmitImage:false,
   requiresIsolatedStaffReview:true,requiresMerchantRightsEvidence:true});
}
function proposePrivateMediaReview({quarantine,storage,scan,reviewer,
  submittedBy,verifyReviewer,nowMs}={}){
 if(!obj(quarantine)||!id(quarantine.tenantId)||!id(quarantine.storeId)||
   !id(quarantine.itemId)||!id(quarantine.sku)||
   !hex(quarantine.sourceSha256)||!hex(quarantine.sanitizedSha256)||
   quarantine.mode!=='OFFLINE_SANITIZED_FILE_QUARANTINE_ONLY'||
   quarantine.sanitizedMime!=='image/png')
   deny('REVIEW_SANITIZED_QUARANTINE_REQUIRED');
 if(!obj(storage)||storage.visibility!=='PRIVATE_QUARANTINE_ONLY'||
   storage.tenantId!==quarantine.tenantId||
   storage.storeId!==quarantine.storeId||
   storage.sku!==quarantine.sku||
   storage.itemId!==quarantine.itemId||
   storage.contentSha256!==quarantine.sanitizedSha256||
   !id(storage.privateStorageReceiptRef))
   deny('REVIEW_PRIVATE_STORE_SCOPED_STORAGE_REQUIRED');
 if(!obj(scan)||scan.status!=='CLEAN_BY_EXTERNAL_SCANNER_DECLARATION'||
   scan.tenantId!==quarantine.tenantId||
   scan.storeId!==quarantine.storeId||
   scan.contentSha256!==quarantine.sanitizedSha256||
   !id(scan.engineVersionRef)||!id(scan.scannerReceiptRef)||
   !Number.isSafeInteger(nowMs)||
   !Number.isSafeInteger(scan.scannedAtMs)||
   scan.scannedAtMs>nowMs||
   scan.scannedAtMs<nowMs-3600000)
   deny('REVIEW_FRESH_SCAN_EVIDENCE_REQUIRED');
 if(!obj(reviewer)||!id(reviewer.staffId)||
   !['MEDIA_REVIEWER','SECURITY_MEDIA_REVIEWER'].includes(reviewer.role)||
   reviewer.tenantId!==quarantine.tenantId||
   reviewer.storeId!==quarantine.storeId||
   reviewer.mfaVerified!==true||
   !id(submittedBy)||submittedBy===reviewer.staffId||
   typeof verifyReviewer!=='function'||
   verifyReviewer({reviewer,quarantine,nowMs})!==true)
   deny('REVIEW_SEPARATE_MFA_STAFF_AUTH_REQUIRED');
 // No direct public publication even after a simulated all-green review.
 // This is a request for a separately governed, audited backend approval.
 return Object.freeze({version:VERSION,mode:'REVIEW_CANDIDATE_NOT_PUBLISHED',
   tenantId:quarantine.tenantId,storeId:quarantine.storeId,
   itemId:quarantine.itemId,sku:quarantine.sku,
   sanitizedSha256:quarantine.sanitizedSha256,
   privateStorageReceiptRef:storage.privateStorageReceiptRef,
   scannerReceiptRef:scan.scannerReceiptRef,
   reviewerStaffRef:reviewer.staffId,
   independentStaffAuthenticationVerifiedByModule:false,
   independentMalwareScanVerifiedByModule:false,
   actualStorageAccessVerifiedByModule:false,
   legalMerchantImageRightsVerifiedByModule:false,
   safeToServePublicly:false,canInvokeRealVision:false,
   actualMerchantMediaPublished:0,providerSends:0,hostedWrites:0});
}
module.exports=Object.freeze({VERSION,prepareUntrustedLink,proposePrivateMediaReview});