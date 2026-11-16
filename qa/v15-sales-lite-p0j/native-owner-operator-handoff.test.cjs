'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../../docs/ai-handoff');
const doc=fs.readFileSync(path.join(dir,
 'V15_P0J_NATIVE_PAGE_OA_PRIVATE_BACKUP_OPERATOR_HANDOFF.md'),'utf8');
const src=fs.readFileSync(path.join(__dirname,'operator-offline-preflight.cjs'),'utf8');
test('native Meta ownership is not inferred from successful n8n webhook',()=>{
 assert.match(doc,/native Meta Page\/admin/i);
 assert.match(doc,/webhook executions #3865–3868/);
 assert.match(doc,/NOT Meta Page admin/i);
 assert.match(doc,/Page-level subscription/i);
 assert.match(doc,/pages_messaging/);
});
test('Meta read-only verification never approves a provider subscription write',()=>{
 assert.match(doc,/GET \/\{page-id\}\/subscribed_apps/);
 assert.match(doc,/Do not POST to subscribe/);
 assert.match(doc,/App Review/);
});
test('Zalo OA OAuth and Bot are explicitly independent evidence domains',()=>{
 assert.match(doc,/OAuth v4/);
 assert.match(doc,/X-ZEvent-Signature/);
 assert.match(doc,/Zalo Bot/);
 assert.match(doc,/distinct/);
});
test('private handoff explicitly forbids token, Page IDs and credential leakage',()=>{
 assert.match(doc,/Do not share Page tokens/);
 assert.match(doc,/encrypted private vault/i);
 assert.match(doc,/Do not share private evidence ledger contents/i);
});
test('CLI v3 local-by-default breaking change and PRE-M1 gate are documented',()=>{
 assert.match(doc,/CLI v3 breaking change dated 2026-11-04/);
 assert.match(doc,/defaults to LOCAL/);
 assert.match(doc,/--remote/);
 assert.match(doc,/PRE-M1 backup decision is separate from POST-M1 Store JWT\/RLS/);
 assert.match(doc,/PR #192/);
});
test('local archive TOE and hash are never full recovery proof',()=>{
 assert.match(doc,/pg_restore -l/);
 assert.match(doc,/Auth user data/);
 assert.match(doc,/Storage object bytes/);
 assert.match(src,/actual_restore_verified/);
 assert.match(src,/can_apply_migration/);
});
test('explicit no hosted migration, provider send, Orders or production publishing',()=>{
 assert.match(doc,/NO-GO/);
 assert.match(doc,/No backup\/export\/restore operation is authorized/i);
 assert.match(doc,/Rollback/);
 assert.match(doc,/PR #189/);
});
test('operator binary execution is locked to safe local inspection only',()=>{
 const code=src.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.match(code,/spawnSync/);
 assert.match(code,/windowsHide:true,shell:false/);
 assert.match(code,/'pg_restore',\['--version'\]/);
 assert.match(code,/'supabase',\['--version'\]/);
 assert.match(code,/'supabase',\['db','dump','--help'\]/);
 assert.doesNotMatch(code,/spawnSync\(['"]psql['"]/);
 assert.doesNotMatch(code,/spawnSync\(['"]supabase['"],\['db','dump'\]/);
});
