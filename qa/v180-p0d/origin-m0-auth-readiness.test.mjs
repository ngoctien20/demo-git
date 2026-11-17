import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectSnapshot,SNAPSHOT_REFERENCE,noHostedAuthorization} from './origin-m0-auth-readiness.mjs';

const base=()=>({...SNAPSHOT_REFERENCE});
const deny=r=>{
 assert.equal(r.status,'REAL_HOSTED_STORE_AB_NO_GO');
 for(const key of ['originalFourHostedRowsOwnerCertified','sameTenantRealStoreABOwnerMapped',
   'm0CurrentRecoveryApproved','currentIndependentRestoreTested',
   'realSupabaseJwtAandBVerified','signedSupabaseIssuerVerified',
   'sameTenantRealJwtNegativeUatAccepted','canReadRealOrder','canWriteRealOrder',
   'canApplyMigration','canBackfill','canAlterRls','canChangeRpcGrant',
   'canCreateUser','canSend','canOpenAccess','canDeploy','canPublish'])
    assert.equal(r[key],false,'Never approve '+key);
};

test('live read-only aggregate shape matches, but authorizes no operational actions',()=>{
 const r=inspectSnapshot(base());deny(r);assert.equal(r.baselineShapeValid,true);
 assert.ok(r.blockers.includes('NO_TWO_QA_STORES_IN_SAME_TENANT'));
 assert.ok(r.blockers.includes('ACTUAL_CURRENT_BACKUP_AND_INDEPENDENT_RESTORE_NOT_VERIFIED'));
 assert.ok(r.blockers.includes('REAL_SUPABASE_ISSUER_VERIFIED_JWT_A_B_NOT_ADMITTED'));
});
test('all externally claimed approvals remain ineffective',()=>{
 const x=base();x.ownerApproved=true;x.m0Approved=true;x.realJwtVerified=true;
 const r=inspectSnapshot(x);deny(r);assert.equal(r.baselineShapeValid,false);
 assert.ok(r.blockers.includes('RAW_OR_UNTRUSTED_AUTHORITY_FIELD_REJECTED'));
});
for(const key of ['jwt','access_token','refresh_token','service_role','password','user_metadata','rowId','storeId','tenantId','rawEvidence','canMigrate','canPublish','private_key','signature']) {
 test('reject any raw or self-signed proof field: '+key,()=>{
  const x=base();x[key]='NEVER_ACCEPT_RAW_VALUE';
  const r=inspectSnapshot(x);deny(r);assert.equal(r.baselineShapeValid,false);
 });
}
for(const key of ['tenants','products','orders','authUsers','qaPairingMatches','sessionRows',
 'sameTenantStoreGroups','publicStores','rpc178Qa','orderOwnershipRows','authCustomerBindings']) {
 test('baseline drift requires a new independent hosted read: '+key,()=>{
  const x=base();x[key]=typeof x[key]==='boolean'?!x[key]:x[key]+1;
  const r=inspectSnapshot(x);deny(r);assert.equal(r.baselineShapeValid,false);
  assert.ok(r.blockers.includes('LIVE_BASELINE_DRIFT_REQUIRES_NEW_READ_ONLY_AUDIT'));
 });
}
for(const input of [null,undefined,[],true,'TRUE',0,{},{...base(),authUsers:'3'},
 {...base(),products:-1},{...base(),sessionRows:1.5}]) {
 test('malformed packet fails closed: '+JSON.stringify(input)?.slice(0,60),()=>{
   const r=inspectSnapshot(input);deny(r);assert.equal(r.baselineShapeValid,false);
 });
}
test('aggregates never result in cryptographically verified JWT',()=>deny(noHostedAuthorization()));
test('read-only SQL cannot perform DDL, DML, credentials export or customer row fetch',()=>{
 const s=readFileSync(new URL('./origin-m0-auth-staging.READ_ONLY.sql',import.meta.url),'utf8');
 const noComments=s.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
 assert.match(noComments,/^\s*BEGIN TRANSACTION READ ONLY;/i);
 assert.match(noComments,/ROLLBACK;\s*$/i);
 assert.doesNotMatch(noComments,/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|COPY|CALL|EXECUTE|SET\s+ROLE|SET_CONFIG|pg_dump)\b/i);
 assert.doesNotMatch(noComments,/\bSELECT\s+\*\s+FROM\b/i);
 for(const label of ['auth.users','auth.sessions','storage.objects','tien404_r1_qa.owner_bindings','public.orders'])
   assert.ok(noComments.includes(label),label+' required in aggregate audit');
 assert.ok(noComments.includes('row_number() OVER'), 'Only anonymous numbered Tenant slots are displayed');
 assert.doesNotMatch(noComments,/\b(?:access_token|refresh_token|encrypted_password|secret_key|session_id|phone)\b/i);
});
