'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const gate=require('./advanced-authorized-rpc-remediation-gate.cjs');
const rpc=()=>({projectRef:'ifxlvrhyjhbzbrkdsida',
 signature:'public.qa_shop_b_zalo_claim(uuid,text,text,text)',
 functionDigestMd5:'37f127c1475378b2810197961398d945',
 ownerRole:'postgres',securityDefiner:true,searchPathRestricted:true,
 anonExecute:true,anonExplicitGrant:true,publicExecute:false,authenticatedExecute:false,
 vaultGuardPresent:true,callerInputValidated:true,hmacPresent:true,
 delegatedPrivateInvoker:true,observedScope:'READ_ONLY_HOSTED_METADATA'});
const store=()=>({projectRef:'ifxlvrhyjhbzbrkdsida',
 tables:{stores:false,storeMemberships:false},
 storeScopedColumns:{orders:false,products:false,orderItems:false},
 rlsEnabled:{orders:true,products:true,orderItems:true},
 signedJwtProofActuallyPerformed:false,sameTenantNegativeCasesPassed:false,
 crossTenantNegativeCasesPassed:false,observedScope:'READ_ONLY_HOSTED_METADATA'});
const create=(opts={})=>gate.createGate({rpc:rpc(),store:store(),...opts});
test('01 correct ADV5E versioned contract',()=>assert.equal(gate.CONTRACT,'T404_ADV5E_RPC_REMEDIATION_AND_JWT_HOSTED_GATE_V1'));
test('02 default recommendation is private gateway only as a proposal',()=>{
 const x=create();assert.equal(x.preferredOption,'MIGRATE_PRIVATE_GATEWAY');
 assert.equal(x.optionAssessment.status,'PREFERRED_DESIGN_NOT_AUTHORIZED');
 assert.equal(x.decision,'NO_GO_HOSTED_EXECUTION_OR_PRODUCTION');
});
test('03 all three remediation options considered, none deployable',()=>{
 assert.deepEqual(Object.keys(gate.OPTIONS),['KEEP_AND_HARDEN','MIGRATE_PRIVATE_GATEWAY','ISOLATE_TEMPORARILY']);
 for(const option of Object.keys(gate.OPTIONS)){
  const x=create({option});assert.equal(x.hostedExecutionAuthorized,false);
  assert.equal(x.migrationOrGrantAuthorized,false);
  assert.equal(x.productionReleaseAuthorized,false);
 }
});
test('04 unknown or arbitrary remediation option rejected',()=>{
 assert.equal(create({option:'REVOKE_ANON_NOW'}).status,'REJECTED');
});
test('05 callable anon SECURITY DEFINER still requires independent P0 review',()=>{
 const x=create();assert.equal(x.rpcReviewStatus,'PRIVILEGED_ANON_RPC_REVIEW_REQUIRED');
 assert.equal(x.phase,'INVENTORY_AND_PRIVATE_AUTHORITY_REVIEW_ONLY');
});
test('06 source hash drift cannot authorize modifications',()=>{
 const x=create({rpc:{...rpc(),functionDigestMd5:'b'.repeat(32)}});
 assert.equal(x.phase,'REBASELINE_RPC_FIRST');
 assert.equal(x.hostedExecutionAuthorized,false);
});
test('07 current Store schema blocks JWT cases',()=>{
 const x=create();assert.equal(x.storeReadinessStatus,'STORE_SCHEMA_MISSING');
 assert.equal(x.signedJwtExecutionAuthorized,false);
});
test('08 three separate highly sensitive domains require approvals',()=>{
 const x=create();for(const s of ['RPC_SECURITY_CHANGE','HOSTED_STORE_SCHEMA_CHANGE','REAL_JWT_RLS_TEST'])
  assert(x.executionScopes.some(y=>y.scope===s&&y.status==='BLOCKED'));
});
test('09 backup and public send are separate scopes',()=>{
 const x=create();for(const s of ['BACKUP_OR_RESTORE','CHANNEL_PUBLIC_RELEASE'])
  assert(x.executionScopes.some(y=>y.scope===s&&y.status==='BLOCKED'));
});
test('10 operation-scoped approvals must not be inferred from boolean flags',()=>{
 const x=create({authorizationClaims:{userApproved:true,securityReviewerApproved:true,allPassed:true}});
 assert.equal(x.approvalClaimsSupplied,true);assert.equal(x.approvalClaimsTrusted,false);
 assert.equal(x.signedJwtExecutionAuthorized,false);
});
test('11 credentials in untrusted authorization claims are never echoed',()=>{
 const secret='PRIVATE_TEST_SENTINEL_DO_NOT_PUBLISH';
 const x=create({authorizationClaims:{access_token:secret,service_role:secret,owner:'true'}});
 assert.equal(JSON.stringify(x).includes(secret),false);
 assert.equal(x.approvalClaimsTrusted,false);
});
test('12 15 prerequisites stay pending, even if metadata is strong',()=>{
 const x=create();assert.equal(x.prerequisites.length,15);
 assert(x.prerequisites.every(y=>y.status==='PENDING_INDEPENDENT_ATTESTATION'));
});
test('13 12 real JWT negative and positive test designs are distinct',()=>{
 const ids=gate.JWT_CASES.map(x=>x.id);
 assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);
});
test('14 same tenant cross Store tested in both directions',()=>{
 const a=gate.JWT_CASES.find(x=>x.id==='JWT02');
 const b=gate.JWT_CASES.find(x=>x.id==='JWT03');
 assert.match(a.target,/SAME_TENANT/);assert.match(b.target,/SAME_TENANT/);
 assert.equal(a.expected,'DENY');assert.equal(b.expected,'DENY');
});
test('15 checks cross-tenant deny',()=>{
 assert.equal(gate.JWT_CASES.find(x=>x.id==='JWT04').expected,'DENY');
});
test('16 prevents privilege escalation on insert and update',()=>{
 for(const id of ['JWT08','JWT09'])assert.match(gate.JWT_CASES.find(x=>x.id===id).expected,/CHECK_DENY/);
});
test('17 JWT revocation and expiry require negative cases',()=>{
 assert.equal(gate.JWT_CASES.find(x=>x.id==='JWT05').expected,'DENY_AFTER_REVOCATION');
 assert.equal(gate.JWT_CASES.find(x=>x.id==='JWT06').expected,'AUTH_REJECT_OR_NO_ROWS');
});
test('18 browser cannot contain service role',()=>{
 assert.equal(gate.JWT_CASES.find(x=>x.id==='JWT12').expected,'NO_SECRET_EXPOSURE');
});
test('19 replay test requires durable denial',()=>{
 assert.equal(gate.JWT_CASES.find(x=>x.id==='JWT10').expected,'DURABLE_REPLAY_DENY');
});
test('20 status objects are immutable',()=>{
 const x=create();
 assert(Object.isFrozen(x));assert(Object.isFrozen(x.executionScopes));
 assert(Object.isFrozen(gate.JWT_CASES));
});
test('21 arbitrary metadata receipts cannot grant any scope',()=>{
 const x=create({receipts:[]});
 assert.equal(x.publicReceiptCount,0);
 assert(x.executionScopes.every(z=>z.executable===false));
});
test('22 malformed receipt rejects request',()=>{
 const x=create({receipts:[{approved:true}]});
 assert.equal(x.status,'REJECTED');
});
test('23 duplicate evidence fingerprint is blocked',()=>{
 const base={contract:'T404_ADV5D_HOSTED_PRIVATE_RECEIPT_GATE_V1',
  type:'RPC_AUTHORITY_REVIEW',evidenceSha256:'a'.repeat(64),
  receiptNonce:'b'.repeat(32),issuerClass:'SECURITY_REVIEWER',
  obtainedAt:'2026-11-16T05:40:00.000Z',
  privateStoreVerifiedOutOfBand:true,reviewedByIndependentAuthority:true};
 const x=create({receipts:[base,{...base,type:'RPC_CALLER_DEPENDENCY'}]});
 assert.equal(x.status,'REJECTED');assert.equal(x.reason,'DUPLICATE_RECEIPT_DIGEST');
});
test('24 self-asserted true receipt is still not authorization',()=>{
 const receipt={contract:'T404_ADV5D_HOSTED_PRIVATE_RECEIPT_GATE_V1',
  type:'RPC_AUTHORITY_REVIEW',evidenceSha256:'c'.repeat(64),
  receiptNonce:'d'.repeat(32),issuerClass:'SECURITY_REVIEWER',
  obtainedAt:'2026-11-16T05:40:00.000Z',
  privateStoreVerifiedOutOfBand:true,reviewedByIndependentAuthority:true};
 const x=create({receipts:[receipt]});
 assert.equal(x.publicReceiptCount,1);
 assert.equal(x.independentEvidenceVerified,false);
 assert.equal(x.hostedExecutionAuthorized,false);
});
test('25 invalid receipt count rejected',()=>{
 assert.equal(create({receipts:Array(16).fill({})}).status,'REJECTED');
});
test('26 all claimed real JWT tests PASS cannot authorize',()=>{
 const statuses=Object.fromEntries(gate.JWT_CASES.map(x=>[x.id,'PASS']));
 const x=gate.inspectHostReviewResult({contract:gate.CONTRACT,
  rpcSourceMd5:'37f127c1475378b2810197961398d945',
  jwtCaseStatuses:statuses,operatorAction:'REAL_JWT_RLS_TEST',
  independentSecuritySignerVerified:true,merchantOwnerVerified:true,rollbackReady:true});
 assert.equal(x.allTestsClaimedPass,true);
 assert.equal(x.privateSignerVerified,false);
 assert.equal(x.executionAuthorized,false);
 assert.equal(x.productionReleaseAuthorized,false);
});
test('27 public reviewer report cannot include real JWT/credential fields',()=>{
 const statuses=Object.fromEntries(gate.JWT_CASES.map(x=>[x.id,'PASS']));
 const x=gate.inspectHostReviewResult({contract:gate.CONTRACT,
  rpcSourceMd5:'37f127c1475378b2810197961398d945',
  jwtCaseStatuses:statuses,operatorAction:'REAL_JWT_RLS_TEST',
  independentSecuritySignerVerified:true,merchantOwnerVerified:true,rollbackReady:true,
  jwt:'FAKE_SECRET'});
 assert.equal(x.status,'REJECTED');
});
test('28 missing JWT case blocked, no false coverage',()=>{
 const statuses=Object.fromEntries(gate.JWT_CASES.slice(1).map(x=>[x.id,'PASS']));
 const x=gate.inspectHostReviewResult({contract:gate.CONTRACT,
  rpcSourceMd5:'37f127c1475378b2810197961398d945',
  jwtCaseStatuses:statuses,operatorAction:'REAL_JWT_RLS_TEST',
  independentSecuritySignerVerified:false,merchantOwnerVerified:false,rollbackReady:false});
 assert.equal(x.status,'REJECTED');
});
test('29 wrong version/unknown scope cannot be legitimized',()=>{
 const statuses=Object.fromEntries(gate.JWT_CASES.map(x=>[x.id,'NOT_RUN']));
 const x=gate.inspectHostReviewResult({contract:'VERSION_FAKED',
  rpcSourceMd5:'37f127c1475378b2810197961398d945',
  jwtCaseStatuses:statuses,operatorAction:'PRODUCTION_DEPLOY',
  independentSecuritySignerVerified:false,merchantOwnerVerified:false,rollbackReady:false});
 assert.equal(x.status,'REJECTED');
});
test('30 full plan declares zero external effects and cost',()=>{
 const x=create();
 assert.equal(x.hostedReads,0);assert.equal(x.hostedWrites,0);
 assert.equal(x.providerSends,0);assert.equal(x.realModelCalls,0);
 assert.equal(x.paidSpendVnd,0);
});
test('31 no node network, DB client, cryptographic signer or system process',()=>{
 const txt=fs.readFileSync(__dirname+'/advanced-authorized-rpc-remediation-gate.cjs','utf8');
 for(const re of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\bWebSocket\b/,/\bhttps?\.request\s*\(/,
  /\bcreateClient\s*\(/,/\bprocess\.env\b/,/\bchild_process\b/,/\bcrypto\.sign\s*\(/])
  assert(!re.test(txt),String(re));
});
test('32 source-only code never dynamically evaluates an authorization token',()=>{
 const txt=fs.readFileSync(__dirname+'/advanced-authorized-rpc-remediation-gate.cjs','utf8');
 assert(!/\beval\s*\(|\bnew Function\s*\(|\bJSON\.parse\s*\(\s*jwt/.test(txt));
});
