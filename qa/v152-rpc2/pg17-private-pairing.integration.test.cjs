'use strict';
/*
 * RPC.2 REAL PostgreSQL 17 INTEGRATION QA — DISPOSABLE CI ONLY.
 * No API keys, customer data, provider sends, real Supabase connections,
 * postgres host writes, data export or credentials shared outside synthetic CI.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {Pool}=require('pg');
const h=process.env.PGHOST;
if(process.env.CI!=='true'||process.env.T404_RPC2_DISPOSABLE_PG!=='1'||
 !['127.0.0.1','localhost'].includes(h)||process.env.PGDATABASE!=='t404_rpc2_ci'||
 process.env.PGUSER!=='postgres')
 throw Error('RPC2_REFUSES_HOSTED_OR_UNAPPROVED_DATABASE');
const cfg={host:h,port:Number(process.env.PGPORT||5432),
 database:'t404_rpc2_ci',user:'postgres',password:process.env.PGPASSWORD,
 connectionTimeoutMillis:5000,max:30};
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const newHash=()=>digest(crypto.randomBytes(32));
let pool,secondary;
const claimSql='SELECT t404_rpc2_ci.claim_owner_pairing_ci($1,$2,$3,$4,$5,$6,$7) as ok';
const confirmSql='SELECT t404_rpc2_ci.confirm_owner_pairing_ci($1,$2,$3,$4,$5) as ok';
async function scoped(role,query,args=[],src=pool){
 const client=await src.connect();
 try{
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE '+role);
  const result=await client.query(query,args);
  await client.query('COMMIT');
  return result;
 }catch(e){try{await client.query('ROLLBACK')}catch{}
  throw e;}finally{client.release()}
}
async function fixture({tenant='tenant-qa',store='store-a',bot='bot-a',
  valid=true,ownerHash=newHash(),recipient=newHash(),
  eventHash=newHash(),code='candidate-qa-secret-1',
  expiresInMs=300000}={}){
 const challenge=crypto.randomUUID();
 await pool.query('INSERT INTO t404_rpc2_ci.shop_bots VALUES ($1,$2,$3,$4) ON CONFLICT(tenant_key,store_key,bot_key) DO UPDATE SET active=excluded.active',[tenant,store,bot,valid]);
 await pool.query('INSERT INTO t404_rpc2_ci.owner_memberships VALUES ($1,$2,$3,true) ON CONFLICT(tenant_key,store_key,owner_hash) DO UPDATE SET active=true',[tenant,store,ownerHash]);
 await pool.query('INSERT INTO t404_rpc2_ci.challenges(challenge_id,tenant_key,store_key,bot_key,owner_hash,recipient_hash,code_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,public.digest($7,$8),clock_timestamp()+($9::text||$10)::interval)',
 [challenge,tenant,store,bot,ownerHash,recipient,code,'sha256',String(expiresInMs),' milliseconds']);
 return {tenant,store,bot,ownerHash,recipient,eventHash,code,challenge,
  claim:[tenant,store,bot,challenge,recipient,eventHash,code],
  confirm:[tenant,store,bot,challenge,ownerHash]};
}
test.before(async()=>{
 if(!cfg.password)throw Error('PG_PASSWORD_REQUIRED_ONLY_IN_DISPOSABLE_CI');
 pool=new Pool(cfg);
 const v=await pool.query('select current_database() db,version() ver');
 assert.equal(v.rows[0].db,'t404_rpc2_ci');
 assert.match(v.rows[0].ver,/PostgreSQL 17\./);
 for(const role of ['anon','authenticated','service_role',
   't404_pairing_writer_ci','t404_pairing_claim_ci','t404_pairing_confirm_ci']){
  await pool.query('CREATE ROLE '+role+' NOLOGIN NOBYPASSRLS');
 }
 const ddl=fs.readFileSync(path.join(__dirname,'ci-private-pairing-fixture.sql'),'utf8');
 assert.match(ddl,/disposable/i);
 assert.match(ddl,/NEVER APPLY TO HOSTED/);
 await pool.query(ddl);
 secondary=new Pool(cfg);
});
test.after(async()=>{if(secondary)await secondary.end();if(pool)await pool.end()});
test('01 PostgreSQL 17 private schema, no public or direct table role grants',async()=>{
 for(const role of ['anon','authenticated','service_role']){
  const r=await pool.query("select has_schema_privilege($1,$2,'USAGE') schema_use, has_function_privilege($1,$3,'EXECUTE') can_claim,has_function_privilege($1,$4,'EXECUTE') can_confirm",
  [role,'t404_rpc2_ci','t404_rpc2_ci.claim_owner_pairing_ci(text,text,text,uuid,text,text,text)',
   't404_rpc2_ci.confirm_owner_pairing_ci(text,text,text,uuid,text)']);
  assert.deepEqual(r.rows[0],{schema_use:false,can_claim:false,can_confirm:false});
 }
 const priv=await pool.query("select rolname,rolbypassrls from pg_roles where rolname in ('t404_pairing_writer_ci','t404_pairing_claim_ci','t404_pairing_confirm_ci') order by rolname");
 assert.equal(priv.rows.length,3);assert(priv.rows.every(x=>x.rolbypassrls===false));
 const x=await pool.query("select p.prosecdef, r.rolname owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='t404_rpc2_ci' and p.proname='claim_owner_pairing_ci'");
 assert.equal(x.rows[0].prosecdef,true);
 assert.equal(x.rows[0].owner,'t404_pairing_writer_ci');
});
test('02 permitted CLAIM role can insert one pending claim but no real pairing',async()=>{
 const f=await fixture();const x=await scoped('t404_pairing_claim_ci',claimSql,f.claim);
 assert.equal(x.rows[0].ok,true);
 const claim=await pool.query('select status from t404_rpc2_ci.claims where challenge_id=$1',[f.challenge]);
 assert.equal(claim.rows[0].status,'pending');
 assert.equal((await pool.query('select count(*)::int n from t404_rpc2_ci.bindings')).rows[0].n,0);
});
test('03 two wrong Store/Tenant/Bot attempts blocked for identical challenge',async()=>{
 const f=await fixture();
 for(const bad of [
   ['tenant-other',f.store,f.bot,f.challenge,f.recipient,newHash(),f.code],
   [f.tenant,'store-b',f.bot,f.challenge,f.recipient,newHash(),f.code],
   [f.tenant,f.store,'bot-other',f.challenge,f.recipient,newHash(),f.code]
 ]){
  const x=await scoped('t404_pairing_claim_ci',claimSql,bad);
  assert.equal(x.rows[0].ok,false);
 }
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,f.claim)).rows[0].ok,true);
});
test('04 sender mismatch, wrong code and five failed attempts fail closed',async()=>{
 const f=await fixture();
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,
   [f.tenant,f.store,f.bot,f.challenge,newHash(),f.eventHash,f.code])).rows[0].ok,false);
 for(let i=0;i<5;i++){
   const x=await scoped('t404_pairing_claim_ci',claimSql,
     [f.tenant,f.store,f.bot,f.challenge,f.recipient,newHash(),'WRONG-CODE']);
   assert.equal(x.rows[0].ok,false);
 }
 const r=await pool.query('select failed_attempts from t404_rpc2_ci.challenges where challenge_id=$1',[f.challenge]);
 assert.equal(r.rows[0].failed_attempts,5);
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,f.claim)).rows[0].ok,false);
});
test('05 duplicate message cannot create more than one pending claim',async()=>{
 const f=await fixture();
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,f.claim)).rows[0].ok,true);
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,f.claim)).rows[0].ok,false);
 assert.equal((await pool.query('select count(*)::int n from t404_rpc2_ci.claims where challenge_id=$1',[f.challenge])).rows[0].n,1);
});
test('06 32 concurrent claims across two PG pools yield EXACTLY one pending row',async()=>{
 const f=await fixture();
 const results=await Promise.all(Array.from({length:32},(_,i)=>
   scoped('t404_pairing_claim_ci',claimSql,f.claim,i%2===0?pool:secondary)
     .then(r=>r.rows[0].ok)));
 assert.equal(results.filter(Boolean).length,1);
 assert.equal(results.filter(x=>!x).length,31);
});
test('07 GLOBAL event idempotency blocks reuse across Store A and Shop B',async()=>{
 const sharedEvent=newHash();
 const a=await fixture({tenant:'tenant-cross',store:'shop-a',bot:'bot-a',eventHash:sharedEvent});
 const b=await fixture({tenant:'tenant-cross',store:'shop-b',bot:'bot-b',eventHash:sharedEvent});
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,a.claim)).rows[0].ok,true);
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,b.claim)).rows[0].ok,false);
});
test('08 DB transaction ROLLBACK does not consume event/idempotency key',async()=>{
 const f=await fixture(),c=await pool.connect();
 try{
  await c.query('BEGIN');await c.query('SET LOCAL ROLE t404_pairing_claim_ci');
  const accepted=await c.query(claimSql,f.claim);assert.equal(accepted.rows[0].ok,true);
  await c.query('ROLLBACK');
 }finally{c.release()}
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,f.claim)).rows[0].ok,true);
});
test('09 only separate CONFIRM role + right owner hash may activate binding',async()=>{
 const f=await fixture();
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,f.claim)).rows[0].ok,true);
 assert.equal((await scoped('t404_pairing_confirm_ci',confirmSql,
  [f.tenant,f.store,f.bot,f.challenge,newHash()])).rows[0].ok,false);
 assert.equal((await scoped('t404_pairing_confirm_ci',confirmSql,f.confirm)).rows[0].ok,true);
 const b=await pool.query('select owner_hash,recipient_hash,status from t404_rpc2_ci.bindings where tenant_key=$1 and store_key=$2 and bot_key=$3',[f.tenant,f.store,f.bot]);
 assert.equal(b.rows.length,1);assert.equal(b.rows[0].owner_hash,f.ownerHash);
 assert.equal(b.rows[0].recipient_hash,f.recipient);assert.equal(b.rows[0].status,'active');
 assert.equal((await scoped('t404_pairing_confirm_ci',confirmSql,f.confirm)).rows[0].ok,false);
});
test('10 16 concurrent confirmations: only one successful binding',async()=>{
 const f=await fixture();
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,f.claim)).rows[0].ok,true);
 const results=await Promise.all(Array.from({length:16},(_,i)=>
  scoped('t404_pairing_confirm_ci',confirmSql,f.confirm,i%2===0?pool:secondary)
  .then(r=>r.rows[0].ok)));
 assert.equal(results.filter(Boolean).length,1);
 assert.equal(results.filter(x=>!x).length,15);
});
test('11 revoked owner membership fails confirmation without consuming claim',async()=>{
 const f=await fixture();
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,f.claim)).rows[0].ok,true);
 await pool.query('update t404_rpc2_ci.owner_memberships set active=false where tenant_key=$1 and store_key=$2 and owner_hash=$3',[f.tenant,f.store,f.ownerHash]);
 assert.equal((await scoped('t404_pairing_confirm_ci',confirmSql,f.confirm)).rows[0].ok,false);
 assert.equal((await pool.query('select status from t404_rpc2_ci.claims where challenge_id=$1',[f.challenge])).rows[0].status,'pending');
});
test('12 expired challenge and disabled bot fail without inserting claims',async()=>{
 const expired=await fixture({expiresInMs:-1000});
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,expired.claim)).rows[0].ok,false);
 const disabled=await fixture({store:'disabled-shop',bot:'disabled-bot',valid:false});
 assert.equal((await scoped('t404_pairing_claim_ci',claimSql,disabled.claim)).rows[0].ok,false);
});
test('13 runtime roles cannot directly read or modify private tables',async()=>{
 const f=await fixture();
 for(const role of ['t404_pairing_claim_ci','t404_pairing_confirm_ci','anon']){
  await assert.rejects(()=>scoped(role,
   'SELECT status FROM t404_rpc2_ci.claims WHERE challenge_id=$1',[f.challenge]),/permission denied/);
 }
});
test('14 cross-function privileges denied to claim-only and confirm-only roles',async()=>{
 const f=await fixture();
 await assert.rejects(()=>scoped('t404_pairing_confirm_ci',claimSql,f.claim),/permission denied/);
 await assert.rejects(()=>scoped('t404_pairing_claim_ci',confirmSql,f.confirm),/permission denied/);
});
test('15 store/owner/recipient fields contain only synthetic identifiers or hashes',async()=>{
 const f=await fixture();
 await scoped('t404_pairing_claim_ci',claimSql,f.claim);
 const cols=await pool.query("select column_name from information_schema.columns where table_schema='t404_rpc2_ci' and table_name='claims' order by ordinal_position");
 const c=cols.rows.map(x=>x.column_name);
 for(const bad of ['phone','access_token','raw_body','owner_email','zalo_token','api_secret'])
   assert(!c.includes(bad));
 assert(c.includes('event_hash'));assert(c.includes('recipient_hash'));
});
