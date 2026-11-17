// TIEN404 AI V17.7E — owner evidence + isolated manual no-send canary acceptance.
// Pure offline validators. Do NOT connect real OAuth/Meta/Zalo/JWT, access customer
// rows, invoke an HTTP endpoint, create Orders, or infer Store ownership.
// The ACTUAL n8n manual-only run is recorded separately, not fabricated by CI.

const REQUIRED=Object.freeze(['T1_PRODUCT_1','T1_ORDER_1','T2_PRODUCT_1','T2_ORDER_1']);
const WORKFLOW=Object.freeze({
 id:'MQcbjLWZ5QUTJW0k',
 version:'b8aaf94c-def1-472c-bd92-fccea1d946b8',
 name:'TIEN404_V177E_MANUAL_CHANNEL_STORE_QA_INACTIVE_NO_SEND',
 projectId:'WW82YsCCaAxGC9dp',
 folderId:'d3ZVrZ9cNiW2SJ1q'
});
const EXPECTED_NODES=Object.freeze([
 ['Manual QA Gate','n8n-nodes-base.manualTrigger'],
 ['Offline Store Channel Gate No Send','n8n-nodes-base.code']
]);
const HEX=/^[0-9a-f]{64}$/;
const REF=/^[A-Za-z0-9_-]{8,96}$/;
const SENSITIVE=/token|password|cookie|authorization|headers|phone|email|customer|address|access.?key|private.?key|secret|raw.?payload|name|url|message|jwt/i;
const never=Object.freeze({
 realOwnerProofVerified:false,realOwnerConsentVerified:false,
 realReviewerVerified:false,realProviderSignatureVerified:false,
 realStoreAuthJwtRlsVerified:false,realSameTenantStoreABVerified:false,
 publicWebhookEnabled:false,providerSendAllowed:false,
 commerceReadAllowed:false,commerceWriteAllowed:false,
 canDeploy:false,canPublish:false
});
const denied=(reason,detail={})=>Object.freeze({
 shapeCandidate:false,reason,sourceOnly:true,...never,...detail
});
const candidate=(reason,detail={})=>Object.freeze({
 shapeCandidate:true,reason,sourceOnly:true,...never,...detail
});

/**
 * Witness shape only. Nothing in a JSON envelope authenticates a person.
 * Four original product/order rows MUST be attested via private issuer + owner,
 * then independently checked against hosted source records by reviewer.
 * This validator never returns legal ownership or production read privileges.
 */
export function inspectPrivateFourRowOwnerEnvelope(envelope,nowMs){
 if(!Number.isSafeInteger(nowMs)||!envelope||!Array.isArray(envelope.records)||
    envelope.mode!=='OFFLINE_REDACTED_FIXTURE'||
    envelope.noSend!==true||envelope.noCommerceWrite!==true)
    return denied('PRIVATE_OWNER_EVIDENCE_INTAKE_NOT_ESTABLISHED');
 if(envelope.records.length!==4||new Set(envelope.records.map(x=>x?.caseRef)).size!==4||
    !REQUIRED.every(k=>envelope.records.some(x=>x?.caseRef===k)))
    return denied('EXACT_FOUR_ORIGINAL_RECORD_CASES_REQUIRED');
 const allowed=new Set(['caseRef','sourceDigest','ownerActorDigest',
    'independentReviewerDigest','observedAtMs','scope']);
 for(const r of envelope.records){
   if(!r||typeof r!=='object'||Array.isArray(r)||
      Object.keys(r).some(k=>!allowed.has(k)||SENSITIVE.test(k)))
      return denied('RAW_OWNER_OR_CUSTOMER_FIELDS_PROHIBITED');
   if(!HEX.test(r.sourceDigest??'')||
      !HEX.test(r.ownerActorDigest??'')||
      !HEX.test(r.independentReviewerDigest??''))
      return denied('MISSING_PRIVATE_SOURCE_OWNER_REVIEW_DIGEST');
   if(r.ownerActorDigest===r.independentReviewerDigest)
      return denied('INDEPENDENT_REVIEWER_MUST_BE_DIFFERENT_ACTOR');
   if(r.scope!=='ORIGINAL_STORE_PROVENANCE_READONLY')
      return denied('UNTRUSTED_OWNER_RECORD_SCOPE');
   if(!Number.isSafeInteger(r.observedAtMs)||
      Math.abs(nowMs-r.observedAtMs)>5*60*1000)
      return denied('OWNER_WITNESS_TIMESTAMP_INVALID');
 }
 return candidate('REDACTED_FOUR_ROW_ENVELOPE_SHAPE_ONLY',{
   checkedCases:4,actualOwnerRecordsInspected:0,
   providerOwnerSessionVerified:false,
   independentSourceReadbackVerified:false
 });
}

/** The real hosted n8n workflow is intentionally MANUAL-ONLY and INACTIVE.
 * A forged JSON snapshot can pass this shape inspector, but CANNOT certify
 * hosted execution: only direct connector inspection + independent run logs
 * can support that assertion.
 */
export function inspectInactiveHostedManualQaShape(snapshot,receipt){
 if(!snapshot||!receipt||snapshot.id!==WORKFLOW.id||
    snapshot.version!==WORKFLOW.version||
    snapshot.name!==WORKFLOW.name||
    snapshot.projectId!==WORKFLOW.projectId||
    snapshot.folderId!==WORKFLOW.folderId)
   return denied('WRONG_QA_WORKFLOW_OR_VERSION_TARGET');
 if(snapshot.active!==false||snapshot.publishedVersion!==null||
    snapshot.hasPublicWebhook!==false||
    snapshot.credentialCount!==0||!Array.isArray(snapshot.nodes)||
    snapshot.nodes.length!==2)
   return denied('QA_WORKFLOW_NOT_ISOLATED_INACTIVE_MANUAL_ONLY');
 for(const [name,type]of EXPECTED_NODES){
   const rows=snapshot.nodes.filter(n=>n?.name===name&&n?.type===type);
   if(rows.length!==1||rows[0].credentials!==false)
     return denied('DISALLOWED_QA_NODE_OR_CREDENTIAL');
 }
 if(receipt.workflowId!==WORKFLOW.id||receipt.executionId!=='5026'||
   receipt.executionMode!=='manual'||receipt.status!=='success'||
   receipt.contract!=='TIEN404_V17_7E_MANUAL_FIXTURE_12_CASES'||
   receipt.testStatus!=='QA_PASS'||receipt.passed!==12||receipt.total!==12||
   receipt.failedCount!==0)
   return denied('MANUAL_EXECUTION_SHAPE_NOT_MATCHING');
 const hardZero=[
  'actualProviderEvents','outboundMessages','commerceReads','commerceWrites',
  'ordersWritten','stockWritten','modelCalls'
 ];
 if(hardZero.some(k=>receipt[k]!==0)||receipt.fixtureOnly!==true||
   receipt.webhookInstalled!==false||receipt.credentialsUsed!==false||
   receipt.realProviderSignatureVerified!==false||
   receipt.realStoreOwnerVerified!==false||
   receipt.realJwtRlsVerified!==false||
   receipt.canPublish!==false||receipt.realHostedCanary!=='NO_GO')
   return denied('MANUAL_RECEIPT_MUST_BE_SYNTHETIC_AND_ZERO_EFFECT');
 return candidate('REAL_N8N_MANUAL_EXECUTION_RECEIPT_SHAPE_MATCH_ONLY',{
   manualExecutionId:'5026',manualSyntheticCases:12,
   independentHostedReadbackStillRequired:true
 });
}

/** Claimed real provider signatures, merchant ownership, Store JWT, and
 * operator status cannot self-authorize. Host cutover requires privately
 * verified source attestations, Access isolation, signed native events,
 * no-send capture, and separately approved G0/M0/G3 from PR #247.
 */
export function evaluateRealChannelCanaryRelease(claim){
 const blocked=Object.freeze([
  'G0_FOUR_ORIGINAL_STORE_OWNER_ROWS_NEED_PRIVATE_AUTH_AND_REVIEW',
  'M0_CURRENT_BACKUP_AND_INDEPENDENT_RESTORE_SCOPE_NOT_VERIFIED',
  'CANONICAL_STORE_RLS_WITH_REAL_SAME_TENANT_AB_JWT_NOT_TESTED',
  'NATIVE_ZALO_BOT_OR_META_SIGNATURE_AND_REAL_OWNER_NOT_VERIFIED',
  'DEDICATED_PRIVATE_INACTIVE_SIGNED_INGRESS_NOT_DEPLOYED',
  'EXTERNAL_ANONYMOUS_ACCESS_DENIAL_NOT_INDEPENDENTLY_PROVED',
  'NO_SEND_ZERO_ORDER_ZERO_STOCK_VERIFIED_END_TO_END_NOT_PROVED'
 ]);
 return Object.freeze({
   ...never,sourceOnly:true,
   status:'REAL_CHANNEL_HOSTED_NO_GO',
   blocked,ignoredSelfReportedProof:!!claim
 });
}

export const ownerFourCaseRefs=REQUIRED;
export const verifiedManualWorkflowTarget=WORKFLOW;
