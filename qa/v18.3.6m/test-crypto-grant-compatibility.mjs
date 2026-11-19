import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,verify,createHmac} from 'node:crypto';
import {assessCryptoCompatibility,assessPrivilegeInventory,cryptoOptions} from './crypto-privilege-compatibility.mjs';

const met=()=>({pgcryptoInstalled:1,pgsodiumInstalled:0,pgsodiumAvailable:1,pgjwtInstalled:0,candidateEd25519PublicFunctions:0});
const grants=()=>({publicFunctionCount:8,publicSecurityDefiner:4,
  definerAnonExecutable:1,definerAuthenticatedExecutable:2,
  definerServiceExecutable:1,verifiedFunctionBodiesByIndependentHuman:false,
  dataApiSchemaExposureVerified:false,explicitOwnerApprovalToAlterGrants:false});
test('C01 ephemeral Node Ed25519 signing and verifying works',()=>{
 const k=generateKeyPairSync('ed25519');
 const data=Buffer.from('TIEN404 synthetic private reviewer fixture');
 const sig=sign(null,data,k.privateKey);
 assert.equal(sig.length,64);assert.equal(verify(null,data,k.publicKey,sig),true);
});
test('C02 mutated Ed25519 payload is rejected',()=>{
 const k=generateKeyPairSync('ed25519'),data=Buffer.from('fixture');
 const sig=sign(null,data,k.privateKey);
 assert.equal(verify(null,Buffer.from('modified'),k.publicKey,sig),false);
});
test('C03 signature with different public key is denied',()=>{
 const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');
 const data=Buffer.from('fixture');
 assert.equal(verify(null,data,b.publicKey,sign(null,data,a.privateKey)),false);
});
test('C04 HMAC-SHA256 known vector matches PostgreSQL pgcrypto assertion',()=>{
 assert.equal(createHmac('sha256','key').update('message').digest('hex'),
  '6e9ef29b75fffc5b7abae527d58fdadb2fe42e7219011976917343065f58ed4a');
});
test('C05 Node Ed25519 support does not imply in-DB Ed25519',()=>{
 const q=assessCryptoCompatibility(met());
 assert.equal(q.postgresEd25519Verified,false);
 assert.equal(q.productionAdmitted,false);
});
test('C06 known metadata packet is design review only',()=>{
 const q=assessCryptoCompatibility(met());
 assert.equal(q.status,'CRYPTO_DESIGN_REVIEW_ONLY');
 assert.equal(q.postgresHmacPresent,true);
});
test('C07 missing crypto metadata rejected',()=>{
 const q=assessCryptoCompatibility({});
 assert.equal(q.status,'REQUIRES_METADATA_RECHECK');
});
test('C08 no pgcrypto installed cannot claim HMAC parity',()=>{
 const x=met();x.pgcryptoInstalled=0;
 assert.equal(assessCryptoCompatibility(x).postgresHmacPresent,false);
});
test('C09 pgsodium available but not installed is NOT supported verifier',()=>{
 const q=assessCryptoCompatibility(met());
 assert.equal(q.pgSodiumActivationApproved,false);
});
test('C10 pgsodium installed state change forces re-review',()=>{
 const x=met();x.pgsodiumInstalled=1;
 assert.ok(assessCryptoCompatibility(x).blockers.includes('RECHECK_PGSODIUM_INSTALLED_BEFORE_CLAIM'));
});
test('C11 pgjwt installed state change forces re-review',()=>{
 const x=met();x.pgjwtInstalled=1;
 assert.ok(assessCryptoCompatibility(x).blockers.includes('RECHECK_PGJWT_INSTALLED_BEFORE_CLAIM'));
});
test('C12 actual Ed25519 candidate symbol forces separate compatibility review',()=>{
 const x=met();x.candidateEd25519PublicFunctions=1;
 assert.ok(assessCryptoCompatibility(x).blockers.includes('ED25519_CANDIDATE_NEEDS_INDEPENDENT_AUDIT'));
});
test('C13 no metadata can promote a verifier to production',()=>{
 const q=assessCryptoCompatibility(met());
 assert.equal(q.productionKeyCustodyVerified,false);
 assert.equal(q.productionAdmitted,false);
});
test('C14 crypto option matrix labels Ed25519 SQL as unknown',()=>{
 const opt=cryptoOptions.find(x=>x.id==='PGSODIUM_ED25519_CANDIDATE');
 assert.equal(opt.dbSidePublicKeyVerification,'UNKNOWN');
});
test('C15 production HMAC requires shared DB secret boundary',()=>{
 const opt=cryptoOptions.find(x=>x.id==='PGCRYPTO_HMAC_SHA256');
 assert.equal(opt.sharedSecretInDB,true);
});
test('G01 real-style metadata indicates public SECDEF review required',()=>{
 const q=assessPrivilegeInventory(grants());
 assert.equal(q.status,'REVIEW_REQUIRED');
 assert.ok(q.blockers.includes('PUBLIC_SECDEF_ANON_EXEC_REVIEW_REQUIRED'));
});
test('G02 authenticated EXECUTE requires body and tenant-scope audit',()=>{
 assert.ok(assessPrivilegeInventory(grants()).blockers.includes('PUBLIC_SECDEF_AUTHENTICATED_EXEC_REVIEW_REQUIRED'));
});
test('G03 service-role EXECUTE requires explicit bypass review',()=>{
 assert.ok(assessPrivilegeInventory(grants()).blockers.includes('SERVICE_ROLE_SECDEF_REVIEW_REQUIRED'));
});
test('G04 aggregate metadata alone is NOT proof of exploit',()=>{
 const q=assessPrivilegeInventory(grants());
 assert.equal(q.exposureProven,false);assert.equal(q.exploitProven,false);
});
test('G05 cannot auto revoke grants without approval',()=>{
 const q=assessPrivilegeInventory(grants());
 assert.equal(q.permissionsChanged,false);assert.equal(q.grantRevocationApproved,false);
});
test('G06 missing real function-body review flagged',()=>{
 assert.ok(assessPrivilegeInventory(grants()).blockers.includes('FUNCTION_BODY_SECURITY_REVIEW_PENDING'));
});
test('G07 unverified Data API exposed schema flagged',()=>{
 assert.ok(assessPrivilegeInventory(grants()).blockers.includes('POSTGREST_EXPOSED_SCHEMA_REVIEW_PENDING'));
});
test('G08 no explicit grant-change approval blocks remediation',()=>{
 assert.ok(assessPrivilegeInventory(grants()).blockers.includes('NO_APPROVAL_TO_CHANGE_GRANTS'));
});
test('G09 impossible aggregate numbers flagged',()=>{
 const x=grants();x.definerAnonExecutable=100;
 assert.ok(assessPrivilegeInventory(x).blockers.includes('INCONSISTENT_GRANT_COUNTS'));
});
test('G10 missing counts flagged',()=>{
 assert.ok(assessPrivilegeInventory({}).blockers.some(x=>x.startsWith('MISSING_GRANT_METADATA_')));
});
test('G11 negative counts flagged',()=>{
 const x=grants();x.publicFunctionCount=-1;
 assert.ok(assessPrivilegeInventory(x).blockers.includes('MISSING_GRANT_METADATA_publicFunctionCount'));
});
test('G12 no anon EXECUTE still does not establish release',()=>{
 const x=grants();x.definerAnonExecutable=0;
 assert.equal(assessPrivilegeInventory(x).productionAdmitted,false);
});
test('G13 even all-true metadata cannot replace reviewer',()=>{
 const x=grants();x.verifiedFunctionBodiesByIndependentHuman=true;
 x.dataApiSchemaExposureVerified=true;x.explicitOwnerApprovalToAlterGrants=true;
 const q=assessPrivilegeInventory(x);assert.equal(q.status,'REVIEW_REQUIRED');
 assert.equal(q.productionAdmitted,false);
});
test('G14 grant inventory never reads SQL function bodies',()=>{
 assert.equal(assessPrivilegeInventory(grants()).securityDefinerBodiesAccessed,false);
});
