/**
 * TIEN404 V19.8.10 - END-TO-END LOCAL QA ONLY.
 *
 * A synthetic HMAC-signed Bot event -> server-owned SQL installation/consent
 * admission -> REAL local Supabase Auth Owner JWT -> Store-scoped PostgREST
 * catalog read. No actual Zalo provider auth, sends, orders or hosted DB reads.
 *
 * PostgreSQL superuser is used ONLY to set up synthetic roles/fixtures and
 * simulate an internal installation registry. It MUST NOT read the catalog.
 * All catalog reads use low-privilege signed local Owner JWT + PostgREST RLS.
 */
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {signMockProvider,verifyMockProvider,validateCatalogRow}
 from './mock-ingress-catalog-policy.mjs';

const API='http://127.0.0.1:54321',TENANT='00000000-0000-0000-0000-000000001989';
const PG=['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h','127.0.0.1',
 '-p','54322','-U','postgres','-d','postgres'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const serverSettings={
 QA_ENDPOINT_A:{credentialRef:'QA_CRED_A',epoch:2,key:randomBytes(32),storeCode:'A'},
 QA_ENDPOINT_B:{credentialRef:'QA_CRED_B',epoch:1,key:randomBytes(32),storeCode:'B'}
};
function insist(ok,code){if(!ok)throw Error('V19810_QA_'+code);}
function psql(sql){
 insist(typeof sql==='string'&&sql.length<7000,'SQL_NOT_FIXED');
 return execFileSync('psql',[...PG,'-c',sql],{
  encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000,
  env:{...process.env,PGPASSWORD:'postgres'}}).trim();
}
function publicAnonKey(){
 const output=execFileSync('supabase',['status','-o','env'],{
  encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
 const entries=Object.fromEntries(output.split(/\r?\n/).map(s=>{
  const m=s.match(/^([A-Z_]+)=(.*)$/);
  return m?[m[1],m[2].replace(/^["']|["']$/g,'')]:['',''];
 }));
 insist(entries.API_URL===API,'NON_LOCAL_API_REFUSED');
 insist(typeof entries.ANON_KEY==='string'&&entries.ANON_KEY.length>30,
  'LOCAL_ANON_KEY_MISSING');
 insist(entries.ANON_KEY!==entries.SERVICE_ROLE_KEY,'SERVICE_ROLE_KEY_FORBIDDEN');
 return entries.ANON_KEY;
}
async function call(path,key,token,method='GET',body){
 insist(path.startsWith('/auth/v1/')||path.startsWith('/rest/v1/t404_v1989_products')||
  path.startsWith('/rest/v1/t404_v19810_installations'),'UNSCOPED_API_PATH_REFUSED');
 const headers={apikey:key,accept:'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 if(body!==undefined)headers['Content-Type']='application/json';
 const r=await fetch(API+path,{method,headers,cache:'no-store',redirect:'error',
  body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(12000)});
 let data=null;try{data=await r.json();}catch{}
 return {status:r.status,ok:r.ok,data};
}
async function createOwner(key,label){
 const email='t404-v19810-'+label.toLowerCase()+'-'+
  randomBytes(12).toString('hex')+'@tien404-qa.invalid';
 const password=randomBytes(30).toString('base64url')+'A1!';
 let r=await call('/auth/v1/signup',key,null,'POST',{email,password});
 insist(r.ok&&UUID.test(r.data?.user?.id||''),'OWNER_SIGNUP_'+label);
 const id=r.data.user.id;
 r=await call('/auth/v1/token?grant_type=password',key,null,'POST',{email,password});
 insist(r.ok&&typeof r.data?.access_token==='string','OWNER_SIGNIN_'+label);
 const jwt=r.data.access_token;
 insist(jwt.split('.').length===3,'NOT_SIGNED_JWT_'+label);
 const u=await call('/auth/v1/user',key,jwt);
 insist(u.ok&&u.data?.id===id&&u.data.role==='authenticated','AUTH_JWT_INVALID_'+label);
 return {id,token:jwt};
}
function setupOwners(a,b){
 for(const [label,user,epoch] of [['A',a,2],['B',b,1]]){
  insist(UUID.test(user.id),'INVALID_QA_UUID');
  const sql=[
   "INSERT INTO public.t404_v1989_tenant_memberships VALUES "+
    "('"+TENANT+"','"+user.id+"',true);",
   "INSERT INTO public.t404_v1989_store_memberships VALUES "+
    "('"+TENANT+"','"+label+"','"+user.id+"',true,'owner');",
   "INSERT INTO public.t404_v19810_installations VALUES "+
    "('QA_INSTALL_"+label+"','QA_ENDPOINT_"+label+"','QA_BOT_"+label+
    "','QA_CRED_"+label+"',"+epoch+",'"+TENANT+"','"+label+"','"+
    user.id+"','qa_active',1,now()-interval '2 hour',NULL);",
   "INSERT INTO public.t404_v19810_owner_consents VALUES "+
    "('QA_INSTALL_"+label+"','"+user.id+
    "','consented_readonly_qa',1,now()-interval '1 hour',NULL);"
  ].join('\n');
  psql(sql);
 }
}
/**
 * Single-statement local DB admission with unique installation-scoped inbox.
 * Rejects if any Store/owner mapping is missing, duplicate, expired,
 * revoked or config epoch mismatches. No catalog rows queried here.
 */
function internalAdmit(e){
 insist(/^QA_ENDPOINT_[AB]$/.test(e.endpointRef)&&
  /^EVT_[A-Z0-9_]{3,40}$/.test(e.eventRef) &&
  Number.isSafeInteger(e.credentialEpoch),'INVALID_INTERNAL_INPUT');
 const cfg=serverSettings[e.endpointRef];
 const sql=
 "WITH verified AS MATERIALIZED ("+
 "SELECT i.installation_ref,i.store_code,i.owner_user_id FROM "+
 "public.t404_v19810_installations i "+
 "JOIN public.t404_v19810_owner_consents c ON c.installation_ref=i.installation_ref "+
 " AND c.owner_user_id=i.owner_user_id "+
 "JOIN public.t404_v1989_store_memberships sm ON sm.tenant_id=i.tenant_id "+
 " AND sm.store_code=i.store_code AND sm.user_id=i.owner_user_id "+
 "JOIN public.t404_v1989_tenant_memberships tm ON tm.tenant_id=i.tenant_id "+
 " AND tm.user_id=i.owner_user_id "+
 "WHERE i.endpoint_ref='"+e.endpointRef+"'"+
 " AND i.credential_ref='"+cfg.credentialRef+"'"+
 " AND i.credential_epoch="+e.credentialEpoch+
 " AND i.tenant_id='"+TENANT+"'"+
 " AND i.state='qa_active' AND i.revoked_at IS NULL "+
 " AND i.verified_at<=now() AND sm.active=true AND sm.role='owner' "+
 " AND tm.owner_active=true AND c.consent='consented_readonly_qa' "+
 " AND c.approved_version=i.version AND c.revoked_at IS NULL "+
 " AND c.approved_at>=i.verified_at AND c.approved_at<=now() "+
 " FOR SHARE OF i,c,sm,tm), "+
 "claimed AS (INSERT INTO public.t404_v19810_event_inbox(installation_ref,event_ref) "+
 "SELECT installation_ref,'"+e.eventRef+"' FROM verified "+
 "ON CONFLICT DO NOTHING RETURNING installation_ref) "+
 "SELECT v.store_code||'|'||v.owner_user_id::text FROM verified v "+
 "JOIN claimed cl ON cl.installation_ref=v.installation_ref;";
 const rows=psql(sql).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(rows.length!==1)return null;
 const [store,ownerId]=rows[0].split('|');
 if(!['A','B'].includes(store)||!UUID.test(ownerId))return null;
 return {store,ownerId};
}
async function catalog(key,jwt,store){
 const query='?select='+encodeURIComponent('store_code,sku,price_vnd,stock_on_hand,fixture_tag')+
  '&store_code=eq.'+store+'&sku=eq.F01';
 const r=await call('/rest/v1/t404_v1989_products'+query,key,jwt);
 if(!r.ok||!Array.isArray(r.data))return null;
 return r.data;
}
async function handle(packet,key,sessions){
 const now=Date.now(),e=packet?.event;
 // The server chooses the mock provider key by its private endpoint registry.
 const setting=e&&serverSettings[e.endpointRef];
 if(!setting)return {allowed:false,reason:'ENDPOINT_UNRECOGNIZED'};
 const check=verifyMockProvider(packet,setting.key,now);
 if(!check.accepted)return {allowed:false,reason:check.reason};
 const bound=internalAdmit(check.event);
 if(!bound)return {allowed:false,reason:'INSTALLATION_OR_EVENT_NOT_AUTHORIZED'};
 const owner=sessions.get(bound.ownerId);
 if(!owner)return {allowed:false,reason:'NO_VERIFIED_OWNER_SESSION'};
 const authenticated=await call('/auth/v1/user',key,owner.token);
 if(!authenticated.ok||authenticated.data?.id!==bound.ownerId)
  return {allowed:false,reason:'OWNER_JWT_NOT_VERIFIED'};
 const rows=await catalog(key,owner.token,bound.store);
 if(!rows||rows.length!==1)return {allowed:false,reason:'STORE_CATALOG_NOT_VISIBLE'};
 const preview=validateCatalogRow(rows[0],bound.store,check.event.sku,check.event.quantity);
 if(!preview)return {allowed:false,reason:'CATALOG_PRICE_STOCK_INVALID'};
 // No provider recipient, message body or provider send operation in output.
 return {allowed:true,reason:'LOCAL_MOCK_INSTALLATION_CATALOG_PREVIEW',
  preview,realZaloProviderVerified:false,hostedSupabaseVerified:false,
  canSend:false,canWrite:false};
}
function event(endpointRef,eventRef,quantity=1){
 return {endpointRef,eventRef,kind:'message.text.received',chatType:'PRIVATE',
  isEcho:false,issuedAtMs:Date.now()-1500,sku:'F01',quantity,
  credentialEpoch:serverSettings[endpointRef].epoch};
}
function signed(e){return signMockProvider(e,serverSettings[e.endpointRef].key);}
async function run(){
 insist(process.env.T404_V19810_LOCAL_ONLY==='DOCKER_SYNTHETIC_NO_SEND',
  'NOT_APPROVED_LOCAL_CI');
 insist(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_PROJECT_REF&&
  !process.env.T404_UAT_PROJECT_REF,'HOSTED_CREDENTIAL_ENV_BLOCKED');
 const key=publicAnonKey(),a=await createOwner(key,'A'),b=await createOwner(key,'B');
 insist(a.id!==b.id,'OWNER_A_B_NOT_DISTINCT');
 setupOwners(a,b);
 const sessions=new Map([[a.id,a],[b.id,b]]);
 let passed=0;
 const ok=(value,name)=>{insist(value,'TEST_'+name);passed++;
  process.stdout.write('V19810_PASS_'+name+'\n');};
 ok((await handle(signed(event('QA_ENDPOINT_A','EVT_A001',2)),key,sessions)).preview?.priceVnd===159000,
  'BOT_A_STORE_A_PRICE');
 ok((await handle(signed(event('QA_ENDPOINT_B','EVT_B001',2)),key,sessions)).preview?.priceVnd===189000,
  'BOT_B_STORE_B_PRICE');
 ok((await handle(signed(event('QA_ENDPOINT_A','EVT_A002',6)),key,sessions)).preview?.canFulfill===false,
  'INSUFFICIENT_STOCK_NO_ORDER');
 // The event identifier is scoped to installation, not to tenant globally.
 ok((await handle(signed(event('QA_ENDPOINT_B','EVT_A001')),key,sessions)).allowed,
  'SAME_EVENT_ID_OTHER_INSTALLATION_ALLOWED');
 ok(!(await handle(signed(event('QA_ENDPOINT_A','EVT_A001')),key,sessions)).allowed,
  'SAME_INSTALLATION_REPLAY_DENIED');
 const tampered=signed(event('QA_ENDPOINT_A','EVT_A003'));
 tampered.event.quantity=9;
 ok(!(await handle(tampered,key,sessions)).allowed,'HMAC_TAMPER_DENIED');
 const injected=signed(event('QA_ENDPOINT_A','EVT_A004'));
 injected.event.storeId='B';
 ok(!(await handle(injected,key,sessions)).allowed,'CHAT_SUPPLIED_STORE_REJECTED');
 const cross=signed(event('QA_ENDPOINT_B','EVT_B002'));
 cross.signature=signMockProvider(cross.event,serverSettings.QA_ENDPOINT_A.key).signature;
 ok(!(await handle(cross,key,sessions)).allowed,'CROSS_INSTALLATION_SIGNER_REJECTED');
 const ownA=await catalog(key,a.token,'A'),otherA=await catalog(key,a.token,'B');
 ok(ownA?.length===1&&otherA?.length===0,'REAL_JWT_NO_CROSS_STORE_CATALOG');
 const direct=await call('/rest/v1/t404_v19810_installations?select=installation_ref',
  key,a.token);
 ok(!direct.ok||Array.isArray(direct.data)&&direct.data.length===0,
  'INSTALLATION_REGISTRY_PRIVATE');
 psql("UPDATE public.t404_v19810_owner_consents SET consent='revoked',revoked_at=now() "+
  "WHERE installation_ref='QA_INSTALL_A';");
 ok(!(await handle(signed(event('QA_ENDPOINT_A','EVT_A005')),key,sessions)).allowed,
  'OWNER_CONSENT_REVOKED_BLOCKS_READ');
 ok((await handle(signed(event('QA_ENDPOINT_B','EVT_B003')),key,sessions)).allowed,
  'BOT_B_UNAFFECTED_BY_A_CONSENT_REVOKE');
 psql("UPDATE public.t404_v19810_owner_consents "+
  "SET consent='consented_readonly_qa',revoked_at=NULL WHERE installation_ref='QA_INSTALL_A';");
 psql("UPDATE public.t404_v19810_installations SET state='revoked',revoked_at=now() "+
  "WHERE installation_ref='QA_INSTALL_A';");
 ok(!(await handle(signed(event('QA_ENDPOINT_A','EVT_A006')),key,sessions)).allowed,
  'REVOKED_INSTALLATION_DENIED');
 psql("UPDATE public.t404_v19810_installations SET state='qa_active',revoked_at=NULL "+
  "WHERE installation_ref='QA_INSTALL_A';");
 psql("UPDATE public.t404_v1989_store_memberships SET active=false "+
  "WHERE user_id='"+a.id+"' AND store_code='A' AND tenant_id='"+TENANT+"';");
 ok(!(await handle(signed(event('QA_ENDPOINT_A','EVT_A007')),key,sessions)).allowed,
  'REVOKED_STORE_OWNER_DENIED');
 const still=await call('/auth/v1/user',key,a.token);
 const revoked=await catalog(key,a.token,'A');
 ok(still.ok&&revoked?.length===0,'SAME_REAL_JWT_RLS_DENIES_REVOKED_OWNER');
 psql("UPDATE public.t404_v1989_store_memberships SET active=true "+
  "WHERE user_id='"+a.id+"' AND store_code='A' AND tenant_id='"+TENANT+"';");
 psql("UPDATE public.t404_v19810_installations SET credential_epoch=3 "+
  "WHERE installation_ref='QA_INSTALL_A';");
 ok(!(await handle(signed(event('QA_ENDPOINT_A','EVT_A008')),key,sessions)).allowed,
  'STALE_CREDENTIAL_EPOCH_DENIED');
 psql("UPDATE public.t404_v19810_installations SET credential_epoch=2 "+
  "WHERE installation_ref='QA_INSTALL_A';");
 ok((await handle(signed(event('QA_ENDPOINT_A','EVT_A009')),key,sessions)).allowed,
  'RESTORED_OWNER_AND_INSTALLATION_ALLOWED');
 const anonymous=await catalog(key,null,'A');
 ok(anonymous===null||anonymous.length===0,'NO_ANON_CATALOG');
 const forbidden=await call('/rest/v1/t404_v1989_products',key,a.token,'POST',
  {tenant_id:TENANT,store_code:'B',sku:'F99',price_vnd:1,stock_on_hand:3,
   fixture_tag:'SYNTHETIC_V1989'});
 ok([401,403,405].includes(forbidden.status),'NO_ORDER_OR_CATALOG_WRITE');
 process.stdout.write(JSON.stringify({
  checkpoint:'V19.8.10_LOCAL_MOCK_INSTALLATION_STORE_CATALOG_INTEGRATION',
  realLocalOwnerJwtVerified:true,realZaloProviderVerified:false,
  trueHostedStoreAuthorityVerified:false,productionReady:false,
  testsPassed:passed,testsFailed:0,providerSends:0,commerceOrderWrites:0,
  hostedConnections:0,installationInboxWrites:'LOCAL_SYNTHETIC_ONLY'})+'\n');
}
run().catch(err=>{
 const e=String(err?.message||'UNKNOWN');
 const safe=e.startsWith('V19810_QA_')?e.replace(/[^A-Z0-9_]/g,'').slice(0,100):'INTERNAL_FAILURE';
 process.stderr.write('V19810_INTEGRATION_FAILED_'+safe+'\n');process.exitCode=1;
});
