'use strict';
// TIEN404 AI V17.1Y — independently signed private consent READINESS ONLY.
// This source never performs Cloudflare/R2/Supabase/HTTP/IAM writes, object reads,
// user provisioning, external canary calls, token operations, or billing.
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const PROJECT='ifxlvrhyjhbzbrkdsida';
const WORKER='tien404-rpc16-merchant-evidence-inactive-staging';
const BUCKET='tien404-merchant-evidence-quarantine-staging';
const PREFIX='qa-v171x-disposable/';
const ROUTE='EXISTING_PROTECTED_PRIVATE_QA_ROUTE_ONLY';
const ROLES=Object.freeze(['INFRA_ACCOUNT_OWNER','INDEPENDENT_SECURITY_REVIEWER']);
const REF=/^(?:inventory|consent)_[A-Za-z0-9_-]{22,76}$/;
const NONCE=/^qareview_[A-Za-z0-9_-]{20,80}$/;
const HEX40=/^[a-f0-9]{40}$/;
const KID=/^[A-Za-z0-9_.:-]{1,96}$/;
function deny(reason){return Object.freeze({ok:false,reason});}
function obj(x){return x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function exact(x,keys){return !!obj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');}
function stable(x,d=0){
 if(d>12)throw Error('DEPTH');
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(Number.isSafeInteger(x))return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(y=>stable(y,d+1)).join(',')+']';
 if(obj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k],d+1)).join(',')+'}';
 throw Error('INVALID_SIGNATURE_PAYLOAD');
}
const hash=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
const PLANNED_SCOPE='PRIVATE_PROTECTED_CANARY_PREPARATION_ONLY';
const REVIEW_SCHEMA='TIEN404_V171Y_PROTECTED_CANARY_CONSENT_V1';
const INVENTORY_SCHEMA='TIEN404_V171Y_R2_PREFIX_READ_ONLY_INVENTORY_V1';
function makePrivateConsentAdmission({
 expectedCommitSha,loadPrivateInventory,loadPrivateConsentScope,
 lookupEnrolledSigner,reserveNonceOnce,clock=()=>Date.now()
}={}){
 if(!HEX40.test(String(expectedCommitSha||''))||
  [loadPrivateInventory,loadPrivateConsentScope,
   lookupEnrolledSigner,reserveNonceOnce,clock].some(x=>typeof x!=='function'))
  throw Error('V171Y_PRIVATE_TRUST_CONFIG_REQUIRED');
 const attempted=new Set();
 async function review(request={}){
  if(!exact(request,['inventoryRef','consentRef','nonce'])||
     typeof request.inventoryRef!=='string'||!REF.test(request.inventoryRef)||
     !request.inventoryRef.startsWith('inventory_')||
     typeof request.consentRef!=='string'||!REF.test(request.consentRef)||
     !request.consentRef.startsWith('consent_')||
     typeof request.nonce!=='string'||!NONCE.test(request.nonce))
   return deny('Y_PRIVATE_REFERENCE_SHAPE');
  const now=clock();
  if(!Number.isSafeInteger(now)||now<=0)return deny('Y_UNTRUSTED_CLOCK');
  if(attempted.has(request.nonce))return deny('Y_SAME_PROCESS_NONCE_REPLAY');
  attempted.add(request.nonce); // before first awaited operation, across all plan refs
  let inventory,scope;
  try{
   [inventory,scope]=await Promise.all([
    loadPrivateInventory({ref:request.inventoryRef,projectRef:PROJECT}),
    loadPrivateConsentScope({ref:request.consentRef,projectRef:PROJECT})
   ]);
  }catch{return deny('Y_PRIVATE_COLLECTOR_UNAVAILABLE');}
  const iKeys=['ref','schema','projectRef','bucket','prefix','source',
   'listedAtMs','objectCount','resultFullyPaginated','hasMore','objectContentsFetched'];
  if(!exact(inventory,iKeys)||
    inventory.ref!==request.inventoryRef||inventory.schema!==INVENTORY_SCHEMA||
    inventory.projectRef!==PROJECT||inventory.bucket!==BUCKET||
    inventory.prefix!==PREFIX||inventory.source!=='CLOUDFLARE_GET_PREFIX_OBJECTS'||
    !Number.isSafeInteger(inventory.listedAtMs)||inventory.listedAtMs>now+30000||
    now-inventory.listedAtMs>60000||
    !Number.isSafeInteger(inventory.objectCount)||inventory.objectCount<0||
    typeof inventory.resultFullyPaginated!=='boolean'||
    typeof inventory.hasMore!=='boolean'||inventory.objectContentsFetched!==false)
   return deny('Y_R2_INVENTORY_UNTRUSTED_OR_EXPIRED');
  const cKeys=['ref','schema','scope','projectRef','commitSha','worker',
   'bucket','prefix','target','methods','maxRequests','maxAddedCostUsd',
   'noNewPublicRoute','noR2Write','noAuthWrite','noMembershipWrite',
   'noProviderSend','noCustomerData','qaTenantMode','ownerSlots',
   'founderConsentForTechnicalQaOnly','realMerchantOwnersAttested',
   'twoRealAuthSessionsAttested','storeRlsAttested','issuedAtMs','expiresAtMs'];
  if(!exact(scope,cKeys)||scope.ref!==request.consentRef||
   scope.schema!==REVIEW_SCHEMA||scope.scope!==PLANNED_SCOPE||
   scope.projectRef!==PROJECT||scope.commitSha!==expectedCommitSha||
   scope.worker!==WORKER||scope.bucket!==BUCKET||scope.prefix!==PREFIX||
   scope.target!==ROUTE||!isDeepStrictEqual(scope.methods,['GET','HEAD'])||
   scope.maxRequests!==4||scope.maxAddedCostUsd!==0||
   scope.noNewPublicRoute!==true||scope.noR2Write!==true||
   scope.noAuthWrite!==true||scope.noMembershipWrite!==true||
   scope.noProviderSend!==true||scope.noCustomerData!==true||
   scope.qaTenantMode!=='NEW_DISPOSABLE_SAME_TENANT_QA_ONLY'||
   !isDeepStrictEqual(scope.ownerSlots,['QA_OWNER_A','QA_OWNER_B'])||
   scope.founderConsentForTechnicalQaOnly!==true||
   scope.realMerchantOwnersAttested!==false||
   scope.twoRealAuthSessionsAttested!==false||
   scope.storeRlsAttested!==false||
   !Number.isSafeInteger(scope.issuedAtMs)||
   !Number.isSafeInteger(scope.expiresAtMs)||
   scope.issuedAtMs>now+30000||scope.issuedAtMs<now-600000||
   scope.expiresAtMs<=now||scope.expiresAtMs-scope.issuedAtMs>600000)
   return deny('Y_CONSENT_SCOPE_UNSAFE');
  const invDigest=hash(inventory),scopeDigest=hash(scope);
  // A private consent document cannot supply its own public keys or signer
  // identity. Both signers must be independently enrolled on the server.
  const enrolled=[],identity=new Set();
  for(const role of ROLES){
   let rec;
   try{rec=await lookupEnrolledSigner({role,projectRef:PROJECT});}
   catch{return deny('Y_SIGNER_REGISTRY_UNAVAILABLE');}
   if(!rec||rec.active!==true||rec.role!==role||
     rec.enrollment!=='PRIVATE_IDENTITY_MFA_VERIFIED'||
     typeof rec.signerRef!=='string'||!KID.test(rec.signerRef)||
     typeof rec.kid!=='string'||!KID.test(rec.kid)||
     identity.has(rec.signerRef)||
     !obj(rec.publicJwk)||rec.publicJwk.kty!=='OKP'||
     rec.publicJwk.crv!=='Ed25519'||typeof rec.publicJwk.x!=='string'||
     rec.publicJwk.d!==undefined)
    return deny('Y_SIGNER_NOT_INDEPENDENT');
   identity.add(rec.signerRef);
   enrolled.push({role,kid:rec.kid,signerRef:rec.signerRef,x:rec.publicJwk.x});
  }
  // Signatures are fetched from a *separate protected* consent channel, not
  // invented by user_text or provided as untrusted approval booleans.
  let signed;
  try{signed=await loadPrivateConsentScope({
   ref:request.consentRef,projectRef:PROJECT,approvalsFor:hash({
    scopeDigest,invDigest,nonce:request.nonce
   })
  });}catch{return deny('Y_SIGNATURE_SERVICE_UNAVAILABLE');}
  if(!exact(signed,['ref','schema','scope','projectRef','commitSha','worker',
   'bucket','prefix','target','methods','maxRequests','maxAddedCostUsd',
   'noNewPublicRoute','noR2Write','noAuthWrite','noMembershipWrite',
   'noProviderSend','noCustomerData','qaTenantMode','ownerSlots',
   'founderConsentForTechnicalQaOnly','realMerchantOwnersAttested',
   'twoRealAuthSessionsAttested','storeRlsAttested','issuedAtMs','expiresAtMs',
   'signedApprovals']))
   return deny('Y_SIGNATURE_ENVELOPE_SHAPE');
  // The signed envelope may only extend the original trusted scope by the
  // exact, separate signedApprovals field; it must not mutate any scope field.
  const {signedApprovals,...returnedScope}=signed;
  if(hash(returnedScope)!==scopeDigest||!Array.isArray(signedApprovals)||
   signedApprovals.length!==2||new Set(signedApprovals.map(x=>x?.role)).size!==2)
   return deny('Y_SIGNATURE_ENVELOPE_DRIFT');
  for(const actor of enrolled){
   const a=signedApprovals.find(x=>x?.role===actor.role);
   if(!exact(a,['role','kid','signature'])||a.kid!==actor.kid||
    typeof a.signature!=='string')return deny('Y_SIGNER_SIGNATURE_SHAPE');
   const bytes=Buffer.from('TIEN404_V171Y_PRIVATE_SIGNED_CONSENT_V1\0'+stable({
    role:actor.role,kid:actor.kid,invDigest,scopeDigest,nonce:request.nonce
   }));
   let valid=false;
   try{
    if(/^[A-Za-z0-9_-]{85,88}$/.test(a.signature)){
     const sig=Buffer.from(a.signature,'base64url');
     if(sig.length===64&&sig.toString('base64url')===a.signature){
      const trusted=await lookupEnrolledSigner({role:actor.role,projectRef:PROJECT});
      if(trusted?.active===true&&trusted.kid===actor.kid&&
       trusted.publicJwk?.x===actor.x&&trusted.signerRef===actor.signerRef)
       valid=crypto.verify(null,bytes,
        crypto.createPublicKey({key:trusted.publicJwk,format:'jwk'}),sig);
     }
    }
   }catch{}
   if(!valid)return deny('Y_ED25519_CONSENT_INVALID');
  }
  let reserved;
  try{reserved=await reserveNonceOnce({nonce:request.nonce,
   digest:hash({invDigest,scopeDigest,nonce:request.nonce}),
   projectRef:PROJECT,ttlMs:600000});}
  catch{return deny('Y_DURABLE_NONCE_BACKEND_UNAVAILABLE');}
  if(reserved!==true)return deny('Y_DURABLE_NONCE_REPLAY_OR_NON_ATOMIC');
  let currentInv,currentScope;
  try{
   [currentInv,currentScope]=await Promise.all([
    loadPrivateInventory({ref:request.inventoryRef,projectRef:PROJECT}),
    loadPrivateConsentScope({ref:request.consentRef,projectRef:PROJECT})
   ]);
  }catch{return deny('Y_EVIDENCE_RECHECK_UNAVAILABLE');}
  if(hash(currentInv)!==invDigest||hash(currentScope)!==scopeDigest)
   return deny('Y_EVIDENCE_CHANGED_AFTER_REVIEW');
  for(const actor of enrolled){
   let fresh;
   try{fresh=await lookupEnrolledSigner({role:actor.role,projectRef:PROJECT});}
   catch{return deny('Y_SIGNER_RECHECK_UNAVAILABLE');}
   if(fresh?.active!==true||fresh.enrollment!=='PRIVATE_IDENTITY_MFA_VERIFIED'||
    fresh.signerRef!==actor.signerRef||fresh.kid!==actor.kid||
    fresh.publicJwk?.x!==actor.x||fresh.publicJwk?.d!==undefined)
    return deny('Y_SIGNER_REVOKED_OR_ROTATED');
  }
  const t=clock();
  if(!Number.isSafeInteger(t)||t-inventory.listedAtMs>60000||
   t>=scope.expiresAtMs)return deny('Y_EVIDENCE_EXPIRED_AT_COMMIT');
  const zeroAndComplete=inventory.objectCount===0&&
   inventory.resultFullyPaginated===true&&inventory.hasMore===false;
  return {ok:true,plan:Object.freeze({
   kind:'PRIVATE_PROTECTED_CANARY_AND_QA_AUTH_CONSENT_REVIEW_ONLY',
   projectRef:PROJECT,prefix:PREFIX,bucket:BUCKET,
   inventoryZeroAtObservation:zeroAndComplete,
   scopeDigest,inventoryDigest:invDigest,independentConsentSigners:2,
   technicalQaPersonaSlots:2,independentMerchantOwnersAttested:false,
   signedRealAuthJwtSessionsAttested:false,
   inventoryMustBeRecheckedBeforeAnyR2Change:true,
   unverifiedCurrentAccessRoute:true,
   actualR2LifecycleApplied:false,actualAuthUsersCreated:0,
   actualStoreMembershipsChanged:0,actualMessagesSent:0,
   allowProtectedCanaryExecution:false,allowPublicRouteCreation:false,
   allowR2Mutation:false,allowAuthProvisioning:false,
   allowRlsMutation:false,allowProviderSend:false,
   allowBilling:false,productionReleaseApproved:false,release:'HOSTED_NO_GO'
  })};
 }
 return Object.freeze({review});
}
module.exports={makePrivateConsentAdmission};
