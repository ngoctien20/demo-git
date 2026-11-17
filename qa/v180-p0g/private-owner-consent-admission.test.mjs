import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 evaluateOwnerCohort,evaluatePrivateConsent,inspectRealReadOnlyHandshake,inheritedNoSendMatrix
} from './private-owner-consent-admission.mjs';
const aggregate=JSON.parse(readFileSync(new URL('./read-only-auth-owner-aggregate.json',import.meta.url),'utf8'));
const compat=JSON.parse(readFileSync(new URL('../v180-p0f/canonical-store-compatibility-metadata.json',import.meta.url),'utf8'));
const clone=x=>structuredClone(x);
const blocked=result=>{
 assert.equal(result.status,'NO_GO');
 for(const key of ['canOperateWithRealJWT','canChangeHostedSchema','canGrantStoreMembership',
                  'canRunHostedAB','canSendProvider','canPublish'])assert.equal(result[key],false);
};
const issue=(r,term)=>assert.ok(r.issues.some(x=>x.includes(term)),'Expected blocker: '+term);
const consent=()=>({
 target:'QA_PRIVATE_NO_SEND',
 founder_authorized_private_read_only:true,
 owner_a_consented:true,
 owner_b_consented:true,
 independent_operator_review:true,
 owner_a_receipt_ref:'qa-receipt:'+'1'.repeat(32),
 owner_b_receipt_ref:'qa-receipt:'+'2'.repeat(32),
 receipt_storage:'PROTECTED_PRIVATE_EVIDENCE_REGISTRY',
 real_auth_session_verified_by_operator:true,
 server_side_canonical_store_registry_verified:true,
 canonical_tenant_uuid:'11111111-1111-4111-8111-111111111111',
 canonical_store_a_uuid:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 canonical_store_b_uuid:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
});
const handshake=()=>({
 scope:'READ_ONLY_NO_SEND',
 auth_a_via_official_get_user:true,
 auth_b_via_official_get_user:true,
 session_a_correlated_privately:true,
 session_b_correlated_privately:true,
 signatures_and_iss_aud_exp_verified_privately:true,
 owner_scopes_read_from_authoritative_registry:true,
 cross_store_negative_checks_executed:false,
 provider_messages_sent:false,
 database_writes:false,
 result:'NO_GO'
});
test('actual read-only cohort is verified aggregate but real admission blocked',()=>{
 const r=evaluateOwnerCohort(aggregate,compat);
 blocked(r);assert.equal(r.exactAggregateReadOnlyVerified,true);
 assert.equal(r.realOwnerABVerified,false);assert.equal(r.realJWTVerified,false);
 issue(r,'NO_PAIR_OF_ELIGIBLE');
 issue(r,'CANONICAL_HOSTED_STORE_AUTHORITY_MISSING');
});
test('invalid cohort container blocked',()=>{
 const r=evaluateOwnerCohort(null,compat);blocked(r);issue(r,'AGGREGATE_EVIDENCE_MISSING');
});
test('wrong Supabase project blocked',()=>{
 const s=clone(aggregate);s.project_ref='another';const r=evaluateOwnerCohort(s,compat);
 blocked(r);issue(r,'UNTRUSTED_COHORT');
});
test('unrecognized cohort count drift blocks admission',()=>{
 const s=clone(aggregate);s.auth_cohort.eligible_members_with_unexpired_session_record=3;
 const r=evaluateOwnerCohort(s,compat);blocked(r);issue(r,'COHORT_CHANGED');
});
test('two same-tenant session records asserted cannot override independent proof',()=>{
 const s=clone(aggregate);s.auth_cohort.same_tenant_two_owner_session_record_groups=1;
 const r=evaluateOwnerCohort(s,compat);blocked(r);issue(r,'COHORT_CHANGED');
});
test('bad aggregate number rejected',()=>{
 const s=clone(aggregate);s.auth_cohort.active_tenant_membership_rows=-1;
 const r=evaluateOwnerCohort(s,compat);blocked(r);issue(r,'INVALID_AGGREGATE');
});
test('JWT success cannot be inferred from session row',()=>{
 const s=clone(aggregate);s.auth_cohort.real_jwt_signature_verified=true;
 const r=evaluateOwnerCohort(s,compat);blocked(r);issue(r,'UNVERIFIED_JWT_CLAIM');
});
test('legacy pairing cannot become canonical owner proof',()=>{
 const s=clone(aggregate);s.legacy_qa_owner_pairing.legacy_pairing_is_trusted_store_owner=true;
 const r=evaluateOwnerCohort(s,compat);blocked(r);issue(r,'LEGACY_QA_PAIRING');
});
test('stale P0F Store compatibility baseline blocks admission',()=>{
 const s=clone(compat);s.store_memberships_table_present=true;
 const r=evaluateOwnerCohort(aggregate,s);blocked(r);issue(r,'P0F_COMPATIBILITY_DRIFT');
});
test('absence of consent cannot grant access',()=>{
 const r=evaluatePrivateConsent(aggregate,compat,null);blocked(r);issue(r,'PRIVATE_CONSENT_NOT_COLLECTED');
});
test('perfect-looking consent JSON is NOT independent human evidence',()=>{
 const r=evaluatePrivateConsent(aggregate,compat,consent());
 blocked(r);assert.equal(r.privateEvidenceReviewPrepared,true);
 issue(r,'CONSENT_JSON_SELF_ASSERTION_IS_NOT_PROOF');
});
test('two distinct owner consents are required',()=>{
 const e=consent();e.owner_b_consented=false;
 const r=evaluatePrivateConsent(aggregate,compat,e);blocked(r);issue(r,'TWO_SEPARATE_ACCOUNT_CONSENTS_REQUIRED');
});
test('independent reviewer must be attested',()=>{
 const e=consent();e.independent_operator_review=false;
 const r=evaluatePrivateConsent(aggregate,compat,e);blocked(r);issue(r,'INDEPENDENT_REVIEW');
});
test('private founder read-only authorization must be attested',()=>{
 const e=consent();e.founder_authorized_private_read_only=false;
 const r=evaluatePrivateConsent(aggregate,compat,e);blocked(r);issue(r,'FOUNDER_PRIVATE_READ_ONLY');
});
test('owner A/B receipt ids cannot be reused',()=>{
 const e=consent();e.owner_b_receipt_ref=e.owner_a_receipt_ref;
 const r=evaluatePrivateConsent(aggregate,compat,e);blocked(r);issue(r,'TWO_DISTINCT_OPAQUE');
});
test('private owner proofs must not use user ids',()=>{
 const e=consent();e.user_id='synthetic';
 const r=evaluatePrivateConsent(aggregate,compat,e);blocked(r);issue(r,'SENSITIVE_FIELD');
});
test('access token field is prohibited even if redacted',()=>{
 const e=consent();e.access_token='REDACTED';
 const r=evaluatePrivateConsent(aggregate,compat,e);blocked(r);issue(r,'SENSITIVE_FIELD');
});
test('nested JWT field is prohibited',()=>{
 const e=consent();e.extra={jwt:'REDACTED'};
 const r=evaluatePrivateConsent(aggregate,compat,e);blocked(r);issue(r,'SENSITIVE_FIELD');
});
test('private registry cannot be substituted with public repo',()=>{
 const e=consent();e.receipt_storage='PUBLIC_GITHUB_ISSUE';
 const r=evaluatePrivateConsent(aggregate,compat,e);blocked(r);issue(r,'PRIVATE_EVIDENCE_STORAGE');
});
test('Store A and B UUID must differ',()=>{
 const e=consent();e.canonical_store_b_uuid=e.canonical_store_a_uuid;
 const r=evaluatePrivateConsent(aggregate,compat,e);blocked(r);issue(r,'SAME_TENANT_DIFFERENT_STORE_UUIDS_REQUIRED');
});
test('read-only handshake missing cannot imply JWT checked',()=>{
 const r=inspectRealReadOnlyHandshake(aggregate,compat,null);blocked(r);issue(r,'NO_PRIVATE_OPERATOR_HANDSHAKE');
});
test('complete-looking handshake remains NO_GO without true owner store tables',()=>{
 const r=inspectRealReadOnlyHandshake(aggregate,compat,handshake());
 blocked(r);assert.equal(r.realAuthHandshakeExecuted,false);
 issue(r,'CANONICAL_HOSTED_STORE_AUTHORITY_MISSING');
});
test('handshake needs both official getUser checks',()=>{
 const e=handshake();e.auth_b_via_official_get_user=false;
 const r=inspectRealReadOnlyHandshake(aggregate,compat,e);blocked(r);issue(r,'TWO_OFFICIAL_AUTH_GETUSER_CHECKS_REQUIRED');
});
test('handshake needs separate verified session correlations',()=>{
 const e=handshake();e.session_b_correlated_privately=false;
 const r=inspectRealReadOnlyHandshake(aggregate,compat,e);blocked(r);issue(r,'TWO_PRIVATELY_VERIFIED_SESSION');
});
test('handshake must not claim provider sends',()=>{
 const e=handshake();e.provider_messages_sent=true;
 const r=inspectRealReadOnlyHandshake(aggregate,compat,e);blocked(r);issue(r,'PROVIDER_SEND_MUST_BE_FALSE');
});
test('handshake must not make database writes',()=>{
 const e=handshake();e.database_writes=true;
 const r=inspectRealReadOnlyHandshake(aggregate,compat,e);blocked(r);issue(r,'HOSTED_DATABASE_WRITES_MUST_BE_FALSE');
});
test('handshake must not claim hosted AB test results',()=>{
 const e=handshake();e.cross_store_negative_checks_executed=true;
 const r=inspectRealReadOnlyHandshake(aggregate,compat,e);blocked(r);issue(r,'UNAUTHORIZED_HOSTED_AB_TEST_CLAIM');
});
test('handshake cannot self-declare UAT PASS',()=>{
 const e=handshake();e.result='PASS';
 const r=inspectRealReadOnlyHandshake(aggregate,compat,e);blocked(r);issue(r,'INVALID_REAL_AUTH_RESULT');
});
test('handshake raw session id prohibited',()=>{
 const e=handshake();e.session_id='synthetic';
 const r=inspectRealReadOnlyHandshake(aggregate,compat,e);blocked(r);issue(r,'PERSONAL_IDENTIFIERS');
});
test('31 pre-existing P0F cases inherited without fabricated results',()=>{
 const r=inheritedNoSendMatrix();assert.equal(r.length,31);
 assert.ok(r.every(x=>x.actual==='NOT_RUN' && !x.runtimeVerified && x.evidence_sha256===null));
});
