'use strict';
/**
 * TIEN404 V17.1L — fail-closed authority between untrusted bot ingress,
 * language model proposals, and Commerce tools. OFFLINE SOURCE ONLY.
 *
 * No plugin/DB/HTTP/LLM call. Real native signature proof, Store/RLS,
 * atomic rate limits, replay, provider send and order grants must be supplied
 * by independently audited server-side adapters. A fake callback can lie,
 * therefore this source never certifies hosted security or production release.
 */
const VERSION='T404_V171L_ZERO_TRUST_BOT_TOOL_AUTHORITY_V1';
const ALLOWED_CHANNELS=new Set(['MESSENGER','ZALO','WEBSITE']);
const ID=/^[A-Za-z0-9_-]{2,90}$/;
const HEX=/^[a-f0-9]{64}$/;
const id=x=>typeof x==='string'&&ID.test(x);
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const int=x=>Number.isSafeInteger(x);
const fail=code=>{throw Error(code)};
const MAX_BODY=64*1024;
const EVENT_SKEW_MS=300000; // 5 minutes; stale signed webhook denied here
const HIGH_RISK=new Set([
 'CREATE_ORDER','UPDATE_ORDER','CANCEL_ORDER','MARK_PAID','CONFIRM_ORDER',
 'UPDATE_PRICE','UPDATE_STOCK','ADJUST_DEBT','DELETE_CUSTOMER',
 'EXPORT_CUSTOMERS','SEND_MESSAGE','SEND_NOTIFICATION','ADMIN_ACTION',
 'EXECUTE_CODE','HTTP_REQUEST','WORKFLOW_PUBLISH','UPDATE_CREDENTIAL',
 'UPLOAD_UNTRUSTED_MEDIA','FETCH_EXTERNAL_URL'
]);
const PROVENANCE=new Set(['CUSTOMER_MESSAGE','PRODUCT_IMAGE','PRODUCT_CATALOG',
 'EXTERNAL_WEBSITE','KNOWLEDGE_DOCUMENT','MODEL_PROPOSAL','TOOL_RESULT']);
function rejectUntrustedClaims(envelope){
  // No client may provide trusted context, signature verdicts, tool authority,
  // or tenant/session grants as ordinary request fields.
  const forbidden=['tenantId','storeId','userRole','isAdmin','authenticated',
    'signatureVerified','ownerVerified','approved','serviceRole','botId',
    'sessionId','orderAccessGrant','customerConfirmed','expectedTotal',
    'systemPrompt','toolPermissions','modelCanWrite','credential'];
  for(const field of forbidden){
    if(Object.prototype.hasOwnProperty.call(envelope,field))
      fail('INGRESS_FORGED_TRUST_OR_SCOPE_CLAIM');
  }
}
function createBotSecurityBoundary({resolveInstallation,verifyProviderEvent,
 reserveReplayOnce,allowRateAndCost,verifyOrderAccess,verifyCatalogRead,
 verifyCustomerConfirmation,verifyServerQuote}={}){
  if([resolveInstallation,verifyProviderEvent,reserveReplayOnce,
      allowRateAndCost,verifyOrderAccess,verifyCatalogRead,
      verifyCustomerConfirmation,verifyServerQuote].some(fn=>typeof fn!=='function'))
    fail('SECURITY_SERVER_ADAPTERS_MISSING');
  const validSessions=new WeakSet();
  function admit(envelope){
    if(!obj(envelope))fail('INGRESS_ENVELOPE_INVALID');
    rejectUntrustedClaims(envelope);
    const {channel,installationId,rawBody,signatureHeader,nowMs}=envelope;
    if(!ALLOWED_CHANNELS.has(channel)||!id(installationId)||
       !Buffer.isBuffer(rawBody)||rawBody.length<2||
       rawBody.length>MAX_BODY||!int(nowMs)||nowMs<=0||
       typeof signatureHeader!=='string'||signatureHeader.length>300)
      fail('INGRESS_NATIVE_EVENT_BOUNDS_OR_CHANNEL');
    const inst=resolveInstallation({channel,installationId});
    if(!obj(inst)||inst.source!=='SERVER_TRUSTED_INSTALLATION_REGISTRY'||
       inst.status!=='ACTIVE'||
       inst.channel!==channel||inst.installationId!==installationId||
       !id(inst.tenantId)||!id(inst.storeId)||!id(inst.botVersion)||
       !id(inst.ownerEvidenceRef)||!id(inst.providerDestinationId)||inst.tenantId===inst.storeId)
       fail('INGRESS_INSTALLATION_OWNER_NOT_TRUSTED');
    const verified=verifyProviderEvent({
       channel,installationId,rawBody,signatureHeader,
       installation:inst,nowMs
    });
    if(!obj(verified)||verified.source!=='INDEPENDENT_NATIVE_PROVIDER_ADAPTER'||
       verified.verified!==true||verified.channel!==channel||
       verified.installationId!==installationId||
       verified.providerDestinationId!==inst.providerDestinationId||
       !id(verified.providerSenderId)||!id(verified.providerEventId)||
       !int(verified.occurredAtMs)||
       Math.abs(nowMs-verified.occurredAtMs)>EVENT_SKEW_MS||
       verified.isSelfEcho===true)
       fail('INGRESS_SIGNATURE_EVENT_IDENTITY_OR_TIME_DENIED');
    const key=[
      inst.tenantId,inst.storeId,channel,installationId,verified.providerEventId
    ].join(':');
    // These callbacks MUST be atomic and independently backed by a secure,
    // durable service; local Sets are used ONLY in deterministic offline QA.
    if(reserveReplayOnce({key,ttlMs:EVENT_SKEW_MS,nowMs})!==true)
       fail('INGRESS_REPLAY_OR_DUPLICATE_DENIED');
    if(allowRateAndCost({tenantId:inst.tenantId,storeId:inst.storeId,
       channel,installationId,senderId:verified.providerSenderId,
       maxInputBytes:rawBody.length,nowMs})!==true)
       fail('INGRESS_RATE_OR_QUOTA_DENIED');
    const session=Object.freeze({
       version:VERSION,mode:'OFFLINE_SERVER_ADAPTER_CONTRACT_ONLY',
       tenantId:inst.tenantId,storeId:inst.storeId,
       channel,installationId,botVersion:inst.botVersion,
       providerSenderId:verified.providerSenderId,
       providerEventId:verified.providerEventId,occurredAtMs:verified.occurredAtMs,
       providerSignatureIndependentlyVerifiedByThisModule:false,
       storeOwnershipIndependentlyVerifiedByThisModule:false,
       durableReplayStoreVerifiedByThisModule:false,
       hostedRlsVerifiedByThisModule:false,
       canExecuteHighRiskTools:false
    });
    validSessions.add(session);
    return session;
  }
  function authorizeTool({session,tool,arguments:args,origin,nowMs}={}){
    if(!validSessions.has(session)||!id(tool)||!obj(args)||
       !PROVENANCE.has(origin)||!int(nowMs)||nowMs<=0||
       Math.abs(nowMs-session.occurredAtMs)>EVENT_SKEW_MS)
       fail('TOOL_CONTEXT_NOT_ADMITTED');
    if(HIGH_RISK.has(tool))
       return Object.freeze({decision:'DENY',reason:'TOOL_HIGH_RISK_DISABLED_IN_SHADOW',
         tool,actualHostedMutations:0,actualProviderSends:0,actualModelCalls:0});
    const scoped=[...Object.keys(args)].filter(k=>
       ['tenantId','storeId','botVersion','providerSenderId','role',
        'admin','providerDestinationId','serviceRole','apiKey',
        'credential','connectionId','targetRecipientId'].includes(k));
    if(scoped.length)fail('TOOL_UNTRUSTED_SCOPE_OR_SECRET_ARGUMENTS');
    if(origin!=='MODEL_PROPOSAL')
       return Object.freeze({decision:'DENY',
         reason:'TOOL_UNTRUSTED_DATA_CANNOT_AUTHORIZE_ACTION',
         tool,actualHostedMutations:0,actualProviderSends:0});
    if(tool==='READ_PUBLIC_CATALOG'){
      if(Object.keys(args).some(k=>!['sku','query'].includes(k))||
         (args.sku!==undefined&&!id(args.sku))||
         (args.query!==undefined&&
           (typeof args.query!=='string'||args.query.length>120)))
           fail('TOOL_CATALOG_PARAMETERS_INVALID');
      if(verifyCatalogRead({tenantId:session.tenantId,storeId:session.storeId,
            sku:args.sku||null,query:args.query||null,
            botVersion:session.botVersion})!==true)
           fail('TOOL_SERVER_CATALOG_SCOPE_DENIED');
      return Object.freeze({decision:'SOURCE_ONLY_READ_PLAN',tool,
        tenantId:session.tenantId,storeId:session.storeId,
        actualDatabaseReads:0,actualProviderSends:0,
        resultMustComeFromServerScopedReader:true});
    }
    if(tool==='READ_OWN_ORDER_STATUS'){
      if(Object.keys(args).some(k=>!['orderId'].includes(k))||
         !id(args.orderId))fail('TOOL_ORDER_ID_INVALID');
      if(verifyOrderAccess({tenantId:session.tenantId,storeId:session.storeId,
         channel:session.channel,installationId:session.installationId,
         providerSenderId:session.providerSenderId,orderId:args.orderId,
         nowMs,requiredScope:'ORDER_STATUS_READ'})!==true)
         fail('TOOL_ORDER_GRANT_OR_CROSS_CHANNEL_IDENTITY_DENIED');
      return Object.freeze({decision:'SOURCE_ONLY_READ_PLAN',tool,
         tenantId:session.tenantId,storeId:session.storeId,
         orderId:args.orderId,actualDatabaseReads:0,
         actualProviderSends:0,realOrderAccessGrantVerifiedHere:false});
    }
    if(tool==='PROPOSE_ORDER'){
      if(Object.keys(args).some(k=>!['sku','quantity','expectedTotalVnd'].includes(k))||
         !id(args.sku)||!int(args.quantity)||args.quantity<1||
         args.quantity>100||!int(args.expectedTotalVnd)||
         args.expectedTotalVnd<1||args.expectedTotalVnd>1000000000)
         fail('TOOL_ORDER_PROPOSAL_SCHEMA_INVALID');
      // Server confirmation callback is a separate boundary and NEVER
      // becomes authorization to write via this module.
      if(verifyServerQuote({tenantId:session.tenantId,
         storeId:session.storeId,sku:args.sku,
         quantity:args.quantity,expectedTotalVnd:args.expectedTotalVnd,
         nowMs})!==true)
         fail('TOOL_SERVER_PRICE_OR_STOCK_QUOTE_DENIED');
      if(verifyCustomerConfirmation({tenantId:session.tenantId,
         storeId:session.storeId,channel:session.channel,
         providerSenderId:session.providerSenderId,
         sku:args.sku,quantity:args.quantity,
         expectedTotalVnd:args.expectedTotalVnd,nowMs})!==true)
         fail('TOOL_ORDER_PROPOSAL_NOT_CUSTOMER_CONFIRMED');
      return Object.freeze({decision:'HUMAN_CONFIRMED_PROPOSAL_ONLY',
         tool,tenantId:session.tenantId,storeId:session.storeId,
         sku:args.sku,quantity:args.quantity,
         expectedTotalVnd:args.expectedTotalVnd,
         canCreateOrder:false,canReduceStock:false,
         actualHostedMutations:0,actualProviderSends:0,
         actualCatalogReservation:0});
    }
    return Object.freeze({decision:'DENY',tool,
       reason:'TOOL_NOT_IN_EXPLICIT_ALLOWLIST',
       actualHostedMutations:0,actualProviderSends:0});
  }
  return Object.freeze({version:VERSION,admit,authorizeTool});
}
module.exports=Object.freeze({VERSION,MAX_BODY,HIGH_RISK,createBotSecurityBoundary});