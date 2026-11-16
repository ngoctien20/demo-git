'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {FIELDS,BOOLS}=require('./hosted-channel-store-metadata-preflight.cjs');
const sql=fs.readFileSync(path.resolve(__dirname,
 '../../docs/ai-handoff/V15_P0H_HOSTED_METADATA_ONLY_PREFLIGHT.sql'),'utf8');
const executable=sql.split('\n').filter(x=>!x.trim().startsWith('--')).join('\n');
test('hosted preflight is wrapped in a read-only transaction',()=>{
 assert.match(executable,/BEGIN TRANSACTION READ ONLY\s*;/);
 assert.match(executable,/\bCOMMIT\s*;/);
});
test('preflight cannot call write/DDL/role/privileged functions',()=>{
 assert.doesNotMatch(executable,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|CALL|EXECUTE|VACUUM)\s+(?:INTO|FROM|TABLE|FUNCTION|ROLE|ON|PUBLIC|SCHEMA|[A-Za-z_])/i);
 assert.doesNotMatch(executable,/\b(?:COPY|DO)\s+[\w$]/i);
 assert.doesNotMatch(executable,/\b(?:pg_read_file|pg_ls_dir|dblink|pg_sleep|lo_export)\s*\(/i);
});
test('no raw Auth, provider account, owner or secret values selected',()=>{
 assert.doesNotMatch(executable,/\bSELECT\s+(?:\*|id|email|phone|user_id|secret_ref|external_account_ref)\s+FROM\b/i);
 assert.doesNotMatch(executable,/\bSELECT\s+pg_get_functiondef\s*\(/i);
 assert.doesNotMatch(executable,/\bFROM\s+auth\.users\b/i);
 assert.doesNotMatch(executable,/\bSELECT\s+.*\b(?:raw_user_meta_data|password_hash)\b/i);
});
test('all mandatory aggregate output fields are produced by hosted SQL',()=>{
 assert.match(executable,/V15_P0H_HOSTED_METADATA_V1/);
 for(const f of [...FIELDS,...BOOLS]){
  assert.ok(new RegExp('\\bAS\\s+'+f+'\\b','i').test(executable),f);
 }
});
test('preflight explicitly inspects private channel binding grants and RLS',()=>{
 assert.match(executable,/app_private\.channel_secrets/);
 assert.match(executable,/has_table_privilege\('anon'/);
 assert.match(executable,/has_table_privilege\('authenticated'/);
 assert.match(executable,/relrowsecurity/);
 assert.match(executable,/PRIMARY KEY \(tenant_id, platform\)/);
});
test('preflight checks Store columns, QA synthetic-only identity and Store RLS',()=>{
 assert.match(executable,/table_name='stores'/);
 assert.match(executable,/table_name='store_memberships'/);
 assert.match(executable,/column_name='store_id'/);
 assert.match(executable,/identity_status='synthetic_qa'/);
 assert.match(executable,/ILIKE '%store_memberships%'/);
});
