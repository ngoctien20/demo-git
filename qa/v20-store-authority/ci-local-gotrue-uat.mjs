/**
 * TIEN404 V20 Store Authority — real LOCAL Supabase GoTrue JWT + PostgREST UAT.
 * Runs only against a disposable `supabase start` stack on 127.0.0.1 (GitHub Actions).
 * Synthetic users/data. No hosted access, no service_role key use, no provider sends.
 */
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const API='http://127.0.0.1:54321';
const TA='9c8c524c-88db-4771-8ab0-a4316298494c', TB='4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5';
const BRANCH='e0000000-0000-4000-8000-0000000000a2';
const KINDS=['products','customers','orders','order_items','conversations','messages'];
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
let pass=0;
const must=(v,t)=>{if(!v)throw Error('QA20_'+t)};
const ok=(v,t)=>{must(v,t);pass++;process.stdout.write('PASS_'+t+'\n')};
function psql(q){
 must(typeof q==='string'&&q.length<20000,'SQL_SCOPE');
 try{return execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-q','-t','-A','-h','127.0.0.1',
  '-p','54322','-U','postgres','-d','postgres','-c',q],{env:{...process.env,PGPASSWORD:'postgres'},
  encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}).trim();}
 catch{throw Error('QA20_LOCAL_PSQL_FAILED')}
}
function anonKey(){
 const raw=execFileSync('supabase',['status','-o','env'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
 const c=Object.fromEntries(raw.split(/\r?\n/).map(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[m[1],m[2].replace(/^["']|["']$/g,'')]:['','']}));
 must(c.API_URL===API,'NO_NONLOCAL_URL');
 must(typeof c.ANON_KEY==='string'&&c.ANON_KEY.length>30&&c.ANON_KEY!==c.SERVICE_ROLE_KEY,'ANON_KEY_ONLY');
 return c.ANON_KEY;
}
async function req(key,path,jwt,method='GET',body){
 must(path.startsWith('/auth/v1/')||path.startsWith('/rest/v1/'),'LOCAL_ENDPOINTS_ONLY');
 const headers={apikey:key,accept:'application/json'};
 if(jwt)headers.authorization='Bearer '+jwt;
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
  redirect:'error',signal:AbortSignal.timeout(12000)});
 let data=null;try{data=await r.json()}catch{}
 return {ok:r.ok,status:r.status,data};
}
async function actor(key,label){
 const email='v20-'+label.toLowerCase()+'-'+randomBytes(8).toString('hex')+'@qa.invalid';
 const password=randomBytes(24).toString('base64url')+'Aa1!';
 const s=await req(key,'/auth/v1/signup',null,'POST',{email,password});
 must(s.ok&&UUID.test(s.data?.user?.id||''),'SIGNUP_'+label);
 const l=await req(key,'/auth/v1/token?grant_type=password',null,'POST',{email,password});
 must(l.ok&&typeof l.data?.access_token==='string','LOGIN_'+label);
 const v=await req(key,'/auth/v1/user',l.data.access_token);
 must(v.ok&&v.data?.id===s.data.user.id&&v.data?.role==='authenticated','JWT_VERIFY_'+label);
 return {id:v.data.id,jwt:l.data.access_token};
}
const rows=async(key,a,kind,filter='')=>{
 const r=await req(key,'/rest/v1/'+kind+'?select=id,store_id'+filter,a?.jwt);
 return r;
};
async function run(){
 must(process.env.T404_V20_LOCAL_ONLY==='DISPOSABLE_SUPABASE_GOTRUE','LOCAL_FLAG');
 must(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_DB_URL&&!process.env.SUPABASE_PROJECT_REF,'HOSTED_CREDS_FORBIDDEN');
 const key=anonKey();
 const [a,b,br,tm]=await Promise.all(['OWNER_A','OWNER_B','BRANCH_OWNER','TENANT_ONLY'].map(x=>actor(key,x)));
 ok(new Set([a.id,b.id,br.id,tm.id]).size===4,'FOUR_REAL_LOCAL_GOTRUE_JWTS');
 // Pre-migration tenant memberships (as an owner would have before cutover), then migrate.
 psql(`INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES
  ('${TA}','${a.id}','owner'),('${TB}','${b.id}','owner')`);
 // Tables were created after PostgREST started: reload its schema cache and wait for it.
 psql("NOTIFY pgrst, 'reload schema'");
 let before;
 // store_id does not exist before the migration: select id only.
 for(let i=0;i<20;i++){before=await req(key,'/rest/v1/products?select=id',a.jwt);if(before.status!==404)break;await new Promise(r=>setTimeout(r,500));}
 ok(before.ok&&before.data.length===1,'PRE_MIGRATION_OWNER_A_TENANT_READ_HTTP'+before.status);
 execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-q','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres',
  '-f',new URL('./10_store_authority_expand.sql',import.meta.url).pathname],{env:{...process.env,PGPASSWORD:'postgres'},stdio:'inherit'});
 psql("NOTIFY pgrst, 'reload schema'");
 for(let i=0;i<20;i++){const r=await req(key,'/rest/v1/stores?select=id',a.jwt);if(r.status!==404)break;await new Promise(r=>setTimeout(r,500));}
 ok(true,'MIGRATION_APPLIED_TO_DISPOSABLE_LOCAL_ONLY');
 psql(`INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('${TA}','${br.id}','owner'),('${TA}','${tm.id}','manager');
  INSERT INTO public.stores(id,tenant_id,store_key,name) VALUES ('${BRANCH}','${TA}','branch','Chi nhanh');
  INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role) VALUES ('${TA}','${BRANCH}','${br.id}','owner');
  INSERT INTO public.products(tenant_id,store_id,sku,name,price_vnd) VALUES ('${TA}','${BRANCH}','QA-A002','Branch',199000);
  INSERT INTO public.customers(id,tenant_id,store_id,display_name) VALUES ('f0000000-0000-4000-8000-0000000000a2','${TA}','${BRANCH}','K');
  INSERT INTO public.orders(id,tenant_id,customer_id,total_vnd) VALUES ('d0000000-0000-4000-8000-0000000000a2','${TA}','f0000000-0000-4000-8000-0000000000a2',199000);
  INSERT INTO public.order_items(tenant_id,order_id,product_id,quantity,unit_price_vnd) SELECT '${TA}','d0000000-0000-4000-8000-0000000000a2',id,1,199000 FROM public.products WHERE sku='QA-A002';
  INSERT INTO public.conversations(id,tenant_id,store_id,channel) VALUES ('90000000-0000-4000-8000-0000000000a2','${TA}','${BRANCH}','zalo');
  INSERT INTO public.messages(tenant_id,conversation_id,sender,body) VALUES ('${TA}','90000000-0000-4000-8000-0000000000a2','customer','hi');`);
 for(const kind of KINDS){
  const own=await rows(key,br,kind);
  ok(own.ok&&own.data.length>=1&&own.data.every(r=>r.store_id===BRANCH),'BRANCH_OWNER_'+kind+'_ONLY_OWN_STORE');
  const main=await rows(key,a,kind,'&store_id=eq.'+BRANCH);
  ok(main.ok&&main.data.length===0,'MAIN_OWNER_'+kind+'_CROSS_STORE_DENIED');
  const foreign=await rows(key,b,kind,'&tenant_id=eq.'+TA);
  ok(foreign.ok&&foreign.data.length===0,'OWNER_B_'+kind+'_CROSS_TENANT_DENIED');
  const tenantOnly=await rows(key,tm,kind);
  ok(tenantOnly.ok&&tenantOnly.data.length===0,'TENANT_MEMBER_NO_STORE_'+kind+'_DENIED');
  const anon=await rows(key,null,kind);
  ok(!anon.ok||(Array.isArray(anon.data)&&anon.data.length===0),'ANON_'+kind+'_DENIED');
 }
 const keep=await rows(key,a,'products');
 ok(keep.ok&&keep.data.length===1,'OWNER_A_NO_ACCESS_LOSS_AFTER_CUTOVER');
 const write=await req(key,'/rest/v1/store_memberships',tm.jwt,'POST',{tenant_id:TA,store_id:BRANCH,user_id:tm.id,role:'owner'});
 ok(!write.ok&&[401,403].includes(write.status),'SELF_GRANT_STORE_MEMBERSHIP_DENIED');
 const tampered=a.jwt.slice(0,-2)+(a.jwt.endsWith('AZ')?'zx':'AZ');
 const t=await req(key,'/rest/v1/products?select=id',tampered);
 ok([400,401,403].includes(t.status),'TAMPERED_JWT_DENIED');
 psql(`UPDATE public.store_memberships SET active=false WHERE user_id='${br.id}'`);
 const still=await req(key,'/auth/v1/user',br.jwt);
 ok(still.ok&&still.data?.id===br.id,'JWT_STILL_VALID_AFTER_REVOKE');
 for(const kind of KINDS){
  const r=await rows(key,br,kind);
  ok(r.ok&&r.data.length===0,'REVOKED_SAME_JWT_'+kind+'_DENIED');
 }
 console.log(JSON.stringify({checkpoint:'V20_STORE_AUTHORITY_LOCAL_GOTRUE_JWT',status:'PASS',passed:pass,failed:0,
  realLocalAuthJwt:true,hostedOwnerJwt:false,hostedConnections:0,hostedMigrations:0,providerSends:0,productionReady:false}));
}
run().catch(e=>{const s=String(e?.message||'UNKNOWN');
 process.stderr.write('V20_FAILED_'+(s.startsWith('QA20_')?s.replace(/[^A-Z0-9_]/g,'').slice(0,110):'INTERNAL_ERROR')+'\n');process.exitCode=1;});
