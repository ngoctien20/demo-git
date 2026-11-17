/** RPC17.5 — Canonical Store Authority evaluation contract (OFFLINE/NO-HOST).
 * Input is a server-verified DB snapshot only in future; tests use fabricated data.
 * NO JWT cryptographic verification, Supabase connection, permission grant, SQL write, deployment or upload here.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DENY=(reason)=>Object.freeze({eligible:false,can_read:false,can_write:false,can_upload:false,can_send:false,can_deploy:false,reason});
const valid=x=>typeof x==='string'&&UUID.test(x);
const EXACT_KEYS=(obj,keys)=>!!obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');
export const STORE_AUTHORITY_SCHEMA=Object.freeze({
 stores:Object.freeze(['id','tenant_id','status','authority_version']),
 memberships:Object.freeze(['store_id','tenant_id','user_id','role','active','authority_version']),
 // These are proposed canonical tables. They DO NOT yet exist in staging.
});
export function evaluateStoreAuthorityOffline(input={}){
 try{
  const {principal,store,membership,tenantMembership,nowSeconds}=input||{};
  if(!principal||!store||!membership||!tenantMembership||!Number.isSafeInteger(nowSeconds))return DENY('EVIDENCE_MISSING');
  if(!EXACT_KEYS(principal,['sub','session_id','tenant_id','issuer','aud','exp','iat','verified_by_private_gateway','session_confirmed']))return DENY('UNTRUSTED_PRINCIPAL');
  if(!valid(principal.sub)||!valid(principal.session_id)||!valid(principal.tenant_id)||principal.verified_by_private_gateway!==true||principal.session_confirmed!==true)return DENY('PRINCIPAL_UNVERIFIED');
  if(principal.issuer!=='tien404-staging-supabase-auth'||principal.aud!=='authenticated')return DENY('ISSUER_AUDIENCE');
  if(!Number.isSafeInteger(principal.exp)||!Number.isSafeInteger(principal.iat)||principal.exp<=nowSeconds||principal.iat>nowSeconds||principal.exp-principal.iat>3600)return DENY('JWT_TIME');
  if(!EXACT_KEYS(store,['id','tenant_id','status','authority_version']))return DENY('STORE_SCHEMA');
  if(!valid(store.id)||!valid(store.tenant_id)||store.tenant_id!==principal.tenant_id||store.status!=='active'||!Number.isSafeInteger(store.authority_version)||store.authority_version<1)return DENY('STORE_SCOPE');
  if(!EXACT_KEYS(tenantMembership,['tenant_id','user_id','role','active'])||tenantMembership.tenant_id!==principal.tenant_id||tenantMembership.user_id!==principal.sub||tenantMembership.active!==true||!['owner','manager','staff'].includes(tenantMembership.role))return DENY('TENANT_AUTHORITY');
  if(!EXACT_KEYS(membership,['store_id','tenant_id','user_id','role','active','authority_version']))return DENY('MEMBERSHIP_SCHEMA');
  if(membership.store_id!==store.id||membership.tenant_id!==store.tenant_id||membership.user_id!==principal.sub||membership.active!==true||!['owner','manager','staff'].includes(membership.role)||membership.authority_version!==store.authority_version)return DENY('STORE_MEMBERSHIP');
  return Object.freeze({eligible:true,can_read:false,can_write:false,can_upload:false,can_send:false,can_deploy:false,reason:'OFFLINE_CONTRACT_MATCH_NOT_AUTHORIZATION',store_id:store.id,tenant_id:store.tenant_id});
 }catch{return DENY('FAIL_CLOSED');}
}
export function evaluateStoreAbReadiness({A,B,storeA,storeB,sameTenantExpected}={}){
 const block=reason=>Object.freeze({status:'BLOCKED',can_assert_real_uat:false,can_send:false,can_upload:false,reason});
 if(!A?.eligible||!B?.eligible||!valid(storeA)||!valid(storeB)||storeA===storeB||A.store_id!==storeA||B.store_id!==storeB||!valid(sameTenantExpected)||A.tenant_id!==sameTenantExpected||B.tenant_id!==sameTenantExpected)return block('NOT_INDEPENDENTLY_ADMITTED');
 return block('TWO_REAL_SESSIONS_AND_RLS_NOT_EXECUTED');
}
export function publicAdmission(){return DENY('HOSTED_NO_GO');}
