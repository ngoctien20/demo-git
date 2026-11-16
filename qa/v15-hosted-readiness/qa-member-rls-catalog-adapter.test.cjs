'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createQaMemberCatalogAdapter,auditCatalogRls,safePrice,safeStock}=require('./qa-member-rls-catalog-adapter.cjs');
const UID='aa111111-2222-4333-8444-555555555555';
const TID_A='ab111111-2222-4333-8444-555555555555';
const TID_B='bc111111-2222-4333-8444-555555555555';
const TOKEN='synthetic_test_jwt_never_real';
const SHOP_A='qa-staging-shop-a-20261110', SHOP_B='qa-staging-shop-b-20261110';
const baseInput={accessToken:TOKEN,shopSlug:SHOP_A,sku:'QA-A001'};
function backend(over={}){
 return {environment:'QA_STAGING_ONLY',source:'PRIVATE_SUPABASE_USER_JWT_RLS',
  hasServiceRoleKey:false,allowWrite:false,
  verifyAccessToken:async token=>token===TOKEN?{verified:true,source:'SUPABASE_AUTH_GETUSER_SERVER',
    userId:UID,role:'authenticated',accessTokenBound:true,serviceRoleUsed:false}:null,
  lookupMembershipWithUserJwt:async a=>a.userId===UID&&a.shopSlug===SHOP_A&&a.accessToken===TOKEN?
    {source:'SUPABASE_USER_JWT_MEMBERSHIP_SELECT',userId:UID,tenantId:TID_A,
      shopSlug:SHOP_A,role:'owner',active:true,userJwtRlsApplied:true,serviceRoleUsed:false}:null,
  readProductWithUserJwt:async p=>p.userId===UID&&p.tenantId===TID_A&&p.accessToken===TOKEN?
    [{catalog_source:'SUPABASE_QA_MEMBER_RLS',userJwtRlsApplied:true,
      serviceRoleUsed:false,tenant_id:TID_A,sku:'QA-A001',name:'Sản phẩm QA A',
      price_vnd:'123000',stock_on_hand:5,is_active:true}]:[],
  ...over};
}
const read=(input=baseInput,server=backend())=>createQaMemberCatalogAdapter(server).read(input);
function fail(r,reason){assert.equal(r.status,'BLOCKED');assert.equal(r.reason,reason);assert.equal(r.can_send,false);assert.equal(r.orders_written,0);}
const meta={
 source:'READONLY_PG_CATALOG_AUDIT',environment:'SUPABASE_QA_STAGING',
 products:{rls_enabled:true,rls_forced:true,authenticated_select:true,
   anon_select:false,authenticated_insert:false,authenticated_update:false,authenticated_delete:false},
 product_select_policy:{name:'products_member_read',role:'authenticated',command:'SELECT',
    requires_auth_uid:true,requires_active_membership:true,tenant_join_verified:true},
 qa_store_counts:{A:1,B:1},authenticated_session_e2e_verified:false
};
test('read-only metadata reports configuration verified but real JWT pending',()=>{
 const x=auditCatalogRls(meta);assert.equal(x.status,'CONFIGURATION_VERIFIED_ONLY');
 assert.equal(x.authenticated_data_api_verified,false);assert.equal(x.can_connect_public_bot,false);
});
test('RLS policy must require auth.uid',()=>fail(auditCatalogRls({...meta,product_select_policy:{...meta.product_select_policy,requires_auth_uid:false}}),'RLS_POLICY_OR_DATABASE_GRANTS_INCOMPLETE'));
test('RLS policy must require active membership',()=>fail(auditCatalogRls({...meta,product_select_policy:{...meta.product_select_policy,requires_active_membership:false}}),'RLS_POLICY_OR_DATABASE_GRANTS_INCOMPLETE'));
test('RLS tenant join must be verified',()=>fail(auditCatalogRls({...meta,product_select_policy:{...meta.product_select_policy,tenant_join_verified:false}}),'RLS_POLICY_OR_DATABASE_GRANTS_INCOMPLETE'));
test('FORCE RLS cannot be missing',()=>fail(auditCatalogRls({...meta,products:{...meta.products,rls_forced:false}}),'RLS_POLICY_OR_DATABASE_GRANTS_INCOMPLETE'));
test('anonymous SELECT must be blocked',()=>fail(auditCatalogRls({...meta,products:{...meta.products,anon_select:true}}),'RLS_POLICY_OR_DATABASE_GRANTS_INCOMPLETE'));
test('authenticated INSERT cannot be granted',()=>fail(auditCatalogRls({...meta,products:{...meta.products,authenticated_insert:true}}),'RLS_POLICY_OR_DATABASE_GRANTS_INCOMPLETE'));
test('authenticated UPDATE cannot be granted',()=>fail(auditCatalogRls({...meta,products:{...meta.products,authenticated_update:true}}),'RLS_POLICY_OR_DATABASE_GRANTS_INCOMPLETE'));
test('authenticated DELETE cannot be granted',()=>fail(auditCatalogRls({...meta,products:{...meta.products,authenticated_delete:true}}),'RLS_POLICY_OR_DATABASE_GRANTS_INCOMPLETE'));
test('caller-submitted policy snapshot is not a trusted audit',()=>fail(auditCatalogRls({...meta,source:'CLIENT_SELF_REPORTED'}),'AUDIT_SOURCE_NOT_TRUSTED'));
test('real authenticated read cannot be claimed from metadata audit alone',()=>{
 const a=auditCatalogRls(meta);
 assert.equal(a.status,'CONFIGURATION_VERIFIED_ONLY');assert.equal(a.real_session_rls_tested,false);
});
test('even future authenticated member RLS does not approve public bot',()=>{
 const x=auditCatalogRls({...meta,authenticated_session_e2e_verified:true});
 assert.equal(x.can_connect_public_bot,false);assert.equal(x.status,'REQUIRES_INDEPENDENT_HOSTED_AUTH_REVIEW');
});
test('valid QA user JWT mock member can read exact QA SKU (not hosted proof)',async()=>{
 const x=await read();assert.equal(x.status,'AUTHENTICATED_QA_MEMBER_CATALOG_READ');
 assert.equal(x.source,'SUPABASE_QA_MEMBER_RLS');assert.equal(x.sku,'QA-A001');
 assert.equal(x.price_vnd,123000);assert.equal(x.stock_on_hand,5);
 assert.equal(x.role_source,'VERIFIED_USER_JWT_MEMBERSHIP');
 assert.equal(x.can_send,false);assert.equal(x.orders_written,0);
 assert.equal(x.commerce_approved,false);assert.equal(x.provider_customer_bot_access,false);
 assert.equal(x.merchant_consent_verified,false);
 assert.equal(JSON.stringify(x).includes(TOKEN),false);
 assert.equal(JSON.stringify(x).includes(UID),false);
 assert.equal(JSON.stringify(x).includes(TID_A),false);
});
test('adapter requires private backend configuration',async()=>{
 fail(await read(baseInput,{}),'TRUSTED_JWT_RLS_BACKEND_NOT_CONFIGURED');
});
test('service role key present in backend is rejected',async()=>{
 fail(await read(baseInput,backend({hasServiceRoleKey:true})),'TRUSTED_JWT_RLS_BACKEND_NOT_CONFIGURED');
});
test('write-enabled backend rejected',async()=>fail(await read(baseInput,backend({allowWrite:true})),'TRUSTED_JWT_RLS_BACKEND_NOT_CONFIGURED'));
test('incorrect backend source rejects',async()=>fail(await read(baseInput,backend({source:'PUBLIC_BROWSER_CLAIM'})),'TRUSTED_JWT_RLS_BACKEND_NOT_CONFIGURED'));
test('production mode backend rejects',async()=>fail(await read(baseInput,backend({environment:'PRODUCTION'})),'TRUSTED_JWT_RLS_BACKEND_NOT_CONFIGURED'));
test('invalid extra tenant claim rejected',async()=>fail(await read({...baseInput,tenant_id:TID_B}),'STRICT_CATALOG_INPUT_REQUIRED'));
test('invalid extra role claim rejected',async()=>fail(await read({...baseInput,role:'owner'}),'STRICT_CATALOG_INPUT_REQUIRED'));
test('invalid extra price claim rejected',async()=>fail(await read({...baseInput,price_vnd:1}),'STRICT_CATALOG_INPUT_REQUIRED'));
test('arbitrary shop C or real production shop rejected',async()=>fail(await read({...baseInput,shopSlug:'shop-c-live'}),'OUTSIDE_PINNED_QA_SHOP_SCOPE'));
test('V14.7 A001 SKU is mismatched namespace; never silently map',async()=>fail(await read({...baseInput,sku:'A001'}),'CATALOG_SOURCE_MISMATCH'));
test('QA B SKU cannot be normalized to A SKU',async()=>{
 const x=await read({...baseInput,sku:'QA-B001'});assert.equal(x.status,'BLOCKED');assert.equal(x.reason,'CROSS_STORE_OR_WRONG_CATALOG_SOURCE');
});
test('SQL injection style SKU rejected before database callback',async()=>{
 let touched=false;const s=backend({readProductWithUserJwt:async()=>{touched=true;return[]}});
 fail(await read({...baseInput,sku:"QA-A001' OR 1=1 --"},s),'SKU_NOT_IN_SUPABASE_QA_NAMESPACE');assert.equal(touched,false);
});
test('no token cannot read catalog as public bot customer',async()=>fail(await read({...baseInput,accessToken:''}),'USER_JWT_MISSING_OR_BAD_FORMAT'));
test('stale or fake token rejected by server verifier',async()=>fail(await read({...baseInput,accessToken:'invalid_fake_jwt_1234567'}),'SERVER_VERIFIED_USER_SESSION_REQUIRED'));
test('session claim authenticated false rejected',async()=>fail(await read(baseInput,backend({verifyAccessToken:async()=>({verified:false,source:'SUPABASE_AUTH_GETUSER_SERVER',userId:UID,role:'authenticated',accessTokenBound:true,serviceRoleUsed:false})})),'SERVER_VERIFIED_USER_SESSION_REQUIRED'));
test('session service-role path cannot be accepted',async()=>fail(await read(baseInput,backend({verifyAccessToken:async()=>({verified:true,source:'SUPABASE_AUTH_GETUSER_SERVER',userId:UID,role:'authenticated',accessTokenBound:true,serviceRoleUsed:true})})),'SERVER_VERIFIED_USER_SESSION_REQUIRED'));
test('JWT must be bound to request',async()=>fail(await read(baseInput,backend({verifyAccessToken:async()=>({verified:true,source:'SUPABASE_AUTH_GETUSER_SERVER',userId:UID,role:'authenticated',accessTokenBound:false,serviceRoleUsed:false})})),'SERVER_VERIFIED_USER_SESSION_REQUIRED'));
test('anon user token rejected',async()=>fail(await read(baseInput,backend({verifyAccessToken:async()=>({verified:true,source:'SUPABASE_AUTH_GETUSER_SERVER',userId:UID,role:'anon',accessTokenBound:true,serviceRoleUsed:false})})),'SERVER_VERIFIED_USER_SESSION_REQUIRED'));
test('unverified member active false rejected',async()=>{
 const x=backend(),original=x.lookupMembershipWithUserJwt;x.lookupMembershipWithUserJwt=async a=>({...await original(a),active:false});
 fail(await read(baseInput,x),'USER_JWT_SHOP_MEMBERSHIP_NOT_VERIFIED');
});
test('membership from another auth subject rejected',async()=>{
 const x=backend(),original=x.lookupMembershipWithUserJwt;x.lookupMembershipWithUserJwt=async a=>({...await original(a),userId:'cc111111-2222-4333-8444-555555555555'});
 fail(await read(baseInput,x),'USER_JWT_SHOP_MEMBERSHIP_NOT_VERIFIED');
});
test('membership from another shop rejected',async()=>{
 const x=backend(),original=x.lookupMembershipWithUserJwt;x.lookupMembershipWithUserJwt=async a=>({...await original(a),shopSlug:SHOP_B,tenantId:TID_B});
 fail(await read(baseInput,x),'USER_JWT_SHOP_MEMBERSHIP_NOT_VERIFIED');
});
test('membership RLS must be applied with same user JWT',async()=>{
 const x=backend(),original=x.lookupMembershipWithUserJwt;x.lookupMembershipWithUserJwt=async a=>({...await original(a),userJwtRlsApplied:false});
 fail(await read(baseInput,x),'USER_JWT_SHOP_MEMBERSHIP_NOT_VERIFIED');
});
test('membership service role cannot be used',async()=>{
 const x=backend(),original=x.lookupMembershipWithUserJwt;x.lookupMembershipWithUserJwt=async a=>({...await original(a),serviceRoleUsed:true});
 fail(await read(baseInput,x),'USER_JWT_SHOP_MEMBERSHIP_NOT_VERIFIED');
});
test('membership callback error returns denied, not raw error/secret',async()=>{
 const x=await read(baseInput,backend({lookupMembershipWithUserJwt:async()=>{throw Error('private secret password')}}));
 fail(x,'USER_JWT_SHOP_MEMBERSHIP_NOT_VERIFIED');assert.equal(JSON.stringify(x).includes('password'),false);
});
test('error reading product with user JWT returns blocked',async()=>{
 fail(await read(baseInput,backend({readProductWithUserJwt:async()=>{throw Error('db connection')}})),'RLS_CATALOG_READ_FAILURE');
});
test('missing product returns authorized QA not-found, no fabricated price',async()=>{
 const x=await read(baseInput,backend({readProductWithUserJwt:async()=>[]}));
 assert.equal(x.status,'NOT_FOUND_IN_AUTHORIZED_QA_STORE');assert.equal(x.price_vnd,null);
});
test('multiple product results forbidden',async()=>fail(await read(baseInput,backend({readProductWithUserJwt:async()=>[{},{}]})),'RLS_CATALOG_READ_FAILURE'));
test('cross-tenant product returned by buggy backend must be rejected',async()=>{
 const x=backend(),original=x.readProductWithUserJwt;
 x.readProductWithUserJwt=async a=>(await original(a)).map(r=>({...r,tenant_id:TID_B}));
 fail(await read(baseInput,x),'CROSS_STORE_OR_WRONG_CATALOG_SOURCE');
});
test('wrong row SKU rejected even if price exists',async()=>{
 const x=backend(),original=x.readProductWithUserJwt;x.readProductWithUserJwt=async a=>(await original(a)).map(r=>({...r,sku:'QA-B001'}));
 fail(await read(baseInput,x),'CROSS_STORE_OR_WRONG_CATALOG_SOURCE');
});
test('row from V14.7 static fixtures cannot be treated as Supabase QA price',async()=>{
 const x=backend(),original=x.readProductWithUserJwt;x.readProductWithUserJwt=async a=>(await original(a)).map(r=>({...r,catalog_source:'V14_7_STATIC_FIXTURE'}));
 fail(await read(baseInput,x),'CROSS_STORE_OR_WRONG_CATALOG_SOURCE');
});
test('row is_active false not quoted',async()=>{
 const x=backend(),original=x.readProductWithUserJwt;x.readProductWithUserJwt=async a=>(await original(a)).map(r=>({...r,is_active:false}));
 fail(await read(baseInput,x),'CROSS_STORE_OR_WRONG_CATALOG_SOURCE');
});
test('row user-JWT RLS flag false not trusted',async()=>{
 const x=backend(),original=x.readProductWithUserJwt;x.readProductWithUserJwt=async a=>(await original(a)).map(r=>({...r,userJwtRlsApplied:false}));
 fail(await read(baseInput,x),'CROSS_STORE_OR_WRONG_CATALOG_SOURCE');
});
test('row service role used rejected even if values valid',async()=>{
 const x=backend(),original=x.readProductWithUserJwt;x.readProductWithUserJwt=async a=>(await original(a)).map(r=>({...r,serviceRoleUsed:true}));
 fail(await read(baseInput,x),'CROSS_STORE_OR_WRONG_CATALOG_SOURCE');
});
test('invalid NaN, negative, exponent and fractional VND prices fail closed',()=>{
 for(const v of [0,-1,NaN,Infinity,'0','-1','1e5','12.00',1.2,' 1200 ','000123','9007199254740993'])assert.equal(safePrice(v),null,String(v));
 assert.equal(safePrice('123000'),123000);
 assert.equal(safePrice(123000),123000);
});
test('QA price cap matches the actual Supabase products constraint',()=>{
 assert.equal(safePrice(1000000000000),1000000000000);
 assert.equal(safePrice('1000000000000'),1000000000000);
 assert.equal(safePrice(1000000000001),null);
 assert.equal(safePrice('1000000000001'),null);
});
test('database can store zero but merchant QA quote requires approved free-item policy',()=>{
 assert.equal(safePrice(0),null);
 assert.equal(safePrice('0'),null);
});
test('invalid negative and noninteger stock fails closed',()=>{
 for(const v of [-1,NaN,Infinity,'5',1.5,2147483648])assert.equal(safeStock(v),null,String(v));
 assert.equal(safeStock(0),0);assert.equal(safeStock(5),5);
});
test('invalid VND price from query row prevents quote',async()=>{
 const x=backend(),original=x.readProductWithUserJwt;x.readProductWithUserJwt=async a=>(await original(a)).map(r=>({...r,price_vnd:'NaN'}));
 fail(await read(baseInput,x),'INVALID_AUTHORIZED_PRODUCT_PRICE_OR_STOCK');
});
test('stock out of database range prevents quote',async()=>{
 const x=backend(),original=x.readProductWithUserJwt;x.readProductWithUserJwt=async a=>(await original(a)).map(r=>({...r,stock_on_hand:-2}));
 fail(await read(baseInput,x),'INVALID_AUTHORIZED_PRODUCT_PRICE_OR_STOCK');
});
test('name with control characters or empty string not quoted',async()=>{
 const x=backend(),original=x.readProductWithUserJwt;x.readProductWithUserJwt=async a=>(await original(a)).map(r=>({...r,name:'\n'}));
 fail(await read(baseInput,x),'INVALID_AUTHORIZED_PRODUCT_PRICE_OR_STOCK');
});
test('private member adapter does not call provider or write orders',async()=>{
 const result=await read();assert.equal(result.provider_sends,0);assert.equal(result.orders_written,0);
 assert.equal(result.stock_writes,0);assert.equal(result.real_model_calls,0);
});
