'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path');
const sql=fs.readFileSync(path.resolve(__dirname,
  '../../docs/ai-handoff/V15_P0E2_AI_SECURITY_REVIEW_READ_ONLY.sql'),'utf8');
const doc=fs.readFileSync(path.resolve(__dirname,
  '../../docs/ai-handoff/V15_P0E2_AI_SECURITY_REVIEW_FINDINGS.md'),'utf8');
const executable=sql.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
test('security review SQL executes in read-only PostgreSQL transaction',()=>{
 assert.match(executable,/BEGIN TRANSACTION READ ONLY\s*;/i);
 assert.match(executable,/COMMIT\s*;/i);
});
test('security review cannot write or call privileged business RPCs',()=>{
 assert.doesNotMatch(executable,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|CALL|EXECUTE)\s+(?:INTO|FROM|TABLE|FUNCTION|ON|PUBLIC|SCHEMA|[A-Za-z_])/i);
 assert.doesNotMatch(executable,/\b(?:DO|COPY)\s+[\w$]/i);
 assert.doesNotMatch(executable,/\b(?:pg_read_file|lo_import|pg_ls_dir|dblink)\s*\(/i);
 assert.doesNotMatch(executable,/\bSELECT\s+public\.(?:qa_shop_b_zalo_claim|qa_owner_pairing|save_merchant_product)\s*\(/i);
});
test('does not disclose any identity or function source code',()=>{
 assert.doesNotMatch(executable,/\bSELECT\s+(?:\*|email|phone|id|user_id|raw_user_meta_data)\s+FROM\s+auth\.users/i);
 assert.doesNotMatch(executable,/\bSELECT\s+pg_get_functiondef\s*\(/i);
 assert.doesNotMatch(executable,/\bSELECT\s+.*\bpassword_hash\b/i);
});
test('covers anon SECURITY DEFINER, tenant and Store RLS metadata',()=>{
 assert.match(executable,/has_function_privilege\('anon'/);
 assert.match(executable,/security_definer/);
 assert.match(executable,/store_memberships/);
 assert.match(executable,/tenant_memberships/);
 assert.match(executable,/qa_shop_b_zalo_claim/);
});
test('audit report does not claim independent human signer or authorise export',()=>{
 assert.match(doc,/\bAI technical reviewer\b/i);
 assert.match(doc,/NO-GO/);
 assert.match(doc,/không phải.*Security Reviewer độc lập/i);
 assert.match(doc,/chưa.*cấp phép|không.*phê duyệt|chưa.*ủy quyền|không.*cho phép/i);
});
test('inherited P0-E.2 authorization gate remains fail-closed',()=>{
 const {decideOneTimeExport}=require('../v15-sales-lite-p0e2/one-time-export-decision.cjs');
 const result=decideOneTimeExport();
 assert.equal(result.status,'NO_GO');
 assert.equal(result.can_export,false);
 assert.equal(result.can_apply_migration,false);
 assert.equal(result.real_approval_issued,false);
});
