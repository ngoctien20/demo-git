'use strict';
/**
 * V14.2 optional HOSTED JWT READ-ONLY QA runner.
 * Not wired into CI; does NOT execute without explicit operator flags, real
 * JWTs and canonical schema/fixtures. Never log JWT/API keys or private values.
 * Only GET requests, no DDL, DML, or service-role keys.
 */
const assert=require('node:assert/strict');
const EXPECTED_PROJECT='ifxlvrhyjhbzbrkdsida';
const API='https://'+EXPECTED_PROJECT+'.supabase.co';
const compactId=x=>typeof x==='string' && /^[0-9a-f-]{36}$/i.test(x);
function configFromEnv(env=process.env){
 const envs=['TIEN404_QA_ALLOW_HOSTED_READ_ONLY','QA_A_ACCESS_TOKEN','QA_B_ACCESS_TOKEN',
  'SUPABASE_PUBLISHABLE_KEY','QA_STORE_A_UUID','QA_STORE_B_UUID','QA_SKU_A','QA_SKU_B',
  'TIEN404_QA_SAME_TENANT_ASSERTION'];
 const missing=envs.filter(k=>!env[k]);
 if(missing.length)return {ready:false,missing,error:'HOSTED_QA_PREREQUISITES_MISSING'};
 if(env.TIEN404_QA_ALLOW_HOSTED_READ_ONLY!=='EXPLICIT_STAGING_JWT_READ_QA_APPROVED'||
    env.TIEN404_QA_SAME_TENANT_ASSERTION!=='YES_AUTHORIZED_SAME_TENANT_FIXTURES')
  return {ready:false,error:'HOSTED_QA_OPERATOR_OR_SAME_TENANT_GATE_CLOSED',missing:[]};
 if(!compactId(env.QA_STORE_A_UUID)||!compactId(env.QA_STORE_B_UUID)||env.QA_STORE_A_UUID===env.QA_STORE_B_UUID||
    env.QA_A_ACCESS_TOKEN===env.QA_B_ACCESS_TOKEN||!env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'))
  return {ready:false,error:'QA_IDENTITIES_OR_PUBLISHABLE_KEY_INVALID',missing:[]};
 return {ready:true,env};
}
async function requestRead(path,session,apiKey,fetchImpl=fetch){
 const response=await fetchImpl(API+path,{method:'GET',
  headers:{apikey:apiKey,Authorization:'Bearer '+session,Accept:'application/json'},
  redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('READ_ONLY_REQUEST_STATUS_'+response.status);
 const result=await response.json();
 return result;
}
async function hostedReadQa(cfg,fetchImpl=fetch){
 if(!cfg?.ready)throw Error('HOSTED_QA_NOT_AUTHORIZED');
 const e=cfg.env;const keys=[e.QA_A_ACCESS_TOKEN,e.QA_B_ACCESS_TOKEN];
 const profiles=await Promise.all(keys.map(k=>requestRead('/auth/v1/user',k,e.SUPABASE_PUBLISHABLE_KEY,fetchImpl)));
 for(const p of profiles){if(!compactId(p?.id)||p?.is_anonymous===true)throw Error('INVALID_AUTH_SESSION')}
 if(profiles[0].id===profiles[1].id)throw Error('TWO_DISTINCT_USERS_REQUIRED');
 const memberships=await Promise.all(profiles.map((p,i)=>
  requestRead('/rest/v1/store_memberships?select=tenant_id,store_id,user_id,role&user_id=eq.'+
    encodeURIComponent(p.id)+'&limit=20',keys[i],e.SUPABASE_PUBLISHABLE_KEY,fetchImpl)));
 if(!memberships.every(Array.isArray))throw Error('MEMBERSHIP_RESPONSE_INVALID');
 const a=memberships[0].find(m=>m.store_id===e.QA_STORE_A_UUID);
 const b=memberships[1].find(m=>m.store_id===e.QA_STORE_B_UUID);
 if(!a||!b||!compactId(a.tenant_id)||a.tenant_id!==b.tenant_id)
   throw Error('SAME_TENANT_STORE_MEMBERSHIP_PROOF_MISSING');
 // Positive: each user's own store must show independently authorized fixture.
 const stores=[e.QA_STORE_A_UUID,e.QA_STORE_B_UUID];
 const skus=[e.QA_SKU_A,e.QA_SKU_B];
 const checks=[];
 for(let i=0;i<2;i++){
  for(let j=0;j<2;j++){
   const u='/rest/v1/products?select=id,tenant_id,store_id,sku&store_id=eq.'+
    encodeURIComponent(stores[j])+'&sku=eq.'+encodeURIComponent(skus[j])+'&limit=2';
   const data=await requestRead(u,keys[i],e.SUPABASE_PUBLISHABLE_KEY,fetchImpl);
   if(!Array.isArray(data))throw Error('PRODUCT_QUERY_NOT_ARRAY');
   if(i===j){
    if(data.length!==1||data[0].store_id!==stores[j]||
       data[0].tenant_id!==a.tenant_id||data[0].sku!==skus[j])
      throw Error('OWN_STORE_POSITIVE_RLS_FAILED');
   }else if(data.length!==0)throw Error('CROSS_STORE_RLS_LEAK_DETECTED');
   checks.push({actor:i===0?'A':'B',target:j===0?'A':'B',expected:i===j?1:0,
     observed_count:data.length,pass:true});
  }
 }
 return Object.freeze({status:'HOSTED_READ_ONLY_JWT_QA_PASS',
    checks,distinct_users_verified:true,same_tenant_verified:true,
    service_role_used:false,queries:'GET_ONLY',writes:0,
    note:'Positive and negative reads ONLY. Write-path RLS remains untested.'});
}
if(require.main===module){
 (async()=>{const cfg=configFromEnv();
  if(!cfg.ready)throw Error(cfg.error+':'+(cfg.missing||[]).join(','));
  const result=await hostedReadQa(cfg);
  process.stdout.write(JSON.stringify(result)+'\n');
 })().catch(e=>{console.error('HOSTED_QA_BLOCKED_OR_FAILED: '+e.message);process.exitCode=1});
}
module.exports={configFromEnv,hostedReadQa,requestRead};
