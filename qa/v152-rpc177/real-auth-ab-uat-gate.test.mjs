import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRealJwtAbEvidence,realSupabaseMigrationDecision} from './real-auth-ab-uat-gate.mjs';
const actor=(id,store)=>({user_id:'user-'+id,session_id:'session-'+id,tenant_id:'tenant-QA',store_id:'store-'+store,verified_by_independent_auth_service:true,session_active_rechecked:true,postgrest_authenticated_role:true,owner_version_verified:true,store_membership_db_verified:true});
const flagNames=['A_reads_A_only','B_reads_B_only','A_denied_B','B_denied_A','cross_tenant_denied','revoked_user_denied','outbound_send_disabled','real_merchant_files_absent'];
const base=()=>({actorA:actor('A','A'),actorB:actor('B','B'),checks:Object.fromEntries(flagNames.map(k=>[k,true]))});
const denied=x=>{assert.equal(x.status,'BLOCKED');for(const p of ['can_assert_real_uat','can_migrate','can_read_real_data','can_upload','can_send','can_deploy'])assert.equal(x[p],false)};
test('all synthetic positive observations still cannot authorize real JWT UAT',()=>denied(inspectRealJwtAbEvidence(base())));
for(const [name,change] of [
 ['unverified A',x=>x.actorA.verified_by_independent_auth_service=false],
 ['unverified B',x=>x.actorB.verified_by_independent_auth_service=false],
 ['revoked session A',x=>x.actorA.session_active_rechecked=false],
 ['missing authenticated role',x=>x.actorB.postgrest_authenticated_role=false],
 ['same user',x=>x.actorB.user_id=x.actorA.user_id],
 ['same session',x=>x.actorB.session_id=x.actorA.session_id],
 ['different tenant',x=>x.actorB.tenant_id='tenant-other'],
 ['same store',x=>x.actorB.store_id=x.actorA.store_id],
 ['stale owner proof',x=>x.actorA.owner_version_verified=false],
 ['missing Store membership',x=>x.actorB.store_membership_db_verified=false]
])test('reject '+name,()=>{const v=base();change(v);denied(inspectRealJwtAbEvidence(v))});
for(const field of flagNames)test('missing '+field+' blocks read-only acceptance',()=>{const v=base();delete v.checks[field];const r=inspectRealJwtAbEvidence(v);denied(r);assert.ok(r.gaps.includes(field))});
test('missing or null observations block',()=>{denied(inspectRealJwtAbEvidence());denied(inspectRealJwtAbEvidence(null))});
test('Supabase migration remains hard blocked',()=>denied(realSupabaseMigrationDecision()));
