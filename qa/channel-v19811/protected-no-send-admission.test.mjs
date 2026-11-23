import assert from 'node:assert/strict';
import {assessProtectedNoSendAdmission} from './protected-no-send-admission.mjs';
const T='00000000-0000-0000-0000-000000000001',
 S='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
 O='aaaaaaaa-0000-0000-0000-000000000001';
const NOW=1795176000000,D='a'.repeat(64);
const fixture=()=>({
 mode:'LOCAL_SYNTHETIC_PROOF_CHAIN_ONLY',nowMs:NOW,
 installation:{source:'MOCK_PRIVATE_INSTALLATION_REGISTRY',installationRef:'QA_INSTALL_A',
  endpointRef:'QA_ENDPOINT_A',channel:'zalo_bot',botId:'111111111111111111',
  tenantId:T,storeId:S,ownerId:O,credentialEpoch:2,state:'qa_active',
  bindingVersion:3,verifiedAtMs:NOW-200000,revokedAtMs:null,
  expectedWebhookDigest:D,uniqueActiveBinding:true},
 provider:{source:'MOCK_ZALO_READONLY_API_EVIDENCE',botId:'111111111111111111',
  getMeOk:true,webhookInfoOk:true,webhookDigest:D,
  observedAtMs:NOW-10000,credentialEpoch:2,endpointRef:'QA_ENDPOINT_A',
  tokenNotPersisted:true},
 owner:{source:'MOCK_SERVER_VERIFIED_OWNER_SESSION',
  ownerId:O,tenantId:T,storeId:S,installationRef:'QA_INSTALL_A',
  consent:'readonly_catalog_qa_only',approvedVersion:3,
  sessionVerified:true,tenantMembershipActive:true,storeOwnerMembershipActive:true,
  challengeConsumed:true,approvedAtMs:NOW-10000,expiresAtMs:NOW+100000,
  revokedAtMs:null},
 receipt:{source:'MOCK_VERIFIED_WEBHOOK_RECEIPT',endpointRef:'QA_ENDPOINT_A',
  eventRef:'EVT_A001',eventName:'message.text.received',chatType:'PRIVATE',
  isEcho:false,issuedAtMs:NOW-3000,
  dedupeStatus:'MOCK_DURABLE_INSTALLATION_SCOPED_UNIQUE',
  credentialEpoch:2,sku:'F01',quantity:1},
 restrictions:{localFixtureOnly:true,providerSendEnabled:false,
  hostedReadEnabled:false,commerceWriteEnabled:false,notifyEnabled:false,
  realProviderCredentialUsed:false,realCustomerDataUsed:false}
});
const cases=[
 ['candidate all mocked',x=>{},'OFFLINE_NO_SEND_PREVIEW_CANDIDATE'],
 ['Store B also synthetic',x=>{x.installation.storeId=B;x.owner.storeId=B},'OFFLINE_NO_SEND_PREVIEW_CANDIDATE'],
 ['mode LIVE rejected',x=>x.mode='REAL_PRODUCTION','NO_GO'],
 ['missing envelope now',x=>delete x.nowMs,'NO_GO'],
 ['extra envelope auth',x=>x.serviceRole=true,'NO_GO'],
 ['bad clock',x=>x.nowMs='now','NO_GO'],
 ['client store claim',x=>x.receipt.storeId=S,'NO_GO'],
 ['client tenant claim',x=>x.receipt.tenantId=T,'NO_GO'],
 ['client owner claim',x=>x.receipt.isOwner=true,'NO_GO'],
 ['client bot authority',x=>x.receipt.botId='111111111111111111','NO_GO'],
 ['client send flag',x=>x.receipt.canSend=true,'NO_GO'],
 ['unrecognized install source',x=>x.installation.source='USER_INPUT','NO_GO'],
 ['wrong channel',x=>x.installation.channel='zalo_oa','NO_GO'],
 ['wrong installation ref',x=>x.installation.installationRef='?','NO_GO'],
 ['wrong tenant UUID',x=>x.installation.tenantId='T1','NO_GO'],
 ['wrong owner ID',x=>x.installation.ownerId='O1','NO_GO'],
 ['invalid bot format',x=>x.installation.botId='bot','NO_GO'],
 ['revoked installation',x=>{x.installation.state='revoked';x.installation.revokedAtMs=NOW-1},'NO_GO'],
 ['inactive installation',x=>x.installation.state='pending','NO_GO'],
 ['duplicate bot binding',x=>x.installation.uniqueActiveBinding=false,'NO_GO'],
 ['bad webhook fingerprint',x=>x.installation.expectedWebhookDigest='fake','NO_GO'],
 ['new install config version',x=>x.installation.bindingVersion=4,'NO_GO'],
 ['wrong installation secret epoch',x=>x.installation.credentialEpoch=3,'NO_GO'],
 ['installation verified in future',x=>x.installation.verifiedAtMs=NOW+10,'NO_GO'],
 ['provider is client-supplied',x=>x.provider.source='CUSTOMER_JSON','NO_GO'],
 ['provider getMe missing',x=>x.provider.getMeOk=false,'NO_GO'],
 ['provider webhook info missing',x=>x.provider.webhookInfoOk=false,'NO_GO'],
 ['provider Bot A vs B mismatch',x=>x.provider.botId='222222222222222222','NO_GO'],
 ['provider wrong webhook hash',x=>x.provider.webhookDigest='b'.repeat(64),'NO_GO'],
 ['provider wrong endpoint',x=>x.provider.endpointRef='QA_ENDPOINT_B','NO_GO'],
 ['provider credential epoch old',x=>x.provider.credentialEpoch=1,'NO_GO'],
 ['provider observed too old',x=>x.provider.observedAtMs=NOW-400000,'NO_GO'],
 ['provider observed future',x=>x.provider.observedAtMs=NOW+5000,'NO_GO'],
 ['provider token persisted',x=>x.provider.tokenNotPersisted=false,'NO_GO'],
 ['extra provider secret',x=>x.provider.rawBotToken='secret','NO_GO'],
 ['owner evidence from customer',x=>x.owner.source='CUSTOMER_MESSAGE','NO_GO'],
 ['owner wrong identity',x=>x.owner.ownerId='bbbbbbbb-0000-0000-0000-000000000002','NO_GO'],
 ['owner wrong tenant',x=>x.owner.tenantId=B,'NO_GO'],
 ['owner cross Store',x=>x.owner.storeId=B,'NO_GO'],
 ['owner wrong installation',x=>x.owner.installationRef='QA_INSTALL_B','NO_GO'],
 ['owner consent revoked',x=>{x.owner.consent='revoked';x.owner.revokedAtMs=NOW-1},'NO_GO'],
 ['owner consent suspended',x=>x.owner.consent='pending','NO_GO'],
 ['owner consent version stale',x=>x.owner.approvedVersion=2,'NO_GO'],
 ['owner signed session missing',x=>x.owner.sessionVerified=false,'NO_GO'],
 ['owner tenant member revoked',x=>x.owner.tenantMembershipActive=false,'NO_GO'],
 ['owner Store owner revoked',x=>x.owner.storeOwnerMembershipActive=false,'NO_GO'],
 ['owner approval challenge not consumed',x=>x.owner.challengeConsumed=false,'NO_GO'],
 ['owner consent expired',x=>x.owner.expiresAtMs=NOW-1,'NO_GO'],
 ['owner consent signed prior to install proof',x=>x.owner.approvedAtMs=NOW-300000,'NO_GO'],
 ['owner approval in future',x=>x.owner.approvedAtMs=NOW+100,'NO_GO'],
 ['owner role injected',x=>x.owner.role='SUPERADMIN','NO_GO'],
 ['owner consent returned raw JWT',x=>x.owner.jwt='secret','NO_GO'],
 ['receipt from unknown transport',x=>x.receipt.source='CHAT_DATA','NO_GO'],
 ['receipt endpoint mismatch',x=>x.receipt.endpointRef='QA_ENDPOINT_B','NO_GO'],
 ['receipt unknown event type',x=>x.receipt.eventName='message.image.received','NO_GO'],
 ['receipt Bot echo',x=>x.receipt.isEcho=true,'NO_GO'],
 ['receipt group message',x=>x.receipt.chatType='GROUP','NO_GO'],
 ['receipt replay',x=>x.receipt.dedupeStatus='DUPLICATE','NO_GO'],
 ['receipt not durable',x=>x.receipt.dedupeStatus='IN_MEMORY','NO_GO'],
 ['receipt wrong credential epoch',x=>x.receipt.credentialEpoch=5,'NO_GO'],
 ['receipt SKU SQL injection',x=>x.receipt.sku="F01' OR TRUE",'NO_GO'],
 ['receipt quantity 0',x=>x.receipt.quantity=0,'NO_GO'],
 ['receipt quantity 101',x=>x.receipt.quantity=101,'NO_GO'],
 ['receipt timestamp stale',x=>x.receipt.issuedAtMs=NOW-301000,'NO_GO'],
 ['receipt timestamp future',x=>x.receipt.issuedAtMs=NOW+9000,'NO_GO'],
 ['guard live read attempted',x=>x.restrictions.hostedReadEnabled=true,'NO_GO'],
 ['guard send attempted',x=>x.restrictions.providerSendEnabled=true,'NO_GO'],
 ['guard write attempted',x=>x.restrictions.commerceWriteEnabled=true,'NO_GO'],
 ['guard notification attempted',x=>x.restrictions.notifyEnabled=true,'NO_GO'],
 ['guard actual credentials claimed',x=>x.restrictions.realProviderCredentialUsed=true,'NO_GO'],
 ['guard real customer claimed',x=>x.restrictions.realCustomerDataUsed=true,'NO_GO'],
 ['guard no longer fixture',x=>x.restrictions.localFixtureOnly=false,'NO_GO'],
];
let count=0;
for(const [label,mutate,expected] of cases){
 const f=fixture();mutate(f);const x=assessProtectedNoSendAdmission(f);
 assert.equal(x.decision,expected,label);
 assert.equal(x.realZaloBotIdentityVerified,false,label);
 assert.equal(x.realMerchantConsentVerified,false,label);
 assert.equal(x.hostedUatApproved,false,label);
 assert.equal(x.canReadHosted,false,label);
 assert.equal(x.canSend,false,label);
 assert.equal(x.canWrite,false,label);
 assert.equal(x.canInvokePublishedCommerce,false,label);
 assert.equal(x.canNotifyMerchant,false,label);
 assert.equal(x.providerSends,0,label);
 assert.equal(x.commerceWrites,0,label);
 assert.equal(x.stockReservations,0,label);
 assert.equal(x.hostedReads,0,label);
 assert.equal(x.productionReady,false,label);
 assert.equal(x.customerReply,null,label);
 assert.equal(x.tenantId,null,label);
 assert.equal(x.storeId,null,label);
 count++;
}
const forged=fixture();
forged.mode='REAL_PRODUCTION';
const z=assessProtectedNoSendAdmission(forged);
assert.equal(z.decision,'NO_GO');
count++;
console.log('TIEN404_V19811_NO_SEND_ADMISSION_POLICY_PASS='+count);
console.log('REAL_ZALO_BOT_GETME_VERIFIED=false');
console.log('REAL_MERCHANT_CONSENT_VERIFIED=false');
console.log('PROVIDER_SEND=0');
