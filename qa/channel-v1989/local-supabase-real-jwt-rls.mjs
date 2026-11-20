/**
 * TIEN404 V19.8.9: RUN ONLY ON A THROWAWAY LOCAL SUPABASE CLI DOCKER STACK.
 *
 * Exercises REAL Supabase Auth-issued JWTs against REAL PostgREST and Postgres
 * RLS. Accounts, products and orders are synthetic, never merchant data.
 * Neither this script nor its CI connects to any hosted Supabase project.
 *
 * No service_role credential is used for login or row-level authorization.
 * Admin psql is used ONLY to assign local synthetic Store memberships.
 */
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const API='http://127.0.0.1:54321';
const PG_ARGS=['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-q','-t','-A'];
const TENANT='00000000-0000-0000-0000-000000000199';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLES=['products','orders','conversations'];
const TEST_ID='V1989_SYNTHETIC_ONLY';
const FIX={
 A:{sku:'F01',price_vnd:159000,stock_on_hand:5},
 B:{sku:'F01',price_vnd:189000,stock_on_hand:9}
};
const fail=(reason)=>{throw Error('V1989_TEST_FAILED_'+reason)};
const check=(bool,label)=>{if(!bool)fail(label)};
function psql(sql) {
 check(typeof sql==='string' && sql.length<6000,'INVALID_LOCAL_SQL');
 return execFileSync('psql',[...PG_ARGS,'-c',sql],{
   encoding:'utf8',stdio:['ignore','pipe','pipe'],
   env:{...process.env,PGPASSWORD:'postgres'},timeout:12000
 });
}
function getAnonKey() {
 const text=execFileSync('supabase',['status','-o','env'],{
  encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:25000
 });
 const pairs=new Map(text.split(/\r?\n/).map(l=>{
  const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[m[1],m[2].replace(/^["']|["']$/g,'')]:['',''];
 }));
 const url=pairs.get('API_URL');
 check(url===API,'NON_LOOPBACK_API_REFUSED');
 const key=pairs.get('ANON_KEY');
 check(typeof key==='string'&&key.length>30,'MISSING_LOCAL_ANON_KEY');
 check(pairs.get('SERVICE_ROLE_KEY')!==key,'ANON_KEY_NOT_SERVICE_KEY');
 return key;
}
async function call(path,anonKey,accessToken,method='GET',body) {
 check(path.startsWith('/auth/v1/')||path.startsWith('/rest/v1/t404_uat1989_'),
  'NON_FIXTURE_PATH_REFUSED');
 const headers={apikey:anonKey};
 if(accessToken)headers.Authorization='Bearer '+accessToken;
 if(body!==undefined)headers['Content-Type']='application/json';
 const reply=await fetch(API+path,{
  method,headers,body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(10000),cache:'no-store',redirect:'error'
 });
 let data=null;
 try{data=await reply.json();}catch{}
 return {status:reply.status,ok:reply.ok,data};
}
async function createOwner(anonKey,label) {
 const email='t404-v1989-'+randomBytes(12).toString('hex')+'@tien404-qa.invalid';
 const password=randomBytes(24).toString('base64url')+'A1!';
 let result=await call('/auth/v1/signup',anonKey,null,'POST',{email,password});
 check(result.ok&&typeof result.data?.user?.id==='string',
  'AUTH_SIGNUP_FAILED_'+label+'_HTTP_'+result.status);
 const id=result.data.user.id;
 check(UUID.test(id),'AUTH_USER_ID_INVALID_'+label);
 result=await call('/auth/v1/token?grant_type=password',anonKey,null,'POST',{email,password});
 check(result.ok&&typeof result.data?.access_token==='string',
  'AUTH_PASSWORD_LOGIN_FAILED_'+label+'_HTTP_'+result.status);
 const jwt=result.data.access_token;
 check(jwt.split('.').length===3,'JWT_NOT_SIGNED_COMPACT_'+label);
 const profile=await call('/auth/v1/user',anonKey,jwt);
 check(profile.ok&&profile.data?.id===id&&profile.data?.role==='authenticated',
  'SIGNED_JWT_NOT_ACCEPTED_BY_SUPABASE_AUTH_'+label);
 return {id,token:jwt};
}
function assignOwner(owner,label){
 check(UUID.test(owner.id)&&['A','B'].includes(label),'UNSAFE_OWNER_BINDING');
 psql("INSERT INTO public.t404_uat1989_memberships(tenant_id,store_code,user_id,active) "+
   "VALUES ('"+TENANT+"','"+label+"','"+owner.id+"',true);");
}
function setOwnerState(owner,label,active) {
 check(UUID.test(owner.id)&&['A','B'].includes(label),'UNSAFE_MEMBERSHIP_TARGET');
 psql("UPDATE public.t404_uat1989_memberships SET active="+(active?'true':'false')+
   " WHERE tenant_id='"+TENANT+"' AND store_code='"+label+
   "' AND user_id='"+owner.id+"';");
}
async function fetchFixture(anonKey,token,table,extra='') {
 check(TABLES.includes(table),'UNKNOWN_FIXTURE_TABLE');
 const cols=table==='products'?'store_code,sku,price_vnd,stock_on_hand,fixture_tag':
  table==='orders'?'store_code,order_ref,fixture_tag':'store_code,conversation_ref,fixture_tag';
 const where=extra?'&store_code=eq.'+extra:'';
 return await call('/rest/v1/t404_uat1989_'+table+
  '?select='+encodeURIComponent(cols)+where,anonKey,token);
}
function checkExact(table,owner,record){
 check(record?.store_code===owner&&record?.fixture_tag===TEST_ID,
   'CROSS_STORE_OR_UNKNOWN_FIXTURE_'+owner+'_'+table);
 if(table==='products'){
  const f=FIX[owner];
  check(record.sku===f.sku&&Number(record.price_vnd)===f.price_vnd
     &&record.stock_on_hand===f.stock_on_hand,'PRICE_STOCK_SCOPE_'+owner);
 }else{
  const field=table==='orders'?'order_ref':'conversation_ref';
  check(record[field]==='V1989_'+owner+'_01','RESOURCE_SCOPE_'+owner+'_'+table);
 }
}
async function assertRls(anonKey,owner,token){
 let count=0;
 const other=owner==='A'?'B':'A';
 for(const table of TABLES){
  const own=await fetchFixture(anonKey,token,table);
  check(own.ok&&Array.isArray(own.data)&&own.data.length===1,
    'OWN_POSITIVE_DATA_NOT_VISIBLE_'+owner+'_'+table);
  checkExact(table,owner,own.data[0]);count++;
  const foreign=await fetchFixture(anonKey,token,table,other);
  check((foreign.ok&&Array.isArray(foreign.data)&&foreign.data.length===0)
     ||[401,403].includes(foreign.status),'CROSS_STORE_DATA_LEAK_'+owner+'_'+table);
  count++;
 }
 return count;
}
async function run(){
 // Runtime and token issuer are local ONLY; require explicit CI / disposable marker.
 check(process.env.T404_LOCAL_EPHEMERAL==='RUN_DOCKER_ONLY','LOCAL_MODE_NOT_APPROVED');
 check(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_PROJECT_REF,
   'HOSTED_SUPABASE_CREDENTIAL_PRESENT');
 const anonKey=getAnonKey();
 const a=await createOwner(anonKey,'A');
 const b=await createOwner(anonKey,'B');
 check(a.id!==b.id,'SAME_OWNER_ID');
 assignOwner(a,'A');assignOwner(b,'B');
 let passed=2; // Two actual authenticated, distinct, signed Auth accounts
 passed+=await assertRls(anonKey,'A',a.token);
 passed+=await assertRls(anonKey,'B',b.token);
 for(const table of TABLES){
  const anon=await fetchFixture(anonKey,null,table);
  check((anon.ok&&Array.isArray(anon.data)&&anon.data.length===0)
   ||[401,403].includes(anon.status),'ANON_EXPOSURE_'+table);
  passed++;
 }
 const invalid=await call('/auth/v1/user',anonKey,'definitely.invalid.jwt');
 check([400,401,403].includes(invalid.status),'INVALID_JWT_WAS_ACCEPTED');
 passed++;
 const badToken=a.token.slice(0,-2)+(a.token.slice(-2)==='AA'?'BB':'AA');
 const forged=await fetchFixture(anonKey,badToken,'products');
 check([400,401,403].includes(forged.status),'TAMPERED_JWT_WAS_ACCEPTED');
 passed++;
 // Positive/negative under the SAME signed JWT after revoking membership.
 setOwnerState(a,'A',false);
 for(const table of TABLES){
  const after=await fetchFixture(anonKey,a.token,table);
  check((after.ok&&Array.isArray(after.data)&&after.data.length===0)
    ||[401,403].includes(after.status),'REVOKED_MEMBERSHIP_LEAK_'+table);
  passed++;
 }
 setOwnerState(a,'A',true);
 passed+=await assertRls(anonKey,'A',a.token);
 // Owner A has SELECT ONLY: even own-store POST must not succeed.
 const inserted=await call('/rest/v1/t404_uat1989_products',anonKey,a.token,'POST',{
   tenant_id:TENANT,store_code:'B',sku:'F88',price_vnd:1234,stock_on_hand:2,fixture_tag:TEST_ID
 });
 check([401,403,405].includes(inserted.status),'UNAUTHORIZED_STORE_WRITE_ACCEPTED');
 passed++;
 // Product B remains isolated after all tests.
 const finalB=await fetchFixture(anonKey,b.token,'products');
 check(finalB.ok&&finalB.data?.length===1&&finalB.data[0]?.store_code==='B',
   'STORE_B_FINAL_ISOLATION');
 passed++;
 console.log(JSON.stringify({
  checkpoint:'V19.8.9_LOCAL_SUPABASE_REAL_AUTH_JWT_POSTGREST_RLS',
  source:'LOCAL_EPHEMERAL_GITHUB_ACTIONS_ONLY',
  realSupabaseAuthJwtVerified:true,
  actualHostedSupabaseJwtVerified:false,
  ownersDistinct:true,storesSameTenant:true,testsPassed:passed,testsFailed:0,
  hostedConnections:0,providerSends:0,commerceWrites:0,
  message:'Local stack only. No real merchant ownership or hosted production evidence.'
 }));
}
run().catch(error=>{
 // Never print arbitrary error.message; error bodies might carry sensitive data.
 const original=String(error?.message||'UNKNOWN_ERROR');
 const sanitized=original.startsWith('V1989_TEST_FAILED_')
   ?original.slice(0,120).replace(/[^A-Z0-9_]/g,''):'INTERNAL_FAILURE';
 process.stderr.write('TIEN404_V1989_LOCAL_AUTH_RLS_NO_PASS_'+sanitized+'\n');
 process.exitCode=1;
});
