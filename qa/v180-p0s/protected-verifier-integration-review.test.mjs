// TIEN404 P0S — synthetic review-checklist QA; no real Owner, JWT, endpoint, secrets or network.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessPrivateVerifierReadiness,P0S_CHECK_CODES} from './protected-verifier-integration-review.mjs';
const fieldGroups={
 access:['appScoped','signedJwtVerifiedAtOrigin','audiencePinned','directOriginBlocked',
   'denyMissingAssertionTested','noBypassPolicyApproved','privateEndpointScoped'],
 owners:['localComparisonReceived','consentAIndependentlyVerified','consentBIndependentlyVerified',
   'liveSignedJwtA','liveSignedJwtB','distinctSubjectsSameTenantServerVerified'],
 server:['signedClaimsValidationReviewed','liveUserLookupReviewed','currentSessionLookupReviewed',
   'revocationNegativeTested','activeOwnerMembershipReviewed','leastPrivilegeCredentialApproved',
   'atomicConsentAndReplayReviewed'],
 operations:['auditNoTokenPiiVerified','rateLimitAndTimeoutVerified','rollbackEvidenceReviewed',
   'securityReviewerApproved']
};
const full=()=>Object.fromEntries(Object.entries(fieldGroups).map(([k,fields])=>
 [k,Object.fromEntries(fields.map(field=>[field,true]))]));
const noPermissions=[
 'realOwnerPairAuthenticated','protectedEndpointDeploymentAuthorized',
 'verifiedAccessTokensAccepted','signedReceiptIssued','canonicalStoreAuthority',
 'storeReadAuthorized','orderReadAuthorized','providerSendAuthorized','productionApproved'
];
test('empty or missing evidence fails closed and reports no privileges',()=>{
 for(const input of [undefined,null,{},'TRUE',[],{access:{appScoped:'true'}}]){
  const r=assessPrivateVerifierReadiness(input);
  assert.equal(r.status,'INTEGRATION_NO_GO');
  assert.equal(r.checkedCount,P0S_CHECK_CODES.length);
  assert.equal(r.unmetCount,r.checkedCount);
  for(const key of noPermissions)assert.equal(r[key],false,key);
 }
});
test('all-true review metadata still never grants deployment, Auth or Store permissions',()=>{
 const r=assessPrivateVerifierReadiness(full());
 assert.equal(r.status,'CHECKLIST_COMPLETE_INDEPENDENT_APPROVAL_STILL_REQUIRED');
 assert.equal(r.unmetCount,0);
 for(const key of noPermissions) assert.equal(r[key],false,key);
 assert.equal(Object.isFrozen(r),true);
 assert.equal(Object.isFrozen(r.unmet),true);
});
for(const [group,fields] of Object.entries(fieldGroups))for(const field of fields){
 test('fail-closed when '+group+'.'+field+' is false, missing or non-boolean',()=>{
  for(const invalid of [false,undefined,'true',1,null]){
    const value=full();
    if(invalid===undefined)delete value[group][field];
    else value[group][field]=invalid;
    const r=assessPrivateVerifierReadiness(value);
    assert.equal(r.status,'INTEGRATION_NO_GO');
    assert.equal(r.unmetCount,1);
    assert.equal(r.unmet.length,1);
    assert.equal(P0S_CHECK_CODES.includes(r.unmet[0]),true);
    for(const key of noPermissions)assert.equal(r[key],false,key);
  }
 });
}
test('raw private data never reflected into reports',()=>{
 const v=full();
 v.access.rawJwt='SECRET_BEARER_NOPE';
 v.owners.email='NEVER_EXPORT_EMAIL';
 v.server.sessionId='PRIVATE_SESSION_VALUE';
 const report=JSON.stringify(assessPrivateVerifierReadiness(v));
 for(const token of ['SECRET_BEARER_NOPE','NEVER_EXPORT_EMAIL','PRIVATE_SESSION_VALUE'])
  assert.equal(report.includes(token),false);
});
test('mutating input after review cannot upgrade a denied result',()=>{
 const v=full();v.access.directOriginBlocked=false;
 const r=assessPrivateVerifierReadiness(v);
 v.access.directOriginBlocked=true;
 assert.equal(r.status,'INTEGRATION_NO_GO');
 assert.ok(r.unmet.includes('DIRECT_ORIGIN_BYPASS_UNRESOLVED'));
});
test('duplicate or unexpected metadata cannot bypass a missing gate',()=>{
 const r=assessPrivateVerifierReadiness({
  ...full(),access:{...full().access,appScoped:false},
  override:true,authorized:true,productionApproved:true,
  verifiedAccessTokensAccepted:true
 });
 assert.equal(r.unmetCount,1);
 assert.equal(r.protectedEndpointDeploymentAuthorized,false);
});
test('read-only actual project inventory is still explicitly NO-GO',()=>{
 const actual=JSON.parse(readFileSync(new URL('./verified-readonly-environment.json',import.meta.url),'utf8'));
 assert.equal(actual.github.pr_draft,true);
 assert.equal(actual.render.ip_allowlist_public,true);
 assert.equal(actual.render.direct_origin_access_protected,false);
 assert.equal(actual.cloudflare_access.matching_protected_render_origin,false);
 assert.equal(actual.supabase.two_eligible_owner_count,2);
 assert.equal(actual.supabase.owners_with_session_record,1);
 assert.equal(actual.supabase.real_signed_pair_verified,false);
 assert.equal(actual.supabase.canonical_store_tables,0);
 assert.equal(actual.supabase.commerce_store_id_columns,0);
 assert.equal(actual.private_proof.local_comparison_result_received,false);
 assert.equal(actual.private_proof.independent_consent_pair_received,false);
 assert.equal(actual.private_proof.real_jwt_uat_cases_executed,0);
 const r=assessPrivateVerifierReadiness({
  access:{appScoped:actual.cloudflare_access.matching_protected_render_origin,
   directOriginBlocked:actual.render.direct_origin_access_protected},
  owners:{localComparisonReceived:actual.private_proof.local_comparison_result_received,
   distinctSubjectsSameTenantServerVerified:actual.supabase.real_signed_pair_verified}
 });
 assert.equal(r.status,'INTEGRATION_NO_GO');
 for(const c of ['NO_PRIVATE_ACCESS_APPLICATION','DIRECT_ORIGIN_BYPASS_UNRESOLVED',
  'OWNER_B_SIGNED_SESSION_NOT_VERIFIED','P0O_LOCAL_PAIR_NOT_RECEIVED'])
  assert.ok(r.unmet.includes(c),c);
});
test('review report is never a signed receipt or independent Auth proof',()=>{
 const r=assessPrivateVerifierReadiness(full());
 assert.equal('receipt' in r,false);
 assert.equal('jwt' in r,false);
 assert.equal('user_id' in r,false);
 assert.equal('tenant_id' in r,false);
 assert.equal(r.signedReceiptIssued,false);
});
