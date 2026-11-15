'use strict';
// TIEN404 V13.4 Revised — server-only feature entitlements. DO NOT bundle into browser.
// Ports must be implemented by authenticated backend; no DB writes, token access or billing side effects.
const {plans,features}=require('./plan-catalog.json');
const FEATURE_KEYS=new Set(features.map(f=>f.key));
const PLAN_BY_CODE=new Map(plans.map(p=>[p.code,Object.freeze({
 ...p,features:Object.freeze([...p.features]),conditional_features:Object.freeze([...p.conditional_features])
})]));
const VALID_STATES=new Set(['ACTIVE','EXPIRING']);
const MANAGER_ROLES=new Set(['owner','manager']);
const CONDITIONAL=new Set(['zalo_oa.integration','multi_store.manage','team.manage','support.enterprise']);
const DESIGN_ONLY=new Set(['bot.customize','menu.customize']);
const VALID_ID=x=>typeof x==='string'&&x.length>=4&&x.length<=160&&/^[A-Za-z0-9:_-]+$/.test(x);
const DENY=(code)=>Object.freeze({allowed:false,reason:code,stage:'EXPERIMENTAL',writesEnabled:false,
 providerSendingEnabled:false,billingEnabled:false});
function createMerchantEntitlementService({verifySession,listMemberships,readSubscription,
 readEnterpriseContract,readProviderCapability,clock=Date.now}={}){
 for(const fn of [verifySession,listMemberships,readSubscription,clock])
   if(typeof fn!=='function')throw Error('SERVER_PORT_REQUIRED');
 async function evaluate({request,feature}={}){
  if(!FEATURE_KEYS.has(feature))return DENY('UNKNOWN_FEATURE');
  try{
   // Never use client-provided role, shop, subscription or plan data.
   const s=await verifySession(request);
   if(!s||s.serverVerified!==true||!VALID_ID(s.userId)||
      !Number.isFinite(Date.parse(s.expiresAt))||Date.parse(s.expiresAt)<=clock())return DENY('UNAUTHENTICATED');
   const memberships=await listMemberships(Object.freeze({userId:s.userId}));
   if(!Array.isArray(memberships))return DENY('MEMBERSHIP_UNAVAILABLE');
   const allowed=memberships.filter(m=>m&&m.active===true&&m.userId===s.userId&&
       MANAGER_ROLES.has(m.role)&&VALID_ID(m.tenantId)&&VALID_ID(m.storeId));
   if(!allowed.length)return DENY('MEMBERSHIP_DENIED');
   const selected=s.selectedTenantId!==undefined||s.selectedStoreId!==undefined;
   const chosen=selected?
       allowed.find(m=>m.tenantId===s.selectedTenantId&&m.storeId===s.selectedStoreId):
       allowed.length===1?allowed[0]:null;
   if(!chosen)return DENY('SERVER_SHOP_SELECTION_REQUIRED');
   const scope=Object.freeze({tenantId:chosen.tenantId,storeId:chosen.storeId,
     userId:s.userId,role:chosen.role});
   const sub=await readSubscription(scope);
   if(!sub||sub.source!=='SERVER_VERIFIED_SUBSCRIPTION'||sub.verified!==true||
      sub.tenantId!==scope.tenantId||sub.storeId!==scope.storeId)return DENY('SUBSCRIPTION_UNVERIFIED');
   if(!VALID_STATES.has(sub.state)||!Number.isFinite(Date.parse(sub.expiresAt))||
       Date.parse(sub.expiresAt)<=clock())return DENY('SUBSCRIPTION_INACTIVE');
   const plan=PLAN_BY_CODE.get(sub.planCode);
   if(!plan)return DENY('PLAN_UNKNOWN');
   const included=plan.features.includes(feature);
   const conditional=plan.conditional_features.includes(feature);
   if(!included&&!conditional)return DENY('FEATURE_NOT_INCLUDED');
   if(CONDITIONAL.has(feature)){
      if(typeof readEnterpriseContract!=='function')return DENY('CONTRACT_PORT_MISSING');
      const contract=await readEnterpriseContract(scope);
      if(!contract||contract.source!=='SERVER_VERIFIED_ENTERPRISE_CONTRACT'||
          contract.verified!==true||contract.active!==true||
          contract.tenantId!==scope.tenantId||contract.storeId!==scope.storeId||
          !Number.isFinite(Date.parse(contract.expiresAt))||
          Date.parse(contract.expiresAt)<=clock()||
          !Array.isArray(contract.grantedFeatures)||!contract.grantedFeatures.includes(feature))
          return DENY('CONTRACT_NOT_GRANTED');
      if(feature==='zalo_oa.integration'){
       if(typeof readProviderCapability!=='function')return DENY('PROVIDER_PORT_MISSING');
       const cap=await readProviderCapability(Object.freeze({...scope,provider:'ZALO_OA'}));
       if(!cap||cap.source!=='SERVER_VERIFIED_PROVIDER_CAPABILITY'||
          cap.tenantId!==scope.tenantId||cap.storeId!==scope.storeId||
          cap.provider!=='ZALO_OA'||cap.granted!==true||
          cap.ownerAuthorized!==true)return DENY('PROVIDER_CAPABILITY_UNVERIFIED');
      }
   }
   // Entitlement permits an authenticated backend to ATTEMPT a separately secured operation.
   // It never publishes menus, writes customers/orders or changes subscriptions by itself.
   return Object.freeze({allowed:true,reason:'ENTITLEMENT_VERIFIED',stage:'EXPERIMENTAL',
     planCode:plan.code,feature,tenantId:scope.tenantId,storeId:scope.storeId,
     role:scope.role,designMode:DESIGN_ONLY.has(feature)?'DRAFT_ONLY':null,
     writesEnabled:false,providerSendingEnabled:false,billingEnabled:false});
  }catch{return DENY('BACKEND_UNAVAILABLE');}
 }
 return Object.freeze({evaluate,mode:'SERVER_PORTS_REQUIRED',writesEnabled:false,
    billingEnabled:false,providerSendingEnabled:false});
}
module.exports={createMerchantEntitlementService,FEATURE_KEYS,PLAN_BY_CODE};
