'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {CONTRACT,PURPOSE,verifyProviderPayload,
 reviewAuthorityPacket,inspectReviewCandidate}=require('./private-provider-authority-gate.cjs');

const now=Date.parse('2026-11-17T04:00:00Z');
const fakeAppSecret='QA_META_EPHEMERAL_ONLY_abcdefghijklmnopqrstuvwxyz';
const fakeBotSecret='QA_BOT_EPHEMERAL_ONLY_abcdefghijklmnopqrstuvwxyz';
const raw=Buffer.from('{"object":"page","entry":[{"id":"QA_PAGE_A","messaging":[]}]}','utf8');
const metaSig=(payload,secret=fakeAppSecret)=>
 'sha256='+crypto.createHmac('sha256',secret).update(payload).digest('hex');
const dig=s=>crypto.createHash('sha256').update('QA_ONLY_COMMITMENT_V1|'+s).digest('hex');
const {privateKey:ownerPrivate,publicKey:ownerPublic}=crypto.generateKeyPairSync('ed25519');
const {privateKey:reviewerPrivate,publicKey:reviewerPublic}=crypto.generateKeyPairSync('ed25519');
const trust={
 owner:{keyId:'qa_owner_key_001',role:'MERCHANT_OWNER',organization:'QA_FakeMerchant',
  publicKey:ownerPublic},
 reviewer:{keyId:'qa_reviewer_key_001',role:'INDEPENDENT_REVIEWER',
  organization:'QA_IndependentLab',publicKey:reviewerPublic}
};
const shape=()=>({
 contract:CONTRACT,purpose:PURPOSE,environment:'PRIVATE_REVIEW_ONLY',
 provider:'MESSENGER',
 installationDigest:dig('PAGE_A'),tenantDigest:dig('TENANT_QA_1'),storeDigest:dig('STORE_QA_A'),
 registryDigest:dig('REGISTRY_QA_V1'),
 providerOwnerProofDigest:dig('FAKE_PAGE_AUTHORITY'),
 merchantOwnerProofDigest:dig('FAKE_MERCHANT_OWNER'),
 independentSourceProofDigest:dig('FAKE_EXTERNAL_RECORD'),
 ownerKeyId:trust.owner.keyId,reviewerKeyId:trust.reviewer.keyId,
 registryVersion:1,issuedAtMs:now-60000,expiresAtMs:now+600000,noSend:true
});
const canonical=m=>{
 const keys=['contract','purpose','environment','provider','installationDigest',
 'tenantDigest','storeDigest','registryDigest','providerOwnerProofDigest',
 'merchantOwnerProofDigest','independentSourceProofDigest',
 'ownerKeyId','reviewerKeyId','registryVersion','issuedAtMs','expiresAtMs','noSend'];
 return Buffer.from(JSON.stringify(Object.fromEntries(keys.map(k=>[k,m[k]]))),'utf8');
};
const signed=(modify=()=>{})=>{
 const manifest=shape();modify(manifest);
 const bytes=canonical(manifest);
 return {manifest,ownerSignature:crypto.sign(null,bytes,ownerPrivate).toString('base64'),
 reviewerSignature:crypto.sign(null,bytes,reviewerPrivate).toString('base64')};
};
const metaOpts=(changes={})=>({provider:'MESSENGER',rawBody:raw,
 signatureHeader:metaSig(raw),providerSecret:fakeAppSecret,...changes});
const inspectOpts=(changes={})=>({...metaOpts(),packet:signed(),trust,nowMs:now,...changes});
function refuse(name,patch,expected){
 test(name,()=>{
  const opts=inspectOpts();patch(opts);
  const r=inspectReviewCandidate(opts);
  assert.equal(r.status.endsWith('NO_GO'),true);
  assert.equal(r.canReceiveRealTraffic,false);
  assert.equal(r.canPublish,false);
  assert.equal(r.canReadHostedCommerce,false);
  assert.equal(r.ordersWritten,0);
  assert.equal(r.hostedWrites,0);
  assert.equal(r.reason,expected);
 });
}
function badPacket(name,edit,expected){
 test(name,()=>{
  const p=signed(edit);
  const r=reviewAuthorityPacket(p,trust,now);
  assert.equal(r.reason,expected);
  assert.equal(r.actualProviderOwnerAttested,false);
  assert.equal(r.canPublish,false);
 });
}
test('valid fake Meta HMAC over raw bytes passes crypto-only preflight',()=>{
 const result=verifyProviderPayload(metaOpts());
 assert.equal(result.status,'CRYPTOGRAPHIC_PREFLIGHT_ONLY');
 assert.equal(result.cryptographicCheckPassed,true);
 assert.equal(result.actualProviderOwnerAttested,false);
 assert.equal(result.canReceiveRealTraffic,false);
});
test('signed payload with Unicode roundtrips byte-for-byte only',()=>{
 const payload=Buffer.from('{"text":"áo đen 🧥"}','utf8');
 assert.equal(verifyProviderPayload(metaOpts({rawBody:payload,signatureHeader:metaSig(payload)}))
   .cryptographicCheckPassed,true);
 assert.equal(verifyProviderPayload(metaOpts({rawBody:Buffer.from('{"text":"ao den"}'),
   signatureHeader:metaSig(payload)})).cryptographicCheckPassed,false);
});
test('different byte order with same parsed JSON cannot verify',()=>{
 const bodyA=Buffer.from('{"a":1,"b":2}');
 const bodyB=Buffer.from('{"b":2,"a":1}');
 assert.equal(verifyProviderPayload(metaOpts({rawBody:bodyB,signatureHeader:metaSig(bodyA)}))
  .reason,'PROVIDER_CRYPTO_CHECK_FAILED');
});
test('missing Meta header refused',()=>{
 assert.equal(verifyProviderPayload(metaOpts({signatureHeader:null})).reason,'SIGNATURE_HEADER_MISSING');
});
test('Meta malformed/legacy sha1 format refused',()=>{
 assert.equal(verifyProviderPayload(metaOpts({signatureHeader:'sha1='+('0'.repeat(40))}))
  .reason,'META_SIGNATURE_FORMAT_INVALID');
});
test('Meta wrong HMAC refused',()=>{
 assert.equal(verifyProviderPayload(metaOpts({signatureHeader:'sha256='+('0'.repeat(64))}))
  .reason,'PROVIDER_CRYPTO_CHECK_FAILED');
});
test('Meta wrong app secret refused',()=>{
 assert.equal(verifyProviderPayload(metaOpts({providerSecret:'QA_ANOTHER_EPHEMERAL_SECRET_FOOBAR'}))
  .reason,'PROVIDER_CRYPTO_CHECK_FAILED');
});
test('empty raw body refused',()=>{
 assert.equal(verifyProviderPayload(metaOpts({rawBody:Buffer.alloc(0)}))
  .reason,'RAW_BYTES_NOT_PRESERVED_OR_OVERSIZED');
});
test('body as decoded object refused, even with matching signature string',()=>{
 assert.equal(verifyProviderPayload(metaOpts({rawBody:{object:'page'}}))
  .reason,'RAW_BYTES_NOT_PRESERVED_OR_OVERSIZED');
});
test('oversized raw body refused',()=>{
 assert.equal(verifyProviderPayload(metaOpts({rawBody:Buffer.alloc(131073)}))
  .reason,'RAW_BYTES_NOT_PRESERVED_OR_OVERSIZED');
});
test('no private app secret refused',()=>{
 assert.equal(verifyProviderPayload(metaOpts({providerSecret:''}))
  .reason,'PRIVATE_SECRET_MISSING_OR_INVALID');
});
test('minimum-length secret enforced',()=>{
 assert.equal(verifyProviderPayload(metaOpts({providerSecret:'test'}))
  .reason,'PRIVATE_SECRET_MISSING_OR_INVALID');
});
test('oversized secret refused',()=>{
 assert.equal(verifyProviderPayload(metaOpts({providerSecret:'a'.repeat(257)}))
  .reason,'PRIVATE_SECRET_MISSING_OR_INVALID');
});
test('Zalo Bot matching fake secret header is not HMAC or real provider proof',()=>{
 const r=verifyProviderPayload({provider:'ZALO_BOT',rawBody:raw,
  signatureHeader:fakeBotSecret,providerSecret:fakeBotSecret});
 assert.equal(r.status,'CRYPTOGRAPHIC_PREFLIGHT_ONLY');
 assert.equal(r.cryptographicCheckPassed,true);
 assert.equal(r.canReceiveRealTraffic,false);
});
test('Zalo Bot invalid secret header denied',()=>{
 const r=verifyProviderPayload({provider:'ZALO_BOT',rawBody:raw,
  signatureHeader:'QA_WRONG_HEADER',providerSecret:fakeBotSecret});
 assert.equal(r.reason,'PROVIDER_CRYPTO_CHECK_FAILED');
});
test('Zalo Bot matching header does not attest payload integrity',()=>{
 const r=verifyProviderPayload({provider:'ZALO_BOT',rawBody:Buffer.from('{"content":"attacker-modified"}'),
  signatureHeader:fakeBotSecret,providerSecret:fakeBotSecret});
 assert.equal(r.cryptographicCheckPassed,true);
 assert.equal(r.canReceiveRealTraffic,false);
});
test('Zalo OA blocked until independently verified official native callback contract',()=>{
 assert.equal(verifyProviderPayload({provider:'ZALO_OA',rawBody:raw,
  signatureHeader:metaSig(raw),providerSecret:fakeAppSecret})
  .reason,'ZALO_OA_NATIVE_VERIFICATION_NOT_PROVEN');
});
test('Website fake HMAC blocked pending real website session issuer',()=>{
 assert.equal(verifyProviderPayload({provider:'WEBSITE',rawBody:raw,
  signatureHeader:metaSig(raw),providerSecret:fakeAppSecret})
  .reason,'WEBSITE_PRIVATE_SESSION_ISSUER_NOT_PROVEN');
});
test('unknown provider blocked',()=>{
 assert.equal(verifyProviderPayload({provider:'FAKE_META',rawBody:raw,
  signatureHeader:metaSig(raw),providerSecret:fakeAppSecret})
  .reason,'UNSUPPORTED_PROVIDER');
});
test('valid fake independent signatures check structure but cannot authorize real traffic',()=>{
 const r=reviewAuthorityPacket(signed(),trust,now);
 assert.equal(r.status,'SIGNED_PRIVATE_PACKET_STRUCTURE_PASSED__STILL_NO_GO');
 assert.equal(r.signedAuthorityPacketStructurallyVerified,true);
 assert.equal(r.actualMerchantStoreOwnershipAttested,false);
 assert.equal(r.actualIndependentSourceEvidenceInspected,false);
 assert.equal(r.canPublish,false);
});
test('fake HMAC and fake dual signatures cannot become a LIVE signed-admission token',()=>{
 const r=inspectReviewCandidate(inspectOpts());
 assert.equal(r.status,'CRYPTO_AND_SIGNED_PACKET_STRUCTURALLY_PASSED__HOSTED_NO_GO');
 assert.equal(r.cryptographicCheckPassed,true);
 assert.equal(r.signedAuthorityPacketStructurallyVerified,true);
 assert.equal(r.actualProviderOwnerAttested,false);
 assert.equal(r.canReceiveRealTraffic,false);
 assert.equal(r.providerSends,0);
});
test('private packet with both signatures missing is rejected',()=>{
 const p=signed();p.ownerSignature='';
 assert.equal(reviewAuthorityPacket(p,trust,now).reason,'AUTHORITY_SIGNATURE_FORMAT_INVALID');
});
test('self-issued fake public keys in the packet are rejected as extra fields',()=>{
 const p=signed();p.trustAnchors=trust;
 assert.equal(reviewAuthorityPacket(p,trust,now).reason,'PACKET_SCHEMA_OR_SOURCE_CLAIM_INVALID');
});
test('missing original source proof digest denies source structure',()=>{
 const p=signed();p.manifest.independentSourceProofDigest='';
 assert.equal(reviewAuthorityPacket(p,trust,now).reason,'PRIMARY_SOURCE_DIGEST_INVALID');
});
test('tampered manifest after signing is rejected cryptographically',()=>{
 const p=signed();p.manifest.storeDigest=dig('ATTACK_STORE_B');
 assert.equal(reviewAuthorityPacket(p,trust,now).reason,'OWNER_OR_REVIEWER_SIGNATURE_INVALID');
});
test('forged reviewer signature rejected',()=>{
 const p=signed();p.reviewerSignature=crypto.sign(null,canonical(p.manifest),ownerPrivate).toString('base64');
 assert.equal(reviewAuthorityPacket(p,trust,now).reason,'OWNER_OR_REVIEWER_SIGNATURE_INVALID');
});
test('wrong reviewer trust root rejected even with valid signature',()=>{
 const t={owner:trust.owner,reviewer:{...trust.reviewer,publicKey:ownerPublic}};
 assert.equal(reviewAuthorityPacket(signed(),t,now).reason,'OWNER_OR_REVIEWER_SIGNATURE_INVALID');
});
test('same organization cannot self-certify independent reviewer',()=>{
 const t={owner:trust.owner,reviewer:{...trust.reviewer,organization:trust.owner.organization}};
 assert.equal(reviewAuthorityPacket(signed(),t,now).reason,'INDEPENDENT_REVIEWER_TRUST_NOT_ESTABLISHED');
});
test('wrong reviewer role not accepted',()=>{
 const t={owner:trust.owner,reviewer:{...trust.reviewer,role:'MERCHANT_OWNER'}};
 assert.equal(reviewAuthorityPacket(signed(),t,now).reason,'INDEPENDENT_REVIEWER_TRUST_NOT_ESTABLISHED');
});
test('wrong owner role not accepted',()=>{
 const t={owner:{...trust.owner,role:'ANONYMOUS'},reviewer:trust.reviewer};
 assert.equal(reviewAuthorityPacket(signed(),t,now).reason,'INDEPENDENT_REVIEWER_TRUST_NOT_ESTABLISHED');
});
test('no trusted public keys is a hard deny',()=>{
 assert.equal(reviewAuthorityPacket(signed(),null,now).reason,'PRIVATE_TRUST_ANCHORS_UNAVAILABLE');
});
test('client-supplied owner key cannot be part of signed manifest',()=>{
 const p=signed();p.manifest.publicKey='ATTACKER';
 assert.equal(reviewAuthorityPacket(p,trust,now).reason,'PACKET_SCHEMA_OR_SOURCE_CLAIM_INVALID');
});
badPacket('purpose cannot authorize order write',m=>m.purpose='CREATE_ORDER',
 'AUTHORITY_SCOPE_MISMATCH');
badPacket('environment must remain private',m=>m.environment='PRODUCTION',
 'AUTHORITY_SCOPE_MISMATCH');
badPacket('noSend must be true',m=>m.noSend=false,
 'AUTHORITY_SCOPE_MISMATCH');
badPacket('registry version must be pinned positive integer',m=>m.registryVersion=0,
 'AUTHORITY_TIME_OR_VERSION_INVALID');
badPacket('approval expiration cannot be in the past',m=>m.expiresAtMs=now-1,
 'AUTHORITY_TIME_OR_VERSION_INVALID');
badPacket('approval not more than 30 min',m=>m.expiresAtMs=m.issuedAtMs+31*60000,
 'AUTHORITY_TIME_OR_VERSION_INVALID');
badPacket('issuedAt cannot be in far future',m=>m.issuedAtMs=now+120000,
 'AUTHORITY_TIME_OR_VERSION_INVALID');
badPacket('reviewer key must differ from owner key',m=>m.reviewerKeyId=m.ownerKeyId,
 'OWNER_REVIEWER_NOT_DISTINCT');
badPacket('cannot omit provider source proof digest',m=>m.providerOwnerProofDigest='0'.repeat(64),
 'PRIMARY_SOURCE_DIGEST_INVALID');
badPacket('registry digest must be correct shape',m=>m.registryDigest='unsourced',
 'PRIMARY_SOURCE_DIGEST_INVALID');
refuse('real signed candidate with fake valid HMAC but fake packet remains NO-GO',
 o=>{o.packet.manifest.provider='ZALO_BOT';},
 'OWNER_OR_REVIEWER_SIGNATURE_INVALID');
refuse('wrong provider manifest cannot authorize Messenger',o=>{
  o.packet=signed(m=>m.provider='ZALO_BOT');
 },'PACKET_PROVIDER_MISMATCH');
refuse('wrong secret fail closed even if packet signed',o=>{
  o.providerSecret='QA_DIFFERENT_LONG_SECRET_123456789';
 },'PROVIDER_CRYPTO_CHECK_FAILED');
refuse('expired Authority packet fails even if provider HMAC correct',o=>{
  o.packet=signed(m=>m.expiresAtMs=now-10);
 },'AUTHORITY_TIME_OR_VERSION_INVALID');
test('no raw Page/Store IDs, tokens or private key material emitted in response',()=>{
 const text=JSON.stringify(inspectReviewCandidate(inspectOpts()));
 for(const val of [fakeAppSecret,'QA_PAGE_A','FAKE_PAGE_AUTHORITY',
   'FAKE_MERCHANT_OWNER',dig('STORE_QA_A'),'BEGIN PRIVATE KEY'])
  assert.equal(text.includes(val),false,val);
});
test('nonexistent packet is always denied',()=>{
 assert.equal(reviewAuthorityPacket(null,trust,now).canPublish,false);
 assert.equal(inspectReviewCandidate({...metaOpts(),trust,nowMs:now}).canReceiveRealTraffic,false);
});
