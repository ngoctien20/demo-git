/**
 * TIEN404 V19.8.11 / NO-SEND admission policy candidate.
 * Local synthetic fixtures ONLY. A submitted source string or boolean is NEVER
 * cryptographic provider evidence or proof of an authenticated merchant.
 *
 * The only successful outcome is OFFLINE_NO_SEND_PREVIEW_CANDIDATE.
 * There is deliberately no code path that grants hosted catalog, provider Send
 * or Commerce writes, even if caller forges every input to look verified.
 */
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const BOT=/^[0-9]{12,22}$/;
const REF=/^[A-Z0-9][A-Z0-9_-]{3,63}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const SKU=/^[A-Z][A-Z0-9-]{1,20}$/;
const exact=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const mk=(reason,ok=false)=>({
 decision:ok?'OFFLINE_NO_SEND_PREVIEW_CANDIDATE':'NO_GO',
 reason,phase:ok?'LOCAL_QA_ONLY':'BLOCKED',
 tenantId:null,storeId:null,ownerId:null,installationId:null,
 realZaloBotIdentityVerified:false,realMerchantConsentVerified:false,
 hostedUatApproved:false,canReadHosted:false,canSend:false,canWrite:false,
 canInvokePublishedCommerce:false,canNotifyMerchant:false,
 providerSends:0,commerceWrites:0,stockReservations:0,hostedReads:0,
 productionReady:false,customerReply:null
});
export function assessProtectedNoSendAdmission(e){
 if(!exact(e,['mode','nowMs','installation','provider','owner','receipt','restrictions']))
  return mk('MISSING_OR_EXTRA_ENVELOPE');
 if(e.mode!=='LOCAL_SYNTHETIC_PROOF_CHAIN_ONLY')return mk('LIVE_SOURCE_NOT_AUTHORIZED');
 if(!Number.isSafeInteger(e.nowMs))return mk('CLOCK_INVALID');
 const {installation:i,provider:p,owner:o,receipt:r,restrictions:g}=e;
 if(!exact(i,['source','installationRef','channel','botId','tenantId','storeId',
   'ownerId','credentialEpoch','state','bindingVersion','verifiedAtMs','revokedAtMs',
   'expectedWebhookDigest','endpointRef','uniqueActiveBinding']) ||
   i.source!=='MOCK_PRIVATE_INSTALLATION_REGISTRY'||
   i.channel!=='zalo_bot'||!REF.test(String(i.installationRef||''))||
   !REF.test(String(i.endpointRef||''))||!BOT.test(String(i.botId||''))||
   !UUID.test(String(i.tenantId||''))||!UUID.test(String(i.storeId||''))||
   !UUID.test(String(i.ownerId||''))||
   !Number.isSafeInteger(i.credentialEpoch)||i.credentialEpoch<1||
   !Number.isSafeInteger(i.bindingVersion)||i.bindingVersion<1||
   !Number.isSafeInteger(i.verifiedAtMs)||i.verifiedAtMs>e.nowMs||
   i.state!=='qa_active'||i.revokedAtMs!==null||
   i.uniqueActiveBinding!==true||!DIGEST.test(String(i.expectedWebhookDigest||'')))
  return mk('INSTALLATION_UNTRUSTED_OR_REVOKED');
 if(!exact(p,['source','botId','getMeOk','webhookInfoOk','webhookDigest',
   'observedAtMs','credentialEpoch','endpointRef','tokenNotPersisted'])||
   p.source!=='MOCK_ZALO_READONLY_API_EVIDENCE'||
   p.getMeOk!==true||p.webhookInfoOk!==true||p.botId!==i.botId||
   p.webhookDigest!==i.expectedWebhookDigest||p.endpointRef!==i.endpointRef||
   p.credentialEpoch!==i.credentialEpoch||p.tokenNotPersisted!==true||
   !Number.isSafeInteger(p.observedAtMs)||p.observedAtMs>e.nowMs+1000||
   e.nowMs-p.observedAtMs>300000)
  return mk('PROVIDER_IDENTITY_EVIDENCE_MISSING_OR_STALE');
 if(!exact(o,['source','ownerId','tenantId','storeId','installationRef',
   'consent','approvedVersion','sessionVerified','tenantMembershipActive',
   'storeOwnerMembershipActive','challengeConsumed','approvedAtMs','expiresAtMs',
   'revokedAtMs'])||
   o.source!=='MOCK_SERVER_VERIFIED_OWNER_SESSION'||
   o.ownerId!==i.ownerId||o.tenantId!==i.tenantId||
   o.storeId!==i.storeId||o.installationRef!==i.installationRef||
   o.consent!=='readonly_catalog_qa_only'||o.approvedVersion!==i.bindingVersion||
   o.sessionVerified!==true||o.tenantMembershipActive!==true||
   o.storeOwnerMembershipActive!==true||o.challengeConsumed!==true||
   o.revokedAtMs!==null||!Number.isSafeInteger(o.approvedAtMs)||
   !Number.isSafeInteger(o.expiresAtMs)||o.approvedAtMs>e.nowMs||
   o.approvedAtMs<i.verifiedAtMs||o.expiresAtMs<=e.nowMs)
  return mk('MERCHANT_CONSENT_NOT_VERIFIED');
 if(!exact(r,['source','endpointRef','eventRef','eventName','chatType','isEcho',
   'issuedAtMs','dedupeStatus','credentialEpoch','sku','quantity'])||
   r.source!=='MOCK_VERIFIED_WEBHOOK_RECEIPT'||
   r.endpointRef!==i.endpointRef||r.credentialEpoch!==i.credentialEpoch||
   !REF.test(String(r.eventRef||''))||r.eventName!=='message.text.received'||
   r.chatType!=='PRIVATE'||r.isEcho!==false||
   r.dedupeStatus!=='MOCK_DURABLE_INSTALLATION_SCOPED_UNIQUE'||
   !SKU.test(String(r.sku||''))||!Number.isSafeInteger(r.quantity)||
   r.quantity<1||r.quantity>100||!Number.isSafeInteger(r.issuedAtMs)||
   r.issuedAtMs>e.nowMs+1000||e.nowMs-r.issuedAtMs>300000)
  return mk('INBOUND_RECEIPT_NOT_ADMITTED');
 if(!exact(g,['localFixtureOnly','providerSendEnabled','hostedReadEnabled',
   'commerceWriteEnabled','notifyEnabled','realProviderCredentialUsed',
   'realCustomerDataUsed'])||
   g.localFixtureOnly!==true||g.providerSendEnabled!==false||
   g.hostedReadEnabled!==false||g.commerceWriteEnabled!==false||
   g.notifyEnabled!==false||g.realProviderCredentialUsed!==false||
   g.realCustomerDataUsed!==false)
  return mk('UNAPPROVED_RUNTIME_CAPABILITY');
 return mk('ALL_SYNTHETIC_POLICY_GATES_PASSED_NOT_REAL_IDENTITY',true);
}
