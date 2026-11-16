'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {classify,KEYS,VERSION}=require('./hosted-metadata-triage.cjs');
const NOW=Date.parse('2026-11-16T05:50:00.000Z');
const sample=extra=>({
 capturedAtUtc:'2026-11-16T05:35:42.000Z',
 source:'SUPABASE_HOSTED_METADATA_READ_ONLY',pgMajor:17,
 storesTableCount:0,storeMembershipTableCount:0,
 ordersStoreIdColumnCount:0,membershipStoreIdColumnCount:0,
 privateNonceSchemaCount:0,dedicatedNonceRoleCount:0,
 tenantCoreTablesWithRls:4,publicAnonDefinerRpcCount:1,
 authenticatedDefinerRpcCount:2,queryRoleIsPrivileged:true,
 serviceRoleBypassesRls:true,...extra
});
const run=s=>classify(s,{now:NOW});
test('01 evidence contract is explicit',()=>{
 assert.equal(VERSION,'T404_ADV6B1_HOSTED_METADATA_TRIAGE_V1');
 assert.equal(KEYS.length,14);
});
test('02 synthetic example of hosted metadata remains NO-GO',()=>{
 const r=run(sample());
 assert.equal(r.metadataValid,true);
 assert.equal(r.status,'BLOCKED_PENDING_INDEPENDENT_EVIDENCE');
 assert.equal(r.priority,'P0_REVIEW_REQUIRED');
});
test('03 absence of stores, membership and store_id is P0',()=>{
 assert(run(sample()).blockers.includes('P0_STORE_LEVEL_SCHEMA_NOT_PRESENT'));
});
test('04 anonymous callable definer requires separate review',()=>{
 assert(run(sample()).blockers.includes('P0_ANON_EXECUTABLE_SECURITY_DEFINER_REQUIRES_SEPARATE_REVIEW'));
});
test('05 authenticated callable definer requires separate review',()=>{
 assert(run(sample()).blockers.includes('P0_AUTH_EXECUTABLE_SECURITY_DEFINER_REQUIRES_SEPARATE_REVIEW'));
});
test('06 missing private nonce schema and dedicated DB role is P0',()=>{
 assert(run(sample()).blockers.includes('P0_HOSTED_PRIVATE_NONCE_ROLE_NOT_PROVEN'));
});
test('07 privileged SQL review cannot prove Owner JWT-RLS',()=>{
 assert(run(sample()).blockers.includes('P0_PRIVILEGED_METADATA_QUERY_CANNOT_CERTIFY_OWNER_RLS'));
});
test('08 synthetically complete metadata cannot grant release',()=>{
 const r=run(sample({storesTableCount:1,storeMembershipTableCount:1,
  ordersStoreIdColumnCount:1,membershipStoreIdColumnCount:1,
  privateNonceSchemaCount:1,dedicatedNonceRoleCount:1,
  publicAnonDefinerRpcCount:0,authenticatedDefinerRpcCount:0,
  queryRoleIsPrivileged:false,serviceRoleBypassesRls:false}));
 assert.equal(r.metadataValid,true);
 assert.deepEqual(r.blockers,['INDEPENDENT_REAL_OWNER_JWT_BACKUP_AND_ROLE_ATTESTATION_MISSING']);
 assert.equal(r.productionReleaseAuthorized,false);
});
test('09 spoofed verified:true is rejected rather than trusted',()=>{
 const r=run({...sample(),verified:true});
 assert.equal(r.metadataValid,false);assert.equal(r.status,'BLOCKED_INVALID_OR_STALE_METADATA');
});
test('10 spoofed JWT as extra field rejected',()=>{
 assert.equal(run({...sample(),accessToken:'DO_NOT_ACCEPT_THIS'}).metadataValid,false);
});
test('11 fake signed approval flag rejected',()=>{
 assert.equal(run({...sample(),operatorApproval:true}).metadataValid,false);
});
test('12 source must be recognized as hosted metadata',()=>{
 assert.equal(run(sample({source:'CHAT_SELF_ASSERTED'})).metadataValid,false);
});
test('13 privileged bypass cannot be forged as string',()=>{
 assert.equal(run(sample({serviceRoleBypassesRls:'false'})).metadataValid,false);
});
test('14 negative function count rejected',()=>{
 assert.equal(run(sample({publicAnonDefinerRpcCount:-1})).metadataValid,false);
});
test('15 function count upper bound prevents overflow',()=>{
 assert.equal(run(sample({authenticatedDefinerRpcCount:999999999})).metadataValid,false);
});
test('16 fractional counts rejected',()=>{
 assert.equal(run(sample({storesTableCount:.5})).metadataValid,false);
});
test('17 stale evidence over 24h denied',()=>{
 assert.equal(classify(sample(),{now:NOW+25*3600000}).metadataValid,false);
});
test('18 future metadata over 5mins denied',()=>{
 assert.equal(run(sample({capturedAtUtc:'2026-11-16T07:00:00.000Z'})).metadataValid,false);
});
test('19 invalid timestamps denied',()=>{
 for(const v of ['today','2026-11-16 05:35:42',null,'not a time'])
  assert.equal(run(sample({capturedAtUtc:v})).metadataValid,false);
});
test('20 empty and mutated data fail closed',()=>{
 for(const v of [null,undefined,[],{},true,{},'json'])
  assert.equal(run(v).metadataValid,false);
});
test('21 all privilege-changing operations remain explicitly disallowed',()=>{
 const r=run(sample());
 for(const key of ['hostedMigrationAuthorized','privilegeRevocationAuthorized',
  'productionReleaseAuthorized','providerSendAuthorized','commerceWriteAuthorized'])
  assert.equal(r[key],false,key);
});
test('22 no Owner JWT, backup, or durable replay self-certified',()=>{
 const r=run(sample());
 for(const key of ['authenticatedOwnerJwtCertified','sameTenantCrossStoreRlsCertified',
  'backupRestoreIndependentlyCertified','realHostedNonceCertified'])
  assert.equal(r[key],false,key);
});
test('23 existing tenant RLS does not become Store-level proof',()=>{
 const r=run(sample({tenantCoreTablesWithRls:40}));
 assert(r.blockers.includes('P0_STORE_LEVEL_SCHEMA_NOT_PRESENT'));
 assert.equal(r.sameTenantCrossStoreRlsCertified,false);
});
test('24 even zero public definer grants does not approve migration',()=>{
 const r=run(sample({publicAnonDefinerRpcCount:0,authenticatedDefinerRpcCount:0}));
 assert.equal(r.privilegeRevocationAuthorized,false);
 assert.equal(r.hostedMigrationAuthorized,false);
});
test('25 correct immutable blockers cannot be modified by an untrusted client',()=>{
 const r=run(sample());
 assert.throws(()=>r.blockers.push('PASS'),TypeError);
 assert.equal(Object.isFrozen(r),true);
});
test('26 unknown owner-proofs present only as strings cannot influence metadata',()=>{
 const r=run({...sample(),ownerProof:'private:ref:synthetic'});
 assert.equal(r.status,'BLOCKED_INVALID_OR_STALE_METADATA');
});
test('27 invalid injected clock is refused',()=>{
 assert.throws(()=>classify(sample(),{now:NaN}),/ADV6B1_CLOCK_INVALID/);
});
test('28 exact metadata schema rejects a missing field',()=>{
 const x=sample();delete x.queryRoleIsPrivileged;
 assert.equal(run(x).metadataValid,false);
});
