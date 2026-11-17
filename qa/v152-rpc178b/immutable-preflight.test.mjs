import test from 'node:test';
import assert from 'node:assert/strict';
import {hashApprovedCandidate,inspectRpc178bPreflight,REQUIRED,TARGET,liveNoSendDecision} from './immutable-preflight.mjs';
const ddl='CREATE SCHEMA rpc178_qa; -- ' + 'secure immutable candidate '.repeat(10);
const sha=hashApprovedCandidate(ddl);
const evidence=Object.fromEntries(REQUIRED.map(k=>[k,true]));
const scope={project:TARGET.project,schema:TARGET.schema,ddl_sha256:sha,operator_receipt_binding:sha,reviewer_receipt_binding:sha,mutate_existing_public:false,mutate_auth:false,grant_authenticated:false,grant_anon:false,grant_service_role:false,expose_api:false,send_real_messages:false,write_customer_data:false,create_paid_branch:false};
const baseline={schema_absent:true,public_store_tables_absent:true,commerce_store_columns_absent:true};
const args=()=>({evidence:{...evidence},scope:{...scope},ddl,baseline:{...baseline}});
const assertBlocked=x=>{assert.equal(x.status,'BLOCKED');for(const k of ['can_apply_migration','can_create_users','can_change_grants','can_open_access','can_upload','can_send','real_auth_ab_uat_accepted'])assert.equal(x[k],false)};
test('all self-reported approvals and matching SHA still cannot authorize migration',()=>{const x=inspectRpc178bPreflight(args());assertBlocked(x);assert.equal(x.reason,'REAL_SIGNED_APPROVAL_NOT_INDEPENDENTLY_VERIFIED')});
test('hash is exact and deterministic',()=>{assert.equal(hashApprovedCandidate(ddl),sha);assert.notEqual(hashApprovedCandidate(ddl+' '),sha);assert.equal(hashApprovedCandidate(''),null)});
for(const field of REQUIRED)test('absent '+field+' is denied',()=>{const x=args();delete x.evidence[field];const y=inspectRpc178bPreflight(x);assertBlocked(y);assert.ok(y.missing.includes(field))});
for(const [label,key,value] of [
 ['wrong project','project','another-project'],['wrong schema','schema','public'],
 ['tampered DDL','ddl_sha256','0'.repeat(64)],['forged operator binding','operator_receipt_binding','0'.repeat(64)],
 ['forged reviewer binding','reviewer_receipt_binding','0'.repeat(64)],
 ['mutate public','mutate_existing_public',true],['mutate auth','mutate_auth',true],
 ['grant authenticated','grant_authenticated',true],['grant anon','grant_anon',true],
 ['grant service role','grant_service_role',true],['expose Data API','expose_api',true],
 ['real sends','send_real_messages',true],['customer writes','write_customer_data',true],
 ['paid branch','create_paid_branch',true]
])test('deny '+label,()=>{const x=args();x.scope[key]=value;const y=inspectRpc178bPreflight(x);assertBlocked(y);assert.ok(y.missing.length>0)});
for(const [label,key] of [['schema exists','schema_absent'],['Store tables exist','public_store_tables_absent'],['Store columns exist','commerce_store_columns_absent']])test('deny stale baseline: '+label,()=>{const x=args();x.baseline[key]=false;const y=inspectRpc178bPreflight(x);assertBlocked(y);assert.ok(y.missing.includes('STAGING_BASELINE_UNVERIFIED'))});
test('reject string true instead of actual evidence flags',()=>{const x=args();x.evidence=Object.fromEntries(REQUIRED.map(k=>[k,'true']));assertBlocked(inspectRpc178bPreflight(x))});
test('reject null input fail closed',()=>assertBlocked(inspectRpc178bPreflight(null)));
test('no live JWT or hosted authorization',()=>assertBlocked(liveNoSendDecision()));
