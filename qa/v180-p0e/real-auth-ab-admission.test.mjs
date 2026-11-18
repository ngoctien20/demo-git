import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRealAuthAdmission,expectedTestFlags} from './real-auth-ab-admission.mjs';
const valid=()=>{
 const checks=Object.fromEntries(expectedTestFlags.map(k=>[k,true]));
 return {
  environment:'PRIVATE_STAGING_NO_SEND',
  project_ref:'ifxlvrhyjhbzbrkdsida',
  tenant_id:'11111111-1111-4111-8111-111111111111',
  store_a_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  store_b_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  actor_a_ref:'a'.repeat(64),actor_b_ref:'b'.repeat(64),
  evidence_hashes:{auth_a:'1'.repeat(64),auth_b:'2'.repeat(64),rls_a_b:'3'.repeat(64),
    negative_cases:'4'.repeat(64),owner_scope:'5'.repeat(64)},
  same_tenant_store_proof:'INDEPENDENT_VERIFICATION_REQUIRED',
  checks,
 };
};
const checkBlock=(input,code)=>{
 const r=inspectRealAuthAdmission(input);
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.blockers.includes(code),'missing '+code+': '+r.blockers.join(','));
 assert.equal(r.canMigrate,false);assert.equal(r.canPublish,false);assert.equal(r.canSend,false);
};
test('empty evidence is blocked',()=>checkBlock({},'WRONG_SUPABASE_PROJECT'));
test('null evidence is blocked',()=>checkBlock(null,'INVALID_EVIDENCE_CONTAINER'));
test('valid-looking metadata still NEVER grants migration/send/release',()=>{
 const r=inspectRealAuthAdmission(valid());
 assert.equal(r.status,'INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(r.realAuthAccepted,false); assert.equal(r.canGrantRoles,false);
 assert.equal(r.canMigrate,false);assert.equal(r.canSend,false);assert.equal(r.canPublish,false);
});
test('wrong project denied',()=>{let a=valid();a.project_ref='different';checkBlock(a,'WRONG_SUPABASE_PROJECT')});
test('wrong environment denied',()=>{let a=valid();a.environment='PRODUCTION';checkBlock(a,'PRIVATE_STAGING_NO_SEND_REQUIRED')});
test('same store A and B denied',()=>{let a=valid();a.store_b_id=a.store_a_id;checkBlock(a,'DISTINCT_STORE_A_B_REQUIRED')});
test('missing real actor B proof denied',()=>{let a=valid();a.actor_b_ref='';checkBlock(a,'DISTINCT_PRIVATE_ACTOR_FINGERPRINTS_REQUIRED')});
test('matching actor fingerprint A and B denied',()=>{let a=valid();a.actor_b_ref=a.actor_a_ref;checkBlock(a,'DISTINCT_PRIVATE_ACTOR_FINGERPRINTS_REQUIRED')});
test('raw access token cannot appear in evidence',()=>{let a=valid();a.access_token='example-redacted';checkBlock(a,'RAW_SECRET_OR_TOKEN_FIELD_PROHIBITED')});
test('private key field cannot appear in nested evidence',()=>{let a=valid();a.evidence_hashes.secret='forbidden';checkBlock(a,'RAW_SECRET_OR_TOKEN_FIELD_PROHIBITED')});
test('missing external signature proof denied',()=>{let a=valid();a.checks.signature_a_verified_externally=false;checkBlock(a,'MISSING_SIGNATURE_A_VERIFIED_EXTERNALLY')});
test('missing externally verified JWT expiry denied',()=>{let a=valid();a.checks.expiry_b_verified_externally=false;checkBlock(a,'MISSING_EXPIRY_B_VERIFIED_EXTERNALLY')});
test('missing revoked-session negative test denied',()=>{let a=valid();a.checks.deny_revoked_member=false;checkBlock(a,'MISSING_DENY_REVOKED_MEMBER')});
test('missing cross-store denial denied',()=>{let a=valid();a.checks.deny_a_read_b=false;checkBlock(a,'MISSING_DENY_A_READ_B')});
test('missing RLS update WITH CHECK denied',()=>{let a=valid();a.checks.RLS_using_and_with_check_verified=false;checkBlock(a,'MISSING_RLS_USING_AND_WITH_CHECK_VERIFIED')});
test('service-role bypass usage denied',()=>{let a=valid();a.checks.no_service_role_bypass_used=false;checkBlock(a,'MISSING_NO_SERVICE_ROLE_BYPASS_USED')});
test('provider send risk denied',()=>{let a=valid();a.checks.no_provider_send=false;checkBlock(a,'MISSING_NO_PROVIDER_SEND')});
test('missing independent owner scope hash denied',()=>{let a=valid();a.evidence_hashes.owner_scope='';checkBlock(a,'INDEPENDENT_EVIDENCE_HASHES_MISSING')});
test('self-reported evidence cannot suffice',()=>{let a=valid();a.origin='self_reported';checkBlock(a,'SELF_REPORT_IS_NOT_TRUSTED_PROOF')});
test('unverified same-tenant authority denied',()=>{let a=valid();a.same_tenant_store_proof='guess';checkBlock(a,'STORE_SCOPE_ATTESTATION_REQUIRED')});
