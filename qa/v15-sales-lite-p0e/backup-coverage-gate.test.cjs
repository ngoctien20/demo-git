'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {FIELDS,EXTERNAL,reviewCoveragePlan,coverageWarnings}=require('./backup-coverage-gate.cjs');
const makePlan=()=>{
 const coverage={};let i=0;
 for(const [key,source_class] of Object.entries(FIELDS)){
  coverage[key]={source_class,method_status:'PENDING_PRIVATE_REVIEW',
   review_ticket:'SEC-PRIVATE'+String(i++).padStart(12,'0')};
 }
 return {contract:'TIEN404_V15_P0E_COVERAGE_V1',project:'ifxlvrhyjhbzbrkdsida',
 scope:'REVIEW_ONLY_NO_EXPORT',coverage};
};
const deny=x=>{
 assert.equal(x.status,'BLOCKED');
 for(const k of ['coverage_verified','backed_up_real_data','source_controller_verified',
 'independent_security_verified','private_vault_verified','real_restore_verified','may_export',
 'may_restore','may_apply_migration','may_grant_or_edit_rls','may_send_provider',
 'may_write_orders','can_certify_backup']) assert.equal(x[k],false,k);
};
test('empty default packet denies full project backup certification',()=>{
 deny(reviewCoveragePlan({}));
});
test('all source-class tickets still not a backup, export or certification',()=>{
 const v=reviewCoveragePlan(makePlan());deny(v);
 assert.equal(v.missing.length,0);
 assert.equal(v.reason,'INDEPENDENT_PRIVATE_COVERAGE_AND_OWNER_APPROVAL_REQUIRED');
});
test('three Supabase SQL files do not cover Auth or Storage automatically',()=>{
 const p=makePlan();
 for(const k of ['auth_users_sessions','storage_metadata','storage_object_bytes'])delete p.coverage[k];
 const v=reviewCoveragePlan(p);deny(v);
 assert.deepEqual(v.missing,['auth_users_sessions','storage_metadata','storage_object_bytes']);
});
test('n8n and provider secrets are independent recovery dependencies',()=>{
 assert.equal(EXTERNAL.has('n8n_workflows'),true);
 assert.equal(EXTERNAL.has('channel_credentials'),true);
 const p=makePlan();delete p.coverage.n8n_workflows;
 deny(reviewCoveragePlan(p));
 assert.deepEqual(reviewCoveragePlan(p).missing,['n8n_workflows']);
});
test('forged verified status is rejected',()=>{
 const p=makePlan();p.coverage.application_data.method_status='VERIFIED';
 const v=reviewCoveragePlan(p);deny(v);
 assert.equal(v.reason,'INVALID_OR_UNTRUSTED_REFERENCE');
});
test('backup URL / raw content / token cannot enter public manifest',()=>{
 const p=makePlan();p.coverage.auth_users_sessions.raw_jwt='secret';
 const v=reviewCoveragePlan(p);deny(v);
 assert.equal(v.reason,'INVALID_OR_UNTRUSTED_REFERENCE');
});
test('duplicate reviewer tickets rejected',()=>{
 const p=makePlan();p.coverage.roles.review_ticket=p.coverage.application_schema.review_ticket;
 deny(reviewCoveragePlan(p));
 assert.equal(reviewCoveragePlan(p).reason,'INVALID_OR_UNTRUSTED_REFERENCE');
});
test('wrong project and unsafe requested scopes cannot pass',()=>{
 for(const project of ['production','another-project','']){
  const p=makePlan();p.project=project;deny(reviewCoveragePlan(p));
 }
 const p=makePlan();p.scope='EXPORT_HOSTED_DATABASE';deny(reviewCoveragePlan(p));
});
test('additional unknown categories cannot silently authorize',()=>{
 const p=makePlan();p.coverage.service_role_override={};
 deny(reviewCoveragePlan(p));
});
test('backup caveats explicitly mention auth, storage and isolated restore',()=>{
 const x=coverageWarnings();
 assert.match(x.managed_schemas,/auth\/storage/);
 assert.match(x.storage_objects,/object bytes/);
 assert.match(x.integrity_not_restore,/isolated restore/);
});
