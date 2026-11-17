/**
 * RPC17.8 — read-only, disposable Store A/B PostgREST diagnostic.
 * NO credentials, owner identity, customer data, or JWTs are stored in this repo.
 * Real caller uses *private* operator workstation, not GitHub Actions.
 * This diagnostic NEVER authorizes admission, migration, upload, sending, or Access changes.
 */
const GUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_PROJECT='ifxlvrhyjhbzbrkdsida';
const NEVER=Object.freeze({can_release:false,can_migrate:false,can_upload:false,can_send:false,can_open_access:false});
const fail=reason=>Object.freeze({...NEVER,status:'BLOCKED',reason});
const isGuid=x=>typeof x==='string'&&GUID.test(x);
const expectedKeys=['tenant_id','store_a','store_b','product_a','product_b','user_a','user_b'];
const validFixture=f=>!!f&&expectedKeys.every(k=>isGuid(f[k]))&&f.store_a!==f.store_b&&f.product_a!==f.product_b&&f.user_a!==f.user_b;
const redact=x=>typeof x==='string'&&x.length<=100&&/^[A-Z0-9_]+$/.test(x)?x:'FAILED';
const rget=async(fetchImpl,url,headers)=>{
  // No automatic redirects: avoid forwarding JWTs to an untrusted host.
  const r=await fetchImpl(url,{method:'GET',headers,redirect:'error',cache:'no-store'});
  if(!r||r.status!==200)return null;
  const body=await r.json();
  return body;
};
export async function evaluatePrivateReadOnlyUat({fetchImpl,apiBase,publishableKey,tokenA,tokenB,fixture,operatorGate}={}){
 try{
  if(typeof fetchImpl!=='function'||!validFixture(fixture))return fail('MISSING_QA_FIXTURE');
  const base=new URL(apiBase);
  if(base.origin!==`https://${SAFE_PROJECT}.supabase.co`||base.pathname!=='/'||base.search||base.hash)return fail('PROJECT_NOT_ALLOWLISTED');
  if(typeof publishableKey!=='string'||!publishableKey.startsWith('sb_publishable_')||publishableKey.length>240)return fail('PUBLISHABLE_KEY_REQUIRED');
  if(!['tokenA','tokenB'].every(k=>typeof arguments[0]?.[k]==='string'&&arguments[0][k].length>20&&arguments[0][k].length<8192))return fail('PRIVATE_AUTH_TOKENS_MISSING');
  if(tokenA===tokenB)return fail('IDENTICAL_TOKENS');
  // Never consider a supplied boolean an independent authorization signature.
  if(operatorGate?.explicitPrivateNoSendMode!=='DISPOSABLE_DIAGNOSTIC_ONLY'||operatorGate?.independentApprovalReceiptPresent!==true)return fail('NO_PRIVATE_OPERATOR_RECEIPT');
  const makeHeaders=token=>({'apikey':publishableKey,'Authorization':`Bearer ${token}`,'Accept':'application/json'});
  const profiles={A:makeHeaders(tokenA),B:makeHeaders(tokenB)};
  const userA=await rget(fetchImpl,`${base.origin}/auth/v1/user`,profiles.A);
  const userB=await rget(fetchImpl,`${base.origin}/auth/v1/user`,profiles.B);
  if(!userA||!userB||userA.id!==fixture.user_a||userB.id!==fixture.user_b)return fail('AUTH_USER_ENDPOINT_MISMATCH');
  const checks=[];
  for(const [actor,headers]of Object.entries(profiles)){
   for(const [tag,id,shouldSee] of [
    ['A',fixture.product_a,actor==='A'],
    ['B',fixture.product_b,actor==='B']]){
    const endpoint=new URL(`${base.origin}/rest/v1/products`);
    endpoint.searchParams.set('select','id,tenant_id,store_id');
    endpoint.searchParams.set('id',`eq.${id}`);
    const result=await rget(fetchImpl,endpoint.toString(),{...headers,'Accept-Profile':'rpc178_qa','Prefer':'count=exact'});
    if(!Array.isArray(result)||result.some(x=>!x||!isGuid(x.id)||!isGuid(x.store_id)||!isGuid(x.tenant_id)))return fail('RLS_PROFILE_UNAVAILABLE_OR_INVALID');
    const expectedStore=tag==='A'?fixture.store_a:fixture.store_b;
    const expectedTenant=fixture.tenant_id;
    if(shouldSee){
      if(result.length!==1||result[0].id!==id||result[0].store_id!==expectedStore||result[0].tenant_id!==expectedTenant)return fail('OWN_STORE_READ_FAILED');
    } else if(result.length!==0)return fail('CROSS_STORE_DISCLOSURE');
    checks.push(`${actor}_TO_${tag}_${shouldSee?'OWN':'DENIED'}`);
   }
  }
  return Object.freeze({...NEVER,status:'DIAGNOSTIC_PASSED_HUMAN_REVIEW_REQUIRED',reason:'NO_SESSION_REVOCATION_OR_OWNERSHIP_PROOF',checks:Object.freeze(checks)});
 }catch{return fail('PRIVATE_RUNNER_FAILED_CLOSED');}
}
export const realHostedAcceptance=()=>fail('INDEPENDENT_SECURITY_AND_OWNER_ACCEPTANCE_REQUIRED');
