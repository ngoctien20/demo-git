import test from 'node:test';
import assert from 'node:assert/strict';
import {
 inspectPrivateFourRowOwnerEnvelope,inspectInactiveHostedManualQaShape,
 evaluateRealChannelCanaryRelease,ownerFourCaseRefs,verifiedManualWorkflowTarget
} from './v17-7e-owner-private-manual-canary-offline.mjs';

const NOW=1794912000000;
function owner(){
 return {
  mode:'OFFLINE_REDACTED_FIXTURE',noSend:true,noCommerceWrite:true,
  records:ownerFourCaseRefs.map((caseRef,i)=>({
   caseRef,sourceDigest:String(i+1).repeat(64),
   ownerActorDigest:'a'.repeat(64),
   independentReviewerDigest:'b'.repeat(64),
   observedAtMs:NOW,scope:'ORIGINAL_STORE_PROVENANCE_READONLY'
  }))
 };
}
function manual(){
 return {
  snapshot:{
   id:verifiedManualWorkflowTarget.id,
   version:verifiedManualWorkflowTarget.version,
   name:verifiedManualWorkflowTarget.name,
   projectId:verifiedManualWorkflowTarget.projectId,
   folderId:verifiedManualWorkflowTarget.folderId,
   active:false,publishedVersion:null,hasPublicWebhook:false,
   credentialCount:0,nodes:[
    {name:'Manual QA Gate',type:'n8n-nodes-base.manualTrigger',credentials:false},
    {name:'Offline Store Channel Gate No Send',type:'n8n-nodes-base.code',credentials:false}
   ]
  },
  receipt:{
   workflowId:verifiedManualWorkflowTarget.id,executionId:'5026',
   executionMode:'manual',status:'success',
   contract:'TIEN404_V17_7E_MANUAL_FIXTURE_12_CASES',
   testStatus:'QA_PASS',passed:12,total:12,failedCount:0,
   fixtureOnly:true,actualProviderEvents:0,outboundMessages:0,
   commerceReads:0,commerceWrites:0,ordersWritten:0,
   stockWritten:0,modelCalls:0,webhookInstalled:false,
   credentialsUsed:false,realProviderSignatureVerified:false,
   realStoreOwnerVerified:false,realJwtRlsVerified:false,
   canPublish:false,realHostedCanary:'NO_GO'
  }
 };
}
const locked=r=>{
 for(const field of ['realOwnerProofVerified','realOwnerConsentVerified',
  'realReviewerVerified','realProviderSignatureVerified',
  'realStoreAuthJwtRlsVerified','realSameTenantStoreABVerified',
  'publicWebhookEnabled','providerSendAllowed','commerceReadAllowed',
  'commerceWriteAllowed','canDeploy','canPublish'])
   assert.equal(r[field],false,field);
};
function ownerDenied(reason,mutate){
 const x=owner();mutate(x);
 const r=inspectPrivateFourRowOwnerEnvelope(x,NOW);
 assert.equal(r.shapeCandidate,false);assert.equal(r.reason,reason);locked(r);
}
function manualDenied(reason,mutate){
 const x=manual();mutate(x);
 const r=inspectInactiveHostedManualQaShape(x.snapshot,x.receipt);
 assert.equal(r.shapeCandidate,false);assert.equal(r.reason,reason);locked(r);
}
test('exact four private owner evidence aliases, not actual owner verification',()=>{
 const r=inspectPrivateFourRowOwnerEnvelope(owner(),NOW);
 assert.equal(r.shapeCandidate,true);assert.equal(r.checkedCases,4);
 assert.equal(r.actualOwnerRecordsInspected,0);
 assert.equal(r.providerOwnerSessionVerified,false);
 assert.equal(r.independentSourceReadbackVerified,false);locked(r);
});
test('missing one original Store row blocked',()=>ownerDenied(
 'EXACT_FOUR_ORIGINAL_RECORD_CASES_REQUIRED',x=>{x.records.pop()}));
test('duplicate original Store claim blocked',()=>ownerDenied(
 'EXACT_FOUR_ORIGINAL_RECORD_CASES_REQUIRED',x=>{x.records[3].caseRef=x.records[0].caseRef}));
test('new unrecognized source record cannot silently replace original',()=>ownerDenied(
 'EXACT_FOUR_ORIGINAL_RECORD_CASES_REQUIRED',x=>{x.records[0].caseRef='OTHER_RECORD'}));
test('missing SHA digest blocked',()=>ownerDenied(
 'MISSING_PRIVATE_SOURCE_OWNER_REVIEW_DIGEST',x=>{x.records[0].sourceDigest='no'}));
test('missing owner proof digest blocked',()=>ownerDenied(
 'MISSING_PRIVATE_SOURCE_OWNER_REVIEW_DIGEST',x=>{x.records[0].ownerActorDigest=''}));
test('missing independent reviewer digest blocked',()=>ownerDenied(
 'MISSING_PRIVATE_SOURCE_OWNER_REVIEW_DIGEST',x=>{x.records[1].independentReviewerDigest=''}));
test('same claimant/reviewer identity cannot be marked independent',()=>ownerDenied(
 'INDEPENDENT_REVIEWER_MUST_BE_DIFFERENT_ACTOR',x=>{x.records[1].independentReviewerDigest='a'.repeat(64)}));
test('wrong evidence scope blocked',()=>ownerDenied(
 'UNTRUSTED_OWNER_RECORD_SCOPE',x=>{x.records[0].scope='COMMERCE_WRITE'}));
test('stale record blocked',()=>ownerDenied(
 'OWNER_WITNESS_TIMESTAMP_INVALID',x=>{x.records[0].observedAtMs=NOW-600001}));
test('future record blocked',()=>ownerDenied(
 'OWNER_WITNESS_TIMESTAMP_INVALID',x=>{x.records[0].observedAtMs=NOW+600001}));
for(const k of ['customer_name','access_token','jwt','secret','phone',
 'email','address','raw_payload','merchant_name','url','storeId','tenantId',
 'userMetadata']){
 test('private owner envelope disallows extra field '+k,()=>{
  ownerDenied('RAW_OWNER_OR_CUSTOMER_FIELDS_PROHIBITED',x=>{x.records[0][k]='untrusted'});
 });
}
test('user-supplied consent flag cannot change actual verifier authority',()=>{
 const x=owner();x.ownerApproved=true;x.records[0].independentApproval=true;
 const r=inspectPrivateFourRowOwnerEnvelope(x,NOW);
 assert.equal(r.reason,'RAW_OWNER_OR_CUSTOMER_FIELDS_PROHIBITED');locked(r);
});
test('live mode cannot run offline attestation',()=>ownerDenied(
 'PRIVATE_OWNER_EVIDENCE_INTAKE_NOT_ESTABLISHED',x=>{x.mode='LIVE'}));
test('send-ready owner evidence rejected',()=>ownerDenied(
 'PRIVATE_OWNER_EVIDENCE_INTAKE_NOT_ESTABLISHED',x=>{x.noSend=false}));
test('write-enabled owner evidence rejected',()=>ownerDenied(
 'PRIVATE_OWNER_EVIDENCE_INTAKE_NOT_ESTABLISHED',x=>{x.noCommerceWrite=false}));
test('verified n8n manual receipt shape is still NOT native Zalo/Meta UAT',()=>{
 const x=manual(),r=inspectInactiveHostedManualQaShape(x.snapshot,x.receipt);
 assert.equal(r.shapeCandidate,true);
 assert.equal(r.manualSyntheticCases,12);
 assert.equal(r.independentHostedReadbackStillRequired,true);locked(r);
});
test('workflow version drift blocked',()=>manualDenied(
 'WRONG_QA_WORKFLOW_OR_VERSION_TARGET',x=>{x.snapshot.version='another-version'}));
test('wrong workflow identity blocked',()=>manualDenied(
 'WRONG_QA_WORKFLOW_OR_VERSION_TARGET',x=>{x.snapshot.id='another-id'}));
test('moved into another folder requires re-review',()=>manualDenied(
 'WRONG_QA_WORKFLOW_OR_VERSION_TARGET',x=>{x.snapshot.folderId='another-folder'}));
test('activating workflow blocked',()=>manualDenied(
 'QA_WORKFLOW_NOT_ISOLATED_INACTIVE_MANUAL_ONLY',x=>{x.snapshot.active=true}));
test('Published workflow blocked',()=>manualDenied(
 'QA_WORKFLOW_NOT_ISOLATED_INACTIVE_MANUAL_ONLY',x=>{x.snapshot.publishedVersion='not-null'}));
test('webhook inserted blocked',()=>manualDenied(
 'QA_WORKFLOW_NOT_ISOLATED_INACTIVE_MANUAL_ONLY',x=>{x.snapshot.hasPublicWebhook=true}));
test('credential assigned blocked',()=>manualDenied(
 'QA_WORKFLOW_NOT_ISOLATED_INACTIVE_MANUAL_ONLY',x=>{x.snapshot.credentialCount=1}));
test('HTTP send node inserted blocked',()=>manualDenied(
 'QA_WORKFLOW_NOT_ISOLATED_INACTIVE_MANUAL_ONLY',x=>{x.snapshot.nodes.push({name:'HTTP',type:'n8n-nodes-base.httpRequest',credentials:false})}));
test('provider proof node replacing Code blocked',()=>manualDenied(
 'DISALLOWED_QA_NODE_OR_CREDENTIAL',x=>{x.snapshot.nodes[1].type='n8n-nodes-base.httpRequest'}));
test('wrong execution ID blocked',()=>manualDenied(
 'MANUAL_EXECUTION_SHAPE_NOT_MATCHING',x=>{x.receipt.executionId='unknown'}));
test('webhook execution cannot replace manual QA',()=>manualDenied(
 'MANUAL_EXECUTION_SHAPE_NOT_MATCHING',x=>{x.receipt.executionMode='webhook'}));
test('failed manual QA receipt blocked',()=>manualDenied(
 'MANUAL_EXECUTION_SHAPE_NOT_MATCHING',x=>{x.receipt.status='error'}));
test('not all 12 checks pass blocked',()=>manualDenied(
 'MANUAL_EXECUTION_SHAPE_NOT_MATCHING',x=>{x.receipt.passed=11}));
test('real provider event claim rejected',()=>manualDenied(
 'MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT',x=>{x.receipt.actualProviderEvents=1}));
test('provider send claim rejected',()=>manualDenied(
 'MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT',x=>{x.receipt.outboundMessages=1}));
test('Commerce read claim rejected',()=>manualDenied(
 'MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT',x=>{x.receipt.commerceReads=1}));
test('Order write claim rejected',()=>manualDenied(
 'MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT',x=>{x.receipt.ordersWritten=1}));
test('model calls rejected',()=>manualDenied(
 'MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT',x=>{x.receipt.modelCalls=1}));
test('self-claimed real signature rejected',()=>manualDenied(
 'MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT',x=>{x.receipt.realProviderSignatureVerified=true}));
test('self-claimed real Store owner rejected',()=>manualDenied(
 'MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT',x=>{x.receipt.realStoreOwnerVerified=true}));
test('self-claimed real JWT RLS rejected',()=>manualDenied(
 'MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT',x=>{x.receipt.realJwtRlsVerified=true}));
test('self-claimed publish flag rejected',()=>manualDenied(
 'MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT',x=>{x.receipt.canPublish=true}));
test('forge all-green real provider + Store fails closed',()=>{
 const r=evaluateRealChannelCanaryRelease({
  ownerVerified:true,realProviderSignatureVerified:true,
  jwtABVerified:true,approved:true,send:true});
 assert.equal(r.status,'REAL_CHANNEL_HOSTED_NO_GO');
 assert.equal(r.blocked.length,7);assert.equal(r.ignoredSelfReportedProof,true);locked(r);
});
