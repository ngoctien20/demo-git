'use strict';
/**
 * T404 RPC12 PRIVATE ORIGINAL STORE EVIDENCE COVERAGE, SOURCE-ONLY.
 * This MUST NEVER bind a real Store, authorize migration or pretend hashes verify origin.
 * Do not include real merchant files, names, row IDs, signatures or salts in the repository.
 */
const CONTRACT='T404_RPC12_FOUR_REAL_ROW_ORIGINAL_STORE_OWNER_COVERAGE_V1';
const SLOT_TYPES=Object.freeze({P1:'PRODUCT',P2:'PRODUCT',O1:'ORDER',O2:'ORDER'});
const HASH=/^[a-f0-9]{64}$/;
const SOURCE_TYPES=Object.freeze(['MERCHANT_ORIGINAL_ONBOARDING','MERCHANT_ORIGINAL_CATALOG','SIGNED_EXTERNAL_ORDER_SOURCE','VERIFIED_MERCHANT_EXPORT']);
function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
function inspect(packet){
 const issues=[];
 const obj=packet && typeof packet==='object'&&!Array.isArray(packet)?packet:{};
 if(obj.contract!==CONTRACT)issues.push('WRONG_CONTRACT');
 if(obj.scope!=='PRIVATE_INDEPENDENT_ORIGINAL_SOURCE_REVIEW')issues.push('NOT_PRIVATE_SOURCE_REVIEW');
 if(!Array.isArray(obj.rows)||obj.rows.length!==4)issues.push('EXACT_FOUR_ROW_SLOTS_REQUIRED');
 const seen=new Set();
 for(const r of Array.isArray(obj.rows)?obj.rows:[]){
   if(!r||typeof r!=='object'||Array.isArray(r)||!own(SLOT_TYPES,r.slot)||r.entity!==SLOT_TYPES[r.slot]||seen.has(r.slot)){
     issues.push('INVALID_OR_DUPLICATE_SLOT');continue;
   }
   seen.add(r.slot);
   if(!HASH.test(r.privateRowBindingHmac||'')) issues.push(r.slot+'_PRIVATE_ROW_HMAC_NOT_ATTESTED');
   if(!HASH.test(r.privateTenantBindingHmac||'')) issues.push(r.slot+'_TENANT_BINDING_NOT_ATTESTED');
   if(!HASH.test(r.privateCanonicalStoreBindingHmac||'')) issues.push(r.slot+'_CANONICAL_STORE_NOT_ATTESTED');
   if(!SOURCE_TYPES.includes(r.originalSourceType) || !HASH.test(r.originalSourceEvidenceSha256||''))
     issues.push(r.slot+'_PRIMARY_MERCHANT_SOURCE_NOT_ATTESTED');
   if(!HASH.test(r.merchantOwnerAttestationSha256||'')) issues.push(r.slot+'_MERCHANT_OWNER_PROOF_NOT_ATTESTED');
   if(!HASH.test(r.independentReviewerAttestationSha256||'')) issues.push(r.slot+'_REVIEWER_PROOF_NOT_ATTESTED');
   if(r.sourceReviewedIndependently!==true)issues.push(r.slot+'_SOURCE_NOT_INDEPENDENTLY_INSPECTED');
 }
 for(const slot of Object.keys(SLOT_TYPES))if(!seen.has(slot))issues.push(slot+'_MISSING');
 // Even all syntactically green metadata is not original evidence or a verified signature.
 issues.push('PRIVATE_PRIMARY_SOURCES_NOT_READ_BY_THIS_MODULE');
 issues.push('ACTUAL_AUTH_USER_TO_CANONICAL_STORE_UNVERIFIED');
 issues.push('INDEPENDENT_SIGNER_AUTHORITY_NOT_VERIFIED_HERE');
 issues.push('HOSTED_BACKUP_AND_REAL_JWT_2STORE_UAT_UNVERIFIED');
 return Object.freeze({contract:CONTRACT,
   status:'ORIGINAL_STORE_OWNER_HOSTED_NO_GO',
   issues:Object.freeze([...new Set(issues)]),
   coverage:Object.freeze({expectedRows:4,uniqueSlots:[...seen].length,products:2,orders:2}),
   originalPrimarySourceFilesRead:false,realMerchantConsentVerified:false,
   originalMerchantSignaturesVerified:false,actualStoreOwnerVerified:false,
   realSupabaseJwtVerified:false,canBackfill:false,canApplyM1:false,
   canReplaceRls:false,canRevokeRpc:false,canPublish:false,
   canSendProviderMessages:false,canRelease:false,canWriteHosted:false
 });
}
module.exports=Object.freeze({CONTRACT,SLOT_TYPES,SOURCE_TYPES,inspect});