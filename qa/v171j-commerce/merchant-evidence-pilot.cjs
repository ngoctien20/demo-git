'use strict';
/**
 * V17.1J private merchant photo evidence + bounded real-Vision pilot plan.
 *
 * This is an evidence contract, NOT owner-domain-license verification.
 * Does not fetch photos, call paid models, create embeddings, store PII,
 * approve funds, or give permissions to n8n/Meta/Zalo.
 */
const crypto=require('node:crypto');
const {strictHttpsUrl,allowedHosts}=require('../v171f-commerce/shop-media-source-registry.cjs');
const VERSION='T404_V171J_PRIVATE_MERCHANT_IMAGE_EVIDENCE_V1';
const PLAN_VERSION='T404_V171J_VISION_PILOT_QUOTE_ONLY_V1';
const DENY=x=>{throw Error(x)};
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(x);
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const nat=x=>Number.isSafeInteger(x)&&x>0;
const MAX_MEDIA=100,MAX_CASES=90,MAX_TTL=365*86400000;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');

function prepareMerchantEvidence({tenantId,storeId,catalogRevision,products,
  mediaRows,allowedImageHosts,nowMs}={}){
 if(!id(tenantId)||!id(storeId)||!nat(catalogRevision)||!nat(nowMs)||
    !Array.isArray(products)||!products.length||products.length>100||
    !Array.isArray(mediaRows)||!mediaRows.length||mediaRows.length>MAX_MEDIA)
    DENY('EVIDENCE_SCOPE_OR_INPUT_INVALID');
 const hosts=allowedHosts(allowedImageHosts),catalog=new Map(),itemSeen=new Set();
 for(const p of products){
   if(!plain(p)||p.tenantId!==tenantId||p.storeId!==storeId||
      !id(p.sku)||!id(p.itemId)||p.active!==true||
      catalog.has(p.sku)||itemSeen.has(p.itemId))
      DENY('EVIDENCE_TRUSTED_CATALOG_READBACK_REQUIRED');
   catalog.set(p.sku,p.itemId);itemSeen.add(p.itemId);
 }
 const seenMedia=new Set(),seenHashes=new Set(),seenUrls=new Map(),rows=[];
 for(const r of mediaRows){
   if(!plain(r)||r.tenantId!==tenantId||r.storeId!==storeId||
      r.catalogRevision!==catalogRevision||!id(r.mediaId)||
      !id(r.sku)||catalog.get(r.sku)!==r.itemId||
      !hex(r.imageSha256)||!id(r.licenseEvidenceRef)||
      !id(r.merchantConsentRef)||!id(r.domainOwnershipEvidenceRef)||
      !['MERCHANT_ORIGINAL','LICENSED_SUPPLIER'].includes(r.licenseBasis)||
      r.commercialUseConsent!==true||r.privacyReviewed!==true||
      r.allowAIProductMatching!==true||
      !['PRODUCTS_IMAGE_URL','PRODUCT_MEDIA','OWNER_DIRECT_UPLOAD'].includes(r.sourceType)||
      !nat(r.consentAtMs)||r.consentAtMs>nowMs||
      !nat(r.retentionUntilMs)||r.retentionUntilMs<=nowMs||
      r.retentionUntilMs>nowMs+MAX_TTL||
      Object.hasOwn(r,'imageBytes')||Object.hasOwn(r,'credential')||
      seenMedia.has(r.mediaId)||seenHashes.has(r.imageSha256))
      DENY('EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID');
   let urlHash=null;
   if(r.sourceType!=='OWNER_DIRECT_UPLOAD'){
     if(typeof r.imageUrl!=='string')DENY('EVIDENCE_IMAGE_URL_REQUIRED');
     const normalized=strictHttpsUrl(r.imageUrl,hosts);
     if(seenUrls.has(normalized)&&seenUrls.get(normalized)!==r.itemId)
       DENY('EVIDENCE_URL_ASSIGNED_TO_MULTIPLE_SKUS');
     seenUrls.set(normalized,r.itemId);
     urlHash=hash(normalized);
   }else if(r.imageUrl!==undefined && r.imageUrl!==null){
     DENY('EVIDENCE_DIRECT_UPLOAD_MUST_NOT_CLAIM_URL');
   }
   seenMedia.add(r.mediaId);seenHashes.add(r.imageSha256);
   rows.push(Object.freeze({tenantId,storeId,itemId:r.itemId,sku:r.sku,
     mediaId:r.mediaId,imageSha256:r.imageSha256,sourceType:r.sourceType,
     imageUrlSha256:urlHash,licenseBasis:r.licenseBasis,
     licenseEvidenceRef:r.licenseEvidenceRef,
     merchantConsentRef:r.merchantConsentRef,
     domainOwnershipEvidenceRef:r.domainOwnershipEvidenceRef,
     retentionUntilMs:r.retentionUntilMs,
     independentOwnerVerified:false,independentLicenseVerified:false,
     independentDomainVerified:false,approvedForProduction:false,
     status:'PENDING_PRIVATE_INDEPENDENT_EVIDENCE_REVIEW'}));
 }
 return Object.freeze({version:VERSION,mode:'PRIVATE_EVIDENCE_MANIFEST_ONLY',
    tenantId,storeId,catalogRevision,mediaCount:rows.length,
    media:Object.freeze(rows),actualImageBytesObtained:0,
    independentStoreOwnershipVerified:false,
    independentMerchantRightsVerified:false,
    independentDomainOwnershipVerified:false,
    realPhotoPixelsDecodedHere:false,
    readyForRealVisionPilot:false,canSendOrWrite:false,
    modelCalls:0,providerSends:0,hostedWrites:0});
}
function buildBoundedPilotQuote({dossier,queryCases,provider,model,
  proposedMaxCalls,proposedPerCallMicroUsd,proposedTotalMicroUsd,
  humanBudgetApprovalRef=null}={}){
 if(!plain(dossier)||dossier.version!==VERSION||
    !id(dossier.tenantId)||!id(dossier.storeId)||
    !Array.isArray(dossier.media)||!dossier.media.length||
    !Array.isArray(queryCases)||!queryCases.length||queryCases.length>MAX_CASES||
    !id(provider)||!id(model)||!nat(proposedMaxCalls)||
    proposedMaxCalls>MAX_CASES||queryCases.length>proposedMaxCalls||
    !nat(proposedPerCallMicroUsd)||proposedPerCallMicroUsd>1000000||
    !nat(proposedTotalMicroUsd)||proposedTotalMicroUsd>10000000)
    DENY('PILOT_QUOTE_SCOPE_OR_CAP_INVALID');
 const worstCase=queryCases.length*proposedPerCallMicroUsd;
 if(worstCase>proposedTotalMicroUsd)
   DENY('PILOT_QUOTE_WORST_CASE_EXCEEDS_PROPOSED_CAP');
 const approvedSkus=new Set(dossier.media.map(x=>x.sku));
 const mediaHashes=new Set(dossier.media.map(x=>x.imageSha256));
 const seenCase=new Set(),seenQuery=new Set();
 let known=0,unknown=0;
 const normalized=[];
 for(const c of queryCases){
  if(!plain(c)||!id(c.caseId)||seenCase.has(c.caseId)||
     c.tenantId!==dossier.tenantId||c.storeId!==dossier.storeId||
     !hex(c.imageSha256)||mediaHashes.has(c.imageSha256)||
     seenQuery.has(c.imageSha256)||!id(c.humanLabelReviewerRef)||
     c.blindSplit!=='HOLDOUT'||
     (c.expectedSku!==null&&!approvedSkus.has(c.expectedSku)))
     DENY('PILOT_BLIND_LABEL_OR_STORE_LEAKAGE_DENIED');
  seenCase.add(c.caseId);seenQuery.add(c.imageSha256);
  if(c.expectedSku===null)unknown++;else known++;
  normalized.push(Object.freeze({caseId:c.caseId,
     imageSha256:c.imageSha256,
     expectedSku:c.expectedSku,
     tenantId:c.tenantId,storeId:c.storeId,
     humanLabelReviewerRef:c.humanLabelReviewerRef}));
 }
 const proposedSampleEnough=known>=30&&unknown>=15;
 return Object.freeze({version:PLAN_VERSION,mode:'QUOTE_ONLY_NO_VENDOR_CALLS',
   tenantId:dossier.tenantId,storeId:dossier.storeId,
   catalogRevision:dossier.catalogRevision,provider,model,
   caseCount:normalized.length,knownCount:known,unknownCount:unknown,
   proposedSampleMinimumMet:proposedSampleEnough,
   cases:Object.freeze(normalized),
   proposedMaxCalls,proposedPerCallMicroUsd,
   proposedTotalMicroUsd,proposedWorstCaseMicroUsd:worstCase,
   humanBudgetApprovalRefFormatValid:humanBudgetApprovalRef===null||id(humanBudgetApprovalRef),
   humanApprovalIndependentlyVerified:false,
   vendorPricingIndependentlyVerified:false,
   providerAccountBalanceVerified:false,
   independentlyVerifiedMerchantRights:false,
   issuedLimitedCapability:false,canInvokeRealModel:false,
   realProviderCalls:0,paidUsdObserved:null,
   providerSends:0,hostedWrites:0,
   requiresCustomerSkuSelection:true,requiresFinalOrderConfirmation:true,
   resultClassification:'PILOT_PROPOSED_REAL_PROVIDER_NOT_AUTHORIZED'});
}
function evaluateClaimedPilotReceipts({quote,receipts,dossier}={}){
 if(!plain(quote)||quote.version!==PLAN_VERSION||
   !plain(dossier)||dossier.version!==VERSION||
   quote.tenantId!==dossier.tenantId||
   quote.storeId!==dossier.storeId||
   !Array.isArray(quote.cases)||!Array.isArray(receipts)||
   receipts.length!==quote.cases.length)
   DENY('PILOT_RECEIPT_CONTEXT_INVALID');
 const allowed=new Set(dossier.media.map(m=>m.sku));
 const cases=new Map(quote.cases.map(c=>[c.caseId,c]));
 if(cases.size!==quote.cases.length)DENY('PILOT_CASE_IDS_NOT_UNIQUE');
 const seenCase=new Set(),seenRequest=new Set();
 let r1=0,r3=0,unknownPred=0,known=0,unknown=0,scopeViolations=0,cost=0;
 for(const r of receipts){
   const label=cases.get(r?.caseId);
   if(!plain(r)||!label||seenCase.has(r.caseId)||
      !id(r.providerRequestId)||seenRequest.has(r.providerRequestId)||
      r.tenantId!==quote.tenantId||r.storeId!==quote.storeId||
      r.imageSha256!==label.imageSha256||
      r.provider!==quote.provider||r.model!==quote.model||
      !Number.isSafeInteger(r.claimedMicroUsd)||
      r.claimedMicroUsd<0||r.claimedMicroUsd>quote.proposedPerCallMicroUsd||
      !Array.isArray(r.candidates)||r.candidates.length>3||
      r.candidates.some(x=>!id(x))||
      new Set(r.candidates).size!==r.candidates.length)
      DENY('PILOT_PROVIDER_RECEIPT_INVALID');
   seenCase.add(r.caseId);seenRequest.add(r.providerRequestId);
   cost+=r.claimedMicroUsd;
   scopeViolations+=r.candidates.filter(s=>!allowed.has(s)).length;
   if(label.expectedSku===null){unknown++;if(r.candidates.length)unknownPred++;}
   else{known++;if(r.candidates[0]===label.expectedSku)r1++;
     if(r.candidates.includes(label.expectedSku))r3++;}
 }
 if(cost>quote.proposedTotalMicroUsd)DENY('PILOT_RECEIPT_COST_OVER_CAP');
 return Object.freeze({mode:'UNVERIFIED_CLAIMED_RECEIPT_METRICS',
   tenantId:quote.tenantId,storeId:quote.storeId,
   recallAt1:known?r1/known:null,recallAt3:known?r3/known:null,
   unknownCandidateRate:unknown?unknownPred/unknown:null,
   crossStoreOrInvalidSkuCandidateCount:scopeViolations,
   claimedMicroUsd:cost,actualProviderBillingVerified:false,
   realProviderCallsMadeHere:0,modelQualityIndependentlyVerified:false,
   eligibleForLiveUat:false,canAutoSelectSku:false,
   requiresCustomerSkuSelection:true,
   requiresFinalOrderConfirmation:true,providerSends:0,hostedWrites:0});
}
module.exports=Object.freeze({VERSION,PLAN_VERSION,
  prepareMerchantEvidence,buildBoundedPilotQuote,
  evaluateClaimedPilotReceipts});
