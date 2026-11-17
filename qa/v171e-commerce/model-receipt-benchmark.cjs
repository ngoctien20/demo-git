'use strict';
/**
 * Strict metrics on externally supplied candidate receipts, NOT model execution.
 * Claimed provider receipts and test labels are untrusted until independently
 * audited against vendor billing, actual query photos and merchant rights.
 */
const VERSION='T404_V171E_VISION_RECEIPT_METRICS_V1';
const fail=x=>{throw Error(x);};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function evaluateReceipts({corpus,cases}={}){
 if(!obj(corpus)||corpus.version!=='T404_V171E_MERCHANT_CORPUS_PREPARATION_V1'||
   !id(corpus.tenantId)||!id(corpus.storeId)||
   !Array.isArray(corpus.items)||!Array.isArray(cases)||
   cases.length<1||cases.length>500)fail('VISION_BENCHMARK_DATA_INVALID');
 const skuSet=new Set(corpus.items.map(x=>x.sku));
 if(skuSet.size===0||corpus.items.some(x=>x.tenantId!==corpus.tenantId||
   x.storeId!==corpus.storeId||!id(x.sku)))fail('VISION_CATALOG_SCOPE_INVALID');
 const seen=new Set();
 let positives=0,unknown=0,top1=0,top3=0,falseCandidate=0,leaks=0;
 let totalClaimedCostUsd=0,totalClaimedLatencyMs=0;
 const rows=[];
 for(const c of cases){
   if(!obj(c)||!id(c.caseId)||seen.has(c.caseId)||
     c.tenantId!==corpus.tenantId||c.storeId!==corpus.storeId||
     !hex(c.queryImageSha256)||!id(c.labelReviewerRef)||
     (c.expectedSku!==null&&!skuSet.has(c.expectedSku))||
     !obj(c.receipt)||!id(c.receipt.providerName)||
     !id(c.receipt.modelId)||!id(c.receipt.requestId)||
     c.receipt.inputSha256!==c.queryImageSha256||
     !Number.isSafeInteger(c.receipt.latencyMs)||c.receipt.latencyMs<0||
     typeof c.receipt.claimedCostUsd!=='number'||
     !Number.isFinite(c.receipt.claimedCostUsd)||
     c.receipt.claimedCostUsd<0||c.receipt.claimedCostUsd>100||
     !Array.isArray(c.receipt.candidates)||
     c.receipt.candidates.length>5)
     fail('VISION_RECEIPT_OR_LABEL_INVALID');
   seen.add(c.caseId);
   let prev=Infinity;
   const candidateSet=new Set(),skus=[];
   for(const p of c.receipt.candidates){
     if(!obj(p)||!id(p.sku)||candidateSet.has(p.sku)||
       typeof p.score!=='number'||!Number.isFinite(p.score)||
       p.score<0||p.score>1||p.score>prev)
       fail('VISION_CANDIDATES_INVALID');
     candidateSet.add(p.sku);prev=p.score;skus.push(p.sku);
     if(!skuSet.has(p.sku))leaks++;
   }
   totalClaimedCostUsd+=c.receipt.claimedCostUsd;
   totalClaimedLatencyMs+=c.receipt.latencyMs;
   if(c.expectedSku===null){
     unknown++;
     if(skus.length)falseCandidate++;
   }else{
     positives++;
     if(skus[0]===c.expectedSku)top1++;
     if(skus.slice(0,3).includes(c.expectedSku))top3++;
   }
   rows.push(Object.freeze({caseId:c.caseId,expectedKnown:c.expectedSku!==null,
     retrievedAt1:skus[0]||null,scopeViolations:skus.filter(s=>!skuSet.has(s)).length,
     claimedProviderRequestId:c.receipt.requestId}));
 }
 // Proposed evaluation sample size, NOT an approved launch target.
 const sampleSufficient=positives>=30&&unknown>=15;
 const measured={recallAt1:positives?top1/positives:null,
   recallAt3:positives?top3/positives:null,
   unknownCandidateRate:unknown?falseCandidate/unknown:null};
 return Object.freeze({version:VERSION,mode:'UNVERIFIED_EXTERNAL_RECEIPT_ANALYSIS',
   tenantId:corpus.tenantId,storeId:corpus.storeId,
   totalCases:cases.length,positiveCases:positives,unknownCases:unknown,
   ...measured,crossStoreOrUnknownSkuViolations:leaks,
   claimedProviderCostUsd:Number(totalClaimedCostUsd.toFixed(6)),
   meanClaimedLatencyMs:Number((totalClaimedLatencyMs/cases.length).toFixed(1)),
   proposedMinimumSampleSatisfied:sampleSufficient,
   providerReceiptsIndependentlyVerified:false,
   labelsIndependentlyVerified:false,realMerchantPhotosCertified:false,
   actualVisionCallsMadeByThisModule:0,meetsRealVisionReleaseGate:false,
   canAutoSelectSku:false,requiresCustomerSkuSelection:true,
   requiresFinalOrderConfirmation:true,hostedWrites:0,providerSends:0,
   details:Object.freeze(rows)});
}
module.exports=Object.freeze({VERSION,evaluateReceipts});
