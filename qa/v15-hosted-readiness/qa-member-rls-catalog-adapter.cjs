'use strict';
/**
 * TIEN404 V15.0-03H.1/04H.1 — SOURCE-ONLY Supabase QA member Catalog adapter.
 *
 * Not an authenticated hosted endpoint. No network calls, real Auth token,
 * service-role credentials, customer records, RLS/GRANT mutations or sends.
 *
 * The 3 backend callbacks must be implemented by a PRIVATE server using
 * Supabase getUser(accessToken), membership SELECT and products SELECT
 * under the SAME validated user JWT (RLS), NOT a service_role client.
 *
 * Public Messenger/Zalo customers are NOT tenant members; they must use a
 * separate provider-signed Bot→Shop resolver and approved customer-safe
 * product read contract. DO NOT attach this merchant adapter to public chat.
 */
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const QA_SHOP_SLUG=new Set(['qa-staging-shop-a-20261110','qa-staging-shop-b-20261110']);
const PRODUCT_SKU=/^QA-[A-Z]\d{3}$/;
const MEMBER_ROLES=new Set(['owner','manager','staff']);
// Actual Supabase products_price_vnd_check: 0 <= price_vnd <= 1,000,000,000,000.
// This QA selling-price adapter additionally rejects zero until free-item policy is approved.
const MAX_QA_PRICE_VND=1000000000000;
const DENY=(reason)=>Object.freeze({status:'BLOCKED',reason,can_send:false,provider_sends:0,orders_written:0,stock_writes:0,real_model_calls:0,production_catalog_access:false});
function safePrice(value){
 if(typeof value==='number'){
   if(!Number.isSafeInteger(value)||value<=0||value>MAX_QA_PRICE_VND)return null;
   return value;
 }
 if(typeof value==='string'&&/^[1-9][0-9]{0,15}$/.test(value)){
   const number=Number(value);
   return Number.isSafeInteger(number)&&number<=MAX_QA_PRICE_VND?number:null;
 }
 return null;
}
function safeStock(value){
 return Number.isSafeInteger(value)&&value>=0&&value<=2147483647?value:null;
}
function auditCatalogRls(meta){
 if(!meta||meta.environment!=='SUPABASE_QA_STAGING'||meta.source!=='READONLY_PG_CATALOG_AUDIT')return DENY('AUDIT_SOURCE_NOT_TRUSTED');
 const p=meta.products;
 const pol=meta.product_select_policy;
 if(!p||p.rls_enabled!==true||p.rls_forced!==true||
    p.authenticated_select!==true||p.anon_select!==false||
    p.authenticated_insert!==false||p.authenticated_update!==false||p.authenticated_delete!==false||
    !pol||pol.name!=='products_member_read'||pol.role!=='authenticated'||
    pol.command!=='SELECT'||pol.requires_auth_uid!==true||
    pol.requires_active_membership!==true||
    pol.tenant_join_verified!==true)
  return DENY('RLS_POLICY_OR_DATABASE_GRANTS_INCOMPLETE');
 if(meta.authenticated_session_e2e_verified!==true){
   return Object.freeze({status:'CONFIGURATION_VERIFIED_ONLY',real_session_rls_tested:false,
     authenticated_data_api_verified:false,can_connect_public_bot:false,can_send:false,
     catalog_staging_products_present:meta.qa_store_counts?.A>0&&meta.qa_store_counts?.B>0,
     blocker:'REAL_AUTHENTICATED_USER_JWT_TEST_MISSING'});
 }
 return Object.freeze({status:'REQUIRES_INDEPENDENT_HOSTED_AUTH_REVIEW',real_session_rls_tested:true,
   authenticated_data_api_verified:true,can_connect_public_bot:false,can_send:false,
   blocker:'G2_3_PROVIDER_BOT_AND_MERCHANT_CONSENT_MISSING'});
}
function createQaMemberCatalogAdapter(backend){
 const ready=backend&&backend.environment==='QA_STAGING_ONLY'&&
   backend.source==='PRIVATE_SUPABASE_USER_JWT_RLS'&&
   backend.hasServiceRoleKey===false&&backend.allowWrite===false&&
   typeof backend.verifyAccessToken==='function'&&
   typeof backend.lookupMembershipWithUserJwt==='function'&&
   typeof backend.readProductWithUserJwt==='function';
 return Object.freeze({async read(input){
   if(!ready)return DENY('TRUSTED_JWT_RLS_BACKEND_NOT_CONFIGURED');
   if(!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).sort().join(',')!=='accessToken,shopSlug,sku')
     return DENY('STRICT_CATALOG_INPUT_REQUIRED');
   const {accessToken,shopSlug,sku}=input;
   if(typeof accessToken!=='string'||accessToken.length<12||accessToken.length>8192||
      /\s/.test(accessToken))return DENY('USER_JWT_MISSING_OR_BAD_FORMAT');
   if(!QA_SHOP_SLUG.has(shopSlug))return DENY('OUTSIDE_PINNED_QA_SHOP_SCOPE');
   if(typeof sku!=='string'||sku.length>32)return DENY('INVALID_SKU');
   // V14.7 browser fixtures use A001; Supabase R1 staging has QA-A001/QA-B001.
   // Never normalize, alias or auto-map between data sources.
   if(/^[A-Z]\d{3}$/.test(sku))return DENY('CATALOG_SOURCE_MISMATCH');
   if(!PRODUCT_SKU.test(sku))return DENY('SKU_NOT_IN_SUPABASE_QA_NAMESPACE');
   let session=null;
   try{session=await backend.verifyAccessToken(accessToken)}catch{}
   if(!session||session.verified!==true||session.source!=='SUPABASE_AUTH_GETUSER_SERVER'||
      !UUID.test(session.userId||'')||session.role!=='authenticated'||
      session.accessTokenBound!==true||session.serviceRoleUsed!==false)
     return DENY('SERVER_VERIFIED_USER_SESSION_REQUIRED');
   let membership=null;
   try{membership=await backend.lookupMembershipWithUserJwt({
       accessToken,userId:session.userId,shopSlug,readOnly:true})}catch{}
   if(!membership||membership.source!=='SUPABASE_USER_JWT_MEMBERSHIP_SELECT'||
      !UUID.test(membership.userId||'')||membership.userId!==session.userId||
      !UUID.test(membership.tenantId||'')||membership.shopSlug!==shopSlug||
      !MEMBER_ROLES.has(membership.role)||membership.active!==true||
      membership.userJwtRlsApplied!==true||membership.serviceRoleUsed!==false)
      return DENY('USER_JWT_SHOP_MEMBERSHIP_NOT_VERIFIED');
   let rows=null;
   try{rows=await backend.readProductWithUserJwt({
       accessToken,userId:session.userId,tenantId:membership.tenantId,
       shopSlug,sku,readOnly:true,maxRows:1})}catch{}
   if(!Array.isArray(rows)||rows.length>1)return DENY('RLS_CATALOG_READ_FAILURE');
   if(rows.length===0)return Object.freeze({status:'NOT_FOUND_IN_AUTHORIZED_QA_STORE',
     sku,source:'SUPABASE_QA_MEMBER_RLS',shop_scope:shopSlug,synthetic:true,
     price_vnd:null,stock_on_hand:null,can_send:false,provider_sends:0,orders_written:0});
   const row=rows[0],price=safePrice(row?.price_vnd),stock=safeStock(row?.stock_on_hand);
   if(!row||row.catalog_source!=='SUPABASE_QA_MEMBER_RLS'||row.userJwtRlsApplied!==true||
      row.serviceRoleUsed!==false||row.tenant_id!==membership.tenantId||
      row.sku!==sku||row.is_active!==true)
       return DENY('CROSS_STORE_OR_WRONG_CATALOG_SOURCE');
   if(typeof row.name!=='string'||!row.name.trim()||row.name.length>160||
      /[\x00-\x1F\x7F]/.test(row.name)||price===null||stock===null)
       return DENY('INVALID_AUTHORIZED_PRODUCT_PRICE_OR_STOCK');
   return Object.freeze({status:'AUTHENTICATED_QA_MEMBER_CATALOG_READ',
      source:'SUPABASE_QA_MEMBER_RLS',shop_scope:shopSlug,sku:row.sku,
      name:row.name,price_vnd:price,stock_on_hand:stock,is_active:true,
      environment:'QA_STAGING_ONLY',
      role_source:'VERIFIED_USER_JWT_MEMBERSHIP',
      provider_customer_bot_access:false,
      merchant_consent_verified:false,commerce_approved:false,
      can_send:false,provider_sends:0,orders_written:0,stock_writes:0,
      real_model_calls:0});
 }});
}
module.exports={createQaMemberCatalogAdapter,auditCatalogRls,safePrice,safeStock};
