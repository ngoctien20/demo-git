'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildHostedEvidencePack,REQUIRED,DENY}=require('./hosted-evidence-pack.cjs');
const snapshot=require('./read-only-hosted-evidence.snapshot.json');
const build=(data=snapshot)=>buildHostedEvidencePack({
 mode:'READ_ONLY_EVIDENCE_REVIEW',snapshot:data
});
test('default gate rejects execution, even when genuine snapshot supplied',()=>{
 assert.throws(()=>buildHostedEvidencePack({snapshot}),/M7_EVIDENCE_REVIEW_ONLY/);
});
test('hosted/prod mode is always unavailable',()=>{
 for(const mode of ['HOSTED', 'EXECUTE_MIGRATION', 'PRODUCTION_SEND']){
  assert.throws(()=>buildHostedEvidencePack({mode,snapshot}),/M7_EVIDENCE_REVIEW_ONLY/);
 }
});
test('current connector-snapshot documents missing five canonical dependencies',()=>{
 const a=build();
 assert.equal(a.status,'HOSTED_GATE_BLOCKED');
 for(const k of ['store_schema','catalog_store_id','private_page_binding','private_event_schema']){
  assert.ok(a.blocked.includes(k));
  assert.equal(a.gates.find(x=>x.key===k).state,'MISSING');
 }
});
test('unknown backup, restore, owner mapping and JWT are NOT falsely marked absent',()=>{
 const a=build();
 for(const k of ['restorable_backup','restore_drill','owner_backfill_mapping',
  'same_tenant_two_store_jwt','restricted_no_bypass_rls_role']){
  assert.equal(a.gates.find(x=>x.key===k).state,'NOT_VERIFIED');
 }
});
test('even all schema booleans true cannot unlock migration or provider send',()=>{
 const optimistic=JSON.parse(JSON.stringify(snapshot));
 optimistic.supabase.schema.stores=true;
 optimistic.supabase.schema.storeMemberships=true;
 optimistic.supabase.schema.privatePageBinding=true;
 optimistic.supabase.schema.privateEventClaims=true;
 const a=build(optimistic);
 for(const [key,value] of Object.entries(DENY)){
  assert.equal(a[key],false,key);
 }
 assert.equal(a.evidenceAcceptedForMigration,false);
 assert.ok(a.blocked.includes('restorable_backup'));
});
test('invalid or user-declared snapshot cannot authorize migration',()=>{
 const f={...snapshot,source:'UNTRUSTED_AI_ASSERTION'};
 assert.throws(()=>build(f),/M7_SNAPSHOT_INVALID/);
});
test('missing evidence fields always blocked instead of inferred',()=>{
 for(const key of ['supabase','github','n8n']){
  const x={...snapshot,[key]:undefined};
  assert.throws(()=>build(x),/M7_SNAPSHOT_INVALID/);
 }
});
test('snapshot records PostgreSQL 17.11 and unchanged Messenger version',()=>{
 const a=build();
 assert.equal(a.postgresVersion,'17.11');
 assert.equal(a.publishedN8nUnchangedVerified,true);
 assert.equal(a.githubParentPr,93);
});
test('evidence pack deliberately exports no raw credentials or people data',()=>{
 const a=build(),json=JSON.stringify(a);
 assert.doesNotMatch(json,/access_token|JWT_SECRET|customer_phone|postgres_password|sb_secret_/i);
 assert.ok(a.blocked.length>5);
});
test('all named requirement gates have unique identifiers',()=>{
 assert.equal(new Set(REQUIRED).size,REQUIRED.length);
 assert.equal(REQUIRED.length,17);
});
test('Supabase backups are UNKNOWN; no backup artifact or restore test invented',()=>{
 assert.equal(snapshot.supabase.backupArtifactVerified,null);
 assert.equal(snapshot.supabase.restorableBackupVerified,null);
 assert.equal(snapshot.supabase.restoreRehearsalVerified,null);
});
test('existing Security Definer advisor findings remain separate review blockers',()=>{
 const a=snapshot.supabase.securityAdvisors;
 assert.equal(a.anonSecurityDefinerWarn,1);
 assert.equal(a.authenticatedSecurityDefinerWarn,2);
 assert.equal(a.rlsEnabledNoPolicyInfo,18);
});
test('ephemeral database guard explicitly precedes any DDL',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'EPHEMERAL_CI_POSTGRES_ONLY.sql'),'utf8');
 const check=sql.indexOf("current_database() <> 'tien404_replay_ci'");
 const firstDDL=sql.indexOf('CREATE SCHEMA');
 assert.ok(check>0&&firstDDL>check);
 assert.match(sql,/FORCE ROW LEVEL SECURITY/);
 assert.match(sql,/NOBYPASSRLS/);
 assert.match(sql,/UNIQUE\(tenant_id,store_id,page_id,canonical_event_digest\)/);
});
test('script refuses all databases except disposable CI database',()=>{
 const src=fs.readFileSync(path.join(__dirname,'ci-ephemeral-postgres-atomic.sh'),'utf8');
 assert.match(src,/PGDATABASE.*tien404_replay_ci/);
 assert.match(src,/TIEN404_M7_EPHEMERAL_ONLY/);
 assert.match(src,/seq 1 32/);
 assert.match(src,/connection lost before COMMIT/i);
});
test('canonical digest is independent from rotating HMAC sender/event hashes',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'EPHEMERAL_CI_POSTGRES_ONLY.sql'),'utf8');
 assert.match(sql,/canonical_event_digest char\(64\)/);
 assert.match(sql,/key_version text/);
 assert.match(sql,/sender_hash char\(64\)/);
 const key=sql.match(/CONSTRAINT ci_unique_canonical_replay[\s\S]+?UNIQUE\(([^)]+)\)/);
 assert.ok(key);
 assert.ok(!key[1].includes('sender_hash')&&!key[1].includes('event_hash'));
});
test('actual hosted Store RLS/JWT remains unverified after ephemeral SQL',()=>{
 const a=build();assert.equal(a.hostedReplayReady,false);
 assert.ok(a.blocked.includes('same_tenant_two_store_jwt'));
 assert.ok(a.blocked.includes('store_rls'));
});
