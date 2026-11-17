'use strict';
/* Public metadata-only NO-GO tests. No private owner/JWT data. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const data=require('./HOSTED_JWT_READINESS_SNAPSHOT.json');
const base=path.join(__dirname,'HOSTED_JWT_READINESS_SNAPSHOT.json');
const source=fs.readFileSync(base,'utf8');
const sha256=crypto.createHash('sha256').update(source).digest('hex');

test('01 snapshot is read-only metadata, not a user JWT or provider trace',()=>{
  assert.equal(data.contract,'T404_V176B3_PUBLIC_METADATA_READINESS_V1');
  assert.equal(data.source,'SUPABASE_STAGING_READ_ONLY_METADATA');
  assert.match(sha256,/^[0-9a-f]{64}$/);
});
test('02 two owner bindings across two tenants do not form same-tenant Store A/B proof',()=>{
  assert.equal(data.mappedTenantStoreRows,2);
  assert.equal(data.distinctMappedTenantKeys,2);
  assert.equal(data.distinctMappedStoreKeys,2);
  assert.equal(data.tenantKeysWithTwoDistinctStores,0);
});
test('03 recorded auth session counts do not attest access token possession',()=>{
  assert.equal(data.authUsersCount,3);
  assert.equal(data.authNonExpiredSessionRowsByMetadata,5);
  assert.equal(data.independentPrivateJwtAttestationA,false);
  assert.equal(data.independentPrivateJwtAttestationB,false);
});
test('04 one tenant with multiple members is not distinct Store proof',()=>{
  assert.equal(data.tenantWithTwoActiveMembersCount,1);
  assert.equal(data.independentlyProvenSameTenantTwoStores,false);
});
test('05 no owner consent or independent Store authority has been admitted',()=>{
  assert.equal(data.ownerConsentVerifiedA,false);
  assert.equal(data.ownerConsentVerifiedB,false);
  assert.equal(data.hostedStoreScopedRlsVerified,false);
});
test('06 legacy Core tables remain tenant scoped and not proven Store scoped',()=>{
  assert.equal(data.legacyCoreStoreIdColumnPresent,false);
  assert.equal(data.hostedStoreScopedRlsVerified,false);
});
test('07 zero actual JWT UAT and zero hosted side-effects',()=>{
  assert.equal(data.actualHostedJwtTestCount,0);
  assert.equal(data.actualCustomerDataReadCount,0);
  assert.equal(data.actualCommerceMutationCount,0);
  assert.equal(data.providerMessagesSentCount,0);
});
test('08 NO-GO cannot be accidentally relabeled as production ready',()=>{
  assert.equal(data.productionRelease,'NO_GO');
  assert.match(data.note,/no proof/i);
});
test('09 only allowed non-secret metadata keys appear in public snapshot',()=>{
  const allow=new Set([
    'contract','observedAt','source','mappedTenantStoreRows',
    'distinctMappedTenantKeys','distinctMappedStoreKeys',
    'tenantKeysWithTwoDistinctStores','ownerBindingRows','authUsersCount',
    'authNonExpiredSessionRowsByMetadata','activeTenantMembershipRows',
    'tenantWithTwoActiveMembersCount','legacyCoreStoreIdColumnPresent',
    'ownerConsentVerifiedA','ownerConsentVerifiedB',
    'independentPrivateJwtAttestationA','independentPrivateJwtAttestationB',
    'independentlyProvenSameTenantTwoStores','hostedStoreScopedRlsVerified',
    'actualHostedJwtTestCount','actualCustomerDataReadCount',
    'actualCommerceMutationCount','providerMessagesSentCount',
    'productionRelease','note']);
  assert.ok(Object.keys(data).every(k=>allow.has(k)));
  assert.equal(Object.keys(data).length,allow.size);
  assert.doesNotMatch(source,/Bearer\s+[A-Za-z0-9._-]{20,}/);
  assert.doesNotMatch(source,/sb_secret_[A-Za-z0-9_-]+/);
  assert.doesNotMatch(source,/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/);
});
test('10 private owner evidence and JWT cannot be substituted with metadata booleans',()=>{
  assert.equal(data.independentPrivateJwtAttestationA&&data.independentPrivateJwtAttestationB,false);
  assert.equal(data.productionRelease,'NO_GO');
});
test('11 metadata source and date are a snapshot, not a promise of freshness',()=>{
  assert.equal(data.observedAt,'2026-11-17');
  assert.equal(data.source,'SUPABASE_STAGING_READ_ONLY_METADATA');
});
