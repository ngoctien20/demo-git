'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.resolve(__dirname,'../../docs/ai-handoff/V15_P0B_HOSTED_OWNER_EVIDENCE_PREFLIGHT_READ_ONLY.sql'),'utf8');
const executable=sql.split('\n').map(l=>l.replace(/--.*$/,'')).join('\n');
test('SQL preflight is a read-only transaction',()=>{
 assert.match(executable,/\bBEGIN TRANSACTION READ ONLY\s*;/i);
 assert.match(executable,/\bCOMMIT\s*;/i);
});
test('no write, DDL, RPC invocation or privilege mutation',()=>{
 assert.doesNotMatch(executable,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|EXECUTE|COPY|PERFORM)\s+(?:TABLE|ON|INTO|FROM|FUNCTION|PUBLIC|AUTH|pg_|[A-Za-z_])/i);
 assert.doesNotMatch(executable,/\bDO\s+\$/i);
 assert.doesNotMatch(executable,/\b(?:pg_read_file|dblink|COPY\s+PROGRAM|set_config)\b/i);
});
test('outputs aggregates and metadata, not identities',()=>{
 assert.match(sql,/count\(\*\)\s+from\s+auth\.users/i);
 assert.doesNotMatch(executable,/select\s+(?:\*|id|email|phone|user_id|raw_user_meta_data)\s+from\s+auth\.users/i);
 assert.doesNotMatch(executable,/\bselect\s+(?:p\.)?(?:price_vnd|total_vnd)\b/i);
});
test('explicit review of tenant-only policies and Store membership',()=>{
 assert.match(executable,/pg_policies/i);
 assert.match(executable,/store_memberships/i);
 assert.match(executable,/tenant_memberships/i);
});
test('privileged RPC exposure is reviewed as metadata only',()=>{
 assert.match(executable,/has_function_privilege/i);
 assert.match(executable,/qa_shop_b_zalo_claim/i);
 assert.doesNotMatch(executable,/SELECT\s+public\.qa_shop_b_zalo_claim\s*\(/i);
});
test('preflight cannot silently report real Store owner certification',()=>{
 const {inspectOwnershipPacket}=require('./ownership-evidence-gate.cjs');
 const r=inspectOwnershipPacket({});
 assert.equal(r.real_owner_verified,false);assert.equal(r.approved_migration,false);
});
