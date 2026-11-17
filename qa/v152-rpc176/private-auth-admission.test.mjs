import test from 'node:test';
import assert from 'node:assert/strict';
import {EVIDENCE_FIELDS,reviewRealAbAdmission,redactQaEvidence} from './private-auth-admission.mjs';
const all=Object.fromEntries(EVIDENCE_FIELDS.map(k=>[k,true]));
const safe={environment:'PRIVATE_INDEPENDENT_UAT',stored_raw_jwt:false,secret_uploaded:false,allows_public_url:false};
function locked(x){for(const key of ['can_accept_real_auth','can_assert_uat_pass','can_upload','can_send','can_deploy','can_open_access'])assert.equal(x[key],false)}
test('no evidence is blocked and no privilege granted',()=>{const x=reviewRealAbAdmission();assert.equal(x.status,'BLOCKED');locked(x)});
for(const field of EVIDENCE_FIELDS)test('missing '+field+' blocks',()=>{
 const e={...all};delete e[field];const x=reviewRealAbAdmission(e,safe);assert.ok(x.missing.includes(field));assert.equal(x.status,'BLOCKED');locked(x);
});
test('all synthetic checkboxes still cannot claim real signed JWT UAT',()=>{const x=reviewRealAbAdmission(all,safe);assert.equal(x.status,'HUMAN_REVIEW_REQUIRED');locked(x)});
for(const [name,patch] of [
 ['wrong environment',{environment:'PUBLIC'}],['public route',{allows_public_url:true}],
 ['raw JWT exposure',{stored_raw_jwt:true}],['secret uploaded',{secret_uploaded:true}]
])test('reject '+name,()=>{const x=reviewRealAbAdmission(all,{...safe,...patch});assert.equal(x.status,'BLOCKED');locked(x)});
test('string true does not satisfy evidence',()=>{const x=reviewRealAbAdmission(Object.fromEntries(EVIDENCE_FIELDS.map(k=>[k,'true'])),safe);assert.equal(x.status,'BLOCKED');locked(x)});
test('null object fails closed',()=>{const x=reviewRealAbAdmission(null,null);assert.equal(x.status,'BLOCKED');locked(x)});
test('redact logs accepts only safe status metadata',()=>{const x=redactQaEvidence({case_id:'AB_001',stage:'RLS',result:'BLOCKED',reason:'MISSING_PROOF',token:'do-not-log',customer_phone:'private',jwt:'do-not-log'});assert.deepEqual(x,{case_id:'AB_001',result:'BLOCKED',stage:'RLS',reason:'MISSING_PROOF'})});
test('redact URL and PII from safe fields',()=>{const x=redactQaEvidence({case_id:'https://example.com?jwt=aaa',reason:'email@example.com',stage:'AUTH',result:'DENIED'});assert.deepEqual(x,{stage:'AUTH',result:'DENIED'})});
