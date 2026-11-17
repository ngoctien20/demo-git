import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign, createHash} from 'node:crypto';
import {
  evaluatePrivateOaCanaryAdmission, inspectDedicatedAccessConfig,
  verifyOfflineAttestationEnvelope
} from './oa-04c-attestation-offline.mjs';
const NOW=1794900000000;
const sha=s=>createHash('sha256').update(s).digest('hex');
const mint=(payload,key)=>({payload,signature:sign(null,Buffer.from(JSON.stringify(payload)),key).toString('base64url')});
function fixture(){
 const merchantKeys=generateKeyPairSync('ed25519');
 const operatorKeys=generateKeyPairSync('ed25519');
 const access={id:'access-app-qa-1',name:'TIEN404 OA QA ONLY',type:'self_hosted',
   aud:'aud-zalo-qa-1',domain:'tien404-oa-qa.tien404.workers.dev',
   enabled:true,policies:[{decision:'allow',active:true,allowedActorIds:['operator-2']}]};
 const pinned={name:access.name,aud:access.aud,domain:access.domain};
 const owner={actorId:'owner-1',sessionId:'owner-session',authenticated:true,revoked:false};
 const operator={actorId:'operator-2',aud:access.aud,accessVerified:true,revoked:false};
 const m={
   kind:'MERCHANT_OA_GRANT',audience:'TIEN404_QA_ZALO_OA_OWNER_V1',version:1,
   appId:'360846524940903967',oaId:'388613280879808645',
   claimedCallbackOaId:'388613280879808645',
   profileReadbackOaId:'388613280879808645',
   tenantId:'tenant-1',storeId:'store-A',ownerActorId:'owner-1',
   sessionDigest:sha('owner-session'),
   source:'PRIVATE_OAUTH_EXCHANGE_AND_OA_READBACK',
   ownerAdminConsentVerified:true,oauthStateBound:true,
   scope:'OA_PROFILE_READ_ONLY_AND_WEBHOOK_NO_SEND',
   noSendConsent:true,customerDataAllowed:false,
   issuedAtMs:NOW-1000,expiresAtMs:NOW+100000
 };
 const a={
   kind:'INDEPENDENT_OPERATOR_NO_SEND',audience:'TIEN404_QA_ZALO_OA_OWNER_V1',
   version:1,operatorActorId:'operator-2',grantDigest:sha(JSON.stringify(m)),
   accessAud:access.aud,tenantId:'tenant-1',storeId:'store-A',
   maxProviderSends:0,maxOrderWrites:0,maxStockWrites:0,maxBillableCalls:0,
   allowHostedDeployment:false,noSendOnly:true,
   issuedAtMs:NOW-1000,expiresAtMs:NOW+100000
 };
 const f={executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,nowMs:NOW,
   owner,operator,access,pinnedAccess:pinned,merchantKeys,operatorKeys,m,a,
   storeAllowed:true,oneShot:true,
   merchantAttestorPublicKey:merchantKeys.publicKey,
   operatorAttestorPublicKey:operatorKeys.publicKey
 };
 f.readOwnerSession=async()=>f.owner;
 f.readOperatorIdentity=async()=>f.operator;
 f.loadMerchantAttestation=async()=>mint(f.m,f.merchantKeys.privateKey);
 f.loadOperatorAttestation=async()=>mint(f.a,f.operatorKeys.privateKey);
 f.loadAccessConfig=async()=>f.access;
 f.checkStoreOwnership=async()=>f.storeAllowed;
 f.reserveOneShot=async()=>{if(!f.oneShot)return false;f.oneShot=false;return true;};
 return f;
}
async function denied(expected,modify){
 const f=fixture();modify(f);
 const r=await evaluatePrivateOaCanaryAdmission(f);
 assert.equal(r.candidate,false,JSON.stringify(r));
 assert.equal(r.reason,expected);
 assert.equal(r.realProviderVerified,false);
 assert.equal(r.canReceiveRealTraffic,false);
 assert.equal(r.canSend,false);
 assert.equal(r.canActivate,false);
}
test('valid signed synthetic dual receipt remains NO-GO for real provider',async()=>{
 const f=fixture(),r=await evaluatePrivateOaCanaryAdmission(f);
 assert.equal(r.candidate,true);assert.equal(r.canReceiveRealTraffic,false);
 assert.equal(r.accessHostedVerified,false);assert.equal(r.realProviderVerified,false);
 assert.equal(r.canSend,false);assert.equal(r.realCanaryExecuted,false);
 for(const secret of [f.m.appId,f.m.oaId,f.owner.sessionId])
   assert.equal(JSON.stringify(r).includes(secret),false);
});
test('replay denies second candidate',async()=>{
 const f=fixture();assert.equal((await evaluatePrivateOaCanaryAdmission(f)).candidate,true);
 assert.equal((await evaluatePrivateOaCanaryAdmission(f)).reason,'DUPLICATE_OR_REPLAY');
});
test('no dependencies denies by default',async()=>{
 assert.equal((await evaluatePrivateOaCanaryAdmission({})).candidate,false);
});
test('live mode never allowed',async()=>denied('SOURCE_ONLY_TRUST_DEPENDENCIES_MISSING',f=>{f.liveEnabled=true;}));
test('operator revoked',async()=>denied('INDEPENDENT_CLOUDFLARE_OPERATOR_REQUIRED',f=>{f.operator.revoked=true;}));
test('different Access audience',async()=>denied('INDEPENDENT_CLOUDFLARE_OPERATOR_REQUIRED',f=>{f.operator.aud='other';}));
test('owner unauthorized',async()=>denied('CURRENT_SUPABASE_OWNER_SESSION_REQUIRED',f=>{f.owner.authenticated=false;}));
test('owner session revoked',async()=>denied('CURRENT_SUPABASE_OWNER_SESSION_REQUIRED',f=>{f.owner.revoked=true;}));
test('owner self approval denied',async()=>denied('INDEPENDENT_CLOUDFLARE_OPERATOR_REQUIRED',f=>{f.operator.actorId='owner-1';}));
test('same signer for merchant and operator rejected',async()=>denied('INDEPENDENT_ATTESTOR_KEYS_REQUIRED',f=>{f.operatorAttestorPublicKey=f.merchantKeys.publicKey;}));
test('Access config missing',async()=>denied('DEDICATED_ACCESS_POLICY_NOT_APPROVED',f=>{f.access.enabled=false;}));
test('Access policy bypass denied',async()=>denied('DEDICATED_ACCESS_POLICY_NOT_APPROVED',f=>{f.access.policies[0].decision='bypass';}));
test('Access all users policy denied',async()=>denied('DEDICATED_ACCESS_POLICY_NOT_APPROVED',f=>{f.access.policies[0].everyone=true;}));
test('Access wildcard domain denied',async()=>denied('DEDICATED_ACCESS_POLICY_NOT_APPROVED',f=>{f.access.domain='*.workers.dev';}));
test('Access wrong app audience denied',async()=>denied('DEDICATED_ACCESS_POLICY_NOT_APPROVED',f=>{f.access.aud='different-app';}));
test('Access operator not on allowlist',async()=>denied('OPERATOR_NOT_ON_ACCESS_ALLOWLIST',f=>{f.access.policies[0].allowedActorIds=['unknown'];}));
test('Store A owner cannot claim Store B',async()=>denied('REAL_STORE_OWNERSHIP_NOT_VERIFIED',f=>{f.storeAllowed=false;}));
test('merchant signature revoked by changing public key',async()=>denied('MERCHANT_ATTESTATION_SIGNATURE_INVALID',f=>{f.merchantAttestorPublicKey=generateKeyPairSync('ed25519').publicKey;}));
test('merchant profile ID swap rejected',async()=>denied('OA_ADMIN_GRANT_BINDING_UNVERIFIED',f=>{f.m.profileReadbackOaId='388613280879808646';}));
test('merchant callback OA ID swap rejected',async()=>denied('OA_ADMIN_GRANT_BINDING_UNVERIFIED',f=>{f.m.claimedCallbackOaId='388613280879808646';}));
test('merchant OAuth CSRF state not bound',async()=>denied('OA_ADMIN_GRANT_BINDING_UNVERIFIED',f=>{f.m.oauthStateBound=false;}));
test('merchant customer data permission rejected',async()=>denied('OA_ADMIN_GRANT_BINDING_UNVERIFIED',f=>{f.m.customerDataAllowed=true;}));
test('merchant extra send scope rejected',async()=>denied('OA_ADMIN_GRANT_BINDING_UNVERIFIED',f=>{f.m.scope='OA_SEND';}));
test('merchant expiry rejected',async()=>denied('OA_ADMIN_GRANT_BINDING_UNVERIFIED',f=>{f.m.expiresAtMs=NOW-1;}));
test('merchant owner actor swap rejected',async()=>denied('OA_ADMIN_GRANT_BINDING_UNVERIFIED',f=>{f.m.ownerActorId='owner-2';}));
test('merchant session substitution rejected',async()=>denied('OA_ADMIN_GRANT_BINDING_UNVERIFIED',f=>{f.m.sessionDigest=sha('different-session');}));
test('independent operator signature swap rejected',async()=>denied('INDEPENDENT_OPERATOR_SIGNATURE_INVALID',f=>{f.operatorAttestorPublicKey=generateKeyPairSync('ed25519').publicKey;}));
test('operator Store B mismatch rejected',async()=>denied('OPERATOR_NO_SEND_APPROVAL_NOT_MATCHED',f=>{f.a.storeId='store-B';}));
test('operator approval stale after changing merchant grant',async()=>denied('OPERATOR_NO_SEND_APPROVAL_NOT_MATCHED',f=>{f.m.consentId='another';}));
test('operator permit send denied',async()=>denied('OPERATOR_NO_SEND_APPROVAL_NOT_MATCHED',f=>{f.a.maxProviderSends=1;}));
test('operator permit Commerce writes denied',async()=>denied('OPERATOR_NO_SEND_APPROVAL_NOT_MATCHED',f=>{f.a.maxOrderWrites=1;}));
test('operator permit hosted deployment denied',async()=>denied('OPERATOR_NO_SEND_APPROVAL_NOT_MATCHED',f=>{f.a.allowHostedDeployment=true;}));
test('one-shot unavailable fail closed',async()=>denied('DURABLE_ONE_SHOT_SERVICE_UNAVAILABLE',f=>{f.reserveOneShot=async()=>{throw Error('unavailable');};}));
test('separate access metadata inspector never authorizes hosted',()=>{
 const f=fixture(),r=inspectDedicatedAccessConfig(f.access,f.pinnedAccess);
 assert.equal(r.candidate,true);assert.equal(r.accessHostedVerified,false);
});
test('wrong attestation signature never verifies',()=>{
 const f=fixture();const signed=mint(f.m,f.merchantKeys.privateKey);
 signed.payload={...signed.payload,storeId:'store-B'};
 assert.equal(verifyOfflineAttestationEnvelope(signed,f.merchantKeys.publicKey,'MERCHANT_OA_GRANT'),false);
});
