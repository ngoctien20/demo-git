'use strict';
// V17.2C.29 — NO-COST, SOURCE-ONLY Store A/B isolation probe.
// This is NOT an auth service, signed JWT verifier, or production authorization.
// The trusted dependencies MUST eventually be implemented in a protected
// environment; this module only defines and tests fail-closed behavior.
const DENY=Object.freeze({allowed:false,reason:'DENY'});
const READ_SCOPE='synthetic_catalog_readonly_no_send_no_write';
function createIsolatedStoreReadProbe({verifyActor,resolveStoreOwner,loadCatalog,gate}={}){
 if([verifyActor,resolveStoreOwner,loadCatalog,gate].some(fn=>typeof fn!=='function'))
  throw new TypeError('TRUSTED_ADAPTERS_REQUIRED');
 return async function query({opaqueSession,storeRef,scope,action}={}){
  // No authorization based on caller-provided actor, tenant, role, or store owner.
  if(typeof opaqueSession!=='string'||opaqueSession.length<8||
     typeof storeRef!=='string'||storeRef.length<1||storeRef.length>100||
     scope!==READ_SCOPE||action!=='read_catalog') return DENY;
  try{
   const approved=await gate();
   if(!approved||approved.isolated===false||approved.noSend!==true||
      approved.mode!=='synthetic-only'||approved.allowHosted!==false)return DENY;
   const actor=await verifyActor(opaqueSession);
   if(!actor||actor.verified!==true||actor.active!==true||
      actor.sessionIdVerified!==true||actor.consentVerified!==true||
      actor.consentWithdrawn!==false||actor.subjectRef===undefined||
      !Number.isFinite(actor.expiresAtMs)||actor.expiresAtMs<=Date.now())return DENY;
   const binding=await resolveStoreOwner(actor.subjectRef);
   if(!binding||binding.active!==true||binding.ownerVerified!==true||
      binding.storeRef!==storeRef||typeof binding.tenantRef!=='string'||
      binding.tenantRef.length===0)return DENY;
   const rows=await loadCatalog({tenantRef:binding.tenantRef,storeRef:binding.storeRef,
      subjectRef:actor.subjectRef,readOnly:true});
   if(!Array.isArray(rows)||rows.some(x=>!x||typeof x!=='object'||
      x.tenantRef!==binding.tenantRef||x.storeRef!==binding.storeRef))return DENY;
   // Caller only receives a count, not synthetic fixture data / private attributes.
   return {allowed:true,scope:READ_SCOPE,count:rows.length};
  }catch{return DENY;}
 };
}
module.exports={createIsolatedStoreReadProbe,READ_SCOPE};
