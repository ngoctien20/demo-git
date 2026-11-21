/**
 * TIEN404 V19.8.6 — SYNTHETIC CONTRACT ONLY.
 *
 * This is NOT a live Zalo verifier, not an OAuth proof, not a trusted session.
 * NEVER treat mock labels as cryptographic evidence or use this module to admit
 * live Supabase reads, Commerce orders or Zalo messages.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF=/^[A-Z0-9][A-Z0-9_-]{2,63}$/;
const allowKeys=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>keys.includes(k));
const isRef=x=>typeof x==='string'&&REF.test(x);
const isUUID=x=>typeof x==='string'&&UUID.test(x);
const no=reason=>({decision:'DENY',reason,tenantId:null,storeId:null,
  installationId:null,ownerId:null,replyPreview:'',canReadHosted:false,
  canSend:false,canWrite:false,providerSends:0,orderWrites:0,
  realProviderProof:false,realOwnerProof:false,productionReady:false});

/**
 * Input is assembled from separate synthetic fixture namespaces. None of
 * receipt/chat payload fields may define a Store, Tenant, Owner or credential.
 * A live implementation requires independent native provider signature/API
 * verification and a genuine authenticated owner session.
 */
export function evaluateBotInstallation(envelope) {
  if(!allowKeys(envelope,['mode','nowMs','transport','event','registry','ownerEvidence','storeAuthority','priorBinding']))
    return no('UNTRUSTED_ENVELOPE');
  if(envelope.mode!=='V1986_OFFLINE_FIXTURE'||!Number.isSafeInteger(envelope.nowMs))
    return no('NOT_A_TRUSTED_RUNTIME');
  const {transport:t,event:e,registry:registrations,ownerEvidence:owners,storeAuthority:s,priorBinding:prior}=envelope;
  if(!allowKeys(t,['source','method','endpointRef','credentialBindingRef','secretEpoch','headerAuthenticated',
      'providerAttested','replayStatus','rateStatus','receivedAtMs','claimsVerified'])||
     t.source!=='MOCK_AUTHENTICATED_ENDPOINT'||
     t.method!=='POST'||!isRef(t.endpointRef)||!isRef(t.credentialBindingRef)||
     !Number.isSafeInteger(t.secretEpoch)||t.secretEpoch<1||
     t.headerAuthenticated!==true||t.providerAttested!==true||t.claimsVerified!==true)
    return no('TRANSPORT_OR_PROVIDER_NOT_PROVEN');
  if(!Number.isSafeInteger(t.receivedAtMs)||Math.abs(envelope.nowMs-t.receivedAtMs)>300000)
    return no('TRANSPORT_EXPIRED');
  if(t.replayStatus!=='MOCK_DURABLE_UNIQUE'||t.rateStatus!=='ALLOW')
    return no('REPLAY_OR_RATE_DENIED');
  if(!allowKeys(e,['source','type','chatType','isBotEcho','eventIdStatus','senderRole','qaOwnerCustomerAllowed'])||
     e.source!=='MOCK_NORMALIZED_EVENT'||e.type!=='message.text.received'||
     e.chatType!=='PRIVATE'||e.isBotEcho!==false||e.eventIdStatus!=='MOCK_UNIQUE'||
     !['CUSTOMER','OWNER_AS_CUSTOMER_QA'].includes(e.senderRole))
    return no('UNTRUSTED_OR_UNSUPPORTED_EVENT');
  if(!Array.isArray(registrations)||!registrations.length||registrations.length>10)
    return no('REGISTRY_NOT_AVAILABLE');
  if(registrations.some(x=>!allowKeys(x,['source','installationId','channel','endpointRef',
     'credentialBindingRef','secretEpoch','tenantId','storeId','lifecycle',
     'ownerId','botRef','verifiedAtMs','revokedAtMs','version'])))
    return no('REGISTRY_RECORD_UNTRUSTED');
  const hits=registrations.filter(x=>x.endpointRef===t.endpointRef);
  if(hits.length!==1)return no('ENDPOINT_BINDING_MISSING_OR_AMBIGUOUS');
  const i=hits[0];
  if(i.source!=='MOCK_PRIVATE_SERVER_REGISTRY'||i.channel!=='zalo_bot'||
     !isRef(i.installationId)||!isRef(i.botRef)||!isUUID(i.tenantId)||!isUUID(i.storeId)||
     !isRef(i.ownerId)||i.lifecycle!=='qa_active'||i.revokedAtMs!==null||
     i.credentialBindingRef!==t.credentialBindingRef||i.secretEpoch!==t.secretEpoch||
     !Number.isSafeInteger(i.version)||i.version<1||
     !Number.isSafeInteger(i.verifiedAtMs)||i.verifiedAtMs>envelope.nowMs)
    return no('INSTALLATION_BINDING_UNVERIFIED');
  // A Bot reference must never be attached to multiple active Store records.
  const botBindings=registrations.filter(x=>x.botRef===i.botRef&&x.lifecycle==='qa_active'&&x.revokedAtMs===null);
  if(botBindings.length!==1)return no('DUPLICATE_ACTIVE_BOT_BINDINGS');
  if(!Array.isArray(owners)||!owners.length||owners.length>10||
     owners.some(x=>!allowKeys(x,['source','installationId','ownerId','tenantId','storeId',
       'approval','sessionProof','membershipActive','ownerRole','approvedVersion','approvedAtMs','revokedAtMs'])))
    return no('OWNER_RECORD_UNTRUSTED');
  const approvals=owners.filter(x=>x.installationId===i.installationId);
  if(approvals.length!==1)return no('OWNER_APPROVAL_MISSING_OR_AMBIGUOUS');
  const o=approvals[0];
  if(o.source!=='MOCK_SERVER_VERIFIED_OWNER'||o.ownerId!==i.ownerId||
     o.tenantId!==i.tenantId||o.storeId!==i.storeId||
     o.approval!=='consented_readonly_qa'||o.sessionProof!=='MOCK_AUTH_SESSION'||
     o.membershipActive!==true||o.ownerRole!=='owner'||
     o.revokedAtMs!==null||o.approvedVersion!==i.version||
     !Number.isSafeInteger(o.approvedAtMs)||o.approvedAtMs>envelope.nowMs||
     o.approvedAtMs<i.verifiedAtMs)
    return no('OWNER_CONSENT_OR_MEMBERSHIP_UNVERIFIED');
  if(e.senderRole==='OWNER_AS_CUSTOMER_QA'&&e.qaOwnerCustomerAllowed!==true)
    return no('OWNER_AS_CUSTOMER_QA_DISABLED');
  if(!allowKeys(s,['source','tenantId','storeId','state','ownerId','ownerActive','verifiedVersion'])||
    s.source!=='MOCK_CANONICAL_STORE_AUTHORITY'||s.tenantId!==i.tenantId||
    s.storeId!==i.storeId||s.ownerId!==i.ownerId||s.ownerActive!==true||
    s.state!=='staging_active'||s.verifiedVersion!==i.version)
    return no('CANONICAL_STORE_NOT_VERIFIED');
  if(!allowKeys(prior,['source','lastKnownVersion','lastKnownStoreId','transferApproval'])||
     prior.source!=='MOCK_REGISTRY_HISTORY'||prior.lastKnownVersion>i.version||
     !Number.isSafeInteger(prior.lastKnownVersion))
    return no('REGISTRY_HISTORY_UNTRUSTED');
  if(prior.lastKnownStoreId&&prior.lastKnownStoreId!==i.storeId&&
     prior.transferApproval!=='MOCK_NEW_OWNER_AND_OLD_OWNER_APPROVAL')
    return no('UNAUTHORIZED_BOT_STORE_TRANSFER');
  return {decision:'OFFLINE_BINDING_CANDIDATE',reason:'MOCK_EVIDENCE_NOT_HOSTED_AUTH',
    tenantId:null,storeId:null,installationId:null,ownerId:null,
    replyPreview:'',canReadHosted:false,canSend:false,canWrite:false,
    providerSends:0,orderWrites:0,realProviderProof:false,
    realOwnerProof:false,productionReady:false};
}
