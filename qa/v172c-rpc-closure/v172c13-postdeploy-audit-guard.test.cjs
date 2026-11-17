'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'v172c12-postdeploy-rls-readonly-audit.sql'),'utf8');
test('metadata audit remains SELECT-only',()=>{
 assert.doesNotMatch(sql,/^\s*(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE)\s/mi);
});
test('checks every QA table via pg_class',()=>assert.match(sql,/pg_class c JOIN pg_namespace n/));
test('checks anon grants for all QA relations',()=>assert.match(sql,/anon_accessible_tables/));
test('checks authenticated writes for all QA relations',()=>assert.match(sql,/auth_writable_tables/));
test('validates schema USAGE',()=>{assert.match(sql,/has_schema_privilege\('authenticated'/);assert.match(sql,/has_schema_privilege\('anon'/);});
test('requires catalog policy scope tenant and store',()=>assert.match(sql,/scoped_catalog_policies=1/));
test('requires own membership policy auth.uid',()=>assert.match(sql,/own_membership_policies=1/));
test('explicitly rejects write grant',()=>assert.match(sql,/has_table_privilege\('authenticated',c.oid,'INSERT, UPDATE, DELETE'\)/));
test('never returns a direct GO',()=>{assert.doesNotMatch(sql,/THEN 'GO'/);assert.match(sql,/METADATA_REVIEW_REQUIRED_NOT_JWT_GO/);});
test('fails closed without schema',()=>assert.match(sql,/NO_GO_SCHEMA_OR_GRANT_INVARIANT/));
