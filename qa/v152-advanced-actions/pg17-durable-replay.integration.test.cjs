'use strict';
/**
 * TIEN404 V15.2-ADV.6B — REAL PostgreSQL 17, EPHEMERAL CI ONLY.
 *
 * Never point this file at hosted Supabase. It refuses any non-loopback host,
 * any database not named t404_adv6b_ci, and any run without explicit CI flag.
 * The schema draft is applied solely inside the disposable GitHub Actions
 * postgres:17 service and never to the user's staging/production database.
 *
 * This proves atomic nonce claims, role permissions and reconnection on a
 * disposable PG17 instance. It does NOT certify hosted auth, backup, PITR,
 * PostgreSQL failover, exactly-once Commerce writes or multi-region delivery.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {Pool}=require('pg');
const {createPgNonceStore}=require('./pg-nonce-store.cjs');

const host=process.env.PGHOST;
const database=process.env.PGDATABASE;
const enabled=process.env.CI==='true'&&process.env.T404_PG_CI_ONLY==='1'&&
  ['localhost','127.0.0.1'].includes(host)&&database==='t404_adv6b_ci'&&
  process.env.PGUSER==='postgres';
if(!enabled)throw Error('ADV6B_PG_TEST_REFUSES_HOSTED_OR_LOCAL_WITHOUT_CI_FLAG');

const creds={
  host,port:Number(process.env.PGPORT||5432),database,
  user:'postgres',password:process.env.PGPASSWORD,
  max:20,connectionTimeoutMillis:5000
};
let pool,otherPool;
const table='tien404_action_private.action_nonce_claims';
const nonce=()=>crypto.randomBytes(32).toString('hex');
const restricted=clientPool=>async(sql,values)=>{
  const client=await clientPool.connect();
  try{
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE t404_action_claim_ci');
    const result=await client.query(sql,values);
    await client.query('COMMIT');
    return result;
  }catch(e){
    try{await client.query('ROLLBACK')}catch{}
    throw e;
  }finally{client.release()}
};
test.before(async()=>{
  if(!creds.password)throw Error('CI_POSTGRES_PASSWORD_REQUIRED');
  pool=new Pool(creds);
  const admin=await pool.connect();
  try{
    const db=await admin.query('select current_database() as db,version() as version');
    assert.equal(db.rows[0].db,'t404_adv6b_ci');
    assert.match(db.rows[0].version,/PostgreSQL 17\./);
    // CI-only placeholder roles; not real Supabase roles and never deployed.
    for(const name of ['anon','authenticated','service_role','t404_action_claim_ci']){
      await admin.query('CREATE ROLE '+name+' NOLOGIN');
    }
    const draft=fs.readFileSync(path.join(__dirname,'../../docs/ai-handoff',
      'V15_2_ADV6_PRIVATE_NONCE_SQL_DRAFT_DO_NOT_APPLY.sql'),'utf8');
    assert.match(draft,/DO NOT APPLY/);
    await admin.query(draft);
    // Synthetic role approval matrix on CI only; SQL draft itself has NO GRANT.
    await admin.query('GRANT USAGE ON SCHEMA tien404_action_private TO t404_action_claim_ci');
    await admin.query('GRANT INSERT ON TABLE '+table+' TO t404_action_claim_ci');
    await admin.query('GRANT SELECT(nonce_key_hash) ON '+table+' TO t404_action_claim_ci');
    await admin.query(
      'CREATE POLICY action_ci_insert ON '+table+
      ' FOR INSERT TO t404_action_claim_ci WITH CHECK (true)');
    await admin.query(
      'CREATE POLICY action_ci_select ON '+table+
      ' FOR SELECT TO t404_action_claim_ci USING (true)');
  }finally{admin.release()}
  otherPool=new Pool({...creds,max:20});
});
test.after(async()=>{
  if(otherPool)await otherPool.end();
  if(pool)await pool.end();
});

test('PG17 verified; private schema hidden from anon/auth/service roles',async()=>{
  const c=await pool.connect();
  try{
    for(const role of ['anon','authenticated','service_role']){
      const r=await c.query(
        'select has_schema_privilege($1,$2,\'USAGE\') as can_use, '+
        'has_table_privilege($1,$3,\'INSERT\') as can_insert',
        [role,'tien404_action_private',table]);
      assert.deepEqual(r.rows[0],{can_use:false,can_insert:false},role);
    }
    const matrix=await c.query(
      "select has_schema_privilege('t404_action_claim_ci','tien404_action_private','USAGE') use_ok,"+
      " has_table_privilege('t404_action_claim_ci',$1,'INSERT') insert_ok,"+
      " has_table_privilege('t404_action_claim_ci',$1,'UPDATE') update_ok,"+
      " has_table_privilege('t404_action_claim_ci',$1,'DELETE') delete_ok",
      [table]);
    assert.equal(matrix.rows[0].use_ok,true);
    assert.equal(matrix.rows[0].insert_ok,true);
    assert.equal(matrix.rows[0].update_ok,false);
    assert.equal(matrix.rows[0].delete_ok,false);
    const options=await c.query("select relrowsecurity,relforcerowsecurity from pg_class where oid=$1::regclass",[table]);
    assert.equal(options.rows[0].relrowsecurity,true);
  }finally{c.release()}
});

test('atomic ON CONFLICT: two independent pools and 32 concurrent claims -> exactly one success',async()=>{
  const key=nonce(),expiry=Date.now()+5*60*1000;
  const s1=createPgNonceStore({query:restricted(pool)});
  const s2=createPgNonceStore({query:restricted(otherPool)});
  const claims=await Promise.all(Array.from({length:32},(_,i)=>
    (i%2===0?s1:s2).claimOnce(key,expiry)));
  assert.equal(claims.filter(Boolean).length,1);
  assert.equal(claims.filter(x=>x===false).length,31);
  const r=await pool.query('select count(*)::int as n from '+table+' where nonce_key_hash=decode($1,\'hex\')',[key]);
  assert.equal(r.rows[0].n,1);
});

test('committed nonce remains claimed after closing and reopening a PG pool',async()=>{
  const key=nonce(),expiry=Date.now()+2*60*1000;
  const temporary=new Pool({...creds,max:2});
  assert.equal(await createPgNonceStore({query:restricted(temporary)}).claimOnce(key,expiry),true);
  await temporary.end();
  const reopened=new Pool({...creds,max:2});
  try{
    assert.equal(await createPgNonceStore({query:restricted(reopened)}).claimOnce(key,expiry),false);
  }finally{await reopened.end()}
});

test('expired token at real database clock is never claimed despite stale local clock',async()=>{
  const expired=Date.now()-1200;
  const artificiallyStale=Date.now()-90*1000;
  const store=createPgNonceStore({
    query:restricted(pool),clock:()=>artificiallyStale
  });
  assert.equal(await store.claimOnce(nonce(),expired),false);
});

test('anon cannot insert nonce; internal role cannot delete or update',async()=>{
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE anon');
    await assert.rejects(()=>c.query(
      'INSERT INTO '+table+'(nonce_key_hash,retain_until) VALUES (decode($1,\'hex\'),now()+interval \'10 minutes\')',
      [nonce()]),/permission denied/);
    await c.query('ROLLBACK');
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE t404_action_claim_ci');
    await assert.rejects(()=>c.query(
      'DELETE FROM '+table+' WHERE false'),/permission denied/);
    await c.query('ROLLBACK');
  }finally{c.release()}
});

test('nonce claims are hashes only; no direct customer identifiers or raw provider tokens',async()=>{
  const c=await pool.connect();
  try{
    const cols=await c.query(
      "select column_name from information_schema.columns where table_schema='tien404_action_private' and table_name='action_nonce_claims'");
    assert.deepEqual(cols.rows.map(x=>x.column_name).sort(),
      ['claimed_at','nonce_key_hash','retain_until']);
  }finally{c.release()}
});