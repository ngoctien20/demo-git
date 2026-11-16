'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const draft=fs.readFileSync(path.join(root,'docs/ai-handoff/V15_09_CANONICAL_STORE_EXPAND_REVIEW_ONLY.sql'),'utf8');
const audit=fs.readFileSync(path.join(root,'docs/ai-handoff/V15_09_HOSTED_READ_ONLY_PREFLIGHT.sql'),'utf8');
const nonComments=s=>s.split('\n').filter(x=>!x.trimStart().startsWith('--')).join('\n');
test('schema draft starts with fail-closed exception and ends rollback',()=>{
 assert.match(draft,/DO \$review_only\$ BEGIN\s+RAISE EXCEPTION /);
 assert.match(draft,/ROLLBACK;\s*$/);
});
test('new store hierarchy preserves tenant FK and composite ownership',()=>{
 assert.match(draft,/CREATE TABLE public\.stores/);
 assert.match(draft,/CREATE TABLE public\.store_memberships/);
 assert.match(draft,/FOREIGN KEY \(tenant_id,user_id\)\s+REFERENCES public\.tenant_memberships/);
 assert.match(draft,/UNIQUE\(tenant_id,id\)/);
});
test('new tables are RLS and FORCE RLS, without anonymous GRANT',()=>{
 for(const name of ['stores','store_memberships']){
  assert.match(draft,new RegExp('ALTER TABLE public\\.'+name+' ENABLE ROW LEVEL SECURITY'));
  assert.match(draft,new RegExp('ALTER TABLE public\\.'+name+' FORCE ROW LEVEL SECURITY'));
 }
 assert.doesNotMatch(nonComments(draft),/\bGRANT\b/i);
});
test('each existing business table has nullable store_id and composite FK',()=>{
 const tables=['products','customers','orders','order_items','conversations','messages','tenant_agent_configs'];
 for(const name of tables){
  assert.match(draft,new RegExp('ALTER TABLE public\\.'+name+' ADD COLUMN store_id uuid;'));
  assert.match(draft,new RegExp('ALTER TABLE public\\.'+name+' ADD CONSTRAINT [\\s\\S]*?FOREIGN KEY \\(tenant_id,store_id\\) REFERENCES public\\.stores\\(tenant_id,id\\) NOT VALID;'));
 }
});
test('no guessed legacy row backfill or hidden drop in draft',()=>{
 const sql=nonComments(draft);
 assert.doesNotMatch(sql,/\bUPDATE\s+public\./i);
 assert.doesNotMatch(sql,/\bDELETE\s+FROM\b|\bDROP\s+(TABLE|POLICY|CONSTRAINT)\b/i);
 assert.doesNotMatch(sql,/\bINSERT\s+INTO\b/i);
});
test('existing tenant-wide SKU unique constraint is not accidentally dropped',()=>{
 assert.match(draft,/UNIQUE\(tenant_id,sku\)/);
 assert.match(draft,/UNIQUE\(tenant_id,store_id,sku\)/);
 assert.doesNotMatch(nonComments(draft),/\bDROP\b/i);
});
test('existing business RLS policies are NOT falsely marked migrated',()=>{
 assert.match(draft,/does NOT establish per-Store RLS isolation/i);
 assert.match(draft,/RESTRICTIVE store-SELECT policy/);
});
test('readonly audit uses only SELECT statements',()=>{
 const body=nonComments(audit).trim();
 const statements=body.split(';').map(x=>x.trim()).filter(Boolean);
 assert.equal(statements.length,5);
 statements.forEach(s=>assert.match(s,/^SELECT\b/i));
 assert.doesNotMatch(body,/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|GRANT|REVOKE|DROP|TRUNCATE|COPY)\b/i);
});
test('no secrets or executable API calls in migration and audit source',()=>{
 const both=draft+'\n'+audit;
 assert.doesNotMatch(both,/sk-[A-Za-z0-9]{12,}|SUPABASE_SERVICE_ROLE_KEY=|ZALO_BOT_TOKEN=/);
});
