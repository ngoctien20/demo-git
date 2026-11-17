import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,generateKeyPairSync,sign} from 'node:crypto';
import {inspectPrivateSameStoreEvidence,inspectIsolatedCanaryAdmission,
 G_CONTRACT,NOTE_CONTRACT,privateEvidenceManifestHash,privateEvidenceNoteBytes}
 from './private-native-evidence-samestore-gate.mjs';
import {createNativeIssuerNoSendQa,createInMemoryQaReplayClaim}
 from './native-proof-private-issuer-nosend.mjs';

const NOW=Date.parse('2026-11-17T14:28:00.000Z');
const ROLES=[
 ['META_PROTOCOL_REVIEWER','messenger','QA_META_PAGE_A','META_RAW_HMAC_REVIEW_METADATA_ONLY'],
 ['ZALO_BOT_PROTOCOL_REVIEWER','zalo_bot','QA_ZALO_BOT_A','ZALO_BOT_SHARED_HEADER_REVIEW_METADATA_ONLY'],
 ['MERCHANT_OWNER','both','BOTH_CHANNELS','OWNER_ORIGINALS_PENDING_INDEPENDENT_REVIEW'],
 ['INDEPENDENT_SECURITY_REVIEWER','both','BOTH_CHANNELS','SECURITY_ORIGINALS_PENDING_INDEPENDENT_REVIEW']
];
const outputDeny=x=>{
 assert.equal(x.mayRunHostedNoSendCanary,false);
 assert.equal(x.mayWrite,false);
 assert.equal(x.maySend,false);
 assert.equal(x.providerSends,0);
 assert.equal(x.commerceWrites,0);
};
function make(){
 const manifest={
  contract:G_CONTRACT,ticket:'EV-1234567890ABCDEF1234',nonce:'QA_NONCE_20261117_0001',
  tenantAlias:'QA_TENANT_1',storeAlias:'QA_STORE_A',
  metaPageAlias:'QA_META_PAGE_A',zaloBotAlias:'QA_ZALO_BOT_A',
  consentAlias:'QA_CONSENT_1',
  startedAtMs:NOW-10000,expiresAtMs:NOW+120000,
  isolatedNoSend:true,productionUnchanged:true,commerceWritesDisabled:true,
  modelCallsDisabled:true,privateOperatorOnly:true,
  recoveryGate:'DEFERRED_NOT_WAIVED'
 };
 const keys=ROLES.map(()=>generateKeyPairSync('ed25519'));
 const records=ROLES.map(([role],i)=>({
  keyId:'QA_PUBLIC_KEY_'+i,role,actorAlias:'QA_DISTINCT_SIGNER_'+i,
  revoked:false,active:true,tenantAlias:'QA_TENANT_1',storeAlias:'QA_STORE_A',
  validFromMs:NOW-60000,validUntilMs:NOW+600000,publicKey:keys[i].publicKey
 }));
 const notes=ROLES.map(([reviewRole,channel,installationAlias,method],i)=>({
  contract:NOTE_CONTRACT,ticket:manifest.ticket,nonce:manifest.nonce,
  manifestHash:privateEvidenceManifestHash(manifest),
  tenantAlias:manifest.tenantAlias,storeAlias:manifest.storeAlias,
  reviewRole,channel,installationAlias,evidenceAlias:'QA_PRIVATE_NOTE_'+i,
  method,observedAtMs:NOW-1000,scope:'PRIVATE_NO_SEND_ONLY',
  sourceProofAccepted:false
 }));
 let receipts=notes.map((claim,i)=>({
  keyId:records[i].keyId,actorAlias:records[i].actorAlias,
  reviewRole:ROLES[i][0],claim,
  signature:sign(null,privateEvidenceNoteBytes(claim),keys[i].privateKey).toString('base64url')
 }));
 const trustRegistry={source:'OPERATOR_PINNED_OFFLINE_KEYS',hostedEnabled:false,
  readonly:true,getPublicKey:keyId=>records.find(r=>r.keyId===keyId)};
 const gate=options=>inspectPrivateSameStoreEvidence({
  manifest,receipts,trustRegistry,nowMs:NOW,...options
 });
 const reSign=(index,changes,priv=keys[index].privateKey)=>{
  const claim={...receipts[index].claim,...changes};
  receipts[index]={...receipts[index],claim,
    signature:sign(null,privateEvidenceNoteBytes(claim),priv).toString('base64url')};
 };
 return {manifest,records,keys,receipts,trustRegistry,gate,reSign};
}
test('G01 valid four independently signed private QA notes are STRUCTURAL ONLY',()=>{
 const f=make(),r=f.gate();assert.equal(r.status,'STRUCTURAL_FOUR_REVIEWER_CANDIDATE_ONLY');
 assert.equal(r.metadataNotesVerified,4);
 assert.equal(r.structurallySameStore,true);
 assert.equal(r.independentSignatureMathVerified,true);
 assert.equal(r.nativeMetaProviderVerified,false);
 assert.equal(r.nativeZaloBotProviderVerified,false);
 assert.equal(r.merchantOwnerVerified,false);
 assert.equal(r.realJWTStoreVerified,false);
 outputDeny(r);
});
test('G02 actual read-only hosted shape missing Store/RLS hard-blocks no-send admission',()=>{
 const f=make(),e=f.gate();
 const r=inspectIsolatedCanaryAdmission({evidenceResult:e,hostedSnapshot:{
  source:'SUPABASE_READ_ONLY_AGGREGATE',productionUnchanged:true,
  providerCredentialsNotRead:true,storesExists:false,storeMembershipsExists:false,
  channelLinksExists:false,storeScopedCommerceColumns:0,
  realOwnerApprovalIndependentlyVerified:false
 }});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'P0_CANONICAL_STORE_AND_OWNER_AUTHORITY_MISSING');
 outputDeny(r);
});
test('G03 client cannot add native verified field to operator manifest',()=>{
 const f=make();outputDeny(f.gate({manifest:{...f.manifest,native_verified:true}}));
});
test('G04 signed Meta review for different Store denied',()=>{
 const f=make();f.reSign(0,{storeAlias:'QA_STORE_B'});
 outputDeny(f.gate());
});
test('G05 signed Zalo evidence for a different Tenant denied',()=>{
 const f=make();f.reSign(1,{tenantAlias:'QA_TENANT_2'});
 outputDeny(f.gate());
});
test('G06 wrong Page or Bot alias denied despite valid new signature',()=>{
 const f=make();f.reSign(0,{installationAlias:'QA_OTHER_META'});
 outputDeny(f.gate());
 f.reSign(0,{installationAlias:f.manifest.metaPageAlias});
 f.reSign(1,{installationAlias:f.manifest.metaPageAlias});
 outputDeny(f.gate());
});
test('G07 Bot header and Meta HMAC review methods never interchangeable',()=>{
 const f=make();f.reSign(1,{method:'META_RAW_HMAC_REVIEW_METADATA_ONLY'});
 outputDeny(f.gate());
});
test('G08 revoked or inactive private review key denied',()=>{
 const f=make();f.records[0].revoked=true;
 outputDeny(f.gate());
 f.records[0].revoked=false;f.records[0].active=false;
 outputDeny(f.gate());
});
test('G09 reviewer role cannot self-promote without pinned role',()=>{
 const f=make();f.records[1].role='INDEPENDENT_SECURITY_REVIEWER';
 outputDeny(f.gate());
});
test('G10 same person in two roles is not independent',()=>{
 const f=make();f.receipts[3].actorAlias=f.receipts[2].actorAlias;
 outputDeny(f.gate());
});
test('G11 one key cannot sign two independent reviews',()=>{
 const f=make();f.receipts[3].keyId=f.receipts[2].keyId;
 outputDeny(f.gate());
});
test('G12 tampering evidence note or signature always denied',()=>{
 const f=make();f.receipts[0].claim={...f.receipts[0].claim,evidenceAlias:'QA_FORGED_NOTE'};
 outputDeny(f.gate());
 f.reSign(0,{evidenceAlias:'QA_PRIVATE_NOTE_0'});
 f.receipts[0].signature='A'.repeat(86);outputDeny(f.gate());
});
test('G13 test ticket missing, manifest stale, future, or longer than 5m denied',()=>{
 const f=make();
 outputDeny(f.gate({manifest:{...f.manifest,ticket:'EV-BAD'}}));
 outputDeny(f.gate({nowMs:f.manifest.expiresAtMs}));
 outputDeny(f.gate({nowMs:f.manifest.startedAtMs-1}));
 outputDeny(f.gate({manifest:{...f.manifest,expiresAtMs:NOW+400000}}));
});
test('G14 production callback changed or send/write permitted denied',()=>{
 const f=make();
 outputDeny(f.gate({manifest:{...f.manifest,productionUnchanged:false}}));
 outputDeny(f.gate({manifest:{...f.manifest,isolatedNoSend:false}}));
 outputDeny(f.gate({manifest:{...f.manifest,commerceWritesDisabled:false}}));
 outputDeny(f.gate({manifest:{...f.manifest,modelCallsDisabled:false}}));
});
test('G15 no hidden waiver of the M0 recovery precondition',()=>{
 const f=make();outputDeny(f.gate({manifest:{...f.manifest,recoveryGate:'WAIVED'}}));
});
test('G16 a forged claim that original provider proof was approved is not promoted',()=>{
 const f=make();f.reSign(0,{sourceProofAccepted:true});
 outputDeny(f.gate());
});
test('G17 future evidence or out-of-window observation denied',()=>{
 const f=make();f.reSign(0,{observedAtMs:NOW+100});
 outputDeny(f.gate());
 f.reSign(0,{observedAtMs:f.manifest.startedAtMs-100});
 outputDeny(f.gate());
});
test('G18 duplicate evidence alias cannot satisfy independent original-review slots',()=>{
 const f=make();f.reSign(1,{evidenceAlias:f.receipts[0].claim.evidenceAlias});
 outputDeny(f.gate());
});
test('G19 wrong manifest digest or nonce denied',()=>{
 const f=make();f.reSign(0,{manifestHash:'a'.repeat(64)});
 outputDeny(f.gate());
 f.reSign(0,{manifestHash:privateEvidenceManifestHash(f.manifest),nonce:'QA_WRONG_NONCE'});
 outputDeny(f.gate());
});
test('G20 trust registry must be a pinned private OFFLINE-only map',()=>{
 const f=make();outputDeny(f.gate({trustRegistry:{...f.trustRegistry,hostedEnabled:true}}));
 outputDeny(f.gate({trustRegistry:{...f.trustRegistry,source:'CLIENT_JSON'}}));
});
test('G21 even forged future hosted snapshots with all green flags are review-only',()=>{
 const f=make();
 const r=inspectIsolatedCanaryAdmission({evidenceResult:f.gate(),hostedSnapshot:{
  source:'SUPABASE_READ_ONLY_AGGREGATE',productionUnchanged:true,
  providerCredentialsNotRead:true,storesExists:true,storeMembershipsExists:true,
  channelLinksExists:true,storeScopedCommerceColumns:6,
  realOwnerApprovalIndependentlyVerified:true
 }});
 assert.equal(r.status,'INDEPENDENT_PRIVATE_REVIEW_NEEDED_NO_SEND_NO_EXECUTION');
 assert.equal(r.nativeMetaProviderVerified,false);
 assert.equal(r.merchantOwnerVerified,false);
 outputDeny(r);
});
test('G22 no evidence gate equals no source-only canary authority',()=>{
 const r=inspectIsolatedCanaryAdmission({evidenceResult:null});
 assert.equal(r.status,'BLOCKED');outputDeny(r);
});
test('G23 isolated one-event source-only canary exercises NO SEND without real evidence',async()=>{
 const f=make();
 assert.equal(f.gate().status,'STRUCTURAL_FOUR_REVIEWER_CANDIDATE_ONLY');
 const kp=generateKeyPairSync('ed25519');
 const key='QA_ONLY_META_HMAC_TEST_PRIVATE_SECRET_GREATER_32_BYTES';
 const raw=Buffer.from(JSON.stringify({object:'page',entry:[{id:'9900000001',messaging:[{
  sender:{id:'QA_OWNER_M_A'},recipient:{id:'9900000001'},timestamp:NOW,
  message:{mid:'QA_MSG_000001',text:'QA_ORDER PREVIEW QA_SKU_001 1'}
 }]}]}));
 const q=createNativeIssuerNoSendQa({
  registrations:[{channel:'messenger',route_ref:'QA_META_PAGE_A',
   provider_installation_id:'9900000001',tenant:'QA_TENANT_1',store:'QA_STORE_A',
   scope:'SYNTHETIC_ONLY',status:'QA_APPROVED',owner_verified:false}],
  secretByInstallation:new Map([['messenger:QA_META_PAGE_A',key]]),
  trustedIssuerPrivateKey:kp.privateKey,trustedIssuerPublicKey:kp.publicKey,
  actorHmacSecret:Buffer.from('QA_ONLY_HMAC_ACTOR_IN_CI_NOT_REAL_CUSTOMER_KEY_2026'),
  issuerId:'QA_PRIVATE_ISSUER',keyId:'QA_SIGNER_G_1',
  claimReplay:createInMemoryQaReplayClaim(),now:()=>NOW
 });
 const out=await q.receiveNative({channel:'messenger',route_ref:'QA_META_PAGE_A',
  raw_body:raw,headers:{'x-hub-signature-256':'sha256='+
   createHmac('sha256',key).update(raw).digest('hex')}});
 assert.equal(out.route,'PRIVATE_QA_ORDER_CORE_NO_SEND');
 assert.equal(out.command,'ORDER_PREVIEW');
 assert.equal(out.store,'QA_STORE_A');
 assert.equal(out.provider_sends,0);
 assert.equal(out.commerce_writes,0);
 assert.equal(out.native_provider_verified,false);
 assert.equal(q.getCounters().accepted,1);
 assert.equal(q.getCounters().provider_sends,0);
 assert.equal(q.getCounters().real_provider_owners_verified,0);
 assert.equal(f.gate().mayRunHostedNoSendCanary,false);
 assert.throws(()=>q.sendReal(),/REAL_PROVIDER_SEND_DISABLED/);
 assert.throws(()=>q.writeCommerce(),/COMMERCE_WRITE_DISABLED/);
});
