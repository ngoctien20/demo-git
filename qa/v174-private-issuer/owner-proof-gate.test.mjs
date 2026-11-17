import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateInstallationOwner,signOperatorAttestationForOfflineQa,OWNER_CONTRACT} from './owner-proof-gate.mjs';
const key='FAKE_V174_QA_OPERATOR_ATTESTATION_KEY_LONGER_THAN_32_BYTES';
const now=Date.parse('2026-11-17T04:00:00Z');
const base={installation_ref:'QA_WEB_WIDGET_A',tenant_ref:'QA_TENANT_1',store_ref:'QA_STORE_A',
 bot_ref:'QA_BOT_A',origin:'https://qa-domain.example.invalid',approval_scope:'OWNER_APPROVED',
 owner_authority_verified:true,status:'OWNER_APPROVED',read_only:true};
const raw={version:1,installation_ref:base.installation_ref,tenant_ref:base.tenant_ref,
 store_ref:base.store_ref,bot_ref:base.bot_ref,domain:base.origin,
 owner_ref:'QA_OPERATOR_OWNER',domain_challenge_ref:'QA_DNS_EVIDENCE_001',
 issued_at:Math.floor(now/1000)-10,expires_at:Math.floor(now/1000)+300,state:'OWNER_APPROVED'};
const signed=()=>({...raw,signature:signOperatorAttestationForOfflineQa({proof:raw,fixtureKey:key})});
const verify=(more={})=>evaluateInstallationOwner({binding:base,attestation:signed(),verificationKey:key,now,...more});
test('01 contract marked V174',()=>assert.match(OWNER_CONTRACT,/V174/));
test('02 synthetic fixture is not independent merchant ownership',()=>{
 const r=evaluateInstallationOwner({binding:{...base,approval_scope:'SYNTHETIC_ONLY',owner_authority_verified:false}});
 assert.equal(r.status,'QA_FIXTURE_ONLY');assert.equal(r.allow_real_website_session,false);
});
test('03 valid keyed QA attestation still not real-world independent ownership',()=>{
 const r=verify();assert.equal(r.attestation_integrity_verified,true);
 assert.equal(r.merchant_owner_independently_verified,false);
 assert.equal(r.domain_control_independently_verified,false);
 assert.equal(r.allow_real_website_session,false);
});
test('04 rejects missing private evidence',()=>assert.equal(evaluateInstallationOwner({binding:base}).status,'BLOCKED'));
test('05 rejects fake status QA_APPROVED as production owner proof',()=>{
 assert.equal(evaluateInstallationOwner({binding:{...base,status:'QA_APPROVED'},attestation:signed(),verificationKey:key,now}).status,'BLOCKED');
});
test('06 rejects missing verified owner flag',()=>{
 assert.equal(evaluateInstallationOwner({binding:{...base,owner_authority_verified:false},attestation:signed(),verificationKey:key,now}).status,'BLOCKED');
});
test('07 rejects write-enabled owner binding',()=>{
 assert.equal(evaluateInstallationOwner({binding:{...base,read_only:false},attestation:signed(),verificationKey:key,now}).status,'BLOCKED');
});
test('08 wrong domain denied',()=>{
 assert.equal(evaluateInstallationOwner({binding:{...base,origin:'https://wrong.invalid'},attestation:signed(),verificationKey:key,now}).status,'BLOCKED');
});
test('09 wrong Store denied',()=>{
 assert.equal(evaluateInstallationOwner({binding:{...base,store_ref:'QA_STORE_B'},attestation:signed(),verificationKey:key,now}).status,'BLOCKED');
});
test('10 forged signature denied',()=>{
 assert.equal(evaluateInstallationOwner({binding:base,attestation:{...signed(),signature:'f'.repeat(64)},verificationKey:key,now}).status,'BLOCKED');
});
test('11 expired attestation denied',()=>{
 assert.equal(evaluateInstallationOwner({binding:base,attestation:signed(),verificationKey:key,now:now+360000}).status,'BLOCKED');
});
test('12 future attestation denied',()=>{
 assert.equal(evaluateInstallationOwner({binding:base,attestation:signed(),verificationKey:key,now:now-360000}).status,'BLOCKED');
});
test('13 revoked evidence ID denied',()=>{
 assert.equal(verify({rejectedProofs:new Set([raw.domain_challenge_ref])}).status,'BLOCKED');
});
test('14 absent owner verification key denied',()=>{
 assert.equal(evaluateInstallationOwner({binding:base,attestation:signed(),verificationKey:'',now}).status,'BLOCKED');
});
test('15 must reject weak operator key',()=>{
 assert.throws(()=>signOperatorAttestationForOfflineQa({proof:raw,fixtureKey:'weak'}));
});
test('16 signed owner attestation never reveals signing key',()=>{
 const r=verify();assert(!JSON.stringify(r).includes(key));
});
test('17 no actual Store RLS claim',()=>assert.equal(verify().hosted_store_rls_verified,false));
test('18 no real session authorization ever returned in source contract',()=>{
 for(const binding of [base,{...base,approval_scope:'SYNTHETIC_ONLY',owner_authority_verified:false}]){
  const x=evaluateInstallationOwner({binding,attestation:signed(),verificationKey:key,now});
  assert.equal(x.allow_real_website_session,false);
 }
});
