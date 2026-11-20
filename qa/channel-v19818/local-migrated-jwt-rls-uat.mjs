/**
 * TIEN404 V19.8.18 real LOCAL Supabase GoTrue JWT + PostgREST + migrated PG17 RLS UAT.
 * SYNTHETIC, localhost-only. No service_role token, hosted access or provider sends.
 */
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const API='http://127.0.0.1:54321';
const TENANT='00000000-0000-0000-0000-000000000101';
const STORES={A:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              B:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'};
const KINDS=['products','customers','orders','order_items','conversations','messages'];
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
let pass=0;
function must(value,tag){if(!value)throw Error('QA18_'+tag)}
function ok(value,tag){must(value,tag);pass++;process.stdout.write('PASS_'+tag+'\n')}
function psql(query){
 must(typeof query==='string'&&query.length<10000,'SQL_SCOPE');
 try{
 return execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-q','-t','-A',
 '-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-c',query],
 {env:{...process.env,PGPASSWORD:'postgres'},encoding:'utf8',
 stdio:['ignore','pipe','pipe'],timeout:30000}).trim();
 }catch{throw Error('QA18_LOCAL_PSQL_FAILED')}
}
function localKey(){
 const raw=execFileSync('supabase',['status','-o','env'],{
 encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
 const config=Object.fromEntries(raw.split(/\r?\n/).map(line=>{
 const m=line.match(/^([A-Z_]+)=(.*)$/);
 return m?[m[1],m[2].replace(/^["']|["']$/g,'')]:['',''];
 }));
 must(config.API_URL===API,'NO_NONLOCAL_URL');
 must(typeof config.ANON_KEY==='string'&&config.ANON_KEY.length>30,'NO_ANON_KEY');
 must(config.ANON_KEY!==config.SERVICE_ROLE_KEY,'REJECT_SERVICE_ROLE');
 return config.ANON_KEY;
}
async function request(key,path,jwt,method='GET',body){
 must(path.startsWith('/auth/v1/')||path==='/rest/v1/rpc/t404_v19818_read_store',
 'ONLY_LOCAL_UAT_ENDPOINTS');
 const headers={apikey:key,accept:'application/json'};
 if(jwt)headers.authorization='Bearer '+jwt;
 if(body!==undefined)headers['content-type']='application/json';
 const res=await fetch(API+path,{method,headers,
 body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',
 redirect:'error',signal:AbortSignal.timeout(12000)});
 let data=null;try{data=await res.json()}catch{}
 return {ok:res.ok,status:res.status,data};
}
async function actor(key,label){
 const email='v19818-'+label+'-'+randomBytes(11).toString('hex')+'@qa.invalid';
 const password=randomBytes(30).toString('base64url')+'Aa1!';
 const create=await request(key,'/auth/v1/signup',null,'POST',{email,password});
 must(create.ok&&UUID.test(create.data?.user?.id||''),'SIGNUP_'+label);
 const login=await request(key,'/auth/v1/token?grant_type=password',null,'POST',{email,password});
 must(login.ok&&typeof login.data?.access_token==='string','LOGIN_'+label);
 const jwt=login.data.access_token;
 must(jwt.split('.').length===3,'JWT_STRUCTURE');
 const verify=await request(key,'/auth/v1/user',jwt);
 must(verify.ok&&verify.data?.id===create.data.user.id&&verify.data?.role==='authenticated',
 'AUTH_JWT_VERIFICATION_'+label);
 return {id:verify.data.id,jwt};
}
async function read(key,actor,store,kind){
 return request(key,'/rest/v1/rpc/t404_v19818_read_store',actor?.jwt,'POST',
 {p_store_id:STORES[store],p_kind:kind});
}
function rows(res,tag){
 must(res.ok&&Array.isArray(res.data),'API_ERROR_'+tag+'_'+res.status);
 return res.data;
}
async function run(){
 must(process.env.T404_V19818_LOCAL_ONLY==='DISPOSABLE_PG17_GOTRUE','LOCAL_FLAG');
 must(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_DB_URL
  &&!process.env.SUPABASE_PROJECT_REF&&!process.env.T404_UAT_PROJECT_REF,
 'HOSTED_CREDS_FORBIDDEN');
 const key=localKey();
 const [a,b,tenantMember]=await Promise.all([
 actor(key,'OWNER_A'),actor(key,'OWNER_B'),actor(key,'TENANT_MEMBER')]);
 ok(new Set([a.id,b.id,tenantMember.id]).size===3,
 'THREE_DISTINCT_LOCAL_AUTHSIGNED_JWTS');
 must([a,b,tenantMember].every(x=>UUID.test(x.id)),'USER_ID');
 psql('INSERT INTO t404_v19817.qa_tenant_memberships(tenant_id,user_id,active) VALUES '+
 [a,b,tenantMember].map(x=>"('"+TENANT+"','"+x.id+"',true)").join(',')+';'+
 "INSERT INTO t404_v19817.store_memberships(tenant_id,store_id,user_id,role,active) VALUES "+
 "('"+TENANT+"','"+STORES.A+"','"+a.id+"','owner',true),"+
 "('"+TENANT+"','"+STORES.B+"','"+b.id+"','owner',true);");
 ok(true,'REAL_LOCAL_AUTH_OWNERS_MAPPED_TO_STORES');
 for(const [store,actor0,other] of [['A',a,'B'],['B',b,'A']]){
  for(const kind of KINDS){
   const owned=rows(await read(key,actor0,store,kind),'OWN_'+store+'_'+kind);
   ok(owned.length===1&&owned[0].store_id===STORES[store]
     &&owned[0].resource_kind===kind
     &&(kind!=='products'||owned[0].probe===(store==='A'?'159000':'189000')),
     'OWNER_'+store+'_'+kind+'_OWN_ALLOWED');
   const foreign=rows(await read(key,actor0,other,kind),'OTHER_'+store+'_'+kind);
   ok(foreign.length===0,'OWNER_'+store+'_'+kind+'_CROSS_STORE_DENIED');
  }
 }
 for(const kind of KINDS){
  const none=rows(await read(key,tenantMember,'A',kind),'TENANT_'+kind);
  ok(none.length===0,'TENANT_MEMBER_WITHOUT_STORE_'+kind+'_DENIED');
  const anonymous=await read(key,null,'A',kind);
  ok(!anonymous.ok||Array.isArray(anonymous.data)&&anonymous.data.length===0,
     'ANONYMOUS_'+kind+'_DENIED');
 }
 const bad=await request(key,'/auth/v1/user','invalid.jwt.v19818');
 ok([400,401,403].includes(bad.status),'INVALID_JWT_DENIED');
 const modified=a.jwt.slice(0,-2)+(a.jwt.endsWith('AZ')?'zx':'AZ');
 const forged=await request(key,'/rest/v1/rpc/t404_v19818_read_store',modified,'POST',
 {p_store_id:STORES.A,p_kind:'products'});
 ok([400,401,403].includes(forged.status),'TAMPERED_JWT_DENIED');
 const anonymousKeyProbe=await request(key,'/rest/v1/rpc/t404_v19818_read_store',null,'POST',
 {p_store_id:STORES.B,p_kind:'products'});
 ok(!anonymousKeyProbe.ok||anonymousKeyProbe.data?.length===0,
    'ANON_CANNOT_READ_FOREIGN_STORE');
 ok(psql("SELECT CASE WHEN has_table_privilege('authenticated','t404_v19817.products','INSERT')"+
   " OR has_table_privilege('authenticated','t404_v19817.orders','UPDATE')"+
   " OR has_table_privilege('authenticated','t404_v19817.messages','DELETE')"+
   " THEN 'BAD' ELSE 'OK' END")==='OK','NO_COMMERCE_WRITE_PRIVILEGES');
 psql("UPDATE t404_v19817.store_memberships SET active=false WHERE tenant_id='"+TENANT+
   "' AND store_id='"+STORES.A+"' AND user_id='"+a.id+"';");
 const stillValid=await request(key,'/auth/v1/user',a.jwt);
 ok(stillValid.ok&&stillValid.data?.id===a.id,'JWT_STILL_VALID_AFTER_MEMBERSHIP_REVOKE');
 for(const kind of KINDS){
  ok(rows(await read(key,a,'A',kind),'REVOKED_'+kind).length===0,
     'REVOKED_A_SAME_JWT_'+kind+'_DENIED');
 }
 ok(rows(await read(key,b,'B','products'),'B_AFTER_A_REVOKE').length===1,
    'STORE_B_UNAFFECTED_BY_OWNER_A_REVOCATION');
 psql("UPDATE t404_v19817.stores SET active=false WHERE tenant_id='"+TENANT+
 "' AND id='"+STORES.B+"';");
 for(const kind of KINDS){
  ok(rows(await read(key,b,'B',kind),'CLOSED_B_'+kind).length===0,
    'INACTIVE_STORE_B_'+kind+'_DENIED');
 }
 console.log(JSON.stringify({checkpoint:'V19.8.18_MIGRATED_PG17_REAL_LOCAL_AUTH_JWT_RLS',
 status:'PASS',passed:pass,failed:0,realLocalAuthJwt:true,hostedOwnerJwt:false,
 actualZalo:false,realPublishedWriterCompatibility:false,
 hostedConnections:0,providerSends:0,commerceWrites:0,productionReady:false}));
}
run().catch(e=>{
 const s=String(e?.message||'UNKNOWN');
 process.stderr.write('V19818_FAILED_'+
  (s.startsWith('QA18_')?s.replace(/[^A-Z0-9_]/g,'').slice(0,110):'INTERNAL_ERROR')+'\n');
 process.exitCode=1;
});
