'use strict';
/**
 * V15.2 ADV.5C — STRICTLY read-only synthetic Merchant UAT receipt review.
 *
 * This module does not issue real attestation or any production/staging GO.
 * A merchant's self-reported results, an arbitrary "reviewer" object,
 * or external claims cannot become Owner approval, JWT/RLS certification,
 * provider entitlement, or Commerce authorization.
 */
const crypto=require('node:crypto');
const {CASES,STATUS,VERSION}=require('./advanced-merchant-uat.js');
const CONTRACT='T404_ADV5C_REVIEW_GATE_NO_SEND_V1';
const RELEASE_DECISION='NO_GO_HOSTED_OR_PRODUCTION';
const GATES=Object.freeze([
 Object.freeze({id:'P0_RPC_DEFINER',priority:'P0',status:'BLOCKED',evidence:'READ_ONLY_SUPABASE',
  finding:'public.qa_shop_b_zalo_claim SECURITY DEFINER executable by anon; review of function and grants required',
  requirement:'Independent security review of function logic and authorized least-privilege remediation; verify with read-only GRANT tests'}),
 Object.freeze({id:'P0_HOSTED_STORE_JWT_RLS',priority:'P0',status:'BLOCKED',evidence:'READ_ONLY_SUPABASE',
  finding:'public orders/products/order_items lack store_id; no public stores/store_memberships',
  requirement:'Approved Store schema, signed hosted JWT tests for Shop A/B same tenant and cross tenant; deny negative cases'}),
 Object.freeze({id:'P0_OWNER_AND_CONSENT',priority:'P0',status:'BLOCKED',evidence:'PARTIAL_QA_BINDINGS_NOT_AUTHORITY',
  finding:'QA owner_bindings and pairing claims exist but no independent G2.3 merchant ownership attestation verified',
  requirement:'Independent verified Owner authorization, scope, channel consent, reviewer separation and private signed evidence'}),
 Object.freeze({id:'P0_SECURE_ACTION_GATEWAY',priority:'P0',status:'BLOCKED',evidence:'SYNTHETIC_QA_ONLY',
  finding:'ADV3 synthetic signature and one-time in-memory nonce do not constitute live gateway',
  requirement:'Verified ingress identity, server-side authorization and durable atomic replay/idempotency with explicit confirmation'}),
 Object.freeze({id:'P0_PRIVATE_ORDER_CONTINUITY',priority:'P0',status:'BLOCKED',evidence:'SYNTHETIC_QA_ONLY',
  finding:'Messenger DEMO not migrated to Store-isolated Commerce backend; no live Messenger-Zalo order continuity proof',
  requirement:'Approved isolated Commerce lookup/store ownership; permission and replay negative E2E'}),
 Object.freeze({id:'P1_PROVIDER_ENTITLEMENTS',priority:'P1',status:'NOT_TESTED',evidence:'SOURCE_PREVIEW_ONLY',
  finding:'13-component capability crosswalk describes UX, not Meta/Zalo account-native entitlement',
  requirement:'Per-channel entitlement verification, media allowlist, ZBS spend + template approval'}),
 Object.freeze({id:'P1_MODEL_PRESENTATION',priority:'P1',status:'NOT_TESTED',evidence:'SYNTHETIC_HEURISTIC',
  finding:'ADV.5B did not execute a real LLM presentation benchmark',
  requirement:'Actual model quality, JSON strictness, per-shop isolation, p50/p95 latency and metered spend'}),
 Object.freeze({id:'P1_INDEPENDENT_MERCHANT_UAT',priority:'P1',status:'NOT_VERIFIED',evidence:'SELF_REPORT_16_OF_16',
  finding:'One earlier self-report states 16/16 PASS with 16 blank observations; ADV5B mobile cards have not been independently accepted',
  requirement:'Independent reviewer identity verified out-of-band; fresh mobile-card observation and recorded decision'}),
 Object.freeze({id:'P1_BACKUP_RECOVERY',priority:'P1',status:'BLOCKED',evidence:'NO_APPROVED_RECOVERY_PROOF',
  finding:'No independently confirmed hosted backup/restore evidence or one-time operator authorization',
  requirement:'Approved encrypted backup, restore rehearsal and rollback evidence; never infer approval from checkbox'}),
 Object.freeze({id:'P1_HOSTING_COST_RELEASE',priority:'P1',status:'BLOCKED',evidence:'NO_BILLING_SCOPE',
  finding:'Cloudflare Billing Read scope unavailable at previous audit; no new public deployment was authorized',
  requirement:'Confirm account cost/usage limits and get separate release authorization for public staging'})
]);
const forbiddenKeys=/^(?:authorization|password|secret|token|privateKey|service_role|phone|email|access_token)$/i;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const shape=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>own(x,k));
const safeText=x=>typeof x==='string'&&x.length<=280&&!/[\u0000-\u001f\u007f]/.test(x);
const validIso=t=>typeof t==='string'&&t.length<45&&!Number.isNaN(Date.parse(t))&&new Date(t).toISOString()===t;
function reject(reason){return Object.freeze({status:'REJECTED',reason,reviewAccepted:false,
 ownerVerified:false,independentlyAccepted:false,releaseAuthorized:false,
 hostedReadPerformed:false,providerSendPerformed:false});}
function assessSelfReport(raw){
 if(!shape(raw,['contract','kind','sessionLabel','generatedAt','scope','source',
    'canonicalRegistryReleaseCandidate','cases','counts','claims','technicalPreview']))
  return reject('REPORT_STRUCTURE_INVALID');
 if(raw.contract!==VERSION||raw.kind!=='MERCHANT_SELF_REPORTED_NOT_VERIFIED'||
  raw.scope!=='PUBLIC_SYNTHETIC_QA_ONLY'||
  raw.source!=='HUMAN_SELF_ASSESSMENT_INPUT_NOT_AUTOMATED_CI'||
  raw.canonicalRegistryReleaseCandidate!=='T404_ADV5_CANONICAL_RC1_NO_SEND'||
  raw.sessionLabel!=='LOCAL_SYNTHETIC_UAT'||!validIso(raw.generatedAt))
   return reject('REPORT_CONTRACT_OR_PROVENANCE_INVALID');
 if(!Array.isArray(raw.cases)||raw.cases.length!==CASES.length)return reject('CASE_COUNT_INVALID');
 const expected=CASES.map(c=>c.id);
 const ids=new Set(),tally=Object.fromEntries(STATUS.map(s=>[s,0]));
 for(const entry of raw.cases){
  if(!shape(entry,['caseId','scope','result','observation'])||
    typeof entry.caseId!=='string'||ids.has(entry.caseId)||
    !expected.includes(entry.caseId)||!STATUS.includes(entry.result)||
    !safeText(entry.observation))
    return reject('CASE_SCHEMA_DUPLICATE_OR_STATUS_INVALID');
  const source=CASES.find(c=>c.id===entry.caseId);
  if(entry.scope!==source.scope)return reject('CASE_SCOPE_MISMATCH');
  ids.add(entry.caseId);tally[entry.result]++;
 }
 if(expected.some(id=>!ids.has(id)))return reject('MISSING_EXPECTED_CASE');
 if(!shape(raw.counts,STATUS)||STATUS.some(s=>raw.counts[s]!==tally[s]))
   return reject('COUNTS_MISMATCH');
 const claims=raw.claims;
 if(!shape(claims,['merchantIdentityIndependentlyVerified','platformReviewCompleted',
  'merchantUatApproved','productionReady','noProviderSendAuthorized',
  'noOrderWritesAuthorized','releaseAuthorized'])||
  claims.merchantIdentityIndependentlyVerified!==false||
  claims.platformReviewCompleted!==false||claims.merchantUatApproved!==false||
  claims.productionReady!==false||claims.releaseAuthorized!==false||
  claims.noProviderSendAuthorized!==true||claims.noOrderWritesAuthorized!==true)
   return reject('UNAUTHORIZED_RELEASE_OR_IDENTITY_CLAIMS');
 const tech=raw.technicalPreview;
 if(!shape(tech,['renderCount','canSend','canWriteOrders','realModelCalls','hostedReads','sourceOnly'])||
  !Number.isSafeInteger(tech.renderCount)||tech.renderCount<0||
  tech.canSend!==false||tech.canWriteOrders!==false||
  tech.realModelCalls!==0||tech.hostedReads!==0||tech.sourceOnly!==true)
   return reject('TECHNICAL_PREVIEW_CONTRACT_INVALID');
 const content=JSON.stringify({contract:raw.contract,generatedAt:raw.generatedAt,
   cases:raw.cases.map(x=>[x.caseId,x.scope,x.result,crypto.createHash('sha256').update(x.observation).digest('hex')]),
   counts:tally});
 const digest=crypto.createHash('sha256').update(content).digest('hex');
 const allPass=tally.PASS===CASES.length;
 return Object.freeze({status:'SELF_REPORT_RECEIVED',
  reviewAccepted:true,complete:allPass,results:Object.freeze({...tally}),
  observationsProvided:raw.cases.filter(x=>x.observation.length>0).length,
  reportedRenderCount:tech.renderCount,reportDigest:digest,
  generatedAt:raw.generatedAt,kind:raw.kind,
  independentMerchantUatAccepted:false,ownerVerified:false,releaseAuthorized:false,
  proofLevel:'UNTRUSTED_HUMAN_SELF_REPORT',hostingOrProviderTested:false,
  hostedReadPerformed:false,providerSendPerformed:false});
}
/** An external self-asserted reviewer/attestation is NOT a trusted signer. */
function assessIndependentReview({selfReport,reviewerSubmission}={}){
 const receipt=assessSelfReport(selfReport);
 if(receipt.status!=='SELF_REPORT_RECEIVED')
  return Object.freeze({contract:CONTRACT,reviewStatus:'REJECTED_UNTRUSTED_REPORT',
   receipt,independentAttestationAccepted:false,releaseAuthorized:false});
 if(reviewerSubmission!==undefined){
  if(!plain(reviewerSubmission)||Object.keys(reviewerSubmission).some(k=>forbiddenKeys.test(k)))
   return Object.freeze({contract:CONTRACT,reviewStatus:'REJECTED_REVIEWER_PAYLOAD',
    receipt,independentAttestationAccepted:false,releaseAuthorized:false});
 }
 return Object.freeze({contract:CONTRACT,reviewStatus:'PENDING_VERIFIED_INDEPENDENT_REVIEW',
  receipt,independentAttestationAccepted:false,merchantOwnerG23Verified:false,
  requiredProofs:Object.freeze([
   'OUT_OF_BAND_REVIEWER_IDENTITY',
   'ACTUAL_MERCHANT_CONSENT_AND_STORE_SCOPE',
   'FRESH_ADV5B_MOBILE_UAT_EVIDENCE',
   'INDEPENDENT_REVIEWER_DECISION_RECEIPT']),
  reviewerSelfClaimsIgnored:reviewerSubmission!==undefined,
  releaseAuthorized:false,liveSendAuthorized:false,commerceWriteAuthorized:false});
}
function decideRelease({selfReport,reviewerSubmission,claims}={}){
 const review=assessIndependentReview({selfReport,reviewerSubmission});
 // Arbitrary claims, including {allGatesPassed:true}, NEVER grant authority.
 const claimKeys=plain(claims)?Object.keys(claims).filter(k=>forbiddenKeys.test(k)):[];
 const gates=Object.freeze(GATES.map(g=>Object.freeze({...g})));
 const blockers=gates.filter(g=>g.status!=='VERIFIED').length;
 return Object.freeze({contract:CONTRACT,lifecycle:'CANDIDATE',
  mode:'SOURCE_ONLY_NO_SEND',review,
  releaseDecision:RELEASE_DECISION,
  productionReleaseAuthorized:false,publicStagingReleaseAuthorized:false,
  pendingIndependentMerchantReview:true,blockingGates:blockers,gates,
  prohibitedClaimFieldsPresent:claimKeys.length>0,
  syntheticOnly:true,hostedWrites:0,providerSends:0,paidModelCalls:0,paidSpendVnd:0});
}
module.exports=Object.freeze({CONTRACT,RELEASE_DECISION,GATES,assessSelfReport,
 assessIndependentReview,decideRelease});
