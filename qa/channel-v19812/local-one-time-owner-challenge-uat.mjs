/**
 * TIEN404 V19.8.12 — genuine LOCAL GoTrue JWT / PostgREST Owner challenge QA.
 * Operators and provider installations are SYNTHETIC. No hosted account,
 * actual Zalo token, outgoing provider send, merchant data or Commerce writes.
 */
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const API='http://127.0.0.1:54321';
const TENANT='00000000-0000-0000-0000-000000001989';
const PG=['-X','-v','ON_ERROR_STOP=1','-q','-t','-A','-h','127.0.0.1',
 '-p','54322','-U','postgres','-d','postgres'];
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function demand(ok,code){if(!ok)throw Error('CHALLENGE_QA_'+code)}
function sql(q){
 demand(typeof q==='string'&&q.length<8000,'INVALID_LOCAL_SQL');
 try{return execFileSync('psql',[...PG,'-c',q],{encoding:'utf8',
  env:{...process.env,PGPASSWORD:'postgres'},
  stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:180000}).trim()}
 catch{throw Error('CHALLENGE_QA_LOCAL_SQL_FAILED')}
}
function loadLocalAnon(){
 const out=execFileSync('supabase',['status','-o','env'],{
  encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:25000});
 const env=Object.fromEntries(out.split(/\r?\n/).map(x=>{
  const m=x.match(/^([A-Z_]+)=(.*)$/);
  return m?[m[1],m[2].replace(/^["']|["']$/g,'')]:['',''];
 }));
 demand(env.API_URL===API,'NOT_LOCAL_SUPABASE');
 demand(typeof env.ANON_KEY==='string'&&env.ANON_KEY.length>30,'LOCAL_ANON_MISSING');
 demand(env.ANON_KEY!==env.SERVICE_ROLE_KEY,'SERVICE_ROLE_REJECTED');
 return env.ANON_KEY;
}
async function request(path,key,jwt,method='GET',body){
 demand(path.startsWith('/auth/v1/')||
   path.startsWith('/rest/v1/rpc/t404_v19812_')||
   path.startsWith('/rest/v1/t404_v19812_')||
   path.startsWith('/rest/v1/t404_v1989_products'),
   'UNSCOPED_ENDPOINT');
 const headers={apikey:key,accept:'application/json'};
 if(jwt)headers.authorization='Bearer '+jwt;
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 let value=null;try{value=await r.json()}catch{}
 return {status:r.status,ok:r.ok,value};
}
async function user(key,name){
 const email='qa-v19812-'+name+'-'+randomBytes(9).toString('hex')+
  '@test-only.invalid';
 const password=randomBytes(34).toString('base64url')+'Aa1!';
 let r=await request('/auth/v1/signup',key,null,'POST',{email,password});
 demand(r.ok&&UUID.test(r.value?.user?.id||''),'SIGNUP_'+name);
 const id=r.value.user.id;
 r=await request('/auth/v1/token?grant_type=password',key,null,'POST',{email,password});
 demand(r.ok&&typeof r.value?.access_token==='string','SIGNIN_'+name);
 const jwt=r.value.access_token;
 demand(jwt.split('.').length===3,'NOT_AUTH_ISSUED_JWT');
 const profile=await request('/auth/v1/user',key,jwt);
 demand(profile.ok&&profile.value?.id===id,'LOCAL_AUTH_JWT_NOT_ACCEPTED');
 return {id,jwt};
}
const nonce=()=>randomBytes(32).toString('hex');
const hash=n=>createHash('sha256').update(n,'utf8').digest('hex');
function setup(users,nonces) {
 const {E:a,F:b,M:member}=users;
 demand([a.id,b.id,member.id].every(x=>UUID.test(x)),'BAD_USER_UUID');
 sql(
  "INSERT INTO public.t404_v1989_tenant_memberships VALUES "+
  [a.id,b.id,member.id].map(id=>"('"+TENANT+"','"+id+"',true)").join(',')+";"+
  "INSERT INTO public.t404_v1989_store_memberships VALUES "+
   "('"+TENANT+"','A','"+a.id+"',true,'owner'),"+
   "('"+TENANT+"','B','"+b.id+"',true,'owner');"
 );
 for(const [label,store,actor] of [['E','A',a],['F','B',b]]) {
  const h=hash(nonces[label]);
  demand(/^[a-f0-9]{64}$/.test(h),'INVALID_NONCE_DIGEST');
  sql(
   "INSERT INTO public.t404_v19810_installations VALUES ("+
   "'QA_INSTALL_"+label+"','QA_ENDPOINT_"+label+"','QA_BOT_"+label+
   "','QA_CRED_"+label+"',1,'"+TENANT+"','"+store+"','"+actor.id+
   "','qa_active',2,now()-interval '2 hours',NULL);"+
   "INSERT INTO public.t404_v19812_grants VALUES "+
   "('QA_INSTALL_"+label+"','"+actor.id+"','"+TENANT+"','"+store+
   "',2,'readonly_catalog_qa_only','pending',NULL,NULL);"+
   "INSERT INTO public.t404_v19812_challenges "+
   "(challenge_ref,installation_ref,owner_user_id,tenant_id,store_code,"+
   "binding_version,scope,nonce_sha256,issued_at,expires_at,state,consumed_at) VALUES ("+
   "'QA_CHALLENGE_"+label+"001','QA_INSTALL_"+label+"','"+actor.id+"','"+
   TENANT+"','"+store+"',2,'readonly_catalog_qa_only','"+h+"',"+
   "now()-interval '30 seconds',now()+interval '5 minutes','pending',NULL);"
  );
 }
}
async function approval(key,actor,installation,ref,proof) {
 return request('/rest/v1/rpc/t404_v19812_approve_challenge',key,actor?.jwt,
  'POST',{p_installation_ref:installation,p_challenge_ref:ref,p_nonce:proof});
}
async function revoke(key,actor,installation) {
 return request('/rest/v1/rpc/t404_v19812_revoke_consent',key,actor?.jwt,
  'POST',{p_installation_ref:installation});
}
const granted=(ref,expectState)=>sql("SELECT count(*) FROM public.t404_v19812_grants "+
 "WHERE installation_ref='"+ref+"' AND state='"+expectState+"';")==='1';
const counted=(ref,state)=>sql("SELECT count(*) FROM public.t404_v19812_challenges "+
 "WHERE challenge_ref='"+ref+"' AND state='"+state+"';")==='1';
// Server-owned, read-only synthetic authority check; NEVER trust the grant alone.
function eligibleInstallation(ref) {
 demand(/^QA_INSTALL_[EF]$/.test(ref),'BAD_INSTALL_REF');
 const q="SELECT count(*) FROM public.t404_v19812_grants g "+
 "JOIN public.t404_v19810_installations i ON i.installation_ref=g.installation_ref "+
 "JOIN public.t404_v1989_store_memberships sm ON sm.tenant_id=i.tenant_id "+
 " AND sm.store_code=i.store_code AND sm.user_id=i.owner_user_id "+
 "JOIN public.t404_v1989_tenant_memberships tm ON tm.tenant_id=i.tenant_id "+
 " AND tm.user_id=i.owner_user_id "+
 "WHERE i.installation_ref='"+ref+"' AND i.state='qa_active' "+
 " AND i.revoked_at IS NULL AND i.verified_at<=now() "+
 " AND g.owner_user_id=i.owner_user_id AND g.tenant_id=i.tenant_id "+
 " AND g.store_code=i.store_code AND g.binding_version=i.version "+
 " AND g.scope='readonly_catalog_qa_only' AND g.state='approved' "+
 " AND g.consented_at IS NOT NULL AND g.revoked_at IS NULL "+
 " AND sm.active=true AND sm.role='owner' AND tm.owner_active=true;";
 return sql(q)==='1';
}
async function ownCatalog(key,actor,store) {
 const p='/rest/v1/t404_v1989_products?select=store_code,sku,price_vnd,stock_on_hand'+
  '&store_code=eq.'+store+'&sku=eq.F01';
 const r=await request(p,key,actor?.jwt);
 return r.ok&&Array.isArray(r.value)?r.value:[];
}
async function run(){
 demand(process.env.T404_V19812_LOCAL_ONLY==='ONE_TIME_CHALLENGE_NO_SEND',
  'LOCAL_DOCKER_GUARD');
 demand(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_PROJECT_REF&&
  !process.env.T404_UAT_PROJECT_REF,'HOSTED_CREDENTIAL_ENV_PRESENT');
 const key=loadLocalAnon();
 const [a,b,m]=await Promise.all([user(key,'E'),user(key,'F'),user(key,'MEMBER')]);
 const n={E:nonce(),F:nonce()};
 setup({E:a,F:b,M:m},n);
 let pass=0;
 const ok=(value,name)=>{demand(value,'FAIL_'+name);pass++;
  process.stdout.write('V19812_PASS_'+name+'\n')};
 ok(a.id!==b.id&&b.id!==m.id&&a.id!==m.id,'DISTINCT_LOCAL_REAL_AUTH_JWTS');
 ok(granted('QA_INSTALL_E','pending')&&granted('QA_INSTALL_F','pending'),
  'UNAPPROVED_INSTALLATIONS_ARE_PENDING');
 ok(!eligibleInstallation('QA_INSTALL_E')&&!eligibleInstallation('QA_INSTALL_F'),
  'PENDING_CONSENT_NEVER_GRANTS_SERVER_ADMISSION');
 const privateRead=await request('/rest/v1/t404_v19812_challenges?select=nonce_sha256',key,a.jwt);
 ok(!privateRead.ok||Array.isArray(privateRead.value)&&privateRead.value.length===0,
  'NONCE_HASH_NOT_EXPOSED_TO_OWNER');
 const direct=await request('/rest/v1/t404_v19812_grants',key,a.jwt,'PATCH',{state:'approved'});
 ok(!direct.ok,'DIRECT_CONSENT_UPDATE_DENIED');
 const anon=await approval(key,null,'QA_INSTALL_E','QA_CHALLENGE_E001',n.E);
 ok(!anon.ok||anon.value===false,'ANONYMOUS_RPC_DENIED');
 const stranger=await approval(key,m,'QA_INSTALL_E','QA_CHALLENGE_E001',n.E);
 ok(!stranger.ok||stranger.value===false,'TENANT_ONLY_MEMBER_CANNOT_APPROVE');
 const foreign=await approval(key,a,'QA_INSTALL_F','QA_CHALLENGE_F001',n.F);
 ok(!foreign.ok||foreign.value===false,'OWNER_A_CANNOT_APPROVE_B');
 ok(counted('QA_CHALLENGE_F001','pending'),'FOREIGN_CHALLENGE_NOT_CONSUMED');
 const bad=await approval(key,a,'QA_INSTALL_E','QA_CHALLENGE_E001',nonce());
 ok(bad.ok&&bad.value===false,'WRONG_NONCE_REJECTED');
 const wrongRef=await approval(key,a,'QA_INSTALL_E','QA_CHALLENGE_F001',n.E);
 ok(wrongRef.ok&&wrongRef.value===false,'WRONG_CHALLENGE_REF_REJECTED');
 sql("UPDATE public.t404_v19810_installations SET version=3 "+
  "WHERE installation_ref='QA_INSTALL_E';");
 const stale=await approval(key,a,'QA_INSTALL_E','QA_CHALLENGE_E001',n.E);
 ok(stale.ok&&stale.value===false,'INSTALLATION_CONFIG_VERSION_CHANGE_DENIED');
 sql("UPDATE public.t404_v19810_installations SET version=2 "+
  "WHERE installation_ref='QA_INSTALL_E';");
 sql("UPDATE public.t404_v19812_challenges SET expires_at=now()-interval '1 second' "+
  "WHERE challenge_ref='QA_CHALLENGE_E001';");
 const expired=await approval(key,a,'QA_INSTALL_E','QA_CHALLENGE_E001',n.E);
 ok(expired.ok&&expired.value===false,'EXPIRED_CHALLENGE_DENIED');
 sql("UPDATE public.t404_v19812_challenges SET expires_at=now()+interval '5 minutes' "+
  "WHERE challenge_ref='QA_CHALLENGE_E001';");
 const approved=await approval(key,a,'QA_INSTALL_E','QA_CHALLENGE_E001',n.E);
 ok(approved.ok&&approved.value===true,'REAL_OWNER_A_JWT_CONSUMES_VALID_NONCE');
 ok(granted('QA_INSTALL_E','approved')&&counted('QA_CHALLENGE_E001','consumed'),
  'ATOMIC_CHALLENGE_AND_GRANT_TRANSITION');
 ok(eligibleInstallation('QA_INSTALL_E'),
  'APPROVED_CHALLENGE_MATCHES_SERVER_INSTALLATION');
 const replay=await approval(key,a,'QA_INSTALL_E','QA_CHALLENGE_E001',n.E);
 ok(replay.ok&&replay.value===false,'REPLAYED_CHALLENGE_DENIED');
 const simultaneous=await Promise.all([
  approval(key,b,'QA_INSTALL_F','QA_CHALLENGE_F001',n.F),
  approval(key,b,'QA_INSTALL_F','QA_CHALLENGE_F001',n.F)
 ]);
 ok(simultaneous.filter(r=>r.ok&&r.value===true).length===1&&
    simultaneous.filter(r=>r.ok&&r.value===false).length===1,
   'CONCURRENT_SAME_NONCE_EXACTLY_ONE_APPROVAL');
 ok(granted('QA_INSTALL_F','approved')&&counted('QA_CHALLENGE_F001','consumed'),
   'CONCURRENT_APPROVAL_LEAVES_SINGLE_CONSENT_GRANT');
 sql("UPDATE public.t404_v19810_installations SET version=3 "+
   "WHERE installation_ref='QA_INSTALL_F';");
 ok(!eligibleInstallation('QA_INSTALL_F'),'OLD_CONSENT_DENIED_AFTER_BINDING_VERSION_ROTATION');
 sql("UPDATE public.t404_v19810_installations SET version=2 "+
   "WHERE installation_ref='QA_INSTALL_F';");
 ok(eligibleInstallation('QA_INSTALL_F'),'RESTORED_MATCHING_BINDING_ALLOWED');

 const prodA=await ownCatalog(key,a,'A'),crossA=await ownCatalog(key,a,'B');
 ok(prodA.length===1&&prodA[0].price_vnd===159000&&crossA.length===0,
  'A_REAL_JWT_CAN_READ_ONLY_STORE_A_CATALOG');
 const prodB=await ownCatalog(key,b,'B'),crossB=await ownCatalog(key,b,'A');
 ok(prodB.length===1&&prodB[0].price_vnd===189000&&crossB.length===0,
  'B_REAL_JWT_CAN_READ_ONLY_STORE_B_CATALOG');
 const foreignRevoke=await revoke(key,a,'QA_INSTALL_F');
 ok(foreignRevoke.ok&&foreignRevoke.value===false,'A_CANNOT_REVOKE_B');
 const revoked=await revoke(key,a,'QA_INSTALL_E');
 ok(revoked.ok&&revoked.value===true,'A_CAN_REVOKE_OWN_GRANTED_CONSENT');
 ok(granted('QA_INSTALL_E','revoked')&&granted('QA_INSTALL_F','approved'),
  'CONSENT_REVOCATION_IS_STORE_SCOPED');
 ok(!eligibleInstallation('QA_INSTALL_E')&&eligibleInstallation('QA_INSTALL_F'),
  'REVOKED_GRANT_NEVER_ADMITS_INSTALLATION');
 const reGrant=await approval(key,a,'QA_INSTALL_E','QA_CHALLENGE_E001',n.E);
 ok(reGrant.ok&&reGrant.value===false,'REVOKED_GRANT_CANNOT_REACTIVATE_VIA_REPLAY');
 sql("UPDATE public.t404_v1989_store_memberships SET active=false "+
  "WHERE user_id='"+b.id+"' AND store_code='B' AND tenant_id='"+TENANT+"';");
 const auth=await request('/auth/v1/user',key,b.jwt);
 const catalogAfter=await ownCatalog(key,b,'B');
 ok(auth.ok&&catalogAfter.length===0,
  'STILL_VALID_OWNER_JWT_DENIED_AFTER_STORE_MEMBERSHIP_REVOKE');
 ok(!eligibleInstallation('QA_INSTALL_F'),
  'SERVER_DENIES_OLD_APPROVAL_AFTER_OWNER_STORE_REVOKE');
 const blockedRevoke=await revoke(key,b,'QA_INSTALL_F');
 ok(blockedRevoke.ok&&blockedRevoke.value===false,
  'REVOKED_OWNER_CANNOT_REVOKE_OR_MODIFY_GRANT');
 const invalidJwt=await request('/auth/v1/user',key,'invalid_v19812');
 ok([401,403].includes(invalidJwt.status),'INVALID_JWT_DENIED_BY_AUTH');
 const stillPending=await request('/rest/v1/t404_v19812_challenges?select=*',key,null);
 ok(!stillPending.ok||Array.isArray(stillPending.value)&&stillPending.value.length===0,
  'ANON_CANNOT_READ_CHALLENGES');
 process.stdout.write(JSON.stringify({checkpoint:'V19.8.12_OWNER_CHALLENGE_LOCAL_JWT',
  testsPassed:pass,testsFailed:0,challengeSecretLogged:false,
  realLocalAuthJwt:true,realZaloIdentity:false,hostedOwnerProof:false,
  providerSends:0,hostedReads:0,commerceWrites:0,
  productionReady:false})+'\n');
}
run().catch(e=>{
 const s=String(e?.message||'UNKNOWN');
 process.stderr.write('V19812_LOCAL_CHALLENGE_FAIL_'+
  (s.startsWith('CHALLENGE_QA_')?s.replace(/[^A-Z0-9_]/g,'').slice(0,85):'INTERNAL_FAILURE')+'\n');
 process.exitCode=1;
});
