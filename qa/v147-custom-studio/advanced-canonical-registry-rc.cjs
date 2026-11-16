'use strict';
/**
 * ADV.5 Release Candidate contract for OFFLINE Merchant UAT ONLY.
 * Canonical authority: ADV.2 PR #138. UX vocabulary: PR #144 via ADV.4 crosswalk.
 * No release is authorized. This manifest cannot sign or execute actions.
 */
const canonical=require('./advanced-channel-registry.js');
const crosswalk=require('./advanced-studio-capability-crosswalk.js');
const policy=require('./advanced-presentation-policy.js');
const evaluator=require('./advanced-ai-presentation-evaluator.js');
const assert=require('node:assert/strict');

const CONTRACT='T404_ADV5_CANONICAL_RC1_NO_SEND';
const BASELINE=Object.freeze({
 canonicalPR:138,canonicalHead:'2cb5128ef4ffce11fb562805b82b698fe396fed5',
 canonicalVersion:'T404_ADV_CHANNEL_REGISTRY_1.0',
 uxSourcePR:144,uxHead:'ebc29571c389e982bdc670a85df08157b3106133',
 uxMode:'REVIEWED_13_COMPONENT_DESCRIPTIVE_CROSSWALK_NOT_MERGED',
 advanceFromPR:154,advanceFromHead:'2feea7600631da0595a3666368cb6237d83e16b8',
 crosswalkVersion:'T404_ADV4_CANONICAL_CROSSWALK_1',
 proposalContract:'T404_PRESENTATION_PROPOSAL_V1',
 decisionContract:'T404_PRESENTATION_DECISION_V1'
});
const RELEASE_GATES=Object.freeze({
 lifecycle:'CANDIDATE',productionReleased:false,merchantUatIndependentlyAccepted:false,
 verifiedMerchantOwner:false,hostedStoreJwtRlsCertified:false,providerAccountEntitlementsVerified:false,
 ZaloOaPaidTemplateAuthorized:false,verifiedMediaAllowlist:false,
 realModelPresentationBenchmarked:false,persistentServerActionNonceStoreCertified:false,
 realChannelSendAuthorized:false,ordersOrInventoryWriteAuthorized:false
});
function review({tenant_id='qa_tenant_1',store_id='qa_shop_a'}={}){
 assert.equal(canonical.VERSION,BASELINE.canonicalVersion,'Canonical ADV.2 version drift');
 assert.equal(crosswalk.VERSION,BASELINE.crosswalkVersion,'Studio crosswalk version drift');
 assert.equal(crosswalk.CANONICAL_VERSION,canonical.VERSION,'Different registry implementation');
 assert.equal(evaluator.INPUT_CONTRACT,BASELINE.proposalContract);
 assert.equal(evaluator.OUTPUT_CONTRACT,BASELINE.decisionContract);
 assert.deepEqual([...canonical.CHANNELS],[...crosswalk.CHANNELS],'Channel namespace drift');
 assert.equal(crosswalk.FEATURES.length,13,'UX feature count drift');
 assert.equal(policy.CHANNELS.length,4);
 const seen=new Set();
 const cells=[];
 for(const channel of canonical.CHANNELS){
  for(const feature of crosswalk.FEATURES){
   const row=crosswalk.row({tenant_id,store_id,channel,component:feature});
   const key=channel+'|'+feature;
   assert(!seen.has(key),'Duplicate UX cell: '+key);seen.add(key);
   assert.equal(row.entitlementVerified,false,key);
   assert.equal(row.canSend,false,key);
   assert.equal(row.actionExecutable,false,key);
   assert.equal(row.paidTemplateAuthorized,false,key);
   assert.equal(row.signedBusinessActionAuthorized,false,key);
   assert.equal(row.hasVerifiedMedia,false,key);
   assert.equal(row.fallback,'TEXT',key);
   assert(['TEXT',feature].includes(row.presentation),key);
   if(row.sourceState==='APPROVAL_SPEND')assert.equal(row.previewEligible,false,key);
   if(feature==='VERIFIED_LINK')assert.equal(row.previewEligible,false,key);
   if(!row.canonicalComponent)assert.equal(row.previewEligible,false,key);
   const canonicalEntries=row.canonicalComponent
    ?canonical.capabilities(channel).filter(e=>e.componentId===row.canonicalComponent):[];
   if(row.previewEligible)assert.equal(canonicalEntries.length,1,'Preview must have exactly one canonical entry: '+key);
   // Descriptive 144 matrix may be less permissive than canonical, never more.
   if(['UNSUPPORTED','UNVERIFIED','APPROVAL_SPEND'].includes(row.sourceState))
    assert.equal(row.previewEligible,false,key);
   cells.push(Object.freeze({
    channel,feature,state144:row.sourceState,canonicalComponent:row.canonicalComponent,
    canonicalState:row.canonicalStatus,previewEligible:row.previewEligible,
    fallback:row.fallback,reason:row.reason,canSend:false,certifiedAccountCapability:false
   }));
  }
 }
 assert.equal(cells.length,52,'4x13 matrix incomplete');
 const classified=Object.freeze({
  total:cells.length,
  previewOnly:cells.filter(x=>x.previewEligible).length,
  forcedText:cells.filter(x=>!x.previewEligible).length,
  unmapped:cells.filter(x=>x.canonicalComponent===null).length,
  paidLocked:cells.filter(x=>x.state144==='APPROVAL_SPEND').length
 });
 const conflicts=cells.filter(x=>
  x.canonicalComponent===null||
  x.state144==='UNVERIFIED'||x.state144==='UNSUPPORTED'||x.state144==='APPROVAL_SPEND')
 .map(x=>Object.freeze({channel:x.channel,feature:x.feature,reason:x.reason}));
 return Object.freeze({contract:CONTRACT,mode:'SYNTHETIC_QA_ONLY',baseline:BASELINE,
  candidateFor:'MERCHANT_UAT_ONLY_NOT_PRODUCTION',
  registrySource:'CANONICAL_PR_138',descriptiveUXSource:'PR_144_CONSERVATIVE_COMPATIBILITY_ONLY',
  classified,conflicts:Object.freeze(conflicts),cells:Object.freeze(cells),releaseGates:RELEASE_GATES,
  approvedForUatPreview:true,productionReleaseAuthorized:false,
  liveProviderActionsAuthorized:false,realModelCalls:0,ordersWritten:0,externalSends:0,
  hostedReads:0,hostedWrites:0,paidSpendVnd:0});
}
module.exports=Object.freeze({CONTRACT,BASELINE,RELEASE_GATES,review});
