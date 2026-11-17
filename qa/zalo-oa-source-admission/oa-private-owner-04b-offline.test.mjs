import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {admitPrivateOaOwnerNoSend,qaOnlyApprovalDigest} from './oa-private-owner-04b-offline.mjs';
import worker from './oa-private-access-worker-04b.mjs';

const NOW=1794900000000;
const sha=(s)=>createHash('sha256').update(s).digest('hex');
const input={ownerSessionProof:'qa-owner-session-proof',merchantEvidenceHandle:'merchant-handle-1',operatorApprovalHandle:'operator-handle-1'};
function fixture(){
  const f={executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,nowMs:NOW};
  f.owner={authenticated:true,revoked:false,actorId:'owner-1',sessionId:'owner-session-1'};
  f.operator={accessAuthenticated:true,revoked:false,actorId:'operator-2',sessionId:'operator-access-1'};
  f.merchant={source:'PRIVATE_INDEPENDENT_OA_ADMIN_VERIFIER',status:'VERIFIED_QA_NO_SEND',
    provider:'ZALO_OA',oaId:'388613280879808645',appId:'360846524940903967',
    tenantId:'tenant-qa',storeId:'store-a',consentId:'consent-1',
    ownerActorId:f.owner.actorId,sessionDigest:sha(f.owner.sessionId),
    verifiedAtMs:NOW-1000,expiresAtMs:NOW+120000,
    noSendConsent:true,scope:'OA_PROFILE_READ_ONLY_AND_WEBHOOK_NO_SEND',
    customerDataAccessAllowed:false};
  f.approval={status:'APPROVED_NO_SEND_ONLY',operatorId:f.operator.actorId,
    bindingDigest:qaOnlyApprovalDigest(f.merchant),
    expiresAtMs:NOW+120000,maxProviderSends:0,maxOrderWrites:0,
    maxStockWrites:0,maxBillableCalls:0,allowDeployment:false,
    requiresAccessProtectedRunner:true};
  f.ownerAllowed=true;f.fresh=true;f.reservations=0;
  f.getTrustedOperator=async()=>f.operator;
  f.authenticateOwner=async()=>f.owner;
  f.authorizeStoreOwner=async()=>f.ownerAllowed;
  f.consumeMerchantEvidence=async()=>f.merchant;
  f.consumeOperatorApproval=async()=>f.approval;
  f.reserveCanaryOnce=async()=>{f.reservations++;const v=f.fresh;f.fresh=false;return v};
  return f;
}
async function deny(code,update){
  const f=fixture();
  update(f);
  const r=await admitPrivateOaOwnerNoSend(input,f);
  assert.equal(r.accepted,false);assert.equal(r.reason,code);
  assert.equal(r.noSend,true);assert.equal(r.canActivate,false);
  assert.equal(r.canReceiveProviderTraffic,false);assert.equal(r.hostedWrite,false);
}
test('offline happy shape remains pending and no send',async()=>{
 const f=fixture(), r=await admitPrivateOaOwnerNoSend(input,f);
 assert.equal(r.accepted,true);assert.equal(r.noSend,true);
 assert.equal(r.canReceiveProviderTraffic,false);assert.equal(r.canActivate,false);
 assert.equal(r.merchantEvidence.includes('FIXTURE'),true);assert.equal(f.reservations,1);
 const str=JSON.stringify(r);for(const v of [f.owner.sessionId,f.merchant.oaId,f.merchant.appId,input.ownerSessionProof])
   assert.equal(str.includes(v),false);
});
test('repeated grant denied atomically',async()=>{
 const f=fixture();assert.equal((await admitPrivateOaOwnerNoSend(input,f)).accepted,true);
 assert.equal((await admitPrivateOaOwnerNoSend(input,f)).reason,'CANARY_ALREADY_RESERVED');
});
test('missing adapters denied',async()=>{
 let r=await admitPrivateOaOwnerNoSend(input,{});
 assert.equal(r.reason,'NO_TRUSTED_PRIVATE_GATE');
});
test('live mode blocked',async()=>deny('NO_TRUSTED_PRIVATE_GATE',f=>{f.liveEnabled=true}));
test('non-fixture mode blocked',async()=>deny('NO_TRUSTED_PRIVATE_GATE',f=>{f.executionMode='HOSTED'}));
test('untrusted operator without Access denied',async()=>deny('OPERATOR_ACCESS_REQUIRED',f=>{f.operator.accessAuthenticated=false}));
test('operator revoked denied',async()=>deny('OPERATOR_ACCESS_REQUIRED',f=>{f.operator.revoked=true}));
test('missing owner session denied',async()=>deny('OWNER_SUPABASE_AUTH_REQUIRED',f=>{f.owner.authenticated=false}));
test('revoked owner denied',async()=>deny('OWNER_SUPABASE_AUTH_REQUIRED',f=>{f.owner.revoked=true}));
test('self approval denied',async()=>deny('OWNER_OPERATOR_SEPARATION_REQUIRED',f=>{f.operator.actorId=f.owner.actorId}));
test('merchant receipt unverified denied',async()=>deny('MERCHANT_OA_ADMIN_EVIDENCE_NOT_VERIFIED',f=>{f.merchant.source='CLIENT_INPUT'}));
test('merchant OA spoof denied',async()=>deny('MERCHANT_OA_ADMIN_EVIDENCE_NOT_VERIFIED',f=>{f.merchant.oaId='other-shop'}));
test('merchant owner session substitution denied',async()=>deny('MERCHANT_OA_ADMIN_EVIDENCE_NOT_VERIFIED',f=>{f.merchant.sessionDigest=sha('another-session')}));
test('merchant admin proof expired denied',async()=>deny('MERCHANT_OA_ADMIN_EVIDENCE_NOT_VERIFIED',f=>{f.merchant.expiresAtMs=NOW-1}));
test('merchant consent disallows no-send denied',async()=>deny('MERCHANT_OA_ADMIN_EVIDENCE_NOT_VERIFIED',f=>{f.merchant.noSendConsent=false}));
test('merchant consent requests customer data denied',async()=>deny('MERCHANT_OA_ADMIN_EVIDENCE_NOT_VERIFIED',f=>{f.merchant.customerDataAccessAllowed=true}));
test('Store B revocation denied',async()=>deny('STORE_OWNER_NOT_AUTHORIZED',f=>{f.ownerAllowed=false}));
test('Store lookup failure denied',async()=>deny('STORE_AUTHORITY_UNAVAILABLE',f=>{f.authorizeStoreOwner=async()=>{throw Error('db error')}}));
test('operator approval wrong binding denied',async()=>deny('INDEPENDENT_APPROVAL_NOT_VERIFIED',f=>{f.approval.bindingDigest=sha('store-b')}));
test('operator approval wrong principal denied',async()=>deny('INDEPENDENT_APPROVAL_NOT_VERIFIED',f=>{f.approval.operatorId='someone-else'}));
test('operator approval enables sends denied',async()=>deny('INDEPENDENT_APPROVAL_NOT_VERIFIED',f=>{f.approval.maxProviderSends=1}));
test('operator approval enables Orders denied',async()=>deny('INDEPENDENT_APPROVAL_NOT_VERIFIED',f=>{f.approval.maxOrderWrites=1}));
test('operator approval enables billing denied',async()=>deny('INDEPENDENT_APPROVAL_NOT_VERIFIED',f=>{f.approval.maxBillableCalls=1}));
test('operator approval enables deployment denied',async()=>deny('INDEPENDENT_APPROVAL_NOT_VERIFIED',f=>{f.approval.allowDeployment=true}));
test('operator approval missing Access requirement denied',async()=>deny('INDEPENDENT_APPROVAL_NOT_VERIFIED',f=>{f.approval.requiresAccessProtectedRunner=false}));
test('replay service unavailable denied',async()=>deny('REPLAY_GATE_UNAVAILABLE',f=>{f.reserveCanaryOnce=async()=>{throw Error('unavailable')}}));
test('bad handle rejected before private services',async()=>{
 const r=await admitPrivateOaOwnerNoSend({...input,merchantEvidenceHandle:'http://evil.example'},fixture());
 assert.equal(r.reason,'BAD_PRIVATE_REFERENCE');
});
const url='https://private-qa.invalid/private/oa-canary/status';
const env={SOURCE04B_NO_SEND_ONLY:'enabled',QA_ACCESS_AUD:'trusted-access-aud'};
const access={access:{aud:env.QA_ACCESS_AUD}};
const req=(path='/private/oa-canary/status',method='GET')=>new Request('https://private-qa.invalid'+path,{method});
async function response(request,ctx=access,settings=env){
 const r=await worker.fetch(request,settings,ctx);
 return {status:r.status,json:await r.json(),headers:r.headers};
}
test('Worker denies when kill switch off even if Access signed',async()=>{
 const r=await response(req(),access,{...env,SOURCE04B_NO_SEND_ONLY:'disabled'});
 assert.equal(r.status,403);assert.equal(r.json.canActivate,false);
});
test('Worker denies missing Access identity',async()=>{
 const r=await response(req(),{},{...env});assert.equal(r.status,403);
});
test('Worker denies forged cf-access JWT header without verified ctx.access',async()=>{
 const r=await response(new Request(url,{headers:{'cf-access-jwt-assertion':'fake'}}),{});
 assert.equal(r.status,403);
});
test('Worker denies incorrect Access audience',async()=>{
 const r=await response(req(),{access:{aud:'other-app'}});
 assert.equal(r.status,403);
});
test('Worker Access status reports no provider verification or send',async()=>{
 const r=await response(req());assert.equal(r.status,200);
 assert.equal(r.json.canSend,false);assert.equal(r.json.providerOwnershipVerified,false);
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('Worker never accepts POST approval, even with Access',async()=>{
 const r=await response(req('/private/oa-canary/approve','POST'));
 assert.equal(r.status,423);assert.equal(r.json.canActivate,false);
});
test('Worker rejects provider OAuth routes even with Access',async()=>{
 const r=await response(req('/oauth/zalo-oa/callback'));assert.equal(r.status,404);
});
test('Worker rejects Zalo webhook routes even with Access',async()=>{
 const r=await response(req('/webhook/zalo-oa','POST'));assert.equal(r.status,404);
});
test('Worker rejects body write verbs',async()=>{
 const r=await response(req('/private/oa-canary/status','PUT'));assert.equal(r.status,405);
});
test('Worker unknown route denied',async()=>{
 const r=await response(req('/admin/show-credentials'));assert.equal(r.status,404);
});
