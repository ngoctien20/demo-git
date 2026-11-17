'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assess}=require('./readiness-assessor.cjs');
const original=require('./verified-readonly-baseline.json');
const copy=v=>JSON.parse(JSON.stringify(v));
const check=v=>assess(v||copy(original));
const deny=(v,reason)=>{const x=check(v);assert.equal(x.ok,false);assert.equal(x.code,reason);};
test('Z01 current verified snapshot blocks real hosted UAT',()=>{
 const r=check();assert.equal(r.ok,true);
 assert.equal(r.assessment.release,'HOSTED_NO_GO');
 assert.equal(r.assessment.blockerCount,16);
});
test('Z02 existing Worker has no verified protected route',()=>{
 assert.ok(check().assessment.blockers.includes('WORKER_HAS_NO_VERIFIED_PROTECTED_ROUTE'));
});
test('Z03 Access application has no admission policy',()=>{
 assert.ok(check().assessment.blockers.includes('ACCESS_POLICY_MISSING'));
});
test('Z04 no external denied/authorized Access canary',()=>{
 const r=check();assert.ok(r.assessment.blockers.includes('ANONYMOUS_DENIAL_NOT_VERIFIED'));
 assert.ok(r.assessment.blockers.includes('OPERATOR_ALLOWED_SESSION_NOT_VERIFIED'));
});
test('Z05 actual R2 object count zero does not grant mutation',()=>{
 const r=check();assert.equal(original.cloudflare.qaPrefixFirstPageCount,0);
 assert.equal(original.cloudflare.qaPrefixPaginationComplete,true);
 assert.equal(r.assessment.allowModifyR2,false);
});
test('Z06 original bucket has no object expiration policy',()=>{
 assert.ok(check().assessment.blockers.includes('R2_OBJECT_RETENTION_NOT_CONFIGURED'));
});
test('Z07 existing Worker still lacks attested durable replay binding',()=>{
 assert.ok(check().assessment.blockers.includes('WORKER_DURABLE_REPLAY_UNPROVEN'));
});
test('Z08 tenant map UNIQUE auth_tenant_id prevents old map two Stores one Tenant',()=>{
 assert.ok(check().assessment.blockers.includes('ONE_AUTH_TENANT_ONE_STORE_MAPPING_CONSTRAINT'));
});
test('Z09 tenant-level memberships cannot substitute Store owner authority',()=>{
 assert.ok(check().assessment.blockers.includes('NO_VERIFIED_STORE_MEMBERSHIP_MODEL'));
});
test('Z10 two owner Store pairs still missing on one tenant',()=>{
 assert.ok(check().assessment.blockers.includes('NO_REAL_SAME_TENANT_TWO_STORE_OWNERS'));
});
test('Z11 two independent real Auth sessions same Tenant still missing',()=>{
 assert.ok(check().assessment.blockers.includes('NO_SAME_TENANT_TWO_LIVE_AUTH_SESSIONS'));
});
test('Z12 tenant-only read policy is insufficient Store A/B security UAT',()=>{
 assert.ok(check().assessment.blockers.includes('NO_REAL_STORE_SCOPED_RLS_JWT_ACCEPTANCE'));
});
test('Z13 cannot infer protected route approval from the user requesting a milestone',()=>{
 assert.ok(check().assessment.blockers.includes('PROTECTED_ROUTE_OWNER_APPROVAL_MISSING'));
});
test('Z14 cannot infer independent reviewer approval from a test',()=>{
 assert.ok(check().assessment.blockers.includes('INDEPENDENT_REVIEWER_APPROVAL_MISSING'));
});
test('Z15 cannot infer live Auth provisioning approval',()=>{
 assert.ok(check().assessment.blockers.includes('DISPOSABLE_QA_AUTH_PROVISIONING_NOT_APPROVED'));
});
test('Z16 cannot infer R2 lifecycle change or billing consent',()=>{
 assert.ok(check().assessment.blockers.includes('R2_LIFECYCLE_CHANGE_NOT_APPROVED'));
 assert.ok(check().assessment.blockers.includes('COST_CHANGES_NOT_APPROVED'));
});
test('Z17 request payload cannot extend snapshot with service_role field',()=>{
 const x=copy(original);x.supabase.service_role=true;deny(x,'UNTRUSTED_EVIDENCE_FIELDS');
});
test('Z18 request payload cannot smuggle JWT or tokens',()=>{
 const x=copy(original);x.cloudflare.jwt='fake';deny(x,'UNTRUSTED_EVIDENCE_FIELDS');
});
test('Z19 request payload cannot smuggle automatic approval',()=>{
 const x=copy(original);x.approval.approved=true;deny(x,'UNTRUSTED_EVIDENCE_FIELDS');
});
test('Z20 wrong project cannot be treated as staging evidence',()=>{
 const x=copy(original);x.projectRef='OTHER_PROJECT';deny(x,'UNTRUSTED_SNAPSHOT');
});
test('Z21 wrong QA bucket never accepted',()=>{
 const x=copy(original);x.cloudflare.bucket='live-customers';deny(x,'WRONG_INFRA_SCOPE');
});
test('Z22 nonfinite or negative counts cannot make check pass',()=>{
 const x=copy(original);x.cloudflare.workerZoneRouteCount=-1;deny(x,'INVALID_SCHEMA_NUMBERS');
});
test('Z23 an unsigned supplied true bypassing boolean checks is rejected',()=>{
 const x=copy(original);x.approval.identityProvisioningApproved='true';deny(x,'INVALID_BOOLEAN_EVIDENCE');
});
test('Z24 positive RLS JWT policy flag cannot be asserted solely from live tenant policy',()=>{
 const x=copy(original);x.supabase.hasActualStoreLevelRlsJwtAcceptance=true;
 const r=check(x);assert.equal(r.ok,true);
 assert.equal(r.assessment.release,'HOSTED_NO_GO');
 assert.equal(r.assessment.allowChangeRls,false);
});
test('Z25 apparent good Access policy but no matching route still blocks UAT',()=>{
 const x=copy(original);x.cloudflare.accessPolicyCount=1;
 x.cloudflare.accessAnonymousDenyCanaryRun=true;
 x.cloudflare.accessAuthenticatedOperatorCanaryRun=true;
 assert.ok(check(x).assessment.blockers.includes('WORKER_HAS_NO_VERIFIED_PROTECTED_ROUTE'));
});
test('Z26 new public Worker development endpoint is never automatic approval',()=>{
 const x=copy(original);x.cloudflare.workersDevEnabled=true;
 assert.equal(check(x).assessment.allowDeployWorker,false);
 assert.equal(check(x).assessment.release,'HOSTED_NO_GO');
});
test('Z27 existing R2 prefix may become occupied after earlier empty read',()=>{
 const x=copy(original);x.cloudflare.qaPrefixFirstPageCount=1;
 assert.ok(check(x).assessment.blockers.includes('R2_PREFIX_NOT_CONFIRMED_EMPTY'));
});
test('Z28 empty first page with unfinished pagination is NOT proof of zero objects',()=>{
 const x=copy(original);x.cloudflare.qaPrefixPaginationComplete=false;
 assert.ok(check(x).assessment.blockers.includes('R2_PREFIX_NOT_CONFIRMED_EMPTY'));
});
test('Z29 explicit disallowed real-data/merchant transfer invalidates QA scope',()=>{
 const x=copy(original);x.approval.noExistingMerchantTransfer=false;
 assert.ok(check(x).assessment.blockers.includes('QA_SCOPE_UNSAFE'));
});
test('Z30 even forged all-green snapshot can NEVER authorize hosted action',()=>{
 const x=copy(original);
 Object.assign(x.cloudflare,{workerZoneRouteCount:1,accessPolicyCount:1,
  accessAnonymousDenyCanaryRun:true,accessAuthenticatedOperatorCanaryRun:true,
  r2ObjectExpirationRuleCount:1,atomicReplayWorkerBindingVerified:true});
 Object.assign(x.supabase,{sameTenantDistinctOwnerPairs:2,sameTenantActiveAuthPairs:2,
  legacyCoreStorePolicyCount:1,tenantMapUniqueAuthTenantId:false,
  tenantMapPrimaryKeyTenantKey:false,hasPublicStoreMemberships:true,
  hasActualStoreLevelRlsJwtAcceptance:true});
 for(const k of Object.keys(x.approval))if(k.endsWith('Approved'))x.approval[k]=true;
 const r=check(x);assert.equal(r.ok,true);assert.equal(r.assessment.blockerCount,0);
 assert.equal(r.assessment.release,'HOSTED_NO_GO');
 for(const [k,v] of Object.entries(r.assessment)){
  if(k.startsWith('allow')||k==='productionApproved')assert.equal(v,false,k);
 }
});
