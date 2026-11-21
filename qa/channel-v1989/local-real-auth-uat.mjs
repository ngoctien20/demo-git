/**
 * TIEN404 V19.8.9: local Docker Supabase Auth + real JWT + PostgREST RLS.
 * Ephemeral synthetic users. No hosted project, Bot, payment or Commerce writes.
 * Never print Auth keys, tokens, emails, user IDs or SQL connection URLs.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const TENANT='00000000-0000-0000-0000-000000001989';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLES={
 products:'sku,store_code,price_vnd,stock_on_hand,fixture_tag',
 customers:'customer_ref,store_code,fixture_tag',
 orders:'order_ref,store_code,fixture_tag',
 order_items:'line_ref,store_code,fixture_tag',
 conversations:'conversation_ref,store_code,fixture_tag',
 messages:'message_ref,store_code,fixture_tag'
};
const must=(condition,reason)=>{if(!condition)throw Error(reason)};
export const noHosted=(v)=>{
 try{return ['127.0.0.1','localhost','[::1]'].includes(new URL(v).hostname);}
 catch{return false;}
};
export function validateLocalStatus(x){
 must(x&&typeof x==='object','CLI_STATUS_UNAVAILABLE');
 must(typeof x.API_URL==='string'&&noHosted(x.API_URL),'REFUSE_NON_LOCAL_API');
 must(typeof x.DB_URL==='string'&&noHosted(x.DB_URL),'REFUSE_NON_LOCAL_DATABASE');
 const anon=x.ANON_KEY||x.PUBLISHABLE_KEY;
 must(typeof anon==='string'&&anon.length>20&&!anon.startsWith('sb_secret_'),'PUBLIC_LOCAL_KEY_MISSING');
 return {url:x.API_URL,db:x.DB_URL,anon};
}
export function verifyRows(table,store,rows){
 if(!Object.hasOwn(TABLES,table)||!['A','B'].includes(store)||!Array.isArray(rows)||rows.length!==1)return false;
 const x=rows[0];if(!x||x.store_code!==store||x.fixture_tag!=='SYNTHETIC_V1989')return false;
 if(table==='products')return x.sku==='F01'&&x.price_vnd===(store==='A'?159000:189000)&&x.stock_on_hand===(store==='A'?5:9);
 const k={customers:'customer_ref',orders:'order_ref',order_items:'line_ref',conversations:'conversation_ref',messages:'message_ref'}[table];
 return x[k]==='V1989_'+store+'_01';
}
async function api(local,path,bearer,method='GET',body=null){
 const headers={apikey:local.anon,accept:'application/json'};
 if(bearer)headers.Authorization='Bearer '+bearer;
 if(body)headers['content-type']='application/json';
 return fetch(local.url+path,{method,headers,body:body?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'});
}
async function j(r){try{return await r.json()}catch{throw Error('INVALID_AUTH_JSON')}}
function psql(local,command,asFile=false){
 must(noHosted(local.db),'REFUSE_NON_LOCAL_PSQL');
 execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','--dbname='+local.db,
  asFile?'--file='+command:'--command='+command],
 {stdio:'pipe',timeout:60000,maxBuffer:400000});
}
async function signInNewUser(local,label){
 // Signup + actual GoTrue token issuance, not a handwritten JWT or mock claim.
 const email='qa-t404-'+label+'-'+randomBytes(12).toString('hex')+'@example.invalid';
 const password=randomBytes(36).toString('base64url')+'A1!';
 const signup=await api(local,'/auth/v1/signup',null,'POST',{email,password});
 must(signup.ok,'SIGNUP_'+label+'_HTTP_'+signup.status);
 const newUser=await j(signup);
 must(UUID.test(newUser?.user?.id||''),'SIGNED_UP_USER_INVALID_'+label);
 const login=await api(local,'/auth/v1/token?grant_type=password',null,'POST',{email,password});
 must(login.ok,'SIGNIN_'+label+'_HTTP_'+login.status);
 const session=await j(login);
 must(typeof session.access_token==='string','TOKEN_NOT_ISSUED_'+label);
 const check=await api(local,'/auth/v1/user',session.access_token);
 must(check.ok,'TOKEN_REJECTED_'+label);
 const profile=await j(check);
 must(profile.id===newUser.user.id&&profile.role==='authenticated','SIGNED_AUTH_USER_WRONG_'+label);
 return {id:profile.id,token:session.access_token};
}
async function select(local,table,token,filter=''){
 const path='/rest/v1/t404_v1989_'+table+'?select='+encodeURIComponent(TABLES[table])+
  (filter?'&store_code=eq.'+filter:'');
 const r=await api(local,path,token);
 if(r.status===401||r.status===403)return {blocked:true,rows:[]};
 must(r.ok,'REST_'+table+'_STATUS_'+r.status);
 const rows=await j(r);
 must(Array.isArray(rows),'REST_INVALID_ARRAY_'+table);
 return {blocked:false,rows};
}
async function main(){
 must(process.env.T404_V1989_DOCKER_ONLY==='YES_LOCAL_CI','LOCAL_CI_GATE_MISSING');
 must(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_DB_PASSWORD,'HOSTED_CREDENTIALS_PRESENT');
 // Local Supabase CLI status contains ephemeral keys: never print its output.
 const raw=execFileSync('supabase',['status','-o','json'],
  {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
 const local=validateLocalStatus(JSON.parse(raw));
 const path=resolve(dirname(fileURLToPath(import.meta.url)),'docker-uat-fixture.sql');
 must(readFileSync(path,'utf8').includes('SYNTHETIC_V1989'),'FIXTURE_MISSING');
 psql(local,path,true);
 let pass=0;
 const ok=(v,label)=>{must(v,'FAIL_'+label);pass++;process.stdout.write('PASS '+label+'\n')};
 ok(true,'DISPOSABLE_LOCAL_SQL_FIXTURE_APPLIED');
 const a=await signInNewUser(local,'A');
 const b=await signInNewUser(local,'B');
 const member=await signInNewUser(local,'MEMBER');
 ok(a.id!==b.id&&a.id!==member.id&&b.id!==member.id,'THREE_DISTINCT_GOTRUE_JWT_ISSUED');
 // Only validated UUIDs are interpolated into disposable local SQL.
 must([a.id,b.id,member.id].every(v=>UUID.test(v)),'INVALID_ACCOUNT_ID');
 const members=[a.id,b.id,member.id].map(id=>"('"+TENANT+"','"+id+"',true)").join(',');
 const owners="('"+TENANT+"','A','"+a.id+"',true,'owner'),"+
  "('"+TENANT+"','B','"+b.id+"',true,'owner')";
 psql(local,'INSERT INTO public.t404_v1989_tenant_memberships VALUES '+members+
  '; INSERT INTO public.t404_v1989_store_memberships VALUES '+owners+';');
 ok(true,'DATABASE_MAPPED_REAL_AUTH_USERS_TO_DIFFERENT_STORES');
 for(const [name,actor] of [['A',a],['B',b]]){
  const other=name==='A'?'B':'A';
  for(const table of Object.keys(TABLES)){
   const positive=await select(local,table,actor.token);
   ok(!positive.blocked&&verifyRows(table,name,positive.rows),name+'_'+table+'_OWN_ALLOWED');
   const negative=await select(local,table,actor.token,other);
   ok(negative.blocked||negative.rows.length===0,name+'_'+table+'_OTHER_DENIED');
  }
 }
 for(const table of Object.keys(TABLES)){
  const noStore=await select(local,table,member.token);
  ok(noStore.blocked||noStore.rows.length===0,'TENANT_MEMBER_NO_STORE_'+table);
  const anonymous=await select(local,table,null);
  ok(anonymous.blocked||anonymous.rows.length===0,'ANONYMOUS_DENIED_'+table);
 }
 const bad=await api(local,'/auth/v1/user','intentionally_invalid_token_v1989');
 ok([401,403].includes(bad.status),'AUTH_REJECTED_INVALID_JWT');
 const wrongWrite=await api(local,'/rest/v1/t404_v1989_products',a.token,'POST',
  {tenant_id:TENANT,store_code:'B',sku:'INJECT',price_vnd:1,
   stock_on_hand:4,fixture_tag:'SYNTHETIC_V1989'});
 ok([401,403].includes(wrongWrite.status),'OWNER_CANNOT_WRITE_WRONG_STORE');
 psql(local,"UPDATE public.t404_v1989_store_memberships SET active=false WHERE "+
  "tenant_id='"+TENANT+"' AND store_code='A' AND user_id='"+a.id+"';");
 for(const table of Object.keys(TABLES)){
  const denied=await select(local,table,a.token);
  ok(denied.blocked||denied.rows.length===0,'REVOKED_OWNER_A_SAME_JWT_'+table);
 }
 const jwtStillValid=await api(local,'/auth/v1/user',a.token);
 ok(jwtStillValid.ok,'JWT_VALID_MEMBERSHIP_REVOCATION_TAKES_EFFECT');
 process.stdout.write(JSON.stringify({checkpoint:'V19.8.9',
  result:'LOCAL_SUPABASE_REAL_JWT_RLS_PASS',
  testCount:pass,suite:'DOCKER_EPHEMERAL',
  realLocalSupabaseAuthJwt:true,hostedSupabaseJwtVerified:false,
  hostedRlsVerified:false,productionReady:false,
  providerSends:0,commerceOrderWrites:0,hostedConnections:0})+'\n');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+resolve(process.argv[1])).href){
 main().catch(e=>{
  const reason=String(e.message||'UNKNOWN').replace(/[^A-Z0-9_]/g,'_').slice(0,90);
  process.stderr.write('V1989_LOCAL_UAT_FAILED_'+reason+'\n');process.exitCode=1;
 });
}
