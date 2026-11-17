import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectMetaQaPageNoSend} from './meta-private-page-nosend-admission.mjs';
// Exact pinned PR #243 source is separately checked out by the CI job.
import {verifyReadOnly,CONTRACT} from '../../pinned-pr243-meta-source/qa/v171d-meta-authority/page-app-readonly.mjs';

const NOW=1794900000000;
const pageId='12345678901',appId='22345678901';
const inputs=()=>({pageId,appId,token:'SYNTHETIC_ONLY_NOT_REAL_PAGE_TOKEN',
 fetchImpl:async url=>{
  if(url.includes('/subscribed_apps'))return{ok:true,json:async()=>({data:[{id:appId}]})};
  return{ok:true,json:async()=>({id:pageId})};
 }});
async function receipt(){return verifyReadOnly(inputs());}
function fixture(readOnlyReceipt){
 return {
  nowMs:NOW,readOnlyReceipt,
  manifest:{source:'OFFLINE_PRIVATE_META_QA_PLAN',
    qaPageRef:'qa-page-001',productionPageRef:'prod-page-001',
    qaAppRef:'qa-app-001',productionAppRef:'prod-app-001',
    qaTesterRef:'qa-tester-001',ownerReviewTicket:'review-owner-001',
    operatorReviewTicket:'review-operator-001',
    qaCallbackInactive:true,productionCallbackUnchanged:true,
    singleResponderIsolationPlanned:true,
    existingLegacyBotSendDisabledDuringQa:true,
    allowProviderSend:false,allowGraphMutation:false,
    allowCommerceReadWrite:false,allowPaidModel:false,
    allowedOperation:'PRIVATE_READ_ONLY_PREFLIGHT'},
  privateReview:{source:'PRIVATE_OPERATOR_REVIEW_SUMMARY_ONLY',
    ticket:'review-operator-001',operatorRef:'operator-001',
    independentReviewerRef:'reviewer-001',
    originalPageOwnerEvidenceReviewed:true,appAdminAndHandoverRolesReviewed:true,
    qaAppPageBindingReviewed:true,pageHandoversSubscriptionReviewed:true,
    realProviderUserPermissionsReviewed:true,separateProductionCallbackVerified:true,
    singleNamedTesterConsentReviewed:true,killSwitchAndRollbackReviewed:true,
    noSendAndNoThreadMutationInThisPhase:true,reviewedAtMs:NOW-1000}
 };
}
const blocked=(f,reason)=>{const x=inspectMetaQaPageNoSend(f);
 assert.equal(x.status,'BLOCKED');assert.equal(x.reason,reason);
 assert.equal(x.canDeploy,false);assert.equal(x.canPassThreadControl,false);
 assert.equal(x.canSendMessages,false);assert.equal(x.noSend,true);
};
test('uses pinned real V17.1D page read contract, no network',async()=>{
 assert.equal(CONTRACT,'T404_V171D_META_PAGE_APP_READONLY_V1');
 const r=await receipt();
 assert.equal(r.page_token_can_read_page,true);
 assert.equal(r.expected_app_subscription_visible,true);
 assert.equal(r.verified_merchant_business_owner,false);
 assert.equal(r.authorized_to_change_callback,false);
});
test('valid synthetically observed Page subscription + self-attested reviewer is NEVER permission',async()=>{
 const r=inspectMetaQaPageNoSend(fixture(await receipt()));
 assert.equal(r.status,'PRIVATE_REVIEW_CANDIDATE_ONLY');
 assert.equal(r.graphReadVisibilityObserved,true);
 assert.equal(r.independentPageOwnerProved,false);
 assert.equal(r.independentAppPermissionsProved,false);
 assert.equal(r.canEnableCallback,false);
 assert.equal(r.realSignedHandoverReceived,false);
});
test('missing Meta owner-review evidence yields BLOCKED despite subscribed app',async()=>{
 const f=fixture(await receipt());f.privateReview=null;
 blocked(f,'PRIVATE_INDEPENDENT_PAGE_OWNER_REVIEW_PENDING');
});
test('Page token scope mismatch from existing helper is blocked',async()=>{
 const v=inputs();v.fetchImpl=async()=>({ok:true,json:async()=>({id:'99000000001'})});
 const f=fixture(await verifyReadOnly(v));
 blocked(f,'META_PAGE_APP_READ_VISIBILITY_NOT_VERIFIED');
});
test('Page app not subscribed is blocked',async()=>{
 const v=inputs();v.fetchImpl=async url=>
  ({ok:true,json:async()=>url.includes('subscribed_apps')?{data:[]}:{id:pageId}});
 blocked(fixture(await verifyReadOnly(v)),'META_PAGE_APP_READ_VISIBILITY_NOT_VERIFIED');
});
test('production Page alias accidentally used as QA Page denied',async()=>{
 const f=fixture(await receipt());f.manifest.qaPageRef=f.manifest.productionPageRef;
 blocked(f,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
});
test('production App alias reused by QA App denied',async()=>{
 const f=fixture(await receipt());f.manifest.qaAppRef=f.manifest.productionAppRef;
 blocked(f,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
});
test('QA callback must remain inactive in admission phase',async()=>{
 const f=fixture(await receipt());f.manifest.qaCallbackInactive=false;
 blocked(f,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
});
test('prod callback modification must remain forbidden',async()=>{
 const f=fixture(await receipt());f.manifest.productionCallbackUnchanged=false;
 blocked(f,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
});
test('single-responder plan is mandatory',async()=>{
 const f=fixture(await receipt());f.manifest.singleResponderIsolationPlanned=false;
 blocked(f,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
});
test('existing legacy send must be isolated during future UAT',async()=>{
 const f=fixture(await receipt());f.manifest.existingLegacyBotSendDisabledDuringQa=false;
 blocked(f,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
});
test('paid model and Commerce must remain forbidden',async()=>{
 const f=fixture(await receipt());f.manifest.allowPaidModel=true;
 blocked(f,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
 const g=fixture(await receipt());g.manifest.allowCommerceReadWrite=true;
 blocked(g,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
});
test('no Graph mutation or provider send grant through this module',async()=>{
 const f=fixture(await receipt());f.manifest.allowProviderSend=true;
 blocked(f,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
 const g=fixture(await receipt());g.manifest.allowGraphMutation=true;
 blocked(g,'PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
});
test('self-review by same operator denied',async()=>{
 const f=fixture(await receipt());
 f.privateReview.independentReviewerRef=f.privateReview.operatorRef;
 blocked(f,'PRIVATE_INDEPENDENT_PAGE_OWNER_REVIEW_PENDING');
});
test('expired private review blocked',async()=>{
 const f=fixture(await receipt());f.privateReview.reviewedAtMs=NOW-4*3600000-1;
 blocked(f,'PRIVATE_INDEPENDENT_PAGE_OWNER_REVIEW_PENDING');
});
test('missing handover app roles or messaging_handovers review blocked',async()=>{
 const f=fixture(await receipt());f.privateReview.appAdminAndHandoverRolesReviewed=false;
 blocked(f,'PRIVATE_INDEPENDENT_PAGE_OWNER_REVIEW_PENDING');
 const g=fixture(await receipt());g.privateReview.pageHandoversSubscriptionReviewed=false;
 blocked(g,'PRIVATE_INDEPENDENT_PAGE_OWNER_REVIEW_PENDING');
});
test('missing independent reviewer kill-switch or one tester consent blocked',async()=>{
 const f=fixture(await receipt());f.privateReview.killSwitchAndRollbackReviewed=false;
 blocked(f,'PRIVATE_INDEPENDENT_PAGE_OWNER_REVIEW_PENDING');
 const g=fixture(await receipt());g.privateReview.singleNamedTesterConsentReviewed=false;
 blocked(g,'PRIVATE_INDEPENDENT_PAGE_OWNER_REVIEW_PENDING');
});
test('Page observation cannot be misrepresented as merchant authority',async()=>{
 const f=fixture(await receipt());f.readOnlyReceipt.verified_merchant_business_owner=true;
 blocked(f,'META_PAGE_APP_READ_VISIBILITY_NOT_VERIFIED');
});
