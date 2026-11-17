'use strict';
// V17.2A NO-SEND real JWT UAT adapter, NOT a live operator, NOT connected to Auth.
// Authentication and HTTP are injected from a separately approved PRIVATE runtime.
// Fake CI callbacks are synthetic and never certify real Supabase Auth/Commerce.
const REF='ifxlvrhyjhbzbrkdsida';
const ISSUER='https://'+REF+'.supabase.co/auth/v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKU_A='QA-A-001',SKU_B='QA-B-001';
function deny(code){return Object.freeze({ok:false,code,release:'HOSTED_NO_GO'});}
function exact(x,keys){return !!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');}
function validClaims(c,now){
 if(!c||typeof c!=='object'||Array.isArray(c))return false;
 const audience=Array.isArray(c.aud)?c.aud:[c.aud];
 return c.iss===ISSUER&&audience.includes('authenticated')&&
  c.role==='authenticated'&&c.is_anonymous===false&&
  UUID.test(c.sub||'')&&UUID.test(c.session_id||'')&&
  Number.isSafeInteger(c.iat)&&Number.isSafeInteger(c.exp)&&
  c.iat<=now+30&&c.exp>now+30&&c.exp-c.iat<=86400;
}
function validQuery(x){
 if(!exact(x,['status','rows'])||!Number.isInteger(x.status)||!Array.isArray(x.rows)||x.rows.length>10)return false;
 return x.rows.every(r=>exact(r,['tenant_id','store_key','sku','name','price_vnd'])&&
  UUID.test(r.tenant_id)&&typeof r.store_key==='string'&&
  /^[A-Z0-9-]{2,50}$/.test(r.sku)&&
  typeof r.name==='string'&&r.name.length<=100&&
  ((typeof r.price_vnd==='number'&&Number.isSafeInteger(r.price_vnd)&&r.price_vnd>=0)||
   (typeof r.price_vnd==='string'&&/^\d{1,15}$/.test(r.price_vnd))));
}
function makeRealJwtNoSendUat({
 approvedQaTenantId,verifySupabaseClaims,lookupCurrentAuthSession,
 readCatalogUsingEndUserJwt,clock=()=>Date.now()
}={}){
 if(!UUID.test(approvedQaTenantId||'')||
  [verifySupabaseClaims,lookupCurrentAuthSession,readCatalogUsingEndUserJwt,clock].some(f=>typeof f!=='function'))
  throw Error('PRIVATE_REAL_AUTH_RUNTIME_NOT_CONFIGURED');
 async function run(request={}){
  if(!exact(request,['jwtA','jwtB'])||typeof request.jwtA!=='string'||
    typeof request.jwtB!=='string'||request.jwtA.length<16||request.jwtB.length<16||
    request.jwtA===request.jwtB)return deny('MISSING_TWO_DISTINCT_PRIVATE_JWTS');
  const now=Math.floor(clock()/1000);if(!Number.isSafeInteger(now))return deny('INVALID_CLOCK');
  let verified;
  try{verified=await Promise.all([verifySupabaseClaims(request.jwtA),verifySupabaseClaims(request.jwtB)]);}
  catch{return deny('JWT_CRYPTO_VERIFIER_UNAVAILABLE');}
  if(!verified.every(x=>exact(x,['claims','verifiedByTrustedSupabaseAuth'])&&
       x.verifiedByTrustedSupabaseAuth===true&&validClaims(x.claims,now)))
   return deny('JWT_SIGNATURE_ISSUER_AUDIENCE_OR_EXPIRY_INVALID');
  const [a,b]=verified.map(x=>x.claims);
  if(a.sub===b.sub||a.session_id===b.session_id)return deny('NOT_TWO_INDEPENDENT_AUTH_IDENTITIES');
  async function sessionStillActive(c){
   const proof=await lookupCurrentAuthSession({sessionId:c.session_id,userId:c.sub});
   return exact(proof,['active','sessionId','userId'])&&proof.active===true&&
    proof.sessionId===c.session_id&&proof.userId===c.sub;
  }
  try{
   if(!(await sessionStillActive(a))||!(await sessionStillActive(b)))
    return deny('OWNER_AUTH_SESSION_REVOKED_OR_UNBOUND');
  }catch{return deny('OWNER_SESSION_REGISTRY_UNAVAILABLE');}
  const tasks=[
   {token:request.jwtA,store:'QA_STORE_A',sku:SKU_A,expectedCount:1},
   {token:request.jwtA,store:'QA_STORE_B',sku:null,expectedCount:0},
   {token:request.jwtB,store:'QA_STORE_B',sku:SKU_B,expectedCount:1},
   {token:request.jwtB,store:'QA_STORE_A',sku:null,expectedCount:0},
   {token:null,store:'QA_STORE_A',sku:null,expectedCount:0}
  ];
  for(const item of tasks){
   let r;
   try{r=await readCatalogUsingEndUserJwt({
    accessToken:item.token,targetStoreKey:item.store,
    viewName:'tien404_v172a_qa_catalog',select:'tenant_id,store_key,sku,name,price_vnd',
    method:'GET'
   });}catch{return deny('USER_SCOPED_READER_UNAVAILABLE_OR_DENIED');}
   if(!validQuery(r))return deny('UNTRUSTED_READER_RESULT');
   if(item.token===null){
    if(![200,401,403].includes(r.status)||r.rows.length!==0)
     return deny('ANONYMOUS_READER_DATA_EXPOSURE');
   }else{
    if(r.status!==200||r.rows.length!==item.expectedCount)
     return deny('CROSS_STORE_ISOLATION_OR_OWNER_READ_FAILED');
    if(r.rows.some(row=>row.tenant_id!==approvedQaTenantId||
      row.store_key!==item.store||
      (item.sku!==null&&row.sku!==item.sku)))
     return deny('CROSS_TENANT_STORE_OR_SKU_LEAKAGE');
   }
  }
  try{
   if(!(await sessionStillActive(a))||!(await sessionStillActive(b)))
    return deny('OWNER_SESSION_REVOKED_DURING_UAT');
  }catch{return deny('OWNER_SESSION_RECHECK_UNAVAILABLE');}
  // Never return raw JWT, user_id, session_id, customer data or real host.
  return Object.freeze({ok:true,mode:'PRIVATE_USER_JWT_STORE_RLS_UAT_OBSERVATION_ONLY',
   exactlyFiveReadOnlyQueries:true,syntheticQaCatalogRowsValidated:2,
   independentAuthSubjectsChecked:2,preAndPostSessionChecks:true,
   providerMessagesSent:0,commerceOrdersTouched:0,
   independentMerchantHumanOwnersVerified:false,
   productionApproved:false,release:'HOSTED_NO_GO'});
 }
 return Object.freeze({run});
}
module.exports={makeRealJwtNoSendUat};
