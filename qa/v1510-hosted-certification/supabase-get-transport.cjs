'use strict';
/** Private operator transport. NO live calls made in CI. Only GET allowed.
 * Separate human authorizations are required before real JWT testing.
 */
const PROJECT='ifxlvrhyjhbzbrkdsida';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function roleOfJwt(token){
 try{const parts=token.split('.');if(parts.length!==3)return null;
  const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  return typeof payload?.role==='string'?payload.role:null;
 }catch{return null}
}
function createPrivateGetTransport({projectUrl,publicApiKey,fetchImpl}={}){
 const expected='https://'+PROJECT+'.supabase.co';
 if(projectUrl!==expected)throw Error('WRONG_ORIGIN');
 if(typeof publicApiKey!=='string'||publicApiKey.length<24||publicApiKey.startsWith('sb_secret_')||roleOfJwt(publicApiKey)==='service_role')
  throw Error('PUBLISHABLE_OR_ANON_KEY_ONLY');
 if(typeof fetchImpl!=='function')throw Error('PRIVATE_FETCH_IMPL_REQUIRED');
 async function getJson(path,token){
  if(typeof token!=='string'||token.length<24||token.includes('\n')||token.includes('\r')||roleOfJwt(token)==='service_role')
   throw Error('INVALID_ACTOR_BEARER');
  const url=new URL(path,expected);
  if(url.origin!==expected||!['/auth/v1/user','/rest/v1/orders'].includes(url.pathname))throw Error('READONLY_ENDPOINT_NOT_ALLOWED');
  const response=await fetchImpl(url.toString(),{
   method:'GET',redirect:'error',cache:'no-store',
   headers:{apikey:publicApiKey,Authorization:'Bearer '+token,Accept:'application/json'}
  });
  if(!response||!Number.isInteger(response.status)||response.status<200||response.status>=300)
   throw Error('AUTH_OR_RLS_READ_FAILED');
  return response.json();
 }
 return Object.freeze({
  getUser:async({token,method,path})=>{
   if(method!=='GET'||path!=='/auth/v1/user')throw Error('GET_USER_CONTRACT_REQUIRED');
   const j=await getJson('/auth/v1/user',token);
   if(!j||typeof j.id!=='string')throw Error('INVALID_AUTH_RESPONSE');
   return {id:j.id,aud:j.aud};
  },
  readOrder:async({token,method,resource,select,filter})=>{
   if(method!=='GET'||resource!=='orders'||select!=='id,tenant_id,store_id,status'||!UUID.test(filter?.id||''))
    throw Error('STRICT_ORDER_GET_CONTRACT_REQUIRED');
   const url=new URL('/rest/v1/orders',expected);
   url.searchParams.set('select',select);url.searchParams.set('id','eq.'+filter.id);url.searchParams.set('limit','2');
   const rows=await getJson(url.pathname+url.search,token);
   if(!Array.isArray(rows)||rows.length>2)throw Error('INVALID_ORDER_READ_RESPONSE');
   return rows.map(row=>({id:row.id,tenant_id:row.tenant_id,store_id:row.store_id,status:row.status}));
  }
 });
}
module.exports={createPrivateGetTransport};
