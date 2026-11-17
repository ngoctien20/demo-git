'use strict';
/**
 * TIEN404 V17.1E — private product-image corpus READINESS CONTRACT.
 *
 * This module never reads image bytes, public URLs, credentials or private
 * signed evidence. It audits metadata only. Merchant authorship, rights,
 * independent reviewer signatures and real Store binding CANNOT be verified
 * from a JSON claim or Github test. Keep media and private evidence off GitHub.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_V171E_PRIVATE_MERCHANT_MEDIA_CORPUS_V1';
const ID=/^[A-Za-z0-9_-]{2,90}$/,SHA=/^[a-f0-9]{64}$/;
const allowedMime=new Set(['image/png','image/jpeg','image/webp']);
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const valid=x=>typeof x==='string'&&ID.test(x);
const refuse=x=>{throw Error(x);};
const clean=x=>Array.isArray(x)&&x.length<=500;
const mediaKey=x=>[x.tenantId,x.storeId,x.productId,x.mediaId].join('|');
function auditCorpus({tenantId,storeId,products=[],media=[],cases=[]}={}){
 if(!valid(tenantId)||!valid(storeId)||!clean(products)||!clean(media)||!clean(cases))
  refuse('CORPUS_SCOPE_OR_SIZE_INVALID');
 const errors=[],productIds=new Map(),mediaIds=new Map(),hashes=new Set(),caseIds=new Set();
 for(const p of products){
  if(!obj(p)||p.tenantId!==tenantId||p.storeId!==storeId||
     !valid(p.productId)||!valid(p.sku)||productIds.has(p.productId)||
     p.demoOnly!==true||p.published!==false){
   errors.push('PRODUCT_SCOPE_OR_DEMO_CONTRACT_INVALID');continue;
  }
  productIds.set(p.productId,p);
 }
 let merchantPhotos=0,syntheticPhotos=0;
 for(const m of media){
  if(!obj(m)||m.tenantId!==tenantId||m.storeId!==storeId||
     !valid(m.productId)||!valid(m.mediaId)||
     !productIds.has(m.productId)||mediaIds.has(m.mediaId)){
    errors.push('IMAGE_PRODUCT_OR_STORE_BINDING_INVALID');continue;
  }
  mediaIds.set(m.mediaId,m);
  if(!SHA.test(m.sha256||'')||hashes.has(m.sha256)||
     !allowedMime.has(m.mimeType)||
     !Number.isSafeInteger(m.width)||!Number.isSafeInteger(m.height)||
     m.width<64||m.height<64||m.width>4096||m.height>4096||
     !Number.isSafeInteger(m.bytes)||m.bytes<256||m.bytes>8*1024*1024||
     !valid(m.catalogVersion)||!valid(m.privateObjectRef)||
     typeof m.publicUrl!=='undefined'||
     m.contentStoredInGithub!==false||
     m.productSku!==productIds.get(m.productId).sku){
    errors.push('IMAGE_DIGEST_DIMENSIONS_OR_PRIVATE_STORAGE_INVALID');continue;
  }
  hashes.add(m.sha256);
  if(m.origin==='MERCHANT_UPLOADED'){
    merchantPhotos++;
    if(m.rightsScope!=='PRODUCT_SEARCH_AND_EVALUATION'||
       m.processingConsent!==true||m.licenseState!=='CLAIMED_MERCHANT_OR_LICENSED'||
       !valid(m.merchantAttestor)||!valid(m.independentReviewer)||
       m.merchantAttestor===m.independentReviewer||
       !valid(m.privateEvidenceRef)||
       m.trainingPermission!==false)
      errors.push('MERCHANT_RIGHTS_OR_INDEPENDENT_REVIEW_NOT_READY');
  }else if(m.origin==='QA_GENERATED'){
    syntheticPhotos++;
    if(m.processingConsent!==true||m.trainingPermission!==false)
      errors.push('SYNTHETIC_MEDIA_POLICY_INVALID');
  }else errors.push('UNKNOWN_IMAGE_PROVENANCE');
 }
 let positives=0,unknowns=0,hardNegatives=0;
 for(const c of cases){
  if(!obj(c)||!valid(c.caseId)||caseIds.has(c.caseId)||
    !valid(c.imageId)||!mediaIds.has(c.imageId)||
    c.tenantId!==tenantId||c.storeId!==storeId||
    !['REFERENCE','HOLDOUT'].includes(c.partition)||
    !['positive','unknown','hard_negative'].includes(c.labelType)||
    !valid(c.labeler)||!valid(c.independentReviewer)||
    c.labeler===c.independentReviewer){
    errors.push('BENCHMARK_CASE_UNVERIFIED_OR_CROSS_STORE');continue;
  }
  caseIds.add(c.caseId);
  const m=mediaIds.get(c.imageId);
  if(c.labelType==='positive'){
   positives++;
   if(c.expectedSku!==productIds.get(m.productId)?.sku)
    errors.push('POSITIVE_LABEL_NOT_GROUNDED_IN_PRODUCT');
  }else{
   unknowns++;if(c.labelType==='hard_negative')hardNegatives++;
   if(c.expectedSku!==null)
    errors.push('UNKNOWN_LABEL_HAS_EXPECTED_SKU');
  }
 }
 const ref=new Set(cases.filter(c=>c?.partition==='REFERENCE').map(c=>c?.imageId));
 const hold=new Set(cases.filter(c=>c?.partition==='HOLDOUT').map(c=>c?.imageId));
 for(const item of hold)if(ref.has(item))errors.push('REFERENCE_HOLDOUT_IMAGE_LEAKAGE');
 if(merchantPhotos===0)errors.push('NO_MERCHANT_PHOTO_WITH_PRIVATE_RIGHTS_PROOF');
 if(positives===0||unknowns===0||hardNegatives===0)
   errors.push('MISSING_POSITIVE_UNKNOWN_OR_HARD_NEGATIVE_LABELS');
 if(!ref.size)errors.push('NO_REFERENCE_SET');
 if(!hold.size)errors.push('NO_INDEPENDENT_HOLDOUT');
 if(!cases.some(c=>c?.partition==='HOLDOUT'&&c?.labelType==='positive'))
   errors.push('NO_POSITIVE_HOLDOUT_FOR_RECALL');
 const unique=[...new Set(errors)];
 return Object.freeze({contract:CONTRACT,mode:'METADATA_ONLY_NO_MEDIA_NO_MODEL',
  status:unique.length?'NOT_ADMISSIBLE':'CLAIMED_CORPUS_PACKET_REQUIRES_INDEPENDENT_SOURCE_AUDIT',
  reasons:Object.freeze(unique),tenantId,storeId,
  productCount:productIds.size,merchantPhotoClaims:merchantPhotos,
  syntheticPhotoCount:syntheticPhotos,
  positiveCaseClaims:positives,unknownCaseClaims:unknowns,
  hardNegativeClaims:hardNegatives,holdoutClaimCount:hold.size,
  realMerchantPhotoRightsVerifiedHere:false,independentProvenanceValidatedHere:false,
  realStoreOwnershipVerifiedHere:false,canTrainModel:false,
  canUploadPhotos:false,canPublish:false,providerSends:0,hostedWrites:0});
}
function privateIntakePlan(report){
 if(!obj(report)||report.contract!==CONTRACT)refuse('CORPUS_REPORT_REQUIRED');
 return Object.freeze({requiresPrivateStorage:true,
  acceptedMedia:['image/png','image/jpeg','image/webp'],
  requiredStates:['MERCHANT_CONSENT','OWNERSHIP_OR_LICENSE_PROOF',
    'INDEPENDENT_REVIEW','STORE_IDENTITY_PROOF','SAFE_MEDIA_DECODING',
    'DEDUPLICATED_HASH','LABELED_REFERENCE_AND_HOLDOUT','RETENTION_POLICY'],
  actualMediaUploaded:0,actualImagesReviewed:0,
  recommendation:report.status==='NOT_ADMISSIBLE'?
    'KEEP_REAL_IMAGE_VISION_BENCHMARK_BLOCKED':
    'REQUIRES_INDEPENDENT_OPERATOR_REVIEW_BEFORE_MODEL_BENCHMARK',
  canAuthorizeProviderCost:false});
}
module.exports=Object.freeze({CONTRACT,auditCorpus,privateIntakePlan});
