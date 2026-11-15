'use strict';
// TIEN404 Enterprise — Zalo OA research/connection readiness; strictly NO SEND/NO TOKEN/NO CONNECT.
// Zalo OA and Zalo Bot Creator are separate providers and never share inferred permissions.
const VALID_ID=x=>typeof x==='string'&&x.length>=4&&x.length<=160&&/^[A-Za-z0-9:_-]+$/.test(x);
const DENY=reason=>Object.freeze({status:'BLOCKED',reason,provider:'ZALO_OA',
   connected:false,tokenRead:false,externalSends:0,credentialsChanged:false});
function createEnterpriseOAReadiness({checkEntitlement,readOABinding}={}){
 if(typeof checkEntitlement!=='function'||typeof readOABinding!=='function')
   throw Error('BACKEND_PORT_REQUIRED');
 async function inspect(request){
  try{
   const grant=await checkEntitlement(Object.freeze({request,feature:'zalo_oa.integration'}));
   if(!grant||grant.allowed!==true||grant.reason!=='ENTITLEMENT_VERIFIED'||
      grant.planCode!=='SALES_ENTERPRISE'||!VALID_ID(grant.tenantId)||
      !VALID_ID(grant.storeId)||grant.providerSendingEnabled!==false||
      grant.writesEnabled!==false)return DENY('ENTITLEMENT_NOT_VERIFIED');
   const scope=Object.freeze({tenantId:grant.tenantId,storeId:grant.storeId,provider:'ZALO_OA'});
   const binding=await readOABinding(scope);
   if(!binding||binding.source!=='SERVER_VERIFIED_OA_BINDING'||
      binding.verified!==true||binding.tenantId!==scope.tenantId||
      binding.storeId!==scope.storeId||binding.provider!=='ZALO_OA'||
      binding.ownerAuthorizationVerified!==true||
      !VALID_ID(binding.oaId))return DENY('OA_OWNERSHIP_UNVERIFIED');
   // No token, personal data, secret scopes or provider transport object exposed.
   return Object.freeze({status:'READ_ONLY_CONNECTION_READINESS',provider:'ZALO_OA',
      tenantId:scope.tenantId,storeId:scope.storeId,ownerAuthorizationVerified:true,
      supportedCapabilities:'PROVIDER_SCOPE_AUDIT_REQUIRED',
      oaIdentifierVerified:true,connected:false,tokenRead:false,
      credentialsChanged:false,externalSends:0,productionReady:false});
  }catch{return DENY('BACKEND_UNAVAILABLE');}
 }
 return Object.freeze({inspect,mode:'NO_CONNECT_NO_SEND',provider:'ZALO_OA'});
}
module.exports={createEnterpriseOAReadiness};
