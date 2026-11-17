// TIEN404 V17.7H — Owner/Operator and inactive hosted Worker admission.
// No credential, file, JWT, API token, private evidence or PII is read here.
// A matching user-supplied metadata object is NOT proof of identity/access;
// read the actual Cloudflare account and independent signed private evidence.
//
// Version-upload-only is the sole staged operation proposed in this PR.
// A script Upload Worker PUT can implicitly deploy; using it is forbidden.
// Even a successful version upload is NOT approval for a live callback.
const NAME='tien404-v177h-provider-nosend-inactive-staging';
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/;
const DIGEST=/^[0-9a-f]{64}$/;
const release=Object.freeze({
  realMerchantOwnerVerified:false,
  realProviderQaBotOrPageOwnerVerified:false,
  independentOperatorVerified:false,
  realSupabaseStoreJwtRlsVerified:false,
  realNativeWebhookReceived:false,
  realProviderSignatureVerified:false,
  realExternalAccessDenyVerified:false,
  realDurableReplayVerified:false,
  canEnablePublicRoute:false,
  canRegisterWebhook:false,
  canInjectCredentials:false,
  canSendProviderMessage:false,
  canReadCommerce:false,
  canWriteCommerce:false,
  canPublish:false
});
const denied=(reason,more={})=>Object.freeze({
  hostAdmitted:false,ownerConsentAdmitted:false,
  reason,...release,...more
});
const allowed=(reason,more={})=>Object.freeze({
  hostAdmitted:true,ownerConsentAdmitted:false,
  reason,...release,...more
});

export function inspectInactiveWorkerHostMetadata(snapshot) {
  if(!snapshot||snapshot.source!=='CONNECTED_CLOUDFLARE_READONLY'||
     snapshot.scriptName!==NAME)
    return denied('INDEPENDENT_WORKER_METADATA_REQUIRED');
  if(snapshot.scriptExists!==true ||
     !Number.isSafeInteger(snapshot.versionCount)||
     snapshot.versionCount<1)
    return denied('INACTIVE_SCRIPT_VERSION_NOT_FOUND');
  if(snapshot.deploymentCount!==0 ||
     snapshot.routeCount!==0 ||
     snapshot.customDomainCount!==0 ||
     snapshot.cronCount!==0)
    return denied('WORKER_HAS_DEPLOYMENT_OR_PUBLIC_ROUTING');
  if(snapshot.workersDevEnabled!==false ||
     snapshot.previewUrlsEnabled!==false)
    return denied('WORKERS_DEV_OR_PREVIEW_EXPOSURE_NOT_DENIED');
  if(snapshot.bindingCount!==0 ||
     snapshot.credentialCount!==0)
    return denied('INERT_WORKER_HAS_UNEXPECTED_BINDINGS');
  if(snapshot.defaultHandlerIs404Verified!==true ||
     snapshot.externalNetworkCallsCount!==0 ||
     snapshot.commerceConnectionsCount!==0)
    return denied('INERT_WORKER_CODE_ATTESTATION_MISSING');
  return allowed('HOSTED_VERSION_INACTIVE_METADATA_SHAPE_ONLY',{
    externalEdgeDenialIndependent:false,
    realHandlerExecuted:false
  });
}

/** Ticket metadata only. A valid SHA reference and a claimed signed actor
 * cannot verify an actual real QA Page/Bot owner. Private identity needs
 * hosted issuer verification, consent UI, provider-admin readback and reviewer.
 */
export function inspectScopedOwnerConsentTicket(ticket,nowMs) {
  if(!ticket || !Number.isSafeInteger(nowMs) || nowMs<=0 ||
     ticket.mode!=='REDACTED_PRIVATE_TICKET_SHAPE_ONLY' ||
     ticket.scope!=='ONE_DEDICATED_QA_BOT_OR_PAGE_NO_SEND' ||
     ticket.noSend!==true || ticket.noCustomerData!==true ||
     ticket.noCommerceReadWrite!==true)
    return denied('OWNER_PRIVATE_CONSENT_NOT_AUTHENTICATED');
  const allowedKeys=new Set(['mode','scope','channel','qaInstallationRef',
    'ownerSessionDigest','operatorSessionDigest','reviewerSessionDigest',
    'providerAccountProofDigest','expiresAtMs','noSend','noCustomerData',
    'noCommerceReadWrite']);
  if(Object.keys(ticket).some(k=>!allowedKeys.has(k)) ||
     !['ZALO_BOT','MESSENGER'].includes(ticket.channel) ||
     !ID.test(ticket.qaInstallationRef??''))
    return denied('OWNER_TICKET_HAS_UNTRUSTED_OR_SENSITIVE_FIELDS');
  if(![ticket.ownerSessionDigest,ticket.operatorSessionDigest,
    ticket.reviewerSessionDigest,ticket.providerAccountProofDigest]
    .every(x=>DIGEST.test(x??'')))
    return denied('OWNER_AND_OPERATOR_PROOF_DIGEST_NOT_PINNED');
  if(new Set([ticket.ownerSessionDigest,ticket.operatorSessionDigest,
    ticket.reviewerSessionDigest]).size!==3)
    return denied('OWNER_OPERATOR_INDEPENDENCE_NOT_ESTABLISHED');
  if(!Number.isSafeInteger(ticket.expiresAtMs) ||
     ticket.expiresAtMs<=nowMs ||
     ticket.expiresAtMs>nowMs+15*60*1000)
    return denied('PRIVATE_CONSENT_INVITATION_EXPIRED');
  return denied('OWNER_TICKET_SHAPE_OK_BUT_REAL_PROVIDER_ADMIN_NOT_CHECKED',{
    ticketFormatCandidate:true,
    independentlyAuthenticatedProviderOwner:false
  });
}

export function requireSeparateNativeRealCanaryAuthorization(_claimedGreen) {
  return denied('NO_REAL_PROVIDER_EXTERNAL_UAT_WITHOUT_OWNER_AND_OPERATOR',{
    pending:[
      'OWNER_PRIVATE_AUTHENTICATED_SAME_QA_BOT_OR_META_PAGE_ADMIN',
      'INDEPENDENT_OPERATOR_PERMISSION_AND_COST_CAP',
      'DIFFERENT_FROM_RPC16_MERCHANT_EVIDENCE_ACCESS',
      'NO_PUBLIC_ROUTES_PREVIEWS_AND_NO_DEPLOYMENT_INITIAL_UPLOAD',
      'DURABLE_REPLAY_RATE_AND_SIGNATURE_NATIVE_ADAPTER',
      'ONE_BOUNDED_TEST_MESSAGE_EXPLICIT_CONSENT',
      'INDEPENDENT_EXTERNAL_NO_SEND_AND_ZERO_COMMERCE_AUDIT',
      'HOSTED_SAME_TENANT_REAL_STORE_AB_JWT_RLS_BEFORE_COMMERCE'
    ]
  });
}
export const inactiveCanaryScriptName=NAME;
