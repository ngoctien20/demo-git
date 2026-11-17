// TIEN404 AI V17.7C — Private REAL Channel UAT intake preflight, OFFLINE.
// No outbound network, webhook calls, JWT parsing, metadata writes, token access,
// Commerce reads/writes, channel message sends, or secret/PII intake.
// All passing outputs are SHAPE CANDIDATES, never hosted verification.

const CUSTOMERS=Object.freeze({
  ZALO_BOT:{workflowId:'yIJk8LvJoLF40Z62',proof:'BOT_NATIVE_DELIVERY'},
  MESSENGER:{workflowId:'Z7FdV7uDvApfbURQ',proof:'META_PAGE_NATIVE_DELIVERY'},
  WEBSITE:{workflowId:'wgkkmT7q4lm4HyuA',proof:'WEBSITE_AUTH_SESSION'}
});
const COMMERCE=['products','orders','order_items','customers','conversations','messages'];
const REFERENCE=/^[A-Za-z0-9][A-Za-z0-9_-]{7,95}$/;
const HASH=/^[a-f0-9]{64}$/;
const ALLOWED_STAGES=new Set(['INGRESS_NO_SEND','READ_ONLY_STORE_AUTH','CROSS_STORE_DENIAL']);
const SENSITIVE_KEYS=/^(authorization|cookie|access_token|refresh_token|secret|password|api_key|phone|email|address|message|body|code|jwt|session_token|raw_payload|customer_name)$/i;
const NO_GO=Object.freeze({
  realProviderVerified:false,realStoreJwtVerified:false,
  realSameTenantABVerified:false,realCrossStoreDenied:false,
  publicChannelSendAllowed:false,commerceReadAllowed:false,
  commerceWriteAllowed:false,canPublish:false
});
function deny(reason,extra={}){return Object.freeze({
  readyShape:false,reason,sourceOnly:true,...NO_GO,...extra
});}
function candidate(reason,extra={}){return Object.freeze({
  readyShape:true,reason,sourceOnly:true,...NO_GO,...extra
});}
export const channelUatScopes=Object.freeze(Object.keys(CUSTOMERS));
export const commerceReadSurfaces=Object.freeze([...COMMERCE]);

/**
 * Use only aggregate DB metadata — never values from merchant/customer rows.
 * Store authorization may later use an explicitly reviewed trusted join,
 * not necessarily a new store_id column. A tenant-only RLS policy is NOT
 * a Store policy, no matter whether RLS and FORCE RLS are enabled.
 */
export function inspectHostedStorePreflightSnapshot(snapshot){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    !Array.isArray(snapshot.publicSurfaces)||
    !snapshot.qaStoreTotals||typeof snapshot.qaStoreTotals!=='object')
    return deny('DATABASE_METADATA_NOT_PROVIDED');
  if(snapshot.publicSurfaces.length!==COMMERCE.length||
    new Set(snapshot.publicSurfaces.map(x=>x?.name)).size!==COMMERCE.length||
    !COMMERCE.every(t=>snapshot.publicSurfaces.some(x=>x?.name===t)))
    return deny('COMMERCE_SURFACE_INVENTORY_INCOMPLETE');
  if(snapshot.publicSurfaces.some(s=>s.rls!==true||s.forceRls!==true||
    s.tenantIdField!==true))
    return deny('TENANT_RLS_METADATA_NOT_ESTABLISHED');
  if(snapshot.publicSurfaces.some(s=>s.storePolicyScope!=='STORE_DIRECT'&&
    s.storePolicyScope!=='TRUSTED_STORE_JOIN'))
    return deny('STORE_QUALIFIED_RLS_POLICY_MISSING',{
      blockedTables:Object.freeze(snapshot.publicSurfaces.filter(s=>
        s.storePolicyScope!=='STORE_DIRECT'&&
        s.storePolicyScope!=='TRUSTED_STORE_JOIN').map(s=>s.name).sort())
    });
  if(snapshot.publicSurfaces.some(s=>s.storePolicyScope==='STORE_DIRECT'&&s.storeIdField!==true))
    return deny('STORE_COLUMN_REQUIRED_FOR_DIRECT_POLICY');
  if(!Number.isInteger(snapshot.qaStoreTotals.tenantCount)||
    !Number.isInteger(snapshot.qaStoreTotals.maxDistinctStoresInOneTenant)||
    snapshot.qaStoreTotals.tenantCount<1||
    snapshot.qaStoreTotals.maxDistinctStoresInOneTenant<2)
    return deny('SAME_TENANT_TWO_STORE_QA_FIXTURE_MISSING');
  return candidate('SYNTHETIC_SCHEMA_SHAPE_CANDIDATE_NOT_HOSTED_RLS_PROOF');
}

/**
 * A UAT witness must be independently authenticated and verified in a
 * private hosted environment; an uploaded receipt or a boolean in this
 * manifest can be forged. This code validates MINIMAL, REDACTED metadata
 * only. It MUST NEVER promote a self-reported receipt to verified.
 */
export function inspectPrivateUatReceipt(receipt,expected){
  if(!expected||typeof expected!=='object'||!receipt||
    typeof receipt!=='object'||Array.isArray(receipt)||
    expected.offlineMode!=='SYNTHETIC_QA_ONLY'||
    expected.noSend!==true||expected.noCommerceWrite!==true)
    return deny('PRIVATE_UAT_GATE_NOT_GRANTED');
  if(!Object.hasOwn(CUSTOMERS,receipt.channel))
    return deny('UNSUPPORTED_OR_BLOCKED_OA_CHANNEL');
  const allowed=['channel','workflowId','workflowVersion','caseRef',
    'stage','recordedAtMs','correlationDigest','evidenceSource'];
  if(Object.keys(receipt).some(k=>!allowed.includes(k)||
    SENSITIVE_KEYS.test(k)))
    return deny('SENSITIVE_OR_UNTRUSTED_EVIDENCE_FIELD');
  if(receipt.workflowId!==CUSTOMERS[receipt.channel].workflowId||
    receipt.workflowVersion!==expected.pinnedWorkflowVersion)
    return deny('WORKFLOW_ID_OR_VERSION_DRIFT');
  if(!REFERENCE.test(receipt.caseRef??'')||
    !ALLOWED_STAGES.has(receipt.stage)||
    !HASH.test(receipt.correlationDigest??''))
    return deny('MINIMAL_EVIDENCE_SHAPE_INVALID');
  if(receipt.evidenceSource!=='SYNTHETIC_QA_ONLY')
    return deny('UNSUPPORTED_EXTERNAL_ATTESTATION_IN_OFFLINE_MODULE');
  if(!Number.isSafeInteger(expected.nowMs)||
    !Number.isSafeInteger(receipt.recordedAtMs)||
    Math.abs(expected.nowMs-receipt.recordedAtMs)>5*60*1000)
    return deny('EVIDENCE_RECEIPT_OUT_OF_TIMEBOX');
  return candidate('REDACTED_SYNTHETIC_RECEIPT_SHAPE_CANDIDATE',{
    providerProofNeeded:CUSTOMERS[receipt.channel].proof,
    independentHostedReviewerRequired:true
  });
}

/**
 * No real UAT is "accepted" through a GitHub workflow. This gate shows
 * exactly which independent proofs remain unmet, including when someone
 * submits forged all-true values to try to bypass the reviewer.
 */
export function evaluateRealUatAdmission(_claimedEvidence){
  return Object.freeze({
    stage:'V17_7C_REAL_HOSTED_UAT_BLOCKED_PENDING_INDEPENDENT_REVIEW',
    required:Object.freeze([
      'REAL_AUTHENTICATED_CHANNEL_OWNER_PROOF',
      'NATIVE_PROVIDER_OR_SIGNED_WEBSITE_INGRESS_RECEIPT',
      'PRIVATE_SERVER_OWNED_CHANNEL_TO_STORE_INSTALLATION',
      'TWO_REAL_SUPABASE_AUTH_JWT_SESSIONS_ONE_TENANT_TWO_STORES',
      'REAL_CROSS_STORE_RLS_NEGATIVE_READ_PROOF',
      'REAL_NO_SEND_ZERO_ORDER_ZERO_STOCK_TRACE',
      'INDEPENDENT_REVIEW_OF_AUTHORITY_SCOPE_AND_ROLLBACK'
    ]),
    ...NO_GO,
    noSend:true,noCommerceWrite:true
  });
}

/** Evidence names only; no URLs/tokens/test payloads; user must approve
 * each actual provider/UAT interaction and owner needs to participate.
 */
export function getUatOperatorPlan(channel){
  if(!Object.hasOwn(CUSTOMERS,channel))
    return deny('NO_HOSTED_UAT_PLAN_FOR_THIS_CHANNEL');
  return Object.freeze({
    channel,workflowId:CUSTOMERS[channel].workflowId,
    expectedProof:CUSTOMERS[channel].proof,
    activities:Object.freeze([
      'REVIEW_WORKFLOW_PUBLISHED_VS_DRAFT_SHA_AND_SCOPE',
      'OBTAIN_PRIVATE_REAL_CHANNEL_OWNER_AND_OPERATOR_CONSENT',
      'VERIFY_PROVIDER_NATIVE_PROOF_BEFORE_TRUSTED_INSTALLATION_RESOLVE',
      'KEEP_OUTBOUND_DISABLED_AND_COMMERCE_READ_WRITE_DENIED',
      'PROBE_UNAUTHORIZED_OR_WRONG_STORE_THROUGH_SEPARATE_QA_HARNESS',
      'CAPTURE_REDACTED_CORRELATION_DIGEST_AND_INDEPENDENT_AUDIT',
      'VERIFY_NO_SEND_NO_WRITES_AND_ROLLBACK'
    ]),
    sourceOnly:true,noExecute:true,...NO_GO
  });
}
