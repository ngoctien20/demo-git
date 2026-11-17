import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {
  offlineRoleSigningBytes,
  inspectThreeRoleOfflineChallenge,
  getPrivateOwnerVerificationPlan,
  prohibitRealAdmissionFromSelfReportedGreen,
  offlineOwnerAudience
} from './v17-7h1-three-role-owner-challenge-offline.mjs';

const NOW=1794912000000;
const ROLES=['owner','operator','reviewer'];
// All private keys are ephemeral test fixtures created in-memory by CI.
// Do not store actual Bot Tokens, real Merchant identities or private keys.
const keysets=Object.fromEntries(ROLES.map((role,i)=>{
 const kp=generateKeyPairSync('ed25519');
 return [role,{privateKey:kp.privateKey,publicKey:kp.publicKey.export({type:'spki',format:'pem'}),
   actorDigest:String(i+1).repeat(64),source:'OFFLINE_TEST_IDENTITY'}];
}));
function fixture(channel='ZALO_BOT') {
 const ticket={
  mode:'OFFLINE_SYNTHETIC_NO_SEND',audience:offlineOwnerAudience,
  challengeId:'challenge-qa-0001',channel,
  installationRef:'installation-qa-0001',
  providerAccountRef:'provider-account-qa-0001',
  issuedAtMs:NOW-1000,expiresAtMs:NOW+120000,
  scope:'ONE_DISPOSABLE_QA_BOT_OR_PAGE_NO_SEND',
  noSend:true,noCommerceRead:true,noCommerceWrite:true,
  signatures:[]
 };
 const trust={source:'OFFLINE_EPHEMERAL_TEST_KEYS',keys:Object.fromEntries(
   ROLES.map(role=>[role,{
     publicKey:keysets[role].publicKey,
     actorDigest:keysets[role].actorDigest,
     source:keysets[role].source
   }])
 )};
 const seen=new Set();
 const deps={mode:'OFFLINE_MEMORY_ONLY',nowMs:NOW,
  reserveChallengeOnce:async x=>seen.has(x)?false:(seen.add(x),true)};
 const reseal=()=>{ticket.signatures=ROLES.map(role=>({
   role,signature:sign(null,offlineRoleSigningBytes(ticket,role),
      keysets[role].privateKey).toString('base64url')
 }))};
 reseal();
 return {ticket,trust,deps,reseal};
}
function locked(r) {
 for(const k of ['providerBotOwnerAuthenticated','providerAdminRoleReadbackVerified',
   'realStoreOwnerAuthenticated','independentOperatorAuthenticated',
   'independentReviewerAuthenticated','realProviderWebhookSignatureVerified',
   'realHostedDurableReplayVerified','realStoreAbJwtRlsVerified',
   'canOpenPublicCallback','canChangeProviderWebhook',
   'canUseProductionCredential','canSendProviderMessage',
   'canReadCommerce','canWriteCommerce','canPublish'])
   assert.equal(r[k],false,k);
 assert.equal(r.sourceOnly,true);
}
async function denied(reason,mutation,channel='ZALO_BOT'){
 const f=fixture(channel);mutation(f);
 const r=await inspectThreeRoleOfflineChallenge(f.ticket,f.trust,f.deps);
 assert.equal(r.cryptographicFixtureCandidate,false,JSON.stringify(r));
 assert.equal(r.reason,reason);
 locked(r);
}
for(const channel of ['ZALO_BOT','MESSENGER']) {
 test(channel+' three valid Ed25519 offline signatures do NOT verify real provider owner',async()=>{
  const f=fixture(channel),r=await inspectThreeRoleOfflineChallenge(f.ticket,f.trust,f.deps);
  assert.equal(r.cryptographicFixtureCandidate,true);
  assert.equal(r.verifiedSyntheticSignatureCount,3);
  assert.equal(r.realSourceReadbacks,0);
  assert.equal(r.independentlyVerifiedProviderOwnerCount,0);
  locked(r);
 });
 test(channel+' second identical ticket is replay-denied by synthetic registry',async()=>{
  const f=fixture(channel);
  assert.equal((await inspectThreeRoleOfflineChallenge(f.ticket,f.trust,f.deps)).cryptographicFixtureCandidate,true);
  const again=await inspectThreeRoleOfflineChallenge(f.ticket,f.trust,f.deps);
  assert.equal(again.reason,'CHALLENGE_ALREADY_USED_OR_REPLAYED');
  locked(again);
 });
 test(channel+' owner ticket plan is scope-only, never permissions',()=>{
  const r=getPrivateOwnerVerificationPlan(channel);
  assert.equal(r.steps.length,7);
  assert.equal(r.admissionState,'REAL_OWNER_PROVIDER_UAT_NO_GO');
  locked(r);
 });
}
test('OA is a separate provider, not a Bot shortcut',()=>{
 const r=getPrivateOwnerVerificationPlan('ZALO_OA');
 assert.equal(r.reason,'NO_OWNER_ADMISSION_FOR_OA_OR_UNSUPPORTED_CHANNEL');
 locked(r);
});
test('no Telegram owner admission as a customer ingress',()=>{
 const r=getPrivateOwnerVerificationPlan('TELEGRAM');
 assert.equal(r.reason,'NO_OWNER_ADMISSION_FOR_OA_OR_UNSUPPORTED_CHANNEL');
 locked(r);
});
test('malformed ticket denied',async()=>{
 const f=fixture(),r=await inspectThreeRoleOfflineChallenge(null,f.trust,f.deps);
 assert.equal(r.reason,'CHALLENGE_NOT_PRIVATE_QA_ONLY');locked(r);
});
test('real mode never accepted',async()=>denied('CHALLENGE_NOT_PRIVATE_QA_ONLY',f=>f.ticket.mode='HOSTED'));
test('wrong audience rejected',async()=>denied('CHALLENGE_NOT_PRIVATE_QA_ONLY',f=>f.ticket.audience='PROD'));
test('broad scope rejected',async()=>denied('CHALLENGE_NOT_PRIVATE_QA_ONLY',f=>f.ticket.scope='ALL_STORES'));
test('enable send cannot pass',async()=>denied('CHALLENGE_NOT_PRIVATE_QA_ONLY',f=>f.ticket.noSend=false));
test('enable Commerce reader cannot pass',async()=>denied('CHALLENGE_NOT_PRIVATE_QA_ONLY',f=>f.ticket.noCommerceRead=false));
test('enable Commerce writer cannot pass',async()=>denied('CHALLENGE_NOT_PRIVATE_QA_ONLY',f=>f.ticket.noCommerceWrite=false));
for(const field of ['jwt','token','cookie','phone','email','name','providerAdmin','storeId','tenantId',
  'customer','rawWebhook','proofVerified','sendMessage','sourceRow']) {
 test('unknown top-level identity or permission '+field+' denied',async()=>denied(
  'CHALLENGE_NOT_PRIVATE_QA_ONLY',f=>f.ticket[field]='UNTRUSTED'));
}
test('wrong channel not accepted',async()=>denied('UNPINNED_PROVIDER_OR_CHALLENGE_TIMEBOX',f=>f.ticket.channel='ZALO_OA'));
test('short installation reference denied',async()=>denied('UNPINNED_PROVIDER_OR_CHALLENGE_TIMEBOX',f=>f.ticket.installationRef='A'));
test('missing provider account reference denied',async()=>denied('UNPINNED_PROVIDER_OR_CHALLENGE_TIMEBOX',f=>f.ticket.providerAccountRef=''));
test('invalid challenge ID denied',async()=>denied('UNPINNED_PROVIDER_OR_CHALLENGE_TIMEBOX',f=>f.ticket.challengeId='bad'));
test('issue after expiry denied',async()=>denied('UNPINNED_PROVIDER_OR_CHALLENGE_TIMEBOX',f=>f.ticket.expiresAtMs=f.ticket.issuedAtMs-1));
test('overlong 10 minute challenge denied',async()=>denied('UNPINNED_PROVIDER_OR_CHALLENGE_TIMEBOX',f=>f.ticket.expiresAtMs=f.ticket.issuedAtMs+700000));
test('expired now challenge denied',async()=>denied('OFFLINE_REPLAY_OR_TIMEBOX_NOT_ESTABLISHED',f=>f.deps.nowMs=NOW+900000));
test('future challenge not yet issued denied',async()=>denied('OFFLINE_REPLAY_OR_TIMEBOX_NOT_ESTABLISHED',f=>f.deps.nowMs=NOW-10000));
test('missing durable test double denied',async()=>denied('OFFLINE_REPLAY_OR_TIMEBOX_NOT_ESTABLISHED',f=>delete f.deps.reserveChallengeOnce));
test('live replay mode denied',async()=>denied('OFFLINE_REPLAY_OR_TIMEBOX_NOT_ESTABLISHED',f=>f.deps.mode='REAL'));
test('missing trusted registry denied',async()=>denied('THREE_DISTINCT_INDEPENDENT_ROLES_REQUIRED',f=>f.trust.source='USER_SUPPLIED'));
test('missing reviewer key denied',async()=>denied('THREE_DISTINCT_INDEPENDENT_ROLES_REQUIRED',f=>delete f.trust.keys.reviewer));
test('missing owner signature denied',async()=>denied('THREE_DISTINCT_INDEPENDENT_ROLES_REQUIRED',f=>f.ticket.signatures.pop()));
test('duplicate operator signature cannot replace reviewer',async()=>denied('THREE_DISTINCT_INDEPENDENT_ROLES_REQUIRED',f=>{
 f.ticket.signatures[2].role='operator'
}));
test('wrong signature base64url denied',async()=>denied('SIGNER_RECEIPT_SHAPE_INVALID',f=>f.ticket.signatures[0].signature='bad'));
test('unknown signature extra key denied',async()=>denied('SIGNER_RECEIPT_SHAPE_INVALID',f=>f.ticket.signatures[0].jwt='xyz'));
test('missing actor digest denied',async()=>denied('SIGNER_RECEIPT_SHAPE_INVALID',f=>f.trust.keys.owner.actorDigest=''));
test('untrusted public key source denied',async()=>denied('SIGNER_RECEIPT_SHAPE_INVALID',f=>f.trust.keys.owner.source='PROVIDER_SELF_ATTESTED'));
test('same actor owner & operator denied',async()=>denied('SAME_ACTOR_OR_KEY_REUSED_FOR_MULTIPLE_ROLES',f=>
 f.trust.keys.operator.actorDigest=f.trust.keys.owner.actorDigest));
test('same key operator and reviewer denied',async()=>denied('SAME_ACTOR_OR_KEY_REUSED_FOR_MULTIPLE_ROLES',f=>
 f.trust.keys.reviewer.publicKey=f.trust.keys.operator.publicKey));
test('mutated provider ID invalidates existing signed challenge',async()=>denied('ROLE_SIGNATURE_INVALID_OR_CHALLENGE_TAMPERED',f=>
 f.ticket.providerAccountRef='provider-account-qa-0002'));
test('mutated Store-scoped installation invalidates signatures',async()=>denied('ROLE_SIGNATURE_INVALID_OR_CHALLENGE_TAMPERED',f=>
 f.ticket.installationRef='installation-qa-0002'));
test('valid-format but forged owner signature denied',async()=>denied('ROLE_SIGNATURE_INVALID_OR_CHALLENGE_TAMPERED',f=>
 f.ticket.signatures[0].signature=f.ticket.signatures[1].signature));
test('missing authority cannot silently become live even if all-green',()=>{
 const r=prohibitRealAdmissionFromSelfReportedGreen({
  botCreatorOwner:true,getMe:true,sameTenantJwt:true,
  independentOperator:true,providerWebhook:true,approval:true
 });
 assert.equal(r.blocked.length,6);
 assert.equal(r.cryptographicFixtureCandidate,false);
 locked(r);
});
test('replay backend throws => deny closed',async()=>denied('REPLAY_BACKEND_UNAVAILABLE',f=>
 f.deps.reserveChallengeOnce=async()=>{throw Error('SIMULATED_DOWN')}));
test('replay backend returns non-boolean => deny',async()=>denied('CHALLENGE_ALREADY_USED_OR_REPLAYED',f=>
 f.deps.reserveChallengeOnce=async()=>1));
