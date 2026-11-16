'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const intake=require('./advanced-hosted-rpc-store-private-intake.cjs');
const md5='37f127c1475378b2810197961398d945';
const rpc=()=>({
 projectRef:'ifxlvrhyjhbzbrkdsida',
 signature:'public.qa_shop_b_zalo_claim(uuid,text,text,text)',
 functionDigestMd5:md5,ownerRole:'postgres',
 securityDefiner:true,searchPathRestricted:true,
 anonExecute:true,anonExplicitGrant:true,publicExecute:false,
 authenticatedExecute:false,vaultGuardPresent:true,callerInputValidated:true,
 hmacPresent:true,delegatedPrivateInvoker:true,
 observedScope:'READ_ONLY_HOSTED_METADATA'
});
const store=()=>({
 projectRef:'ifxlvrhyjhbzbrkdsida',
 tables:{stores:false,storeMemberships:false},
 storeScopedColumns:{orders:false,products:false,orderItems:false},
 rlsEnabled:{orders:true,products:true,orderItems:true},
 signedJwtProofActuallyPerformed:false,
 sameTenantNegativeCasesPassed:false,crossTenantNegativeCasesPassed:false,
 observedScope:'READ_ONLY_HOSTED_METADATA'
});
let idx=0;
const receipt=(type='RPC_AUTHORITY_REVIEW')=>({
 contract:intake.CONTRACT,type,
 evidenceSha256:String(++idx).padStart(64,'a'),
 receiptNonce:String(idx).padStart(32,'b'),
 issuerClass:'SECURITY_REVIEWER',
 obtainedAt:'2026-11-16T05:40:00.000Z',
 privateStoreVerifiedOutOfBand:false,
 reviewedByIndependentAuthority:false
});
test('01 contract and project fingerprint match read-only metadata',()=>{
 assert.equal(intake.BASELINE.projectRef,'ifxlvrhyjhbzbrkdsida');
 assert.equal(intake.BASELINE.digestMd5,md5);
 assert.equal(intake.CONTRACT,'T404_ADV5D_HOSTED_PRIVATE_RECEIPT_GATE_V1');
});
test('02 detects explicit anon-executable SECURITY DEFINER as P0 review surface',()=>{
 const r=intake.checkHostedRpcMetadata(rpc());
 assert.equal(r.status,'PRIVILEGED_ANON_RPC_REVIEW_REQUIRED');
 assert.equal(r.aclGrantToAnon,true);assert.equal(r.anonExecute,true);
 assert.equal(r.releaseAuthorized,false);assert.equal(r.canChangeRpcGrant,false);
});
test('03 distinct PUBLIC role and authenticated role are not accidentally elevated',()=>{
 const r=intake.checkHostedRpcMetadata(rpc());
 assert.equal(r.publicExecute,false);assert.equal(r.authenticatedExecute,false);
});
test('04 existing Vault/HMAC/search_path mitigations are recorded but do NOT imply secure',()=>{
 const r=intake.checkHostedRpcMetadata(rpc());
 for(const x of Object.values(r.mitigations))assert.equal(x,true);
 assert.equal(r.knownExploitDemonstrated,false);
 assert.equal(r.bypassProven,false);assert.equal(r.releaseAuthorized,false);
});
test('05 routine digest drift triggers hard re-audit',()=>{
 const r=intake.checkHostedRpcMetadata({...rpc(),functionDigestMd5:'0'.repeat(32)});
 assert.equal(r.status,'REJECTED');
 assert.equal(r.reason,'FUNCTION_BODY_DRIFT_REQUIRES_REAUDIT');
});
test('06 missing or forged project ID is rejected',()=>{
 const r=intake.checkHostedRpcMetadata({...rpc(),projectRef:'fake-other-project'});
 assert.equal(r.reason,'RPC_BASELINE_OR_PROVENANCE_MISMATCH');
});
test('07 extra JSON fake approval or JWT key is rejected',()=>{
 for(const field of ['ownerApproved','service_role','jwt']){
  assert.equal(intake.checkHostedRpcMetadata({...rpc(),[field]:'fake'}).status,'REJECTED');
 }
});
test('08 mutated type for any boolean flag is denied',()=>{
 assert.equal(intake.checkHostedRpcMetadata({...rpc(),anonExecute:'true'}).reason,'RPC_FLAG_TYPE_INVALID');
});
test('09 non-anon grant requires new review instead of claiming safety',()=>{
 const r=intake.checkHostedRpcMetadata({...rpc(),anonExecute:false,anonExplicitGrant:false});
 assert.equal(r.status,'RPC_ACCESS_CHANGED_REAUDIT_REQUIRED');
 assert.equal(r.releaseAuthorized,false);
});
test('10 current hosted Store schema remains structurally blocked',()=>{
 const r=intake.evaluateHostedStoreReadiness(store());
 assert.equal(r.status,'STORE_SCHEMA_MISSING');
 assert.equal(r.structurallyReady,false);
 assert.equal(r.realJwtProofIndependentlyVerified,false);
});
test('11 real storeId column cannot be inferred from tenantId column',()=>{
 const r=intake.evaluateHostedStoreReadiness(store());
 assert.equal(r.tenantScopedRlsIsNotStoreRls,true);
 assert.equal(r.storeAorBAccessCertified,false);
});
test('12 one missing store membership table still blocks',()=>{
 const x=store();x.tables.stores=true;
 assert.equal(intake.evaluateHostedStoreReadiness(x).status,'STORE_SCHEMA_MISSING');
});
test('13 all Store columns but RLS missing remains blocked',()=>{
 const x=store();x.tables={stores:true,storeMemberships:true};
 x.storeScopedColumns={orders:true,products:true,orderItems:true};
 x.rlsEnabled={orders:true,products:false,orderItems:true};
 assert.equal(intake.evaluateHostedStoreReadiness(x).status,'STORE_RLS_INCOMPLETE');
});
test('14 structurally valid tables require actual signed JWT evidence',()=>{
 const x=store();x.tables={stores:true,storeMemberships:true};
 x.storeScopedColumns={orders:true,products:true,orderItems:true};
 assert.equal(intake.evaluateHostedStoreReadiness(x).status,'REAL_HOSTED_JWT_NEGATIVE_PROOF_REQUIRED');
});
test('15 self-asserted JWT PASS cannot certify Shop A/B',()=>{
 const x=store();x.tables={stores:true,storeMemberships:true};
 x.storeScopedColumns={orders:true,products:true,orderItems:true};
 x.signedJwtProofActuallyPerformed=true;
 x.sameTenantNegativeCasesPassed=true;x.crossTenantNegativeCasesPassed=true;
 const r=intake.evaluateHostedStoreReadiness(x);
 assert.equal(r.status,'PRIVATE_JWT_PROOF_REQUIRES_TRUSTED_INDEPENDENT_VERIFICATION');
 assert.equal(r.realJwtProofIndependentlyVerified,false);
 assert.equal(r.releaseAuthorized,false);
});
test('16 arbitrary extra credential field invalidates Store evidence',()=>{
 const r=intake.evaluateHostedStoreReadiness({...store(),token:'secret-do-not-log'});
 assert.equal(r.status,'REJECTED');
});
test('17 receipt with SHA-256 digest metadata is accepted as metadata ONLY',()=>{
 const r=intake.checkPrivateReceipt(receipt());
 assert.equal(r.status,'METADATA_RECEIPT_ACCEPTED_PENDING_PRIVATE_REVIEW');
 assert.equal(r.verifiedByTrustedSystem,false);
 assert.equal(r.privateStorageVerified,false);
 assert.equal(r.releaseAuthorized,false);
});
test('18 even two asserted true flags do not authenticate evidence',()=>{
 const x=receipt();x.privateStoreVerifiedOutOfBand=true;x.reviewedByIndependentAuthority=true;
 const r=intake.checkPrivateReceipt(x);
 assert.equal(r.privateStorageClaimed,true);
 assert.equal(r.independentReviewClaimed,true);
 assert.equal(r.independentReviewVerified,false);
 assert.equal(r.ownerG23Certified,false);
});
test('19 receipt cannot embed JWT, OTP, secret or URL',()=>{
 for(const [key,val] of Object.entries({
  jwt:'signed-token',otp:'123456',backupFile:'backup.sql',sourceUri:'https://private.example',
  realOwnerName:'Merchant','service_role':'abc'
 })){
  assert.equal(intake.checkPrivateReceipt({...receipt(),[key]:val}).status,'REJECTED');
 }
});
test('20 wrong or uppercase digest rejected',()=>{
 for(const hash of ['short','Z'.repeat(64),'A'.repeat(64),'000.00']){
  assert.equal(intake.checkPrivateReceipt({...receipt(),evidenceSha256:hash}).status,'REJECTED');
 }
});
test('21 bogus UAT receipts not in allowlist rejected',()=>{
 assert.equal(intake.checkPrivateReceipt(receipt('APPROVE_PRODUCTION')).status,'REJECTED');
});
test('22 unknown operator class or malformed timestamp rejected',()=>{
 assert.equal(intake.checkPrivateReceipt({...receipt(),issuerClass:'SUPER_ADMIN'}).status,'REJECTED');
 assert.equal(intake.checkPrivateReceipt({...receipt(),obtainedAt:'yesterday'}).status,'REJECTED');
});
test('23 all ten allowed receipt labels are unique and immutable',()=>{
 assert.equal(intake.RECEIPT_TYPES.length,10);
 assert.equal(new Set(intake.RECEIPT_TYPES).size,10);
 assert(Object.isFrozen(intake.RECEIPT_TYPES));
});
test('24 empty receipt list still NO-GO and never touches hosted',()=>{
 const x=intake.buildDecision({rpc:rpc(),store:store()});
 assert.equal(x.receiptCount,0);
 assert.equal(x.decision,'NO_GO_HOSTED_OR_PRODUCTION');
 assert.equal(x.hostedWrites,0);assert.equal(x.providerSends,0);
});
test('25 all evidence types present still do not create independent attestation',()=>{
 const arr=intake.RECEIPT_TYPES.map(type=>receipt(type));
 const x=intake.buildDecision({rpc:rpc(),store:store(),receipts:arr});
 assert.equal(x.receiptCount,10);
 assert.equal(x.independentAttestationAccepted,false);
 assert.equal(x.merchantOwnerVerified,false);
 assert.equal(x.releaseAuthorized,false);
});
test('26 duplicated evidence fingerprint cannot be counted twice',()=>{
 const x=receipt();const y={...receipt('SHOP_A_JWT_RLS'),evidenceSha256:x.evidenceSha256};
 assert.equal(intake.buildDecision({rpc:rpc(),store:store(),receipts:[x,y]}).reason,
  'DUPLICATE_EVIDENCE_FINGERPRINT');
});
test('27 reject more than 20 unauthenticated receipt claims',()=>{
 const arr=Array.from({length:21},()=>receipt());
 assert.equal(intake.buildDecision({rpc:rpc(),store:store(),receipts:arr}).reason,'RECEIPT_LIST_INVALID');
});
test('28 preserves ADV5C 10 release blockers',()=>{
 const x=intake.buildDecision({rpc:rpc(),store:store()});
 assert.equal(x.gates.length,10);
 assert(x.gates.every(g=>g.status!=='VERIFIED'));
 assert.equal(x.securityP0Cleared,false);assert.equal(x.jwtRlsCertified,false);
});
test('29 integrity checks do not submit provider messages or real token calls',()=>{
 const src=fs.readFileSync(__dirname+'/advanced-hosted-rpc-store-private-intake.cjs','utf8');
 for(const re of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\baxios\b/,/\bcreateClient\s*\(/,
  /\bprocess\.env\b/,/\bchild_process\b/,/\bhttps?\.request\s*\(/,
  /\bsendMessage\s*\(/,/\bcrypto\.sign\s*\(/]){
  assert(!re.test(src),String(re));
 }
});
test('30 read-only SQL is metadata-only and excludes mutations',()=>{
 const sql=fs.readFileSync(__dirname+'/advanced-hosted-rpc-readonly-metadata.sql','utf8');
 assert.match(sql,/BEGIN TRANSACTION READ ONLY;/);
 assert.match(sql,/COMMIT;/);
 const clean=sql.replace(/--[^\n]*/g,'');
 for(const re of [/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REVOKE|GRANT|CALL|TRUNCATE|COPY)\b/im,
  /vault\.decrypted_secrets\b/i,/\bpassword\b/i,/\bselect\s+\*\b/i])
  assert(!re.test(clean),String(re));
 assert.match(clean,/has_function_privilege/);
 assert.match(clean,/pg_policies/);
});
