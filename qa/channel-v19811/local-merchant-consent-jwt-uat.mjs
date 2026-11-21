/**
 * TIEN404 V19.8.11 — REAL LOCAL Supabase Auth Merchant Consent RLS.
 * No hosted systems. Local SQL superuser sets up fictional Installations ONLY.
 * The owner approval/revocation action is performed by a genuine Supabase
 * Auth-issued signed JWT through local PostgREST RLS, never by an SQL fake uid.
 *
 * This is NOT consent by a real Zalo bot merchant. No provider calls/sends.
 */
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const API='http://127.0.0.1:54321';
const TENANT='00000000-0000-0000-0000-000000001989';
const PG=['-X','-v','ON_ERROR_STOP=1','-q','-t','-A','-h','127.0.0.1',
 '-p','54322','-U','postgres','-d','postgres'];
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function must(ok,reason){if(!ok)throw Error('LOCAL_CONSENT_'+reason);}
function db(sql){
 must(typeof sql==='string'&&sql.length<7500,'BAD_SQL');
 try{return execFileSync('psql',[...PG,'-c',sql],{encoding:'utf8',
  stdio:['ignore','pipe','pipe'],env:{...process.env,PGPASSWORD:'postgres'},
  timeout:25000,maxBuffer:200000}).trim();}
 catch{throw Error('LOCAL_CONSENT_SQL_REJECTED');}
}
function anonKey(){
 const status=execFileSync('supabase',['status','-o','env'],{
  encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:25000});
 const map=Object.fromEntries(status.split(/\r?\n/).map(x=>{
  const m=x.match(/^([A-Z_]+)=(.*)$/);
  return m?[m[1],m[2].replace(/^["']|["']$/g,'')]:['',''];
 }));
 must(map.API_URL===API,'API_MUST_BE_LOOPBACK');
 must(typeof map.ANON_KEY==='string'&&map.ANON_KEY.length>30,'PUBLIC_KEY_MISSING');
 must(map.SERVICE_ROLE_KEY!==map.ANON_KEY,'SERVICE_ROLE_KEY_NOT_ALLOWED');
 return map.ANON_KEY;
}
async function req(path,key,jwt,method='GET',body=null){
 must(path.startsWith('/auth/v1/')||
  path.startsWith('/rest/v1/t404_v19811_owner_consents'),
  'UNSCOPED_API_DENIED');
 const headers={apikey:key,accept:'application/json'};
 if(jwt)headers.authorization='Bearer '+jwt;
 if(body){headers['content-type']='application/json';headers.prefer='return=representation';}
 const r=await fetch(API+path,{method,headers,cache:'no-store',redirect:'error',
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 let data=null;
 try{data=await r.json()}catch{}
 return {status:r.status,ok:r.ok,data};
}
async function makeOwner(key,label){
 const email='qa-v19811-'+label.toLowerCase()+'-'+randomBytes(10).toString('hex')+
  '@tien404-qa.invalid';
 const password=randomBytes(30).toString('base64url')+'Aa1!';
 let r=await req('/auth/v1/signup',key,null,'POST',{email,password});
 must(r.ok&&UUID.test(r.data?.user?.id||''),'AUTH_SIGNUP_'+label);
 const id=r.data.user.id;
 r=await req('/auth/v1/token?grant_type=password',key,null,'POST',{email,password});
 must(r.ok&&typeof r.data?.access_token==='string','AUTH_LOGIN_'+label);
 const jwt=r.data.access_token;
 must(jwt.split('.').length===3,'AUTH_NOT_JWT_'+label);
 const profile=await req('/auth/v1/user',key,jwt);
 must(profile.ok&&profile.data?.id===id&&profile.data?.role==='authenticated',
  'AUTH_PROFILE_'+label);
 return {id,jwt};
}
function setupRegistry(a,b){
 for(const [owner,label] of [[a,'C'],[b,'D']]){
  must(UUID.test(owner.id),'BAD_USER_ID');
  const store=label==='C'?'A':'B';
  db("INSERT INTO public.t404_v1989_tenant_memberships VALUES ('"+
   TENANT+"','"+owner.id+"',true);"+
   "INSERT INTO public.t404_v1989_store_memberships VALUES ('"+
   TENANT+"','"+store+"','"+owner.id+"',true,'owner');"+
   "INSERT INTO public.t404_v19810_installations VALUES ("+
   "'QA_INSTALL_"+label+"','QA_ENDPOINT_"+label+"','QA_BOT_"+label+
   "','QA_CRED_"+label+"',1,'"+TENANT+"','"+store+"','"+owner.id+
   "','qa_active',1,now()-interval '2 hours',NULL);"+
   "INSERT INTO public.t404_v19811_owner_consents "+
   "(installation_ref,owner_user_id,tenant_id,store_code,binding_version,"+
   "challenge_ref,scope,state,requested_at,expires_at) VALUES ("+
   "'QA_INSTALL_"+label+"','"+owner.id+"','"+TENANT+"','"+store+
   "',1,'QA_CHALLENGE_"+label+"','readonly_catalog_qa_only','pending',"+
   "now()-interval '1 hour',now()+interval '1 hour');");
 }
}
const path=ref=>'/rest/v1/t404_v19811_owner_consents?'+
 'select=installation_ref,store_code,state,approved_at,revoked_at'+
 '&installation_ref=eq.'+ref;
async function rows(key,jwt,ref){
 const r=await req(path(ref),key,jwt);
 if(!r.ok){must([401,403].includes(r.status),'OWNER_CONSENT_GET_HTTP_'+r.status);return [];}
 must(Array.isArray(r.data),'GET_ROWS_INVALID');return r.data;
}
async function status(key,jwt,ref,next,extra){
 return req(path(ref),key,jwt,'PATCH',{state:next,...extra});
}
function admitted(ref){
 must(/^QA_INSTALL_[CD]$/.test(ref),'INVALID_INSTALL_REF');
 const q="SELECT count(*) FROM public.t404_v19810_installations i "+
  "JOIN public.t404_v19811_owner_consents c ON c.installation_ref=i.installation_ref "+
  "AND c.owner_user_id=i.owner_user_id AND c.tenant_id=i.tenant_id "+
  "AND c.store_code=i.store_code "+
  "JOIN public.t404_v1989_store_memberships sm ON sm.tenant_id=i.tenant_id "+
  "AND sm.store_code=i.store_code AND sm.user_id=i.owner_user_id "+
  "JOIN public.t404_v1989_tenant_memberships tm ON tm.tenant_id=i.tenant_id "+
  "AND tm.user_id=i.owner_user_id "+
  "WHERE i.installation_ref='"+ref+"' AND i.state='qa_active' "+
  "AND i.revoked_at IS NULL AND sm.active=true AND sm.role='owner' "+
  "AND tm.owner_active=true AND c.binding_version=i.version "+
  "AND c.scope='readonly_catalog_qa_only' AND c.state='approved' "+
  "AND c.approved_at IS NOT NULL AND c.approved_at<=now() "+
  "AND c.revoked_at IS NULL AND c.expires_at>now();";
 const number=Number(db(q));
 must(Number.isInteger(number)&&number>=0&&number<=1,'AMBIGUOUS_OWNER_CONSENT');
 return number===1;
}
async function run(){
 must(process.env.T404_V19811_DOCKER_ONLY==='OWNER_CONSENT_JWT_NO_SEND',
  'EXPLICIT_LOCAL_ONLY_GATE_REQUIRED');
 must(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_PROJECT_REF&&
  !process.env.T404_UAT_PROJECT_REF,'HOSTED_TOKEN_OR_PROJECT_FORBIDDEN');
 const key=anonKey();
 let n=0;const pass=(ok,label)=>{must(ok,'TEST_'+label);n++;
  process.stdout.write('V19811_PASS_'+label+'\n');};
 const a=await makeOwner(key,'C'),b=await makeOwner(key,'D');
 pass(a.id!==b.id,'DISTINCT_REAL_LOCAL_AUTH_SESSIONS');
 setupRegistry(a,b);
 pass(true,'PRIVATE_PENDING_INSTALLATIONS_PREPARED');
 pass(!admitted('QA_INSTALL_C')&&!admitted('QA_INSTALL_D'),
  'UNAPPROVED_INSTALLATIONS_CANNOT_PASS');
 pass((await rows(key,a.jwt,'QA_INSTALL_C')).length===1,'OWNER_C_SEES_OWN_CONSENT');
 pass((await rows(key,a.jwt,'QA_INSTALL_D')).length===0,'OWNER_C_CANNOT_READ_D');
 pass((await rows(key,b.jwt,'QA_INSTALL_C')).length===0,'OWNER_D_CANNOT_READ_C');
 const wrong=await status(key,a.jwt,'QA_INSTALL_D','approved');
 pass(!wrong.ok||Array.isArray(wrong.data)&&wrong.data.length===0,
  'OWNER_C_CANNOT_APPROVE_STORE_D');
 pass(!admitted('QA_INSTALL_D'),'WRONG_OWNER_CANNOT_AUTHORIZE_OTHER_STORE');
 let approved=await status(key,a.jwt,'QA_INSTALL_C','approved');
 pass(approved.ok&&Array.isArray(approved.data)&&approved.data.length===1&&
  approved.data[0].state==='approved'&&!!approved.data[0].approved_at,
  'OWNER_C_SIGNED_JWT_APPROVAL_SAVED');
 approved=await status(key,b.jwt,'QA_INSTALL_D','approved');
 pass(approved.ok&&Array.isArray(approved.data)&&approved.data.length===1&&
  approved.data[0].state==='approved',
  'OWNER_D_SIGNED_JWT_APPROVAL_SAVED');
 pass(admitted('QA_INSTALL_C')&&admitted('QA_INSTALL_D'),
  'LOCAL_OWNER_GRANTED_CONSENT_MATCHES_SERVER_INSTALLATION');
 const tamper=await status(key,a.jwt,'QA_INSTALL_C','revoked',{owner_user_id:b.id});
 pass(!tamper.ok,'OWNER_C_CANNOT_FORGE_APPROVED_BY_OR_OWNER');
 // Cannot change Store or installation identity using a JWT.
 const cross=await status(key,a.jwt,'QA_INSTALL_C','revoked',{store_code:'B'});
 pass(!cross.ok,'OWNER_C_CANNOT_REASSIGN_STORE');
 const anonymous=await rows(key,null,'QA_INSTALL_C');
 pass(anonymous.length===0,'ANONYMOUS_CANNOT_READ_CONSENT');
 const rev=await status(key,a.jwt,'QA_INSTALL_C','revoked');
 pass(rev.ok&&Array.isArray(rev.data)&&rev.data[0]?.state==='revoked'&&
  !!rev.data[0]?.revoked_at,'OWNER_C_SIGNED_JWT_CAN_REVOKE');
 pass(!admitted('QA_INSTALL_C')&&admitted('QA_INSTALL_D'),
  'REVOKED_OWNER_C_BLOCKED_D_UNAFFECTED');
 const replay=await status(key,a.jwt,'QA_INSTALL_C','approved');
 pass(!replay.ok||Array.isArray(replay.data)&&replay.data.length===0,
  'REVOKED_CONSENT_CANNOT_BE_REAPPROVED_BY_REPLAY');
 db("UPDATE public.t404_v1989_store_memberships SET active=false "+
  "WHERE tenant_id='"+TENANT+"' AND store_code='B' AND user_id='"+b.id+"';");
 const signed=await req('/auth/v1/user',key,b.jwt);
 pass(signed.ok,'EXISTING_JWT_STILL_VALID_AFTER_STORE_REVOKE');
 pass((await rows(key,b.jwt,'QA_INSTALL_D')).length===0,
  'RLS_REMOVES_CONSENT_READ_AFTER_STORE_REVOKE');
 pass(!admitted('QA_INSTALL_D'),'SERVER_DENIES_OWNER_D_AFTER_MEMBERSHIP_REVOKE');
 const post=await req(path('QA_INSTALL_D'),key,b.jwt,'PATCH',{state:'revoked'});
 pass(!post.ok||Array.isArray(post.data)&&post.data.length===0,
  'REVOKED_STORE_OWNER_CANNOT_MUTATE_CONSENT');
 process.stdout.write(JSON.stringify({
  checkpoint:'V19.8.11_LOCAL_REAL_AUTH_MERCHANT_CONSENT_UAT',
  result:'LOCAL_OWNER_JWT_CONSENT_RLS_PASS',
  testsPassed:n,testsFailed:0,
  realLocalSupabaseAuthJWT:true,
  realZaloBotTokenUsed:false,realZaloBotIdentityVerified:false,
  realMerchantOwnerHostedVerified:false,providerSends:0,hostedReads:0,
  commerceWrites:0,productionReady:false})+'\n');
}
run().catch(err=>{
 const msg=String(err?.message||'UNKNOWN');
 const code=msg.startsWith('LOCAL_CONSENT_')
  ?msg.replace(/[^A-Z0-9_]/g,'').slice(0,85):'INTERNAL_FAILURE';
 process.stderr.write('V19811_LOCAL_MERCHANT_CONSENT_FAILED_'+code+'\n');
 process.exitCode=1;
});
