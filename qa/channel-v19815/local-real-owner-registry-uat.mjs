// V19.8.15: ONLY disposable local Supabase Auth/PostgREST/PG17.
// Fake installations and attestations, no provider calls or hosted access.
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
const API='http://127.0.0.1:54321',TENANT='00000000-0000-0000-0000-000000001989';
const PG=['-X','-v','ON_ERROR_STOP=1','-q','-t','-A','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres'];
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ensure=(x,tag)=>{if(!x)throw Error('V19815_'+tag)};
function psql(q){
 ensure(typeof q==='string'&&q.length<8500,'SQL_INPUT');
 try{return execFileSync('psql',[...PG,'-c',q],{encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},stdio:['ignore','pipe','pipe'],timeout:30000}).trim()}
 catch{throw Error('V19815_SQL_FAILED')}
}
function key(){
 const s=execFileSync('supabase',['status','-o','env'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
 const v=Object.fromEntries(s.split(/\r?\n/).map(x=>{const m=x.match(/^([A-Z_]+)=(.*)$/);return m?[m[1],m[2].replace(/^["']|["']$/g,'')]:['','']}));
 ensure(v.API_URL===API&&typeof v.ANON_KEY==='string'&&v.ANON_KEY.length>30,'LOOPBACK_AND_KEY');
 ensure(v.ANON_KEY!==v.SERVICE_ROLE_KEY,'NO_SERVICE_ROLE');
 return v.ANON_KEY;
}
async function req(k,path,jwt,method='GET',body){
 ensure(path.startsWith('/auth/v1/')||path.startsWith('/rest/v1/rpc/t404_v19815_')
 ||path.startsWith('/rest/v1/rpc/t404_v19812_')||path.startsWith('/rest/v1/t404_v19815_')
 ||path.startsWith('/rest/v1/t404_v1989_products'),'PATH_NOT_ALLOWED');
 const h={apikey:k,accept:'application/json'};
 if(jwt)h.authorization='Bearer '+jwt;
 if(body!==undefined)h['content-type']='application/json';
 const r=await fetch(API+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(12000)});
 let data;try{data=await r.json()}catch{data=null}
 return {ok:r.ok,status:r.status,data};
}
async function actor(k,label){
 const email='v19815-'+label+'-'+randomBytes(10).toString('hex')+'@qa.invalid';
 const password=randomBytes(28).toString('base64url')+'Aa1!';
 const s=await req(k,'/auth/v1/signup',null,'POST',{email,password});
 ensure(s.ok&&uuid.test(s.data?.user?.id||''),'SIGNUP');
 const l=await req(k,'/auth/v1/token?grant_type=password',null,'POST',{email,password});
 ensure(l.ok&&typeof l.data?.access_token==='string','SIGNIN');
 const jwt=l.data.access_token;
 const u=await req(k,'/auth/v1/user',jwt);
 ensure(u.ok&&u.data?.id===s.data.user.id&&u.data?.role==='authenticated','REAL_AUTH_JWT');
 return {id:u.data.id,jwt};
}
const digest=s=>createHash('sha256').update(s).digest('hex');
const tokenNonce=()=>randomBytes(32).toString('hex');
async function approve(k,user,label,n){
 return req(k,'/rest/v1/rpc/t404_v19812_approve_challenge',user?.jwt,'POST',
 {p_installation_ref:'QA_INSTALL_'+label,p_challenge_ref:'QA_CHALLENGE_'+label+'001',p_nonce:n});
}
async function read(k,user,installation,store){
 return req(k,'/rest/v1/rpc/t404_v19815_protected_catalog',user?.jwt,'POST',
 {p_installation_ref:'QA_INSTALL_'+installation,p_store_code:store});
}
async function main(){
 ensure(process.env.T404_V19815_DOCKER_ONLY==='TRUE_EPHEMERAL','GUARD');
 ensure(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_PROJECT_REF
 &&!process.env.SUPABASE_DB_URL&&!process.env.T404_UAT_PROJECT_REF,'HOSTED_ENV');
 const k=key();
 const [a,b,member]=await Promise.all([actor(k,'A'),actor(k,'B'),actor(k,'MEMBER')]);
 ensure(new Set([a.id,b.id,member.id]).size===3,'DISTINCT_OWNERS');
 let pass=0;
 const check=(x,label)=>{ensure(x,'FAIL_'+label);pass++;console.log('PASS_'+label)};
 const n={E:tokenNonce(),F:tokenNonce()};
 psql("INSERT INTO public.t404_v1989_tenant_memberships VALUES "+
 [a,b,member].map(u=>"('"+TENANT+"','"+u.id+"',true)").join(',')+";"+
 "INSERT INTO public.t404_v1989_store_memberships VALUES "+
 "('"+TENANT+"','A','"+a.id+"',true,'owner'),"+
 "('"+TENANT+"','B','"+b.id+"',true,'owner');");
 for(const [label,store,owner] of [['E','A',a],['F','B',b]]){
 psql("INSERT INTO public.t404_v19810_installations VALUES "+
 "('QA_INSTALL_"+label+"','QA_ENDPOINT_"+label+"','QA_BOT_"+label+"','QA_CRED_"+label+
 "',1,'"+TENANT+"','"+store+"','"+owner.id+"','qa_active',2,now()-interval '3 hours',NULL);"+
 "INSERT INTO public.t404_v19812_grants VALUES "+
 "('QA_INSTALL_"+label+"','"+owner.id+"','"+TENANT+"','"+store+
 "',2,'readonly_catalog_qa_only','pending',NULL,NULL);"+
 "INSERT INTO public.t404_v19812_challenges "+
 "(challenge_ref,installation_ref,owner_user_id,tenant_id,store_code,binding_version,scope,nonce_sha256,issued_at,expires_at,state,consumed_at) VALUES "+
 "('QA_CHALLENGE_"+label+"001','QA_INSTALL_"+label+"','"+owner.id+"','"+TENANT+"','"+store+
 "',2,'readonly_catalog_qa_only','"+digest(n[label])+"',now()-interval '20 seconds',now()+interval '4 minutes','pending',NULL);"+
 "INSERT INTO t404_v19815_private.registry VALUES "+
 "('QA_INSTALL_"+label+"','"+digest('FAKE_BOT_'+label)+"',1,2,'zalo_bot_fixture','attested',now()-interval '2 hours',NULL);"+
 "INSERT INTO t404_v19815_private.attestation VALUES "+
 "('QA_INSTALL_"+label+"',2,1,true,true,true,true,now()-interval '1 hour',now()+interval '1 day','"+
 digest('SYNTHETIC_EVIDENCE_'+label)+"');");
 }
 check(true,'REGISTRY_FIXTURE_APPLIED_SYNTHETIC');
 let r=await read(k,a,'E','A');
 check(r.ok&&Array.isArray(r.data)&&r.data.length===0,'PENDING_OWNER_CONSENT_DENIED');
 check((await approve(k,a,'E',n.E)).data===true,'REAL_OWNER_A_APPROVAL');
 check((await approve(k,b,'F',n.F)).data===true,'REAL_OWNER_B_APPROVAL');
 check((await approve(k,a,'E',n.E)).data===false,'NONCE_REPLAY_DENIED');
 r=await read(k,a,'E','A');
 check(r.ok&&r.data?.length===1&&r.data[0].price_vnd===159000&&r.data[0].stock_on_hand===5,'A_OWN_STORE_PRICE_STOCK');
 r=await read(k,b,'F','B');
 check(r.ok&&r.data?.length===1&&r.data[0].price_vnd===189000&&r.data[0].stock_on_hand===9,'B_OWN_STORE_PRICE_STOCK');
 for(const [label,u,install,store] of [['A',a,'F','B'],['B',b,'E','A'],['A',a,'E','B'],['B',b,'F','A']]){
 r=await read(k,u,install,store);
 check(r.ok&&Array.isArray(r.data)&&r.data.length===0,'CROSS_STORE_'+label+'_'+install+'_'+store+'_DENIED');
 }
 r=await read(k,member,'E','A');
 check(r.ok&&r.data?.length===0,'TENANT_ONLY_DENIED');
 r=await read(k,null,'E','A');
 check(!r.ok||r.data?.length===0,'ANONYMOUS_DENIED');
 r=await req(k,'/rest/v1/t404_v19815_private.registry?select=*',a.jwt);
 check(!r.ok,'PRIVATE_REGISTRY_NOT_DATA_API');
 r=await req(k,'/rest/v1/t404_v1989_products',a.jwt,'POST',{tenant_id:TENANT,store_code:'B',sku:'QA_MUTATION',price_vnd:1,stock_on_hand:2,fixture_tag:'SYNTHETIC_V1989'});
 check(!r.ok,'CATALOG_WRITE_DENIED');
 psql("UPDATE t404_v19815_private.attestation SET expires_at=now()-interval '1 second' WHERE installation_ref='QA_INSTALL_E';");
 check((await read(k,a,'E','A')).data?.length===0,'EXPIRED_ATTESTATION_DENIED');
 psql("UPDATE t404_v19815_private.attestation SET expires_at=now()+interval '1 day',secret_binding_reviewed=false WHERE installation_ref='QA_INSTALL_E';");
 check((await read(k,a,'E','A')).data?.length===0,'UNVERIFIED_SECRET_DENIED');
 psql("UPDATE t404_v19815_private.attestation SET secret_binding_reviewed=true,installation_version=3 WHERE installation_ref='QA_INSTALL_E';");
 check((await read(k,a,'E','A')).data?.length===0,'ATTESTATION_VERSION_DRIFT_DENIED');
 psql("UPDATE t404_v19815_private.attestation SET installation_version=2 WHERE installation_ref='QA_INSTALL_E';"+
 "UPDATE t404_v19815_private.registry SET credential_epoch=2 WHERE installation_ref='QA_INSTALL_E';");
 check((await read(k,a,'E','A')).data?.length===0,'CREDENTIAL_EPOCH_DRIFT_DENIED');
 psql("UPDATE t404_v19815_private.registry SET credential_epoch=1 WHERE installation_ref='QA_INSTALL_E';");
 check((await read(k,a,'E','A')).data?.length===1,'VALID_EVIDENCE_RESTORED');
 psql("UPDATE public.t404_v1989_store_memberships SET active=false WHERE tenant_id='"+TENANT+"' AND store_code='A' AND user_id='"+a.id+"';");
 check((await read(k,a,'E','A')).data?.length===0,'REVOKED_STORE_MEMBERSHIP_SAME_JWT_DENIED');
 check((await req(k,'/auth/v1/user',a.jwt)).ok,'JWT_VALID_AFTER_MEMBERSHIP_REVOKE');
 check((await read(k,b,'F','B')).data?.length===1,'B_UNAFFECTED_BY_A_REVOKE');
 psql("UPDATE t404_v19815_private.registry SET state='revoked',revoked_at=now() WHERE installation_ref='QA_INSTALL_F';");
 check((await read(k,b,'F','B')).data?.length===0,'REVOKED_BOT_INSTALLATION_DENIED');
 check((await read(k,a,'E','A')).data?.length===0,'REVOKED_STORE_REMAINS_DENIED');
 const invalid=await req(k,'/auth/v1/user','invalid.v19815.jwt');
 check([400,401,403].includes(invalid.status),'INVALID_JWT_DENIED');
 console.log(JSON.stringify({checkpoint:'V19.8.15_LOCAL_REGISTRY_REAL_JWT',result:'PASS',checks:pass,realLocalAuthJWT:true,actualZalo:false,hostedOwnerVerified:false,hostedConnections:0,sends:0,orderWrites:0,productionReady:false}));
}
main().catch(e=>{const m=String(e?.message||'UNKNOWN');process.stderr.write('V19815_FAILED_'+(m.startsWith('V19815_')?m.replace(/[^A-Z0-9_]/g,'').slice(0,90):'INTERNAL_ERROR')+'\n');process.exitCode=1});
