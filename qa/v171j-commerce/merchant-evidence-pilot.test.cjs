'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {prepareMerchantEvidence,buildBoundedPilotQuote,evaluateClaimedPilotReceipts}=require('./merchant-evidence-pilot.cjs');
const now=1794873600000;
const scope={tenantId:'T_QA_01',storeId:'S_QA_A'};
const host='images.shop-example.vn';
const img='https://images.shop-example.vn/assets/a-001.png';
const product=(sku='QA_F_001',itemId='P_A_001',storeId=scope.storeId)=>({...scope,storeId,sku,itemId,active:true});
const media=(extra={})=>({...scope,catalogRevision:2,mediaId:'IMG_A_001',
  sku:'QA_F_001',itemId:'P_A_001',imageSha256:'a'.repeat(64),
  sourceType:'PRODUCTS_IMAGE_URL',imageUrl:img,licenseEvidenceRef:'LICENSE_A_1',
  merchantConsentRef:'CONSENT_A_1',domainOwnershipEvidenceRef:'DOMAIN_A_1',
  licenseBasis:'MERCHANT_ORIGINAL',commercialUseConsent:true,
  privacyReviewed:true,allowAIProductMatching:true,
  consentAtMs:now-5000,retentionUntilMs:now+200000,...extra});
const dossier=(options={})=>prepareMerchantEvidence({
  ...scope,catalogRevision:2,products:[product()],mediaRows:[media()],
  allowedImageHosts:[host],nowMs:now,...options});
const cases=()=>[
  {...scope,caseId:'CASE_001',imageSha256:'b'.repeat(64),
    expectedSku:'QA_F_001',humanLabelReviewerRef:'HUMAN_001',blindSplit:'HOLDOUT'},
  {...scope,caseId:'CASE_002',imageSha256:'c'.repeat(64),
    expectedSku:null,humanLabelReviewerRef:'HUMAN_002',blindSplit:'HOLDOUT'}];
const plan=(options={})=>buildBoundedPilotQuote({
  dossier:dossier(),queryCases:cases(),provider:'TEST_VENDOR',
  model:'VISION_CANDIDATE_1',proposedMaxCalls:2,
  proposedPerCallMicroUsd:300,proposedTotalMicroUsd:1000,...options});
const receipts=(p)=>p.cases.map((c,i)=>({...scope,caseId:c.caseId,
  imageSha256:c.imageSha256,providerRequestId:'REQUEST_'+i,
  provider:p.provider,model:p.model,claimedMicroUsd:150,
  candidates:c.expectedSku?[c.expectedSku]:[]}));
test('01 binds image to exact Store/SKU and catalog revision',()=>{
 const d=dossier();assert.equal(d.media[0].sku,'QA_F_001');assert.equal(d.catalogRevision,2);
});
test('02 retains no image bytes, credentials, raw URL or customer PII',()=>{
 const s=JSON.stringify(dossier());assert.equal(s.includes(img),false);
 assert.equal(s.includes('imageBytes'),false);assert.equal(s.includes('credential'),false);
});
test('03 image URL is represented as SHA256 digest',()=>assert.match(dossier().media[0].imageUrlSha256,/^[a-f0-9]{64}$/));
test('04 independently verified rights stay false despite declaration',()=>assert.equal(dossier().independentMerchantRightsVerified,false));
test('05 original merchant ownership stays unverified',()=>assert.equal(dossier().independentStoreOwnershipVerified,false));
test('06 dossier does not authorize model or provider send',()=>{
 const d=dossier();assert.equal(d.readyForRealVisionPilot,false);assert.equal(d.providerSends,0);
});
test('07 wrong tenant denied',()=>assert.throws(()=>dossier({mediaRows:[media({tenantId:'T_OTHER'})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('08 wrong Store denied',()=>assert.throws(()=>dossier({mediaRows:[media({storeId:'S_QA_B'})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('09 SKU absent from trusted catalogue denied',()=>assert.throws(()=>dossier({mediaRows:[media({sku:'QA_F_999'})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('10 wrong product mapped to SKU denied',()=>assert.throws(()=>dossier({mediaRows:[media({itemId:'P_OTHER'})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('11 duplicate image SHA denied',()=>assert.throws(()=>dossier({mediaRows:[media(),media({mediaId:'IMG_A_002'})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('12 duplicate media ID denied',()=>assert.throws(()=>dossier({mediaRows:[media(),media({imageSha256:'d'.repeat(64)})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('13 missing commercial consent denied',()=>assert.throws(()=>dossier({mediaRows:[media({commercialUseConsent:false})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('14 no AI-use consent denied',()=>assert.throws(()=>dossier({mediaRows:[media({allowAIProductMatching:false})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('15 no privacy review denied',()=>assert.throws(()=>dossier({mediaRows:[media({privacyReviewed:false})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('16 missing license evidence ref denied',()=>assert.throws(()=>dossier({mediaRows:[media({licenseEvidenceRef:''})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('17 expired retention denied',()=>assert.throws(()=>dossier({mediaRows:[media({retentionUntilMs:now-1})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('18 more than 365 days retention denied',()=>assert.throws(()=>dossier({mediaRows:[media({retentionUntilMs:now+366*86400000})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('19 URL token or query denied',()=>assert.throws(()=>dossier({mediaRows:[media({imageUrl:img+'?token=private'})]}),/MEDIA_URL_SCOPE_OR_TOKEN_DENIED/));
test('20 unapproved host denied',()=>assert.throws(()=>dossier({mediaRows:[media({imageUrl:'https://other.example/a.png'})]}),/MEDIA_URL_SCOPE_OR_TOKEN_DENIED/));
test('21 raw image bytes in manifest denied',()=>assert.throws(()=>dossier({mediaRows:[media({imageBytes:Buffer.from('x')})]}),/EVIDENCE_OWNER_RIGHTS_MEDIA_ROW_INVALID/));
test('22 direct upload accepts only local source and no URL',()=>{
 const row=media({sourceType:'OWNER_DIRECT_UPLOAD'});delete row.imageUrl;
 const d=dossier({mediaRows:[row]});assert.equal(d.media[0].imageUrlSha256,null);
});
test('23 claimed direct upload URL denied',()=>assert.throws(()=>dossier({mediaRows:[media({sourceType:'OWNER_DIRECT_UPLOAD'})]}),/EVIDENCE_DIRECT_UPLOAD_MUST_NOT_CLAIM_URL/));
test('24 bounded pilot quote produces integer worst-case',()=>assert.equal(plan().proposedWorstCaseMicroUsd,600));
test('25 pilot quote cannot invoke real model or claim approval',()=>{
 const p=plan({humanBudgetApprovalRef:'APPROVED_FAKE'});assert.equal(p.canInvokeRealModel,false);
 assert.equal(p.humanApprovalIndependentlyVerified,false);assert.equal(p.paidUsdObserved,null);
});
test('26 proposed sample size insufficient for real model gate',()=>assert.equal(plan().proposedSampleMinimumMet,false));
test('27 max call count smaller than inputs denied',()=>assert.throws(()=>plan({proposedMaxCalls:1}),/PILOT_QUOTE_SCOPE_OR_CAP_INVALID/));
test('28 worst-case quote above cap denied',()=>assert.throws(()=>plan({proposedTotalMicroUsd:599}),/PILOT_QUOTE_WORST_CASE_EXCEEDS_PROPOSED_CAP/));
test('29 free quoted rate is still invalid without verified rate',()=>assert.throws(()=>plan({proposedPerCallMicroUsd:0}),/PILOT_QUOTE_SCOPE_OR_CAP_INVALID/));
test('30 float cost cap denied',()=>assert.throws(()=>plan({proposedTotalMicroUsd:1000.50}),/PILOT_QUOTE_SCOPE_OR_CAP_INVALID/));
test('31 holdout query SHA matching training photo denied',()=>{
 const q=cases();q[0].imageSha256='a'.repeat(64);
 assert.throws(()=>plan({queryCases:q}),/PILOT_BLIND_LABEL_OR_STORE_LEAKAGE_DENIED/);
});
test('32 duplicate holdout query hashes denied',()=>{
 const q=cases();q[1].imageSha256=q[0].imageSha256;
 assert.throws(()=>plan({queryCases:q}),/PILOT_BLIND_LABEL_OR_STORE_LEAKAGE_DENIED/);
});
test('33 same-Store known and unknown labels preserved',()=>{
 const p=plan();assert.equal(p.knownCount,1);assert.equal(p.unknownCount,1);
});
test('34 unverified receipt metrics cannot certify model accuracy',()=>{
 const d=dossier(),p=plan({dossier:d});
 const out=evaluateClaimedPilotReceipts({dossier:d,quote:p,receipts:receipts(p)});
 assert.equal(out.recallAt1,1);assert.equal(out.unknownCandidateRate,0);
 assert.equal(out.eligibleForLiveUat,false);assert.equal(out.actualProviderBillingVerified,false);
});
test('35 out-of-store model SKU candidate counted',()=>{
 const d=dossier(),p=plan({dossier:d}),rows=receipts(p);
 rows[0].candidates=['QA_F_999'];
 const out=evaluateClaimedPilotReceipts({dossier:d,quote:p,receipts:rows});
 assert.equal(out.crossStoreOrInvalidSkuCandidateCount,1);
});
test('36 unknown image hallucination counted',()=>{
 const d=dossier(),p=plan({dossier:d}),rows=receipts(p);
 rows[1].candidates=['QA_F_001'];
 const out=evaluateClaimedPilotReceipts({dossier:d,quote:p,receipts:rows});
 assert.equal(out.unknownCandidateRate,1);
});
test('37 wrong Store receipt rejected',()=>{
 const d=dossier(),p=plan({dossier:d}),rows=receipts(p);
 rows[1].storeId='S_QA_B';
 assert.throws(()=>evaluateClaimedPilotReceipts({dossier:d,quote:p,receipts:rows}),/PILOT_PROVIDER_RECEIPT_INVALID/);
});
test('38 wrong photo SHA receipt rejected',()=>{
 const d=dossier(),p=plan({dossier:d}),rows=receipts(p);
 rows[1].imageSha256='d'.repeat(64);
 assert.throws(()=>evaluateClaimedPilotReceipts({dossier:d,quote:p,receipts:rows}),/PILOT_PROVIDER_RECEIPT_INVALID/);
});
test('39 duplicate provider request id rejected',()=>{
 const d=dossier(),p=plan({dossier:d}),rows=receipts(p);
 rows[1].providerRequestId=rows[0].providerRequestId;
 assert.throws(()=>evaluateClaimedPilotReceipts({dossier:d,quote:p,receipts:rows}),/PILOT_PROVIDER_RECEIPT_INVALID/);
});
test('40 actual vendor model calls made by this module always zero',()=>{
 const d=dossier(),p=plan({dossier:d});
 const out=evaluateClaimedPilotReceipts({dossier:d,quote:p,receipts:receipts(p)});
 assert.equal(out.realProviderCallsMadeHere,0);
});
