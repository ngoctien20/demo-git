'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessOwnerEvidence}=require('./owner-proof-gate.cjs');
const NOW=Date.parse('2026-11-16T10:00:00+09:00');
const base={
 user:{id:'QA_USER_A',status:'ACTIVE',syntheticFixture:true},
 tenantMembership:{tenantId:'QA_TENANT_A',userId:'QA_USER_A',active:true,role:'owner'},
 store:{id:'QA_STORE_A',tenantId:'QA_TENANT_A',status:'ACTIVE'},
 storeMembership:{userId:'QA_USER_A',tenantId:'QA_TENANT_A',storeId:'QA_STORE_A',active:true,role:'owner'},
 channelConsent:{ownerUserId:'QA_USER_A',tenantId:'QA_TENANT_A',storeId:'QA_STORE_A',
 providerAccountRef:'QA_ACCOUNT_A',providerBotRef:'QA_BOT_A',
 status:'INDEPENDENTLY_VERIFIED_QA_FIXTURE',expiresAtMs:NOW+60000,revoked:false}
};
const run=(change={},key='')=>{
 const r=structuredClone(base);
 if(key)Object.assign(r[key],change); else Object.assign(r,change);
 return assessOwnerEvidence(r,{now:()=>NOW});
};
test('positive synthetic chain does not grant hosted authority',()=>{
 const r=run();assert.equal(r.status,'SYNTHETIC_FOUR_ROW_CHAIN_READY_NOT_HOSTED');
 assert.equal(r.owner_proof_rows,4);assert.equal(r.certified_real_owner,false);
 assert.equal(r.hosted_jwt_verified,false);assert.equal(r.can_send,false);
 assert.equal(r.can_read_hosted,false);assert.equal(r.can_write_orders,false);
});
const blocks=[
 ['Missing evidence', {storeMembership:null},''],
 ['Missing authentic actor', {id:''},'user'],
 ['Forged nonfixture actor', {syntheticFixture:false},'user'],
 ['Suspended actor', {status:'DISABLED'},'user'],
 ['Tenant mismatch', {tenantId:'QA_TENANT_B'},'tenantMembership'],
 ['Inactive Tenant membership', {active:false},'tenantMembership'],
 ['Tenant user mismatch', {userId:'QA_USER_B'},'tenantMembership'],
 ['Unsupported Tenant role', {role:'staff'},'tenantMembership'],
 ['Store tenant mismatch', {tenantId:'QA_TENANT_B'},'store'],
 ['Paused Store', {status:'PAUSED'},'store'],
 ['Revoked Store', {status:'REVOKED'},'store'],
 ['Wrong Store member', {storeId:'QA_STORE_B'},'storeMembership'],
 ['Wrong Store member tenant', {tenantId:'QA_TENANT_B'},'storeMembership'],
 ['Wrong Store member actor', {userId:'QA_USER_B'},'storeMembership'],
 ['Inactive Store member', {active:false},'storeMembership'],
 ['Unsupported Store member role', {role:'staff'},'storeMembership'],
 ['Wrong consent owner', {ownerUserId:'QA_USER_B'},'channelConsent'],
 ['Wrong consent Store', {storeId:'QA_STORE_B'},'channelConsent'],
 ['Wrong consent Tenant', {tenantId:'QA_TENANT_B'},'channelConsent'],
 ['Consent merely PAIRED not verified', {status:'PAIRED'},'channelConsent'],
 ['Consent merely CONFIRMED synthetic', {status:'CONFIRMED'},'channelConsent'],
 ['Expired consent', {expiresAtMs:NOW-1},'channelConsent'],
 ['Consent expiration missing', {expiresAtMs:undefined},'channelConsent'],
 ['Revoked consent', {revoked:true},'channelConsent'],
 ['Consent status revoked unspecified', {revoked:undefined},'channelConsent'],
 ['Unknown provider', {providerBotRef:''},'channelConsent']
];
for(const [label,change,key] of blocks){
 test(label+' fails closed',()=>{
 const r=run(change,key);assert.equal(r.status,'BLOCKED');
 assert.equal(r.can_read_hosted,false);assert.equal(r.can_send,false);
 });
}
test('synthetic evidence hash scoped to Store and provider',()=>{
 const a=run(),other=structuredClone(base);
 other.store.id='QA_STORE_B';other.storeMembership.storeId='QA_STORE_B';other.channelConsent.storeId='QA_STORE_B';
 const b=assessOwnerEvidence(other,{now:()=>NOW});
 assert.equal(b.status,'SYNTHETIC_FOUR_ROW_CHAIN_READY_NOT_HOSTED');
 assert.notEqual(a.evidence_ref,b.evidence_ref);
 assert.match(a.evidence_ref,/^[a-f\d]{64}$/);
 assert.equal(Object.hasOwn(a,'ownerUserId'),false);
});
