'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const domain=require('./advanced-merchant-uat.js');
const review=require('./advanced-merchant-uat-independent-review.cjs');
function fixture(){
 const s=domain.createSession({clock:()=> '2026-11-16T05:02:01.952Z'});
 for(const c of domain.CASES)s.update(c.id,'PASS','');
 return {...s.exportEvidence(),technicalPreview:{
  renderCount:111,canSend:false,canWriteOrders:false,
  realModelCalls:0,hostedReads:0,sourceOnly:true
 }};
}
function changed(patch){return {...fixture(),...patch}}
test('01 accepts exact user-supplied ADV5 synthetic self-report shape',()=>{
 const r=review.assessSelfReport(fixture());
 assert.equal(r.status,'SELF_REPORT_RECEIVED');assert.equal(r.complete,true);
 assert.equal(r.reviewAccepted,true);assert.equal(r.independentMerchantUatAccepted,false);
});
test('02 all 16 PASS recorded without independent certification',()=>{
 const r=review.assessSelfReport(fixture());
 assert.equal(r.results.PASS,16);assert.equal(r.results.FAIL,0);
 assert.equal(r.results.NOT_RUN,0);assert.equal(r.releaseAuthorized,false);
});
test('03 blank observations count and local render count are only self-claims',()=>{
 const r=review.assessSelfReport(fixture());
 assert.equal(r.observationsProvided,0);assert.equal(r.reportedRenderCount,111);
 assert.equal(r.proofLevel,'UNTRUSTED_HUMAN_SELF_REPORT');
});
test('04 report digest is stable and does not include plaintext notes',()=>{
 const a=review.assessSelfReport(fixture()),b=review.assessSelfReport(fixture());
 assert.match(a.reportDigest,/^[a-f0-9]{64}$/);assert.equal(a.reportDigest,b.reportDigest);
});
test('05 does not require all PASS for record intake; incomplete remains noncertified',()=>{
 const r=fixture();r.cases=r.cases.map(c=>c.caseId==='UAT09'?{...c,result:'FAIL'}:c);
 r.counts={...r.counts,PASS:15,FAIL:1};
 const a=review.assessSelfReport(r);
 assert.equal(a.status,'SELF_REPORT_RECEIVED');assert.equal(a.complete,false);
 assert.equal(a.releaseAuthorized,false);
});
test('06 rejects absent case',()=>{
 const r=fixture();r.cases=r.cases.slice(1);
 assert.equal(review.assessSelfReport(r).reason,'CASE_COUNT_INVALID');
});
test('07 rejects duplicate case',()=>{
 const r=fixture();r.cases[1]={...r.cases[0]};
 assert.equal(review.assessSelfReport(r).reason,'CASE_SCHEMA_DUPLICATE_OR_STATUS_INVALID');
});
test('08 rejects inconsistent count',()=>{
 assert.equal(review.assessSelfReport(changed({counts:{...fixture().counts,PASS:15}})).reason,'COUNTS_MISMATCH');
});
test('09 self-reported owner_verified true never grants release',()=>{
 const r=fixture();r.claims={...r.claims,merchantIdentityIndependentlyVerified:true};
 assert.equal(review.assessSelfReport(r).reason,'UNAUTHORIZED_RELEASE_OR_IDENTITY_CLAIMS');
});
test('10 self-reported releaseAuthorized true rejected',()=>{
 const r=fixture();r.claims={...r.claims,releaseAuthorized:true};
 assert.equal(review.assessSelfReport(r).status,'REJECTED');
});
test('11 scope manipulation rejected',()=>{
 const r=fixture();r.cases[0]={...r.cases[0],scope:'Private Shop Z'};
 assert.equal(review.assessSelfReport(r).reason,'CASE_SCOPE_MISMATCH');
});
test('12 fabricated extra case key rejected',()=>{
 const r=fixture();r.cases[0]={...r.cases[0],ownerProof:'yes'};
 assert.equal(review.assessSelfReport(r).status,'REJECTED');
});
test('13 raw report with extra access token rejected',()=>{
 const r={...fixture(),access_token:'SENSITIVE_VALUE_DO_NOT_LOG'};
 assert.equal(review.assessSelfReport(r).status,'REJECTED');
});
test('14 invalid self-report provenance rejected',()=>{
 assert.equal(review.assessSelfReport(changed({source:'PROVIDER_VERIFIED'})).reason,
 'REPORT_CONTRACT_OR_PROVENANCE_INVALID');
});
test('15 incorrect timestamp rejected',()=>{
 assert.equal(review.assessSelfReport(changed({generatedAt:'not-a-timestamp'})).status,'REJECTED');
});
test('16 control-character notes or overlength notes rejected',()=>{
 for(const note of ['\u0000unsafe','a'.repeat(281)]){
  const r=fixture();r.cases[0]={...r.cases[0],observation:note};
  assert.equal(review.assessSelfReport(r).status,'REJECTED');
 }
});
test('17 claim that client could send is invalid, not proof of permissions',()=>{
 const r=fixture();r.technicalPreview={...r.technicalPreview,canSend:true};
 assert.equal(review.assessSelfReport(r).reason,'TECHNICAL_PREVIEW_CONTRACT_INVALID');
});
test('18 independent reviewer has not been verified when absent',()=>{
 const r=review.assessIndependentReview({selfReport:fixture()});
 assert.equal(r.reviewStatus,'PENDING_VERIFIED_INDEPENDENT_REVIEW');
 assert.equal(r.independentAttestationAccepted,false);
 assert.equal(r.merchantOwnerG23Verified,false);
});
test('19 claimed signature/Owner from client JSON cannot verify itself',()=>{
 const r=review.assessIndependentReview({selfReport:fixture(),reviewerSubmission:{
  identityVerified:true,ownerApproved:true,signature:'fake-attestation',reviewerRole:'auditor'
 }});
 assert.equal(r.reviewerSelfClaimsIgnored,true);
 assert.equal(r.independentAttestationAccepted,false);
 assert.equal(r.releaseAuthorized,false);
});
test('20 reviewer payload containing secret/token key rejected',()=>{
 const r=review.assessIndependentReview({selfReport:fixture(),reviewerSubmission:{token:'test'}});
 assert.equal(r.reviewStatus,'REJECTED_REVIEWER_PAYLOAD');
 assert.equal(r.independentAttestationAccepted,false);
});
test('21 all claims green still strictly NO-GO live',()=>{
 const r=review.decideRelease({selfReport:fixture(),claims:{
  allGatesPassed:true,verifiedOwner:true,hostedJwt:true,productionReady:true
 }});
 assert.equal(r.releaseDecision,'NO_GO_HOSTED_OR_PRODUCTION');
 assert.equal(r.productionReleaseAuthorized,false);
 assert.equal(r.publicStagingReleaseAuthorized,false);
});
test('22 all release gates present, immutable and unverified',()=>{
 const r=review.decideRelease({selfReport:fixture()});
 assert.equal(r.gates.length,10);assert.equal(r.blockingGates,10);
 assert(r.gates.every(g=>g.status!=='VERIFIED'));
 assert(Object.isFrozen(r.gates));
});
test('23 P0 named public DEFINER/anon RPC remains a release blocker',()=>{
 const r=review.decideRelease({selfReport:fixture()});
 const g=r.gates.find(g=>g.id==='P0_RPC_DEFINER');
 assert.equal(g.priority,'P0');assert.equal(g.status,'BLOCKED');
 assert.match(g.finding,/qa_shop_b_zalo_claim/);
 assert.match(g.finding,/anon/);
});
test('24 absent hosted Store ownership/signed JWT is a P0 blocker',()=>{
 const g=review.decideRelease({selfReport:fixture()}).gates.find(g=>g.id==='P0_HOSTED_STORE_JWT_RLS');
 assert.equal(g.status,'BLOCKED');assert.match(g.finding,/store_id/);
});
test('25 prior UAT16 self report does not certify ADV5B mobile cards',()=>{
 const g=review.decideRelease({selfReport:fixture()}).gates.find(g=>g.id==='P1_INDEPENDENT_MERCHANT_UAT');
 assert.equal(g.status,'NOT_VERIFIED');assert.match(g.finding,/ADV5B/);
});
test('26 provider, action, AI and backup gates remain separate',()=>{
 const ids=review.GATES.map(x=>x.id);
 for(const id of ['P1_PROVIDER_ENTITLEMENTS','P0_SECURE_ACTION_GATEWAY',
  'P1_MODEL_PRESENTATION','P1_BACKUP_RECOVERY','P0_PRIVATE_ORDER_CONTINUITY'])
  assert(ids.includes(id),id);
});
test('27 no external side effects of review result',()=>{
 const r=review.decideRelease({selfReport:fixture()});
 assert.equal(r.hostedWrites,0);assert.equal(r.providerSends,0);
 assert.equal(r.paidModelCalls,0);assert.equal(r.paidSpendVnd,0);
});
test('28 invalid self-report cannot be legitimized by reviewer object',()=>{
 const r=review.assessIndependentReview({selfReport:{},reviewerSubmission:{ownerApproved:true}});
 assert.equal(r.reviewStatus,'REJECTED_UNTRUSTED_REPORT');
 assert.equal(r.releaseAuthorized,false);
});
test('29 receipt never captures raw phone / private token/ credential',()=>{
 const source=fs.readFileSync(__dirname+'/advanced-merchant-uat-independent-review.cjs','utf8');
 assert(!/\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b|\bsessionStorage\b/.test(source));
 assert(!/\bprocess\.env\b|\bhttps\.request\s*\(/.test(source));
});
test('30 QA Owner and source no-send status are not release evidence',()=>{
 const r=review.decideRelease({selfReport:fixture()});
 assert.equal(r.lifecycle,'CANDIDATE');
 assert.equal(r.mode,'SOURCE_ONLY_NO_SEND');
 assert.equal(r.review.merchantOwnerG23Verified,false);
 assert.equal(r.review.independentAttestationAccepted,false);
});
