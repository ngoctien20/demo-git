import test from 'node:test';
import assert from 'node:assert/strict';
import {REQUIREMENT_IDS,reviewStagingRestoreEvidence,realMigrationDecision} from './staging-recovery-gate.mjs';
const evidence=Object.fromEntries(REQUIREMENT_IDS.map(k=>[k,true]));
const source={project:'ifxlvrhyjhbzbrkdsida',schema:'rpc178_qa',origin:'LIVE_SUPABASE_SIGNED_RESTORE_ATTESTATION',github_disposable_only:false};
const approval={authorized_ddl_sha256:'a'.repeat(64),operator_identity_receipt:true,independent_reviewer_receipt:true};
const base=()=>({evidence:{...evidence},source:{...source},approval:{...approval}});
const denied=r=>{assert.equal(r.status,'BLOCKED');for(const k of ['can_apply_supabase_ddl','can_restore_supabase','can_delete_backup','can_open_access','can_run_real_jwt_uat','can_send'])assert.equal(r[k],false)};
test('all self-claimed evidence remains NO-GO',()=>{const r=reviewStagingRestoreEvidence(base());denied(r);assert.equal(r.reason,'EXTERNAL_SIGNED_RECEIPT_NOT_VERIFIED')});
for(const k of REQUIREMENT_IDS)test('missing '+k+' blocks',()=>{const x=base();delete x.evidence[k];const r=reviewStagingRestoreEvidence(x);denied(r);assert.ok(r.missing.includes(k))});
for(const [name,key,value,issue] of [
 ['wrong project','project','other','PROJECT_OR_SCHEMA_MISMATCH'],
 ['wrong schema','schema','public','PROJECT_OR_SCHEMA_MISMATCH'],
 ['synthetic CI backup only','github_disposable_only',true,'CI_FIXTURE_NOT_SUFFICIENT'],
 ['not real Supabase restore','origin','CI_PG17_RESTORE_ONLY','NO_REAL_SUPABASE_RESTORE_RECEIPT']
])test(name,()=>{const x=base();x.source[key]=value;const r=reviewStagingRestoreEvidence(x);denied(r);assert.ok(r.missing.includes(issue))});
for(const [name,key,value] of [
 ['no DDL SHA','authorized_ddl_sha256',null],
 ['invalid DDL SHA','authorized_ddl_sha256','unverified'],
 ['no owner operator receipt','operator_identity_receipt',false],
 ['no independent reviewer','independent_reviewer_receipt',false]
])test(name,()=>{const x=base();x.approval[key]=value;const r=reviewStagingRestoreEvidence(x);denied(r);assert.ok(r.missing.length>0)});
test('string true never substitutes attestation',()=>{const x=base();x.evidence=Object.fromEntries(REQUIREMENT_IDS.map(k=>[k,'true']));const r=reviewStagingRestoreEvidence(x);denied(r);assert.ok(r.missing.length>=REQUIREMENT_IDS.length)});
test('null input fails closed',()=>denied(reviewStagingRestoreEvidence(null)));
test('real migration not authorized by this module',()=>denied(realMigrationDecision()));
