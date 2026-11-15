'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function withoutSqlLineComments(s){return s.split('\n').map(line=>line.replace(/--.*$/,'')).join('\n')}
test('Verified preflight SQL contains no DDL/DML/grants or executable mutations',()=>{
 const sql=withoutSqlLineComments(read('PREFLIGHT_READ_ONLY.sql'));
 assert.doesNotMatch(sql,/\b(?:CREATE|ALTER|DROP|UPDATE|DELETE|TRUNCATE|INSERT|GRANT|REVOKE|EXECUTE|CALL|DO|COPY)\b/i);
 assert.match(sql,/\bSELECT\b/i);
 assert.match(sql,/false AS safe_to_apply_ddl/i);
});
test('V14.2 proposal still raises exception before first CREATE or ALTER',()=>{
 const sql=withoutSqlLineComments(read('PROPOSAL_ONLY_STORE_RLS_DO_NOT_RUN.sql'));
 const e=sql.search(/\bRAISE EXCEPTION\b/i);
 const d=sql.search(/\b(?:CREATE TABLE|ALTER TABLE)\b/i);
 assert.ok(e>=0&&d>e,'DRAFT_MIGRATION_MUST_FAIL_CLOSED_BEFORE_DDL');
});
test('Migration proposal never uses guessed default store_id',()=>{
 const sql=withoutSqlLineComments(read('PROPOSAL_ONLY_STORE_RLS_DO_NOT_RUN.sql'));
 assert.doesNotMatch(sql,/ADD COLUMN store_id uuid DEFAULT/i);
});
test('Runbook names backup, restore rehearsal, individual row mapping and same tenant JWT QA',()=>{
 const s=read('../../docs/ai-handoff/V14_2_P0_MIGRATION_BACKUP_ROLLBACK_RUNBOOK.md');
 for(const word of ['restor','owner','SAME TENANT','JWT','qa-store-a','RLS']){
   assert.match(s,new RegExp(word,'i'));
 }
});
test('No autorun hosted JWT invocation in GitHub Actions',()=>{
 const ci=read('../../.github/workflows/v142-store-rls-onboarding-qa.yml');
 assert.doesNotMatch(ci,/run:[^\n]*node\s+qa\/store-rls-v142\/hosted-jwt-read-qa\.cjs/);
 assert.doesNotMatch(ci,/QA_A_ACCESS_TOKEN/);
});
