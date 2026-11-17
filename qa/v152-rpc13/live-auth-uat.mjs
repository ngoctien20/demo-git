// RPC13: operator-only real Supabase Auth JWT UAT. NEVER run in GitHub Actions.
// No writes; 2 independently-authenticated user tokens are read from local files.
// No access-token, email, user UUID, original Store UUID or merchant data is logged.
import {readFile} from 'node:fs/promises';
export {readPrivateToken} from './private-token-file-security.mjs';
import {readPrivateToken} from './private-token-file-security.mjs';
import {resolve} from 'node:path';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SURFACES=Object.freeze(['products','orders','customers','order_items','conversations','messages']);
function ensure(x,msg){if(!x)throw Error(msg);}
function safeUrl(base){const u=new URL(base);ensure(u.protocol==='https:'&&u.pathname==='/'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.origin==='https://ifxlvrhyjhbzbrkdsida.supabase.co','UNTRUSTED_SUPABASE_ORIGIN');return u.origin;}
export async function runUat({projectUrl,publishableKey,tokenA,tokenB,canaries,fetcher=fetch}){
 const origin=safeUrl(projectUrl);
 ensure(typeof publishableKey==='string'&&publishableKey.length>=10,'MISSING_PUBLISHABLE_KEY');
 ensure(typeof tokenA==='string'&&tokenA.length>=100&&typeof tokenB==='string'&&tokenB.length>=100&&tokenA!==tokenB,'DISTINCT_REAL_TOKENS_REQUIRED');
 for(const t of SURFACES){ensure(canaries?.[t]&&UUID.test(canaries[t].A)&&UUID.test(canaries[t].B)&&canaries[t].A!==canaries[t].B,'SIX_SURFACE_CANARIES_REQUIRED');}
 let requests=0;
 async function get(path,token){
  requests++;
  const r=await fetcher(origin+path,{method:'GET',redirect:'error',cache:'no-store',headers:{apikey:publishableKey,authorization:'Bearer '+token,'cache-control':'no-store'}});
  ensure(r.status===200,'HOSTED_AUTH_OR_RLS_NOT_READY');
  const data=await r.json();return data;
 }
 async function user(token){const u=await get('/auth/v1/user',token);ensure(UUID.test(u.id)&&u.role==='authenticated'&&!u.is_anonymous&&Boolean(u.email_confirmed_at),'SIGNED_IN_VERIFIED_USER_REQUIRED');return u;}
 const [ua,ub]=await Promise.all([user(tokenA),user(tokenB)]);ensure(ua.id!==ub.id,'TWO_DISTINCT_USERS_REQUIRED');
 const getRows=(name,q,token)=>get('/rest/v1/'+name+'?select='+encodeURIComponent(name==='tenant_memberships'?'tenant_id,role,active':name==='store_memberships'?'tenant_id,store_id,role,active':'id,tenant_id,store_id')+'&'+q,token);
 const [ta,tb]=await Promise.all([getRows('tenant_memberships','user_id=eq.'+ua.id,tokenA),getRows('tenant_memberships','user_id=eq.'+ub.id,tokenB)]);
 ensure(Array.isArray(ta)&&Array.isArray(tb),'TENANT_MEMBERSHIP_UNREADABLE');
 const tenants=ta.filter(r=>r.active&&['owner','manager'].includes(r.role)).map(r=>r.tenant_id);
 const shared=tb.filter(r=>r.active&&['owner','manager'].includes(r.role)&&tenants.includes(r.tenant_id)).map(r=>r.tenant_id);
 ensure(shared.length===1,'ONE_SHARED_TENANT_REQUIRED');
 const tenant=shared[0];
 const [sa,sb]=await Promise.all([getRows('store_memberships','user_id=eq.'+ua.id,tokenA),getRows('store_memberships','user_id=eq.'+ub.id,tokenB)]);
 ensure(Array.isArray(sa)&&Array.isArray(sb),'STORE_MEMBERSHIP_UNREADABLE');
 const a=sa.filter(r=>r.active&&r.tenant_id===tenant&&['owner','manager'].includes(r.role));
 const b=sb.filter(r=>r.active&&r.tenant_id===tenant&&['owner','manager'].includes(r.role));
 ensure(a.length===1&&b.length===1&&a[0].store_id!==b[0].store_id,'INDEPENDENT_STORE_MEMBERSHIP_REQUIRED');
 // Six tables are checked using real signed Auth tokens at the Supabase PostgREST boundary.
 let assertions=0;
 for(const table of SURFACES){
   const ids=canaries[table];
   for(const [token,ours,theirs,expectedStore] of [[tokenA,ids.A,ids.B,a[0].store_id],[tokenB,ids.B,ids.A,b[0].store_id]]){
    const visible=await getRows(table,'id=eq.'+ours,token);
    ensure(Array.isArray(visible)&&visible.length===1&&visible[0].tenant_id===tenant&&visible[0].store_id===expectedStore,'OWN_CANARY_NOT_VISIBLE_OR_MISBOUND');assertions++;
    const blocked=await getRows(table,'id=eq.'+theirs,token);
    ensure(Array.isArray(blocked)&&blocked.length===0,'CROSS_STORE_RLS_EXPOSURE');assertions++;
   }
 }
 return Object.freeze({status:'REAL_JWT_TWO_STORE_READ_ONLY_UAT_PASS',surfaces:SURFACES.length,assertions,requests,scopedAuthUserCount:2,sameTenant:true});
}
// No CLI token handling is enabled by default; operator must explicitly run locally
// with separate private token files and approved synthetic canary registry.
export async function operatorRun({configPath,tokenAPath,tokenBPath}){
 if(process.env.CI==='true'||process.env.GITHUB_ACTIONS==='true')throw Error('LIVE_AUTH_UAT_FORBIDDEN_IN_CI');
 const config=JSON.parse(await readFile(resolve(configPath),'utf8'));
 if(config.originalMerchantProofApproved!==true||config.recoveryApproved!==true||config.independentUatApproved!==true)throw Error('REAL_UAT_ADMISSION_NOT_APPROVED');
 return runUat({projectUrl:config.projectUrl,publishableKey:config.publishableKey,canaries:config.canaries,tokenA:await readPrivateToken(tokenAPath),tokenB:await readPrivateToken(tokenBPath)});
}