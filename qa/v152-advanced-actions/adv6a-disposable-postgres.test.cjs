'use strict';
/* V15.2 ADV6A. REAL PostgreSQL 17 in isolated GitHub Actions service ONLY.
 * REFUSES hosted Supabase or production use. Zero real merchant/provider I/O.
 */
const test=require('node:test'),{before,after}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
function preflight(){
 const e=process.env;
 if(e.CI!=='true'||e.GITHUB_ACTIONS!=='true'||e.ADV6A_DISPOSABLE_POSTGRES!=='YES'||
    e.PGHOST!=='127.0.0.1'||e.PGDATABASE!=='adv6a_qa'||e.PGUSER!=='adv6a_qa'||
    e.PGPORT!=='5432'||!e.PGPASSWORD||e.PGPASSWORD.length<14)
   throw Error('ADV6A_DISPOSABLE_ONLY_PREFLIGHT_DENIED');
}
preflight();
const {Pool}=require('pg');
const pgStore=require('./pg-nonce-store.cjs');
const identity=require('./verified-identity-connector.cjs');
const gateway=require('./canonical-action-gateway.cjs');
const config=()=>({host:'127.0.0.1',port:5432,user:'adv6a_qa',database:'adv6a_qa',
 password:process.env.PGPASSWORD,max:20,connectionTimeoutMillis:3000});
const hash=()=>crypto.randomBytes(32).toString('hex');
const expiry=()=>Date.now()+120000;
let pool,version;
const evidence={
 contract:'T404_ADV6A_EPHEMERAL_PG17_EVIDENCE_V1',database:'DISPOSABLE_GITHUB_ACTIONS_NOT_HOSTED',
 actualPg17Tested:false,multipleConnectionsUniqueNonce:false,poolReconnectReplayDenied:false,
 qaTransactionalWriteAtomic:false,rollbackAfterFailureVerified:false,
 syntheticSignedJwtScopeChecked:false,leastPrivilegeNegativeTest:false,
 hostedOwnerJwtRlsCertified:false,realCommerceTransactionCertified:false,
 actualProviderWebhookCertified:false,dbCrashRestartCertified:false,
 livePublishAuthorized:false,liveActionAuthorized:false,providerSends:0,
 hostedWrites:0,realCustomerReads:0,tests:[]
};
before(async()=>{
 pool=new Pool(config());
 const client=await pool.connect();
 try{
  const s=await client.query('SELECT version() AS version, current_database() AS db, current_user AS usr');
  assert.equal(s.rows[0].db,'adv6a_qa');
  assert.equal(s.rows[0].usr,'adv6a_qa');
  assert.match(s.rows[0].version,/PostgreSQL 17/);
  version=s.rows[0].version.split(' on ')[0];
  await client.query(fs.readFileSync(path.join(__dirname,'adv6a-disposable-postgres-schema.sql'),'utf8'));
 }finally{client.release()}
 evidence.actualPg17Tested=true;
});
after(async()=>{
 evidence.version=version||null;
 evidence.finishedAt=new Date().toISOString();
 fs.mkdirSync('qa-artifacts-v152-adv6a',{recursive:true});
 fs.writeFileSync('qa-artifacts-v152-adv6a/disposable-pg-evidence.json',
  JSON.stringify(evidence,null,2)+'\n');
 if(pool)await pool.end();
});
const makeStore=p=>pgStore.createPgNonceStore({query:(sql,params)=>p.query(sql,params),clock:Date.now});
test('01 private QA tables RLS enabled; no anonymous-like role access',async()=>{
 const c=await pool.query("SELECT relrowsecurity AS rls FROM pg_class WHERE oid='tien404_action_private.action_nonce_claims'::regclass");
 assert.equal(c.rows[0].rls,true);
 const rights=await pool.query("SELECT has_schema_privilege('adv6a_unprivileged','tien404_action_private','USAGE') AS s, has_table_privilege('adv6a_unprivileged','tien404_action_private.action_nonce_claims','SELECT') AS t");
 assert.equal(rights.rows[0].s,false);assert.equal(rights.rows[0].t,false);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE adv6a_unprivileged');
  await assert.rejects(()=>client.query('SELECT * FROM tien404_action_private.action_nonce_claims'),/permission denied/);
 }finally{await client.query('ROLLBACK');client.release()}
 evidence.leastPrivilegeNegativeTest=true;evidence.tests.push('DISPOSABLE_PG17_PRIVATE_SCHEMA_RLS_ROLE_DENIAL');
});
test('02 32 real parallel SQL connections accept one nonce only',async()=>{
 const a=new Pool(config()),b=new Pool(config()),k=hash(),until=expiry();
 try{
  const stores=[makeStore(a),makeStore(b)];
  const result=await Promise.allSettled(Array.from({length:32},(_,i)=>stores[i%2].claimOnce(k,until)));
  assert.equal(result.filter(x=>x.status==='fulfilled'&&x.value===true).length,1);
  assert.equal(result.filter(x=>x.status==='fulfilled'&&x.value===false).length,31);
  assert.equal(result.filter(x=>x.status==='rejected').length,0);
  const count=await pool.query("SELECT COUNT(*)::int AS n FROM tien404_action_private.action_nonce_claims WHERE nonce_key_hash=decode($1,'hex')",[k]);
  assert.equal(count.rows[0].n,1);
  evidence.multipleConnectionsUniqueNonce=true;
  evidence.tests.push('32_CONCURRENT_CONNECTIONS_EXACTLY_ONE_CLAIM');
 }finally{await Promise.all([a.end(),b.end()])}
});
test('03 connection pool close/open still rejects consumed nonce',async()=>{
 const a=new Pool(config()),k=hash(),until=expiry();
 assert.equal(await makeStore(a).claimOnce(k,until),true);
 await a.end();
 const b=new Pool(config());
 try{assert.equal(await makeStore(b).claimOnce(k,until),false)}
 finally{await b.end()}
 evidence.poolReconnectReplayDenied=true;evidence.tests.push('CONNECTION_REOPEN_REPLAY_DENIED_NOT_DB_RESTART');
});
test('04 malformed/expired nonce cannot reach SQL; DB error fails CLOSED',async()=>{
 const s=pgStore.createPgNonceStore({query:async()=>{throw Error('SHOULD_NOT_QUERY')}});
 await assert.rejects(()=>s.claimOnce('malformed/'+hash(),expiry()),/NONCE_CLAIM_INVALID/);
 await assert.rejects(()=>s.claimOnce(hash(),Date.now()-20),/NONCE_RETENTION_INVALID/);
 const off=pgStore.createPgNonceStore({query:async()=>{throw Error('PG_DISCONNECTED')}});
 await assert.rejects(()=>off.claimOnce(hash(),expiry()),/PG_DISCONNECTED/);
 evidence.tests.push('BAD_NONCE_AND_DB_ERROR_FAIL_CLOSED');
});
const pair=crypto.generateKeyPairSync('ed25519');
const issuer='https://synthetic.qa.invalid/auth/v1';
const scopeA={tenant_id:'qa_tenant_1',store_id:'qa_shop_a',channel:'MESSENGER'};
const scopeB={tenant_id:'qa_tenant_1',store_id:'qa_shop_b',channel:'MESSENGER'};
function jwt(extra={}){
 const head=Buffer.from(JSON.stringify({alg:'EdDSA',kid:'qa-only'})).toString('base64url');
 const claims={iss:issuer,aud:'authenticated',role:'authenticated',is_anonymous:false,
  sub:'qa_owner_a',session_id:'qa_session_a',exp:Math.floor(Date.now()/1000)+600,...extra};
 const body=Buffer.from(JSON.stringify(claims)).toString('base64url');
 const data=head+'.'+body;
 return data+'.'+crypto.sign(null,Buffer.from(data),pair.privateKey).toString('base64url');
}
function verifyJwt(token){
 const parts=token.split('.');
 if(parts.length!==3)throw Error('QA_JWT_MALFORMED');
 const head=JSON.parse(Buffer.from(parts[0],'base64url').toString());
 if(head.alg!=='EdDSA'||head.kid!=='qa-only')throw Error('QA_ALG_DENIED');
 if(!crypto.verify(null,Buffer.from(parts[0]+'.'+parts[1]),pair.publicKey,Buffer.from(parts[2],'base64url')))
  throw Error('QA_SIGNATURE_DENIED');
 return JSON.parse(Buffer.from(parts[1],'base64url').toString());
}
function idFixture(){
 let member=true,session=true;
 const connector=identity.createIdentityConnector({
  verifyJwt:async t=>verifyJwt(t),
  lookupActiveSession:async o=>session&&o.user_id==='qa_owner_a'&&o.session_id==='qa_session_a',
  lookupStoreMembership:async o=>member&&o.user_id==='qa_owner_a'&&o.tenant_id==='qa_tenant_1'&&o.store_id==='qa_shop_a'?
   {user_id:o.user_id,tenant_id:o.tenant_id,store_id:o.store_id,status:'active',role:'owner'}:null,
  verifyWebhook:async()=>{throw Error('WEBHOOK_NOT_INCLUDED_IN_THIS_QA')},
  lookupChannelBinding:async()=>null,lookupConsent:async()=>null,recheckConsent:async()=>false,
  expectedIssuer:issuer,clock:Date.now
 });
 return {connector,setMember:x=>{member=x},setSession:x=>{session=x}};
}
const request=(token=jwt(),target=scopeA)=>({mode:'OWNER_JWT',accessToken:token,target});
function makeGateway(p,id,secret){
 return gateway.createCanonicalGateway({
  mode:'SYNTHETIC_NO_SEND',identity:id,
  nonceStore:makeStore(p),keyRing:{qa:secret},activeKid:'qa',clock:Date.now
 });
}
test('05 synthetic Ed25519-verified Owner JWT + two gateways share real PG nonce',async()=>{
 const a=new Pool(config()),b=new Pool(config()),id=idFixture(),secret=crypto.randomBytes(32);
 try{
  const ga=makeGateway(a,id.connector,secret),gb=makeGateway(b,id.connector,secret);
  const rq=request(),issued=await ga.issuePreview({request:rq,action:'QUOTE',resource_ref:'qa:A001'});
  const outcome=await Promise.allSettled([
   ga.verifyPreview({token:issued.receipt.token,request:rq}),
   gb.verifyPreview({token:issued.receipt.token,request:rq})
  ]);
  assert.equal(outcome.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcome.filter(x=>x.status==='rejected').length,1);
  assert.match(outcome.find(x=>x.status==='rejected').reason.message,/ACTION_REPLAY/);
  assert.equal(outcome.find(x=>x.status==='fulfilled').value.actionExecutable,false);
  evidence.syntheticSignedJwtScopeChecked=true;
  evidence.tests.push('TWO_INSTANCES_REAL_PG_WITH_SYNTHETIC_CRYPTO_JWT_ONE_CONSUME');
 }finally{await Promise.all([a.end(),b.end()])}
});
test('06 Shop B same tenant cannot steal Shop A receipt',async()=>{
 const id=idFixture(),g=makeGateway(pool,id.connector,crypto.randomBytes(32));
 const rq=request(),issued=await g.issuePreview({request:rq,action:'QUOTE'});
 await assert.rejects(()=>g.verifyPreview({request:request(jwt(),scopeB),token:issued.receipt.token}),
 /STORE_OWNER_MEMBERSHIP_NOT_VERIFIED/);
 assert.equal((await g.verifyPreview({request:rq,token:issued.receipt.token})).nonceClaimed,true);
 evidence.tests.push('CROSS_STORE_AUTHENTICATION_FAILS_BEFORE_NONCE');
});
test('07 tampered JWT, revoked session & revoked membership denied',async()=>{
 const id=idFixture(),g=makeGateway(pool,id.connector,crypto.randomBytes(32));
 const rq=request(),issued=await g.issuePreview({request:rq,action:'QUOTE'});
 const token=jwt().split('.');
 const p=JSON.parse(Buffer.from(token[1],'base64url').toString());
 p.sub='qa_owner_b';token[1]=Buffer.from(JSON.stringify(p)).toString('base64url');
 await assert.rejects(()=>g.verifyPreview({request:request(token.join('.')),token:issued.receipt.token}),
 /QA_SIGNATURE_DENIED/);
 id.setMember(false);
 await assert.rejects(()=>g.verifyPreview({request:rq,token:issued.receipt.token}),
 /STORE_OWNER_MEMBERSHIP_NOT_VERIFIED/);
 id.setMember(true);id.setSession(false);
 await assert.rejects(()=>g.verifyPreview({request:rq,token:issued.receipt.token}),/SESSION_INACTIVE/);
 id.setSession(true);
 assert.equal((await g.verifyPreview({request:rq,token:issued.receipt.token})).nonceClaimed,true);
 evidence.tests.push('JWT_TAMPER_AND_REVOKED_SESSION_MEMBERSHIP');
});
async function transactionQa(p,k,event,{abort=false}={}){
 const client=await p.connect();
 try{
  await client.query('BEGIN');
  const s=pgStore.createPgNonceStore({query:(sql,vals)=>client.query(sql,vals)});
  const won=await s.claimOnce(k,expiry());
  if(!won){await client.query('ROLLBACK');return false}
  await client.query("INSERT INTO tien404_action_private.qa_business_effects (event_id,nonce_key_hash) VALUES ($1,decode($2,'hex'))",[event,k]);
  if(abort)throw Error('QA_SIMULATED_ABORT_BEFORE_COMMIT');
  await client.query('COMMIT');return true;
 }catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
test('08 12 concurrent claims+QA effects in SAME PG transaction commit once',async()=>{
 const second=new Pool(config()),k=hash(),event='qa_evt_'+crypto.randomBytes(8).toString('hex');
 try{
  const outcomes=await Promise.allSettled(Array.from({length:12},(_,i)=>
   transactionQa(i%2?second:pool,k,event)));
  assert.equal(outcomes.filter(x=>x.status==='fulfilled'&&x.value===true).length,1);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled'&&x.value===false).length,11);
  assert.equal(outcomes.filter(x=>x.status==='rejected').length,0);
  const rows=await pool.query('SELECT COUNT(*)::int AS n FROM tien404_action_private.qa_business_effects WHERE event_id=$1',[event]);
  assert.equal(rows.rows[0].n,1);
  evidence.qaTransactionalWriteAtomic=true;
  evidence.tests.push('SYNTHETIC_QA_EFFECT_IN_SAME_PG_TRANSACTION_12_WORKERS');
 }finally{await second.end()}
});
test('09 rollback after nonce + QA event restores both, retry commits',async()=>{
 const k=hash(),event='qa_rb_'+crypto.randomBytes(8).toString('hex');
 await assert.rejects(()=>transactionQa(pool,k,event,{abort:true}),/QA_SIMULATED_ABORT/);
 const q=await pool.query("SELECT count(*)::int AS n FROM tien404_action_private.action_nonce_claims WHERE nonce_key_hash=decode($1,'hex')",[k]);
 assert.equal(q.rows[0].n,0);
 assert.equal(await transactionQa(pool,k,event),true);
 assert.equal(await transactionQa(pool,k,event),false);
 evidence.rollbackAfterFailureVerified=true;
 evidence.tests.push('TX_ROLLBACK_SIMULATED_ABORT_AND_RETRY');
});
test('10 real Commerce, provider dispatch and production remain locked',async()=>{
 const id=idFixture(),g=makeGateway(pool,id.connector,crypto.randomBytes(32));
 assert.equal(g.canSend,false);assert.equal(g.canExecute,false);assert.equal(g.canPublish,false);
 assert.throws(()=>g.execute(),/BUSINESS_EXECUTION_DISABLED/);
 assert.throws(()=>g.send(),/PROVIDER_SEND_DISABLED/);
 assert.equal(evidence.hostedOwnerJwtRlsCertified,false);
 assert.equal(evidence.realCommerceTransactionCertified,false);
 evidence.tests.push('NO_REAL_COMMERCE_PROVIDER_OR_HOSTED_AUTH');
});
