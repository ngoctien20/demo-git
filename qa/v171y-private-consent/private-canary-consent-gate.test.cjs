'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {makePrivateConsentAdmission}=require('./private-canary-consent-gate.cjs');
const NOW=Date.parse('2026-11-17T13:45:00Z');
const COMMIT='d'.repeat(40),PROJECT='ifxlvrhyjhbzbrkdsida';
const IREF='inventory_'+'A'.repeat(30),CREF='consent_'+'B'.repeat(30),NONCE='qareview_'+'C'.repeat(30);
const ROLES=['INFRA_ACCOUNT_OWNER','INDEPENDENT_SECURITY_REVIEWER'];
function stable(x){
 if(x===null||typeof x==='string'||typeof x==='boolean'||typeof x==='number')return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
}
const hash=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(overrides={}){
 const inventory={ref:IREF,schema:'TIEN404_V171Y_R2_PREFIX_READ_ONLY_INVENTORY_V1',
  projectRef:PROJECT,bucket:'tien404-merchant-evidence-quarantine-staging',
  prefix:'qa-v171x-disposable/',source:'CLOUDFLARE_GET_PREFIX_OBJECTS',
  listedAtMs:NOW-1000,objectCount:0,resultFullyPaginated:true,
  hasMore:false,objectContentsFetched:false};
 const scope={ref:CREF,schema:'TIEN404_V171Y_PROTECTED_CANARY_CONSENT_V1',
  scope:'PRIVATE_PROTECTED_CANARY_PREPARATION_ONLY',projectRef:PROJECT,
  commitSha:COMMIT,worker:'tien404-rpc16-merchant-evidence-inactive-staging',
  bucket:'tien404-merchant-evidence-quarantine-staging',prefix:'qa-v171x-disposable/',
  target:'EXISTING_PROTECTED_PRIVATE_QA_ROUTE_ONLY',methods:['GET','HEAD'],
  maxRequests:4,maxAddedCostUsd:0,noNewPublicRoute:true,noR2Write:true,
  noAuthWrite:true,noMembershipWrite:true,noProviderSend:true,noCustomerData:true,
  qaTenantMode:'NEW_DISPOSABLE_SAME_TENANT_QA_ONLY',
  ownerSlots:['QA_OWNER_A','QA_OWNER_B'],founderConsentForTechnicalQaOnly:true,
  realMerchantOwnersAttested:false,twoRealAuthSessionsAttested:false,
  storeRlsAttested:false,issuedAtMs:NOW-3000,expiresAtMs:NOW+120000};
 const keypairs={},signers={};
 for(const [i,role] of ROLES.entries()){
  const pair=crypto.generateKeyPairSync('ed25519');
  keypairs[role]=pair;
  signers[role]={role,kid:'QA_KID_'+role,active:true,
   signerRef:'QA_INDEPENDENT_SIGNER_'+i,
   enrollment:'PRIVATE_IDENTITY_MFA_VERIFIED',
   publicJwk:pair.publicKey.export({format:'jwk'})};
 }
 const seen=overrides.sharedSeen||new Set();
 let time=NOW;
 const callbacks={
  expectedCommitSha:COMMIT,clock:()=>time,
  loadPrivateInventory:async()=>inventory,
  loadPrivateConsentScope:async({approvalsFor}={})=>{
   if(!approvalsFor)return scope;
   const invDigest=hash(inventory),scopeDigest=hash(scope);
   return {...scope,signedApprovals:ROLES.map(role=>{
    const kid=signers[role].kid;
    const msg=Buffer.from('TIEN404_V171Y_PRIVATE_SIGNED_CONSENT_V1\0'+stable({
      role,kid,invDigest,scopeDigest,nonce:NONCE
    }));
    return {role,kid,signature:crypto.sign(null,msg,keypairs[role].privateKey).toString('base64url')};
   })};
  },
  lookupEnrolledSigner:async({role})=>signers[role],
  reserveNonceOnce:async({nonce})=>{
   if(seen.has(nonce))return false;
   seen.add(nonce);return true;
  },...overrides
 };
 delete callbacks.sharedSeen;
 const gate=makePrivateConsentAdmission(callbacks);
 return {gate,inventory,scope,signers,keypairs,seen,callbacks,
  args:{inventoryRef:IREF,consentRef:CREF,nonce:NONCE},setTime:t=>time=t};
}
async function denied(p,reason){const r=await p;assert.equal(r.ok,false);if(reason)assert.equal(r.reason,reason);}
const plan=f=>f.gate.review(f.args);
test('Y01 two PRIVATE signed QA consent roles produce design-only plan from empty prefix',async()=>{
 const r=await plan(fixture());assert.equal(r.ok,true);
 assert.equal(r.plan.inventoryZeroAtObservation,true);
 assert.equal(r.plan.kind,'PRIVATE_PROTECTED_CANARY_AND_QA_AUTH_CONSENT_REVIEW_ONLY');
 assert.equal(r.plan.independentConsentSigners,2);
 assert.equal(r.plan.release,'HOSTED_NO_GO');
});
test('Y02 plan grants no R2, Access, Auth, RLS, provider or billing permissions',async()=>{
 const r=await plan(fixture());assert.equal(r.ok,true);
 for(const [key,value] of Object.entries(r.plan)){
  if(key.startsWith('allow')||key==='productionReleaseApproved')
   assert.equal(value,false,key);
  if(key.startsWith('actual'))assert.equal(value,key.endsWith('Applied')?false:0,key);
 }
});
test('Y03 plan never exposes source refs, nonce, signer identities or private keys',async()=>{
 const f=fixture(),r=await plan(f),data=JSON.stringify(r);
 assert.equal(r.ok,true);
 for(const secret of [IREF,CREF,NONCE,'QA_INDEPENDENT_SIGNER_0','QA_KID_INFRA_ACCOUNT_OWNER'])
  assert.equal(data.includes(secret),false);
});
test('Y04 an empty FIRST page with a continuation cursor is NOT zero inventory proof',async()=>{
 const f=fixture();f.inventory.hasMore=true;f.inventory.resultFullyPaginated=false;
 const r=await plan(f);assert.equal(r.ok,true);
 assert.equal(r.plan.inventoryZeroAtObservation,false);
});
test('Y05 a nonempty prefix is not eligible for clean-slate retention approval',async()=>{
 const f=fixture();f.inventory.objectCount=1;
 const r=await plan(f);assert.equal(r.ok,true);
 assert.equal(r.plan.inventoryZeroAtObservation,false);
 assert.equal(r.plan.allowR2Mutation,false);
});
test('Y06 stale prefix inventory over 60 sec refuses source approval',async()=>{
 const f=fixture();f.inventory.listedAtMs=NOW-61000;
 await denied(plan(f),'Y_R2_INVENTORY_UNTRUSTED_OR_EXPIRED');
});
test('Y07 an inventory for another bucket cannot be used',async()=>{
 const f=fixture();f.inventory.bucket='merchant-live-bucket';
 await denied(plan(f),'Y_R2_INVENTORY_UNTRUSTED_OR_EXPIRED');
});
test('Y08 wrong prefix cannot be substituted into inventory evidence',async()=>{
 const f=fixture();f.inventory.prefix='';
 await denied(plan(f),'Y_R2_INVENTORY_UNTRUSTED_OR_EXPIRED');
});
test('Y09 object contents fetched is forbidden in metadata-only preflight',async()=>{
 const f=fixture();f.inventory.objectContentsFetched=true;
 await denied(plan(f),'Y_R2_INVENTORY_UNTRUSTED_OR_EXPIRED');
});
test('Y10 signed inventory cannot be replaced with user-supplied URL',async()=>{
 const f=fixture();await denied(f.gate.review({...f.args,inventoryRef:'http://169.254.169.254/'}),'Y_PRIVATE_REFERENCE_SHAPE');
});
test('Y11 extra client field approved=true is not accepted',async()=>{
 const f=fixture();await denied(f.gate.review({...f.args,approved:true}),'Y_PRIVATE_REFERENCE_SHAPE');
});
test('Y12 actual Store owner attestation flags cannot be falsely claimed',async()=>{
 const f=fixture();f.scope.realMerchantOwnersAttested=true;
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y13 two real Auth JWTs never inferred from consent for two QA personas',async()=>{
 const f=fixture();f.scope.twoRealAuthSessionsAttested=true;
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y14 source cannot pre-authorize actual store RLS UAT',async()=>{
 const f=fixture();f.scope.storeRlsAttested=true;
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y15 grant of Auth user creation is denied',async()=>{
 const f=fixture();f.scope.noAuthWrite=false;
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y16 grant of membership transfer is denied',async()=>{
 const f=fixture();f.scope.noMembershipWrite=false;
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y17 grant of R2 put/delete is denied',async()=>{
 const f=fixture();f.scope.noR2Write=false;
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y18 proposal cannot open public Worker route',async()=>{
 const f=fixture();f.scope.noNewPublicRoute=false;
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y19 proposed canary must remain GET/HEAD and no provider POST',async()=>{
 const f=fixture();f.scope.methods=['GET','POST'];
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y20 canary cannot be unlimited request count',async()=>{
 const f=fixture();f.scope.maxRequests=10000;
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y21 cost privilege cannot be silently enlarged',async()=>{
 const f=fixture();f.scope.maxAddedCostUsd=5;
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y22 only two separated QA owner slots are accepted',async()=>{
 const f=fixture();f.scope.ownerSlots=['QA_OWNER_A','QA_OWNER_A'];
 await denied(plan(f),'Y_CONSENT_SCOPE_UNSAFE');
});
test('Y23 same-process duplicated nonce consumed before first await',async()=>{
 const f=fixture();assert.equal((await plan(f)).ok,true);
 await denied(plan(f),'Y_SAME_PROCESS_NONCE_REPLAY');
});
test('Y24 concurrent requests cannot both issue a plan',async()=>{
 const f=fixture();const rr=await Promise.all([plan(f),plan(f)]);
 assert.equal(rr.filter(r=>r.ok).length,1);
 assert.equal(rr.filter(r=>r.reason==='Y_SAME_PROCESS_NONCE_REPLAY').length,1);
});
test('Y25 cross-instance backend non-atomic refusal cannot issue second plan',async()=>{
 const seen=new Set(),a=fixture({sharedSeen:seen}),b=fixture({sharedSeen:seen});
 assert.equal((await plan(a)).ok,true);
 await denied(plan(b),'Y_DURABLE_NONCE_REPLAY_OR_NON_ATOMIC');
});
test('Y26 a truthy string from replay backend does not authorize',async()=>{
 const f=fixture({reserveNonceOnce:async()=> 'true'});
 await denied(plan(f),'Y_DURABLE_NONCE_REPLAY_OR_NON_ATOMIC');
});
test('Y27 private registry failure fails closed',async()=>{
 const f=fixture({loadPrivateInventory:async()=>{throw Error('OFFLINE')}});
 await denied(plan(f),'Y_PRIVATE_COLLECTOR_UNAVAILABLE');
});
test('Y28 duplicate human acting as founder and reviewer is not independent consent',async()=>{
 const f=fixture();f.signers.INDEPENDENT_SECURITY_REVIEWER.signerRef=f.signers.INFRA_ACCOUNT_OWNER.signerRef;
 await denied(plan(f),'Y_SIGNER_NOT_INDEPENDENT');
});
test('Y29 no privately verified founder signer means no permit',async()=>{
 const f=fixture();f.signers.INFRA_ACCOUNT_OWNER.enrollment='CLIENT_APPROVED';
 await denied(plan(f),'Y_SIGNER_NOT_INDEPENDENT');
});
test('Y30 private Ed25519 secret cannot be supplied inside a public JWK',async()=>{
 const f=fixture();f.signers.INFRA_ACCOUNT_OWNER.publicJwk=f.keypairs.INFRA_ACCOUNT_OWNER.privateKey.export({format:'jwk'});
 await denied(plan(f),'Y_SIGNER_NOT_INDEPENDENT');
});
const cases=[
 ['source git commit tampered',f=>f.scope.commitSha='a'.repeat(40),'Y_CONSENT_SCOPE_UNSAFE'],
 ['foreign Supabase project',f=>f.scope.projectRef='OTHER','Y_CONSENT_SCOPE_UNSAFE'],
 ['scope expires before evidence check',f=>f.scope.expiresAtMs=NOW-1,'Y_CONSENT_SCOPE_UNSAFE'],
 ['unverified signer revoked',f=>f.signers.INDEPENDENT_SECURITY_REVIEWER.active=false,'Y_SIGNER_NOT_INDEPENDENT'],
 ['raw phone number in scope',f=>f.scope.customerPhone='0901234567','Y_CONSENT_SCOPE_UNSAFE'],
 ['inventory fake URL injected',f=>f.inventory.url='https://attacker.invalid/','Y_R2_INVENTORY_UNTRUSTED_OR_EXPIRED'],
 ['no real scanning proof from bucket list',f=>f.inventory.objectCount=0,'OK_BUT_SOURCE_ONLY'],
 ['no actual provider sends',f=>f.scope.noProviderSend=false,'Y_CONSENT_SCOPE_UNSAFE'],
 ['non QA tenant mode',f=>f.scope.qaTenantMode='LIVE_TENANT','Y_CONSENT_SCOPE_UNSAFE'],
 ['unknown signer key is absent',f=>f.signers.INFRA_ACCOUNT_OWNER.kid='BAD_KID','OK_BUT_SOURCE_ONLY']
];
for(const [name,mutate,expected] of cases){
 test('Y-A scoped consent negative: '+name,async()=>{
  const f=fixture();mutate(f);
  const r=await plan(f);
  if(expected==='OK_BUT_SOURCE_ONLY'){
   assert.equal(r.ok,true);assert.equal(r.plan.release,'HOSTED_NO_GO');
  }else{assert.equal(r.ok,false);assert.equal(r.reason,expected);}
 });
}
