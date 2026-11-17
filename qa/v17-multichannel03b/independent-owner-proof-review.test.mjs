import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {inspectSignedOwnerEvidence,inspectSameTenantOwnerPair}
 from './independent-owner-proof-review.mjs';
const NOW=1794900000000;
const KEY=['contract','ticket','tenantAlias','storeAlias','nonce','purpose','expiresAtMs'];
function fixture({storeAlias='storeQA001',tenantAlias='tenantQA001',ownerAlias='ownerPersonA',
 ticket='EV-0123456789ABCDEF',nonce='nonceQA100000001'}={}){
 const claim={contract:'T404_MC03B_OWNER_ATTESTATION_V1',ticket,tenantAlias,
  storeAlias,nonce,purpose:'READ_ONLY_STORE_AB_AUTH_UAT',expiresAtMs:NOW+3600000};
 const owners=[
  {role:'MERCHANT_OWNER',keyId:'key-owner001',actorAlias:ownerAlias},
  {role:'INDEPENDENT_REVIEWER',keyId:'key-review001',actorAlias:'reviewPersonA'}
 ];
 const keys=owners.map((v)=>{
  const pair=generateKeyPairSync('ed25519');
  return {...v,publicKey:pair.publicKey,privateKey:pair.privateKey,
   revoked:false,active:true,allowedTenantAlias:tenantAlias,
   validFromMs:NOW-1000,validUntilMs:NOW+3600000};
 });
 const data=Buffer.from(JSON.stringify(KEY.map(k=>claim[k])));
 const signatures=keys.map(k=>({
  role:k.role,keyId:k.keyId,actorAlias:k.actorAlias,
  signature:sign(null,data,k.privateKey).toString('base64url')
 }));
 const trustStore={source:'OPERATOR_PINNED_OFFLINE_PUBLIC_KEYS',
  readonly:true,realHostedAdmissionEnabled:false,
  resolveKey:(id)=>keys.find(k=>k.keyId===id)};
 const input={claim,signatures,trustStore,nowMs:NOW};
 return {input,keys};
}
const inspect=d=>inspectSignedOwnerEvidence(d.input);
const blocked=(d,why)=>{const r=inspect(d);assert.equal(r.status,'BLOCKED');assert.equal(r.reason,why);
 assert.equal(r.canAdmitRealUat,false);assert.equal(r.noSend,true);};
test('two independently pinned Ed25519 signatures verify only mathematics',()=>{
 const v=inspect(fixture());assert.equal(v.signaturePairVerified,true);
 assert.equal(v.realMerchantOwnerVerified,false);assert.equal(v.independentReviewerCertified,false);
 assert.equal(v.canAdmitRealUat,false);assert.equal(v.canDeploy,false);assert.equal(v.noSend,true);
});
test('missing independently pinned key store blocked',()=>{
 const f=fixture();f.input.trustStore=null;blocked(f,'PRIVATE_PINNED_TRUST_STORE_REQUIRED');
});
test('untrusted caller keysource blocked',()=>{
 const f=fixture();f.input.trustStore.source='SELF_REPORTED_KEYS';
 blocked(f,'PRIVATE_PINNED_TRUST_STORE_REQUIRED');
});
test('private trust store must be readonly and not hosted admission',()=>{
 const f=fixture();f.input.trustStore.readonly=false;
 blocked(f,'PRIVATE_PINNED_TRUST_STORE_REQUIRED');
 const g=fixture();g.input.trustStore.realHostedAdmissionEnabled=true;
 blocked(g,'PRIVATE_PINNED_TRUST_STORE_REQUIRED');
});
test('tampering signed tenant fails signature',()=>{
 const f=fixture();f.input.claim.tenantAlias='tenantOtherQA';
 blocked(f,'TRUSTED_SIGNER_OR_SCOPE_UNVERIFIED');
});
test('tampering signed store fails signature',()=>{
 const f=fixture();f.input.claim.storeAlias='storeOtherQA';
 blocked(f,'SIGNATURE_INVALID');
});
test('signed payload replay with new nonce fails',()=>{
 const f=fixture();f.input.claim.nonce='nonceDifferentQA';
 blocked(f,'SIGNATURE_INVALID');
});
test('attested signer revocation blocks',()=>{
 const f=fixture();f.keys[0].revoked=true;
 blocked(f,'TRUSTED_SIGNER_OR_SCOPE_UNVERIFIED');
});
test('expired signing key blocks',()=>{
 const f=fixture();f.keys[1].validUntilMs=NOW;
 blocked(f,'TRUSTED_SIGNER_OR_SCOPE_UNVERIFIED');
});
test('non-Ed25519 key cannot pass',()=>{
 const f=fixture();f.keys[1].publicKey={asymmetricKeyType:'rsa'};
 blocked(f,'TRUSTED_SIGNER_OR_SCOPE_UNVERIFIED');
});
test('duplicate reviewer key as owner is rejected',()=>{
 const f=fixture();f.input.signatures[1].keyId=f.input.signatures[0].keyId;
 blocked(f,'INDEPENDENT_TWO_SIGNERS_REQUIRED');
});
test('owner self-review alias blocked even with separate key',()=>{
 const f=fixture();f.input.signatures[1].actorAlias=f.input.signatures[0].actorAlias;
 blocked(f,'INDEPENDENT_TWO_SIGNERS_REQUIRED');
});
test('expired owner proof claim blocked',()=>{
 const f=fixture();f.input.claim.expiresAtMs=NOW;
 blocked(f,'INVALID_SCOPE_OR_TTL');
});
test('PII/attachment in owner claim forbidden',()=>{
 const f=fixture();f.input.claim.merchantEmail='qa@example.org';
 blocked(f,'INVALID_SCOPE_OR_TTL');
});
test('malformed signature cannot be interpreted as approval',()=>{
 const f=fixture();f.input.signatures[0].signature='bad';
 blocked(f,'INDEPENDENT_TWO_SIGNERS_REQUIRED');
});
test('distinct owners and distinct stores same tenant: only review candidate',()=>{
 const f=fixture();const g=fixture({storeAlias:'storeQB002',ownerAlias:'ownerPersonB',
  ticket:'EV-ABCDEF0123456789',nonce:'nonceQA200000002'});
 const a=inspect(f),b=inspect(g);
 const v=inspectSameTenantOwnerPair(a,b);
 assert.equal(v.sameTenantTwoStoresStructurallyPlausible,true);
 assert.equal(v.realMerchantOwnerVerified,false);assert.equal(v.canAdmitRealUat,false);
});
test('different Tenant cannot substitute for Store A/B',()=>{
 const f=fixture();const g=fixture({tenantAlias:'tenantOtherQA',storeAlias:'storeQB002',
  ownerAlias:'ownerPersonB',ticket:'EV-ABCDEF0123456789',nonce:'nonceQA200000002'});
 assert.equal(inspectSameTenantOwnerPair(inspect(f),inspect(g)).reason,
 'SAME_TENANT_DISTINCT_STORE_OWNERS_NOT_ESTABLISHED');
});
test('same owner for Store A/B cannot prove two distinct owner sessions',()=>{
 const f=fixture();const g=fixture({storeAlias:'storeQB002',ownerAlias:'ownerPersonA',
  ticket:'EV-ABCDEF0123456789',nonce:'nonceQA200000002'});
 assert.equal(inspectSameTenantOwnerPair(inspect(f),inspect(g)).reason,
 'SAME_TENANT_DISTINCT_STORE_OWNERS_NOT_ESTABLISHED');
});
test('reusing same ticket/nonce across two Store claims fails pair',()=>{
 const f=fixture();const g=fixture({storeAlias:'storeQB002',ownerAlias:'ownerPersonB'});
 assert.equal(inspectSameTenantOwnerPair(inspect(f),inspect(g)).status,'BLOCKED');
});
