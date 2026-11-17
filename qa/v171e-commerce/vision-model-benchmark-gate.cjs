'use strict';
/**
 * V17.1E Vision benchmark contract: evaluate independently supplied labels
 * and outputs in-memory. Never calls a real provider or reads image bytes.
 * All metrics are scoped to synthetic fixtures until verified original model
 * receipts and licensed merchant photos are audited outside GitHub.
 */
const CONTRACT='T404_V171E_VISION_BENCHMARK_AND_COST_GATE_V1';
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(x);
const refuse=x=>{throw Error(x)};
function evaluate({tenantId,storeId,knownItems=[],cases=[],predictions=[],topK=3}={}){
 if(!id(tenantId)||!id(storeId)||!Array.isArray(knownItems)||
  !Array.isArray(cases)||!Array.isArray(predictions)||
  cases.length===0||cases.length>500||cases.length!==predictions.length||
  !Number.isSafeInteger(topK)||topK<1||topK>5)
   refuse('BENCHMARK_SCOPE_OR_CASE_COUNT_INVALID');
 const index=new Map(),labels=new Map(),results=new Map(),issues=[];
 for(const p of knownItems){
  if(!obj(p)||!id(p.itemId)||!id(p.sku)||p.storeId!==storeId||
    p.tenantId!==tenantId||index.has(p.itemId))
   refuse('BENCHMARK_KNOWN_ITEM_SCOPE_INVALID');
  index.set(p.itemId,p);
 }
 for(const c of cases){
  if(!obj(c)||!id(c.caseId)||c.tenantId!==tenantId||
    c.storeId!==storeId||labels.has(c.caseId)||
    !(c.expectedItemId===null||index.has(c.expectedItemId))||
    !['positive','unknown','hard_negative'].includes(c.labelType)||
    (c.labelType==='positive')!==(c.expectedItemId!==null))
   refuse('BENCHMARK_LABEL_SCOPE_INVALID');
  labels.set(c.caseId,c);
 }
 for(const r of predictions){
  if(!obj(r)||!id(r.caseId)||results.has(r.caseId)||
    !Array.isArray(r.candidates)||r.candidates.length>5||
    !Number.isFinite(r.latencyMs)||r.latencyMs<0||r.latencyMs>60000||
    !Number.isSafeInteger(r.costMicroUsd)||r.costMicroUsd<0)
   refuse('BENCHMARK_MODEL_OUTPUT_FORMAT_INVALID');
  const used=new Set();
  for(const p of r.candidates){
   if(!obj(p)||!id(p.itemId)||used.has(p.itemId)||
    !id(p.sku)||p.tenantId!==tenantId||p.storeId!==storeId||
    !index.has(p.itemId)||index.get(p.itemId).sku!==p.sku||
    typeof p.score!=='number'||!Number.isFinite(p.score)||
    p.score<0||p.score>1)
    issues.push('UNTRUSTED_OR_CROSS_STORE_MODEL_CANDIDATE');
   if(p&&id(p.itemId))used.add(p.itemId);
  }
  results.set(r.caseId,r);
 }
 let positives=0,negatives=0,hard=0,hit1=0,hitK=0,falsePositive=0,
  latency=[],costMicroUsd=0;
 for(const [caseId,c] of labels){
  const r=results.get(caseId);
  if(!r){issues.push('MISSING_PREDICTION');continue;}
  if(c.expectedItemId===null){
    negatives++;if(c.labelType==='hard_negative')hard++;
    if(r.candidates.length>0)falsePositive++;
  }else{
    positives++;
    if(r.candidates[0]?.itemId===c.expectedItemId)hit1++;
    if(r.candidates.slice(0,topK).some(x=>x.itemId===c.expectedItemId))hitK++;
  }
  latency.push(r.latencyMs);costMicroUsd+=r.costMicroUsd;
 }
 if(positives===0||negatives===0||hard===0)issues.push('INSUFFICIENT_BENCHMARK_CASE_TYPES');
 if(!Number.isSafeInteger(costMicroUsd))issues.push('COST_SUM_OVERFLOW');
 const sorted=latency.sort((a,b)=>a-b);
 const percentile=q=>sorted.length?sorted[Math.ceil(q*sorted.length)-1]:null;
 return Object.freeze({contract:CONTRACT,mode:'EXTERNAL_OUTPUTS_EVALUATED_OFFLINE',
  status:issues.length?'INVALID_OR_UNSAFE_PREDICTIONS':'METRICS_ONLY_NOT_REAL_MODEL_ATTESTATION',
  issues:[...new Set(issues)],total:cases.length,positives,negatives,hardNegatives:hard,
  recallAt1:positives?hit1/positives:null,recallAtK:positives?hitK/positives:null,
  falsePositiveRate:negatives?falsePositive/negatives:null,
  latencyP50Ms:percentile(0.5),latencyP95Ms:percentile(0.95),
  claimedCostMicroUsd:costMicroUsd,
  actualPaidModelCallsMadeHere:0,originalModelReceiptVerifiedHere:false,
  actualMerchantPhotosVerifiedHere:false,modelAccuracyCertified:false,
  providerSends:0,hostedWrites:0,canUseForCommercialDecisions:false});
}
function planPaidPilot({exactApprovedCaseCount=0,estimatedMaxMicroUsdPerCase=0,
 approvedBudgetMicroUsd=0,balanceMicroUsd=null,
 primaryMerchantRightsEvidence=false,independentSecurityAttestation=false,
 providerBillingAccountAttestation=false,authorizedOneAction=false,
 actualModelVersion=null,privateMediaScopeVerified=false}={}){
 const problems=[];
 if(!Number.isSafeInteger(exactApprovedCaseCount)||exactApprovedCaseCount<1||
  exactApprovedCaseCount>100)problems.push('BOUNDED_CASES_NOT_APPROVED');
 if(!Number.isSafeInteger(estimatedMaxMicroUsdPerCase)||
  estimatedMaxMicroUsdPerCase<1)problems.push('PROVIDER_CASE_PRICE_NOT_VERIFIED');
 if(!Number.isSafeInteger(approvedBudgetMicroUsd)||approvedBudgetMicroUsd<1||
  !Number.isSafeInteger(balanceMicroUsd)||balanceMicroUsd<1)
  problems.push('BUDGET_OR_REAL_BALANCE_NOT_ATTESTED');
 const upper=exactApprovedCaseCount*estimatedMaxMicroUsdPerCase;
 if(!Number.isSafeInteger(upper)||upper>approvedBudgetMicroUsd||
    (Number.isSafeInteger(balanceMicroUsd)&&upper>balanceMicroUsd))
  problems.push('MAX_ESTIMATED_SPEND_EXCEEDS_REPORTED_BUDGET_OR_BALANCE');
 if(!primaryMerchantRightsEvidence)problems.push('MERCHANT_RIGHTS_UNVERIFIED');
 if(!independentSecurityAttestation)problems.push('SECURITY_REVIEW_MISSING');
 if(!providerBillingAccountAttestation)problems.push('PROVIDER_BILLING_SCOPE_UNVERIFIED');
 if(!authorizedOneAction)problems.push('EXACT_ONE_ACTION_CONSENT_MISSING');
 if(!id(actualModelVersion))problems.push('MODEL_VERSION_UNVERIFIED');
 if(!privateMediaScopeVerified)problems.push('IMAGE_SCOPE_UNVERIFIED');
 return Object.freeze({contract:CONTRACT,
  status:problems.length?'PAID_VISION_NO_GO':
    'CLAIMED_BUDGET_PACKET_REQUIRES_PRIVATE_INDEPENDENT_APPROVAL',
  issues:problems,claimedMaximumMicroUsd:upper,
  actualBalanceCheckedByThisModule:false,realProviderPriceConfirmedHere:false,
  canInvokePaidModel:false,canRetry:false,canSendImagesToVendor:false,
  paidModelCalls:0,providerSends:0,hostedWrites:0});
}
function invokePaidVision(){refuse('V171E_REAL_PAID_VISION_NEEDS_SEPARATE_APPROVED_SERVER_ADAPTER');}
module.exports=Object.freeze({CONTRACT,evaluate,planPaidPilot,invokePaidVision});
