import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {SCOPE,REAL_GETME_OBSERVATION,classifyRealGetMeObservation,checkDetachedPrivateReceipt} from './private-provider-evidence.mjs';

const fixedNow=1794927300000;
const owner=generateKeyPairSync('ed25519'),reviewer=generateKeyPairSync('ed25519');
const other=generateKeyPairSync('ed25519');
const pem=(p)=>p.export({format:'pem',type:'spki'}).toString();
const trustedLookingButCallerSupplied={
 ownerPublicKeyPem:pem(owner.publicKey),reviewerPublicKeyPem:pem(reviewer.publicKey)
};
const digest='a'.repeat(64),nonce='b'.repeat(32);
function packetBody(){
 return {scope:SCOPE,purpose:'PRIVATE_PROVIDER_ONLY_NO_SEND',provider:'zalo-bot',
 installationClass:'DEDICATED_DISPOSABLE_QA',syntheticOrReal:'REAL_PRIVATE_EVENT_EVIDENCE',
 eventEvidenceDigest:digest,eventNonce:nonce,ownerConsentEvidenceRef:'c'.repeat(64),
 operatorEvidenceRef:'d'.repeat(64),reviewerEvidenceRef:'e'.repeat(64),
 issuerProject:'tien404-staging-private',issuedAt:fixedNow-60000,expiresAt:fixedNow+60000,
 noSendBoundary:true,noWriteBoundary:true};
}
function signPacket(body=packetBody(),keyA=owner.privateKey,keyB=reviewer.privateKey){
 const sorted={};for(const k of Object.keys(body).sort())sorted[k]=body[k];
 const signed=Buffer.from('TIEN404-V17.23Q-PRIVATE-RECEIPT-V1\n'+JSON.stringify(sorted),'utf8');
 return {body,ownerSignature:sign(null,signed,keyA).toString('base64url'),reviewerSignature:sign(null,signed,keyB).toString('base64url')};
}
test('real n8n getMe observation matches sanitized connector evidence',()=>{
 const x=classifyRealGetMeObservation({...REAL_GETME_OBSERVATION});
 assert.equal(x.status,'REAL_BOT_GETME_READONLY_OBSERVED');
 assert.equal(x.matchesRecordedReadOnlyObservation,true);
 assert.equal(x.independentCredentialValidationAccepted,false);
 assert.equal(x.dedicatedQaBotOwnershipAccepted,false);
 assert.equal(x.nativeSignedWebhookEventAccepted,false);
 assert.equal(x.realJwtAccepted,false);
 assert.equal(x.canStartPrivateCanary,false);
});
test('missing bot check is NOT accepted',()=>assert.equal(classifyRealGetMeObservation().status,'REAL_GETME_REAUDIT'));
for(const k of Object.keys(REAL_GETME_OBSERVATION))
 test('bot check tamper '+k,()=>{const r=classifyRealGetMeObservation({...REAL_GETME_OBSERVATION,[k]:'FAKE'});assert.equal(r.status,'REAL_GETME_REAUDIT');assert.ok(r.blockers.includes('OBSERVATION_CHANGED_'+k.toUpperCase()))});
test('bot observation cannot contain raw auth/PII extras',()=>{
 const r=classifyRealGetMeObservation({...REAL_GETME_OBSERVATION,accessToken:'HIDDEN_UNSAFE_TOKEN'});
 assert.equal(r.status,'REAL_GETME_REAUDIT');assert.ok(!JSON.stringify(r).includes('HIDDEN_UNSAFE_TOKEN'));
});
test('two caller-supplied Ed25519 keys cryptographically consistent but never independent proof',()=>{
 const r=checkDetachedPrivateReceipt(signPacket(),trustedLookingButCallerSupplied,fixedNow);
 assert.equal(r.cryptographicConsistency,true);
 assert.equal(r.status,'INDEPENDENT_EVIDENCE_NO_GO');
 assert.equal(r.independentAuthorityAccepted,false);
 assert.equal(r.realProviderOriginAccepted,false);
 assert.equal(r.canStartCanary,false);
 assert.equal(r.canSetWebhook,false);
 assert.equal(r.canReadOrder,false);
 assert.ok(r.reasons.includes('TRUSTED_PRIVATE_KEY_REGISTRY_AND_REPLAY_NOT_CONNECTED'));
});
test('same packet repeated remains NOT replay approved',()=>{
 const p=signPacket();const first=checkDetachedPrivateReceipt(p,trustedLookingButCallerSupplied,fixedNow);
 const second=checkDetachedPrivateReceipt(p,trustedLookingButCallerSupplied,fixedNow);
 assert.equal(first.status,'INDEPENDENT_EVIDENCE_NO_GO');assert.equal(second.status,'INDEPENDENT_EVIDENCE_NO_GO');
});
test('owner-signed but wrong reviewer private key rejected',()=>{
 const p=signPacket(packetBody(),owner.privateKey,other.privateKey);
 const r=checkDetachedPrivateReceipt(p,trustedLookingButCallerSupplied,fixedNow);
 assert.equal(r.cryptographicConsistency,false);
});
test('wrong owner key rejected',()=>{
 const r=checkDetachedPrivateReceipt(signPacket(),{...trustedLookingButCallerSupplied,ownerPublicKeyPem:pem(other.publicKey)},fixedNow);
 assert.equal(r.cryptographicConsistency,false);
});
test('same owner and reviewer key rejected',()=>{
 const p=signPacket(packetBody(),owner.privateKey,owner.privateKey);
 const r=checkDetachedPrivateReceipt(p,{ownerPublicKeyPem:pem(owner.publicKey),reviewerPublicKeyPem:pem(owner.publicKey)},fixedNow);
 assert.equal(r.cryptographicConsistency,false);assert.ok(r.reasons.includes('TWO_DISTINCT_EXTERNAL_KEYS_REQUIRED'));
});
test('signatures from different bodies rejected',()=>{
 const p=signPacket();p.body={...p.body,provider:'meta-messenger'};
 assert.equal(checkDetachedPrivateReceipt(p,trustedLookingButCallerSupplied,fixedNow).cryptographicConsistency,false);
});
test('malformed signatures rejected',()=>{
 const p=signPacket();p.ownerSignature='not-valid';assert.equal(checkDetachedPrivateReceipt(p,trustedLookingButCallerSupplied,fixedNow).cryptographicConsistency,false);
});
test('required two signatures',()=>{
 const p=signPacket();delete p.reviewerSignature;
 assert.ok(checkDetachedPrivateReceipt(p,trustedLookingButCallerSupplied,fixedNow).reasons.includes('TWO_SIGNATURES_REQUIRED'));
});
test('no packet denied',()=>assert.equal(checkDetachedPrivateReceipt().status,'INVALID_ENVELOPE'));
const mutated=[
 ['scope','OTHER_SCOPE'],
 ['purpose','ALLOW_SEND'],
 ['provider','FAKE_PROVIDER'],
 ['installationClass','EXISTING_LIVE_BOT'],
 ['syntheticOrReal','SYNTHETIC_ONLY'],
 ['eventEvidenceDigest','invalid'],
 ['eventNonce','short'],
 ['ownerConsentEvidenceRef','fake'],
 ['operatorEvidenceRef','fake'],
 ['reviewerEvidenceRef','fake'],
 ['issuerProject','production'],
 ['noSendBoundary',false],
 ['noWriteBoundary',false],
 ['issuedAt',fixedNow+1],
 ['expiresAt',fixedNow-1],
 ['expiresAt',fixedNow+999999]
];
for(const [field,bad] of mutated)test('private evidence rejects forged '+field,()=>{
 const p=signPacket({...packetBody(),[field]:bad});
 const r=checkDetachedPrivateReceipt(p,trustedLookingButCallerSupplied,fixedNow);
 assert.equal(r.status,'INDEPENDENT_EVIDENCE_NO_GO');
 assert.equal(r.cryptographicConsistency,false);
});
for(const field of ['jwt','token','accessToken','refreshToken','serviceRole','appSecret','botToken','oaSecret','apiKey','webhookUrl','rawBody','payload','eventBody','signatureHeader','customerId','customerPhone','merchantId','storeId','tenantId','ownerDocument','pageId','oaId','chatId','userId','password'])
 test('raw private input refused and never echoed '+field,()=>{
 const token='PRIVATE_TOKEN_NEVER_ECHO_773';
 const p=signPacket({...packetBody(),[field]:token});
 const r=checkDetachedPrivateReceipt(p,trustedLookingButCallerSupplied,fixedNow);
 assert.equal(r.cryptographicConsistency,false);
 assert.ok(!JSON.stringify(r).includes(token));
 assert.ok(r.reasons.includes('UNKNOWN_OR_SENSITIVE_FIELD'));
});
test('private packet additional credential blocked',()=>{
 const p={...signPacket(),privateKey:'NOT_A_REAL_KEY_DO_NOT_ECHO'};
 const r=checkDetachedPrivateReceipt(p,trustedLookingButCallerSupplied,fixedNow);
 assert.ok(r.reasons.includes('PRIVATE_INPUT_OR_EXTRA_ENVELOPE_FIELD'));
 assert.equal(JSON.stringify(r).includes('NOT_A_REAL_KEY_DO_NOT_ECHO'),false);
});
test('private receipt key PEM itself not printed',()=>{
 const r=checkDetachedPrivateReceipt(signPacket(),trustedLookingButCallerSupplied,fixedNow);
 assert.ok(!JSON.stringify(r).includes('BEGIN PUBLIC KEY'));
});
test('all default gates deny hosted provider and real JWT',()=>{
 const r=checkDetachedPrivateReceipt(signPacket(),trustedLookingButCallerSupplied,fixedNow);
 for(const k of ['canStartCanary','canUseJwt','canSetWebhook','canSend','canReadOrder','canDeploy'])assert.equal(r[k],false);
});
