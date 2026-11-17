'use strict';
/* V17.1K source-only ONE_SHOT quote: cannot spend, cannot retry,
 * cannot independently validate provider billing or owner approval.
 */
const VERSION='T404_V171K_ONE_SHOT_PILOT_QUOTE_ONLY_V1';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(x);
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const deny=s=>{throw Error(s)};
function proposeOneShot({quarantine,storageReceipt,proposal,budget,nowMs}={}){
 if(!obj(quarantine)||quarantine.mode!=='STAFF_LOCAL_QUARANTINE_ONLY'||
    !obj(storageReceipt)||storageReceipt.tenantId!==quarantine.tenantId||
    storageReceipt.storeId!==quarantine.storeId||
    storageReceipt.itemId!==quarantine.itemId||
    storageReceipt.sku!==quarantine.sku||
    storageReceipt.sha256!==quarantine.imageSha256||
    storageReceipt.status!=='PRIVATE_QA_ONLY'||
    !id(storageReceipt.evidenceRef))
    deny('ONESHOT_STORE_STORAGE_PROOF_MISSING');
 if(!obj(proposal)||!id(proposal.provider)||!id(proposal.model)||
    !id(proposal.caseId)||!id(proposal.nonce)||
    !Number.isSafeInteger(nowMs)||nowMs<=0)
    deny('ONESHOT_PROPOSAL_INVALID');
 if(!obj(budget)||budget.origin!=='HUMAN_QUOTE_UNVERIFIED'||budget.maxCalls!==1||
    budget.retryAllowed!==false||budget.tenantId!==quarantine.tenantId||
    budget.storeId!==quarantine.storeId||
    budget.provider!==proposal.provider||budget.model!==proposal.model||
    !id(budget.approvalRef)||!id(budget.pricingEvidenceRef)||
    !Number.isSafeInteger(budget.expiresAtMs)||budget.expiresAtMs<=nowMs||
    budget.expiresAtMs>nowMs+3600000||
    !Number.isSafeInteger(budget.maxMicroUsd)||budget.maxMicroUsd<1||
    budget.maxMicroUsd>1000000||
    !Number.isSafeInteger(budget.perCallUpperBoundMicroUsd)||
    budget.perCallUpperBoundMicroUsd<1||
    budget.perCallUpperBoundMicroUsd>budget.maxMicroUsd)
    deny('ONESHOT_UNAPPROVED_OR_OVER_BUDGET');
 return Object.freeze({version:VERSION,mode:'PROPOSED_SINGLE_INFERENCE_NO_CALL',
   tenantId:quarantine.tenantId,storeId:quarantine.storeId,
   sku:quarantine.sku,itemId:quarantine.itemId,
   imageSha256:quarantine.imageSha256,
   provider:proposal.provider,model:proposal.model,
   maxCalls:1,retryAllowed:false,
   maxMicroUsd:budget.maxMicroUsd,
   assumedPerCallMicroUsd:budget.perCallUpperBoundMicroUsd,
   verifiedProviderPrice:false,verifiedProviderBalance:false,
   independentOwnerApprovalVerified:false,atomicSpendLedgerPresent:false,
   productionMediaPermissionVerified:false,realModelEligible:false,
   actualVisionCalls:0,actualBilledUsd:null,
   providerSends:0,hostedWrites:0,
   requiresServerSideAtomicBudgetEnforcement:true,
   requiresCustomerSkuSelection:true,requiresFinalOrderConfirmation:true});
}
module.exports=Object.freeze({VERSION,proposeOneShot});