// TIEN404 V21.7 - OWNER A/B REAL AUTH JWT READ-ONLY UAT HARNESS.
// This file NEVER creates users, grants roles, saves Page drafts, or sends Meta.
// Run only locally by an authorized operator with TWO independent Auth sessions.
// Never paste or commit JWTs, anon/publishable keys or customer data into chat.

import { pathToFileURL } from 'node:url';
const HOST='https://ifxlvrhyjhbzbrkdsida.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(reason)=>{throw new Error(reason);};

export async function checkRealOwnerJwtReadOnly({
  fetchImpl, publishableKey, ownerAJwt, ownerBJwt, storeA, storeB,
  expectedAPageCount=1,
}){
  if(typeof fetchImpl!=='function' || !publishableKey ||
     /^(?:sb_secret_|service_role)/i.test(publishableKey) ||
     !ownerAJwt || !ownerBJwt || ownerAJwt===ownerBJwt ||
     !UUID.test(storeA||'') || !UUID.test(storeB||'') || storeA===storeB ||
     !Number.isInteger(expectedAPageCount) || expectedAPageCount<1)
    fail('invalid_uat_configuration');

  let calls=0;
  const onlyGet=async(path,token)=>{
    if(typeof path!=='string'||!path.startsWith('/')||path.includes('..'))
      fail('invalid_request_path');
    calls++;
    const response=await fetchImpl(HOST+path,{
      method:'GET',redirect:'error',
      headers:{
        apikey:publishableKey,accept:'application/json',
        ...(token?{Authorization:'Bearer '+token}:{})
      }
    });
    if(!response || typeof response.status!=='number') fail('invalid_http_response');
    const body=await response.json().catch(()=>null);
    return {status:response.status,ok:response.ok===true,body};
  };
  const auth=async(token)=>{
    const x=await onlyGet('/auth/v1/user',token);
    if(!x.ok||!UUID.test(x.body?.id||''))fail('real_auth_session_not_verified');
    return x.body.id;
  };
  const [uidA,uidB]=await Promise.all([auth(ownerAJwt),auth(ownerBJwt)]);
  if(uidA===uidB)fail('same_authenticated_owner');
  const members=async(token,uid,store)=>{
    const q=new URLSearchParams({
      select:'role,active',user_id:'eq.'+uid,store_id:'eq.'+store
    });
    const x=await onlyGet('/rest/v1/store_memberships?'+q.toString(),token);
    if(!x.ok||!Array.isArray(x.body))fail('member_read_denied');
    return x.body.some(r=>r.role==='owner'&&r.active===true);
  };
  if(!await members(ownerAJwt,uidA,storeA) ||
     !await members(ownerBJwt,uidB,storeB))
    fail('owner_membership_not_proven');
  if(await members(ownerAJwt,uidA,storeB) ||
     await members(ownerBJwt,uidB,storeA))
    fail('overlapping_owner_stores_invalid_test');

  const pages=async(token,store)=>{
    const q=new URLSearchParams({
      select:'id',store_id:'eq.'+store,channel:'eq.messenger'
    });
    const x=await onlyGet('/rest/v1/channel_connections?'+q.toString(),token);
    if(!x.ok||!Array.isArray(x.body))fail('connection_read_denied');
    return x.body.length;
  };
  const [aOwn,aCross,bCross,bOwn]=await Promise.all([
    pages(ownerAJwt,storeA),pages(ownerAJwt,storeB),
    pages(ownerBJwt,storeA),pages(ownerBJwt,storeB)
  ]);
  if(aOwn!==expectedAPageCount || aCross!==0 || bCross!==0)
    fail('cross_tenant_isolation_not_proven');
  const anonymous=await onlyGet('/rest/v1/channel_connections?select=id&limit=1',null);
  if(anonymous.ok && Array.isArray(anonymous.body) && anonymous.body.length>0)
    fail('anonymous_connection_exposure');
  if(anonymous.ok)fail('anon_sql_grant_unexpected');
  if(![401,403].includes(anonymous.status))fail('anon_rejection_not_verified');
  return Object.freeze({
    status:'read_only_uat_pass',separateRealOwnerSessions:true,
    crossStoreHidden:true,anonBlocked:true,ownerAPageCount:aOwn,
    ownerBPageCount:bOwn,requestCount:calls,
    jwtContentsExposed:false,hostedWrite:false,metaSend:false
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const e=process.env;
  // Safety guard: require explicit opt-in and prevent hosted privileged keys.
  if(e.TIEN404_REAL_OWNER_JWT_READONLY_UAT!=='YES' ||
     e.SUPABASE_SERVICE_ROLE_KEY || e.META_PAGE_ACCESS_TOKEN ||
     e.DATABASE_URL || e.SUPABASE_DB_URL || e.N8N_API_KEY) {
    console.error('UAT_BLOCKED: explicit local read-only authorization required');
    process.exitCode=2;
  } else {
    try{
      const result=await checkRealOwnerJwtReadOnly({
        fetchImpl:fetch,publishableKey:e.SUPABASE_PUBLISHABLE_KEY,
        ownerAJwt:e.T404_OWNER_A_JWT,ownerBJwt:e.T404_OWNER_B_JWT,
        storeA:e.T404_STORE_A_UUID,storeB:e.T404_STORE_B_UUID,
        expectedAPageCount:Number(e.T404_EXPECTED_A_PAGES||1)
      });
      // Count only; never output user IDs, store IDs, headers, JWTs or tokens.
      console.log('T404_V217_OWNER_REAL_JWT_UAT '+JSON.stringify(result));
    }catch(_error){
      console.error('UAT_BLOCKED: no credential or raw response is printed; review authorization and RLS');
      process.exitCode=1;
    }
  }
}
