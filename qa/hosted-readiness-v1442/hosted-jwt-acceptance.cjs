'use strict';
/**
 * TIEN404 V14.4.2 — opt-in, GET-ONLY, operator-side HOSTED JWT acceptance.
 * DOES NOT create users/fixtures, connect with service-role, perform SQL,
 * obtain tokens, deploy, change RLS, print profile data or issue messages.
 *
 * Requires: separately owner-approved REAL Supabase Auth user JWTs, one QA
 * tenant with TWO independently assigned stores A+B, a different tenant C,
 * one valid but unassigned/revoked staff user R, and pre-existing owner-
 * authorized synthetic products + orders. Cannot run until hosted RLS exists.
 *
 * This intentionally EXTENDS (does not overwrite) the V14.2 read-only JWT
 * contract from Draft PR #86, which is on a different Git branch.
 */
const {randomUUID}=require('node:crypto');
const PROJECT='ifxlvrhyjhbzbrkdsida';
const ORIGIN='https://'+PROJECT+'.supabase.co';
const APPROVAL='OWNER_APPROVED_HOSTED_GET_ONLY';
const RESTORE_GATE='RESTORE_DRILL_AND_RLS_MIGRATION_SEPARATELY_APPROVED';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED=Object.freeze([
 'TIEN404_V1442_QA_APPROVAL','TIEN404_V1442_RESTORE_GATE',
 'TIEN404_V1442_PROJECT_REF','SUPABASE_PUBLISHABLE_KEY',
 'QA_A_ACCESS_TOKEN','QA_B_ACCESS_TOKEN','QA_C_ACCESS_TOKEN','QA_REVOKED_ACCESS_TOKEN',
 'QA_STORE_A_UUID','QA_STORE_B_UUID','QA_STORE_C_UUID',
 'QA_SKU_A','QA_SKU_B','QA_SKU_C',
 'QA_ORDER_A_UUID','QA_ORDER_B_UUID','QA_ORDER_C_UUID'
]);
const ERRORS=new Set([
 'HOSTED_QA_GATES_CLOSED','HOSTED_QA_CONFIG_INVALID','HOSTED_QA_CREDENTIALS_INVALID',
 'HOSTED_QA_TOKEN_REJECTED','HOSTED_QA_REQUEST_REJECTED','HOSTED_QA_INVALID_RESPONSE',
 'HOSTED_QA_IDENTITY_NOT_INDEPENDENT','HOSTED_QA_TENANTS_NOT_ISOLATED',
 'HOSTED_QA_MEMBERSHIP_MISSING','HOSTED_QA_SCOPE_OVERLAP','HOSTED_QA_POSITIVE_FIXTURE_MISSING',
 'HOSTED_QA_CROSS_STORE_LEAK','HOSTED_QA_REVOKED_STAFF_LEAK'
]);
function deny(code){const e=new Error(code);e.code=code;throw e;}
const isUuid=x=>typeof x==='string'&&UUID.test(x);
const jwtShape=x=>typeof x==='string'&&x.length>30&&x.length<5000&&
 x.split('.').length===3&&x.split('.').every(z=>/^[A-Za-z0-9_-]{4,}$/.test(z));
function configFromEnv(env={}){
 const missing=REQUIRED.filter(k=>typeof env[k]!=='string'||!env[k].trim());
 if(missing.length||env.TIEN404_V1442_QA_APPROVAL!==APPROVAL||
   env.TIEN404_V1442_RESTORE_GATE!==RESTORE_GATE||
   env.TIEN404_V1442_PROJECT_REF!==PROJECT)
    return Object.freeze({ready:false,code:'HOSTED_QA_GATES_CLOSED',missing});
 const key=env.SUPABASE_PUBLISHABLE_KEY;
 const tokens=['QA_A_ACCESS_TOKEN','QA_B_ACCESS_TOKEN','QA_C_ACCESS_TOKEN',
   'QA_REVOKED_ACCESS_TOKEN'].map(k=>env[k]);
 const stores=['QA_STORE_A_UUID','QA_STORE_B_UUID','QA_STORE_C_UUID'].map(k=>env[k]);
 const orders=['QA_ORDER_A_UUID','QA_ORDER_B_UUID','QA_ORDER_C_UUID'].map(k=>env[k]);
 const skus=['QA_SKU_A','QA_SKU_B','QA_SKU_C'].map(k=>env[k]);
 if(!key.startsWith('sb_publishable_')||key.length>250||
    !tokens.every(jwtShape)||new Set(tokens).size!==4||
    !stores.every(isUuid)||new Set(stores).size!==3||
    !orders.every(isUuid)||new Set(orders).size!==3||
    !skus.every(x=>/^[A-Za-z0-9_-]{3,40}$/.test(x)))
   return Object.freeze({ready:false,code:'HOSTED_QA_CREDENTIALS_INVALID',missing:[]});
 return Object.freeze({ready:true,projectRef:PROJECT,
   // NEVER serialize this config or print any token/publishable key.
   privateEnv:env});
}
async function call({path,token,key,fetchImpl}){
 if(!/^\/(?:auth\/v1\/user|rest\/v1\/(?:store_memberships|products|orders)\?.+)$/.test(path))
  deny('HOSTED_QA_REQUEST_REJECTED');
 let response;
 try{
   response=await fetchImpl(ORIGIN+path,{
     method:'GET',redirect:'error',cache:'no-store',
     signal:AbortSignal.timeout(12000),
     headers:{'Authorization':'Bearer '+token,'apikey':key,
       'Accept':'application/json','Cache-Control':'no-store',
       'X-TIEN404-QA-Id':randomUUID()}
   });
 }catch{deny('HOSTED_QA_REQUEST_REJECTED');}
 if(!response?.ok)deny('HOSTED_QA_TOKEN_REJECTED');
 let payload;try{payload=await response.json();}catch{deny('HOSTED_QA_INVALID_RESPONSE');}
 return payload;
}
function query(table,filters,columns){
 const p=new URLSearchParams({select:columns,...filters,limit:'2'});
 return '/rest/v1/'+table+'?'+p.toString();
}
async function hostedJwtAcceptance(cfg,fetchImpl=globalThis.fetch){
 if(cfg?.ready!==true||cfg.projectRef!==PROJECT||
   typeof fetchImpl!=='function')deny('HOSTED_QA_GATES_CLOSED');
 const env=cfg.privateEnv;
 const t=[env.QA_A_ACCESS_TOKEN,env.QA_B_ACCESS_TOKEN,env.QA_C_ACCESS_TOKEN,
   env.QA_REVOKED_ACCESS_TOKEN],key=env.SUPABASE_PUBLISHABLE_KEY;
 const stores=[env.QA_STORE_A_UUID,env.QA_STORE_B_UUID,env.QA_STORE_C_UUID];
 const skus=[env.QA_SKU_A,env.QA_SKU_B,env.QA_SKU_C];
 const orders=[env.QA_ORDER_A_UUID,env.QA_ORDER_B_UUID,env.QA_ORDER_C_UUID];
 // Supabase Auth validates the actual bearer; never infer auth from decoded
 // client payload, user_metadata, a "verified" flag or client-provided role.
 const users=await Promise.all(t.map(token=>call({
   path:'/auth/v1/user',token,key,fetchImpl})));
 if(users.some(u=>!isUuid(u?.id)||u.is_anonymous===true)||
   new Set(users.map(u=>u.id)).size!==4)
   deny('HOSTED_QA_IDENTITY_NOT_INDEPENDENT');
 const memberships=await Promise.all(users.map((u,i)=>call({
   path:query('store_memberships',{user_id:'eq.'+u.id},
      'tenant_id,store_id,user_id,active,role'),
   token:t[i],key,fetchImpl
 })));
 if(!memberships.every(Array.isArray))deny('HOSTED_QA_INVALID_RESPONSE');
 const mine=[];
 for(let i=0;i<3;i++){
  const matched=memberships[i].filter(m=>m.store_id===stores[i]&&
    m.user_id===users[i].id&&m.active===true&&isUuid(m.tenant_id));
  if(matched.length!==1)deny('HOSTED_QA_MEMBERSHIP_MISSING');
  mine.push(matched[0]);
  if(memberships[i].some(m=>m.active===true&&stores.some((v,j)=>j!==i&&v===m.store_id)))
   deny('HOSTED_QA_SCOPE_OVERLAP');
 }
 if(mine[0].tenant_id!==mine[1].tenant_id||mine[0].tenant_id===mine[2].tenant_id)
  deny('HOSTED_QA_TENANTS_NOT_ISOLATED');
 if(memberships[3].some(m=>m.active===true&&stores.includes(m.store_id)))
  deny('HOSTED_QA_SCOPE_OVERLAP');
 const counts={positive:0,negative:0,revoked:0};
 for(let actor=0;actor<4;actor++){
  for(let shop=0;shop<3;shop++){
   for(const [table,fixture,matchField,select] of [
    ['products',skus[shop],'sku','id,tenant_id,store_id,sku'],
    ['orders',orders[shop],'id','id,tenant_id,store_id']
   ]){
    const p=query(table,{store_id:'eq.'+stores[shop],
      [matchField]:'eq.'+fixture},select);
    const data=await call({path:p,token:t[actor],key,fetchImpl});
    if(!Array.isArray(data))deny('HOSTED_QA_INVALID_RESPONSE');
    const own=actor===shop;
    if(own){
      if(data.length!==1||data[0].store_id!==stores[shop]||
        data[0].tenant_id!==mine[shop].tenant_id||
        data[0][matchField]!==fixture)
       deny('HOSTED_QA_POSITIVE_FIXTURE_MISSING');
      counts.positive++;
    }else{
      if(data.length!==0)
       deny(actor===3?'HOSTED_QA_REVOKED_STAFF_LEAK':'HOSTED_QA_CROSS_STORE_LEAK');
      if(actor===3)counts.revoked++;else counts.negative++;
    }
   }
  }
 }
 return Object.freeze({
   mode:'HOSTED_READ_ONLY_JWT_ACCEPTANCE',status:'GET_ONLY_QA_PASSED',
   projectRef:PROJECT,realAuthUserEndpointUsed:true,distinctUserCount:4,
   sameTenantAandB:true,independentTenantC:true,
   positiveCases:counts.positive,negativeCases:counts.negative,
   revokedStaffNegativeCases:counts.revoked,checks:24,
   tableTargets:['products','orders'],writeRequests:0,
   serviceRoleUsed:false,customerPersonalDataReturned:false,
   note:'Read-only Products/Orders scope only; writes/RPCs and the remaining four Commerce tables require separate hosted acceptance. Review independent evidence before release.'
 });
}
if(require.main===module){
 (async()=>{
   const cfg=configFromEnv(process.env);
   if(!cfg.ready)deny(cfg.code);
   const result=await hostedJwtAcceptance(cfg);
   process.stdout.write(JSON.stringify(result)+'\n');
 })().catch(e=>{
   // Never log network response, token, API key, user profile or stack.
   const safe=ERRORS.has(e?.code)?e.code:'HOSTED_QA_REQUEST_REJECTED';
   process.stderr.write('V14_4_2_QA_BLOCKED_OR_FAILED: '+safe+'\n');
   process.exitCode=1;
 });
}
module.exports={PROJECT,APPROVAL,RESTORE_GATE,REQUIRED,configFromEnv,
  hostedJwtAcceptance,query,call};
