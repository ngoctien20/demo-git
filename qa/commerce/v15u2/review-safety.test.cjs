'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,mkdtempSync,rmSync,existsSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=__dirname,read=x=>readFileSync(join(root,x),'utf8');
const files=['01_MAPPING_SCHEMA_REVIEW_ONLY.sql','02_READER_POLICY_REVIEW_ONLY.sql','03_ROLLBACK_REVIEW_ONLY.sql'];
const guard=[
'REVIEW_ONLY_V15_0_10U1_NO_APPROVED_MIGRATION','REVIEW_ONLY_NO_APPROVED_JWT_ROLE_BRIDGE','REVIEW_ONLY_ROLLBACK_NOT_APPROVED'];
const base='/mnt/data/tien404_v15_0_10u_1';
const src='00_LEGACY_SYNTHETIC_FIXTURE.sql',data='04_V2_SYNTHETIC_FIXTURE.sql',judge='05_DISPOSABLE_ASSERTIONS.sql',rollback='06_ROLLBACK_ASSERTIONS.sql';
const workflow=existsSync(join(root,'../../../.github/workflows/v15u2-pg17-disposable.yml'))?'../../../.github/workflows/v15u2-pg17-disposable.yml':'v15u2-pg17-disposable.yml';
for(let i=0;i<files.length;i++){
 const f=files[i],s=read(f);
 test('canonical '+f+' has intact unconditional guard',()=>{
  assert(s.includes(`DO $$ BEGIN RAISE EXCEPTION '${guard[i]}'; END $$;`));
  assert(s.indexOf(`RAISE EXCEPTION '${guard[i]}'`) < s.indexOf(i===0?'CREATE TABLE':i===1?'CREATE ROLE':'DROP POLICY'));
  assert.equal((s.match(/^BEGIN;/gm)||[]).length,1);
  assert.equal((s.match(/^COMMIT;/gm)||[]).length,1);
 });
 test('canonical '+f+' leaves legacy v1/products/orders alone',()=>{
  assert(!/^(?:ALTER|DROP|TRUNCATE)\s+TABLE\s+(?:IF EXISTS\s+)?tien404_r1_qa\.tenant_identity_map\b/im.test(s));
  assert(!/^(?:DROP|UPDATE|TRUNCATE|DELETE|ALTER)\s+(?:TABLE\s+)?public\.(?:products|orders)\b/im.test(s));
  assert(!/\bGRANT\s+(?:SELECT|ALL)[\s\S]{0,160}\sTO\s+(?:anon|authenticated|PUBLIC|service_role)\b/i.test(s));
 });
 test('canonical '+f+' contains no direct privileged function change',()=>{
  assert(!/^(?:CREATE\s+OR\s+REPLACE|DROP|ALTER)\s+FUNCTION/im.test(s));
 });
}
test('legacy fixture source contains 2 v1 tenants and Owner analogs labeled synthetic',()=>{
 const a=read(src);assert(a.includes('Synthetic v1 Owner function analogs'));
 assert(a.includes('PRIMARY KEY (tenant_key,store_key,bot_key)'));
 assert(a.includes('auth_tenant_id uuid NOT NULL UNIQUE'));
 assert(a.includes('SECURITY DEFINER'));assert(a.includes('RETURNS jsonb LANGUAGE plpgsql VOLATILE')); 
 assert(a.includes('CREATE TABLE tien404_r1_qa.tenant_identity_map'));
 assert(a.includes('CREATE FUNCTION public.qa_owner_pairing'));
 assert(a.includes('CREATE FUNCTION tien404_r1_qa.owner_authorized_qa'));
});
test('same tenant two store rows plus distinct SKU prices',()=>{
 const a=read(src),b=read(data);
 for(const v of ["'qa-store-a'","'qa-store-a2'","'qa-tenant-a'","'qa-bot-a2'",'159000','179000','199000'])assert(a.includes(v));
 for(const v of ['tenant_authorities_v2','stores_v2','store_bot_identity_map_v2','store_reader_memberships_v2'])assert(b.includes(v));
 assert(b.includes("'qa-tenant-a','qa-store-a2'"));
});
test('DB assertion scripts are transactional or read-only; no hosted SQL reachability',()=>{
 const a=read(judge),b=read(rollback);
 assert(a.includes('READER_A_CROSS_STORE_VISIBLE')&&a.includes('READER_A2_CROSS_STORE_VISIBLE'));
 assert(a.includes('REVOKED_MEMBERSHIP_VISIBLE')&&a.includes('EXPIRED_BOT_VISIBLE'));
 assert(a.includes('NO_SUBJECT_VISIBLE')&&a.includes('UNKNOWN_READER_VISIBLE'));
 assert(b.includes('V2_OBJECTS_REMAIN_AFTER_ROLLBACK'));
 assert(b.includes('LEGACY_V1_NOT_PRESERVED'));
 assert(!/https?:\/\//i.test(a+b));
});
test('disposable runner hard-blocks any nonlocal DB host and nonexact database',()=>{
 const s=read('run_pg17_disposable.sh');
 assert(s.includes("!= '127.0.0.1'"));
 assert(s.includes("!= 'tien404_v15u2_disposable'"));
 assert(s.includes("'ONE_TIME_APPROVED_ONLY'"));
 assert(s.includes('BLOCKED_NONEMPTY_TARGET'));
 assert(s.includes('BLOCKED_REQUIRE_PG17_DISPOSABLE'));
 assert(!/supabase\.co|postgres:\/\//i.test(s));
});
test('review guard unlock refuses unapproved environment and never overwrites inputs',()=>{
 const temp=mkdtempSync(join(tmpdir(),'t404-u2-'));const target=join(temp,'candidate.sql');
 try{
  let p=spawnSync('python3',[join(root,'guarded_unlock_disposable.py'),join(root,files[0]),target],{env:{...process.env,TIEN404_PG17_DISPOSABLE_QA:'NO',PGHOST:'127.0.0.1',PGDATABASE:'tien404_v15u2_disposable'},encoding:'utf8'});
  assert.notEqual(p.status,0);assert(!existsSync(target));
  p=spawnSync('python3',[join(root,'guarded_unlock_disposable.py'),join(root,files[0]),target],{env:{...process.env,TIEN404_PG17_DISPOSABLE_QA:'ONE_TIME_APPROVED_ONLY',PGHOST:'db.staging.local',PGDATABASE:'tien404_v15u2_disposable'},encoding:'utf8'});
  assert.notEqual(p.status,0);assert(!existsSync(target));
  p=spawnSync('python3',[join(root,'guarded_unlock_disposable.py'),join(root,files[0]),target],{env:{...process.env,TIEN404_PG17_DISPOSABLE_QA:'ONE_TIME_APPROVED_ONLY',PGHOST:'127.0.0.1',PGDATABASE:'tien404_v15u2_disposable'},encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);assert(existsSync(target));
  assert(!readFileSync(target,'utf8').includes("RAISE EXCEPTION 'REVIEW_ONLY_V15_0_10U1_NO_APPROVED_MIGRATION'"));
  assert(read(files[0]).includes("RAISE EXCEPTION 'REVIEW_ONLY_V15_0_10U1_NO_APPROVED_MIGRATION'"));
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('workflow only draft PR and PostgreSQL 17 disposable service',()=>{
 const w=read(workflow);assert(w.includes('pull_request:'));
 assert(w.includes('branches: [main]'));
 assert(w.includes('github.event.pull_request.draft == true'));
 assert(w.includes('image: postgres:17'));
 assert(w.includes('persist-credentials: false'));
 assert(w.includes('permissions:\n  contents: read'));
 assert(!/secrets\.|SUPABASE|service_role/i.test(w));
 assert(!w.includes('push:')&&!w.includes('workflow_dispatch:'));
});
test('original review scripts are unchanged from checkpoint',()=>{
 // If archived source is available locally, assert exact byte identity.
 const {existsSync}=require('node:fs');
 if(!existsSync(base))return;
 for(const f of files)assert.equal(createHash('sha256').update(read(f)).digest('hex'),createHash('sha256').update(readFileSync(join(base,f))).digest('hex'));
});