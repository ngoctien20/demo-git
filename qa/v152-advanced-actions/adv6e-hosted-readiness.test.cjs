'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const source=require('./adv6e-hosted-readonly-snapshot.json');
const gate=require('./adv6e-hosted-readiness.cjs');
const NOW=Date.parse('2026-11-16T06:24:00.000Z');
const clone=x=>JSON.parse(JSON.stringify(x));
const assess=x=>gate.assess(x,{now:NOW});
const unsafeActions=['authorizeBackup','restoreBackup','signApproval',
 'updatePrivilege','applyMigration','sendMessage','executeOrder'];
test('01 source snapshot uses exact read-only hosted metadata contract',()=>{
 assert.equal(source.contract,gate.VERSION);
 assert.equal(source.scope,'SUPABASE_STAGING_METADATA_ONLY_NOT_AUTH_PROOF');
});
test('02 hosted risk snapshot accepted only as metadata, no certificate',()=>{
 const a=assess(source);
 assert.equal(a.validReadOnlyShape,true);
 assert.equal(a.status,'SECURITY_REVIEW_REQUIRED_NO_GO');
 assert.equal(a.hostedCertificationIssued,false);
});
test('03 RPC anon SECURITY DEFINER exposure is flagged',()=>{
 const a=assess(source);
 assert(a.findings.includes('P0_ANON_CALLABLE_PRIVILEGED_RPC'));
});
test('04 authenticated SECURITY DEFINER exposures require review',()=>{
 assert(assess(source).findings.includes('P0_AUTHENTICATED_CALLABLE_PRIVILEGED_RPC_REVIEW'));
});
test('05 missing Store-level schema blocks hosted Owner proof',()=>{
 assert(assess(source).findings.includes('P0_SAME_TENANT_STORE_OWNERSHIP_SCHEMA_NOT_READY'));
});
test('06 missing private nonce schema blocks hosted replay claim',()=>{
 assert(assess(source).findings.includes('P0_HOSTED_PRIVATE_ACTION_NONCE_NOT_READY'));
});
test('07 leaked password protection advisor is flagged P1',()=>{
 assert(assess(source).findings.includes('P1_LEAKED_PASSWORD_PROTECTION_DISABLED'));
});
test('08 admin SQL reader never establishes Owner JWT-RLS proof',()=>{
 const r=assess(source);assert.equal(r.actualHostedOwnerRlsCertified,false);
 assert.equal(r.metadataSourceCryptographicallyVerified,false);
});
test('09 analyst cannot upgrade metadata with verified:true',()=>{
 const x=clone(source);x.verified=true;
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('10 adding an unreviewed customer token is forbidden',()=>{
 const x=clone(source);x.jwt='do-not-accept-jwt';
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('11 missing RPC is rejected as incomplete snapshot',()=>{
 const x=clone(source);x.rpc.pop();
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('12 duplicate RPC is rejected rather than counted twice',()=>{
 const x=clone(source);x.rpc[1]=clone(x.rpc[0]);
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('13 exact function signature must be preserved',()=>{
 const x=clone(source);x.rpc[1].args='p_code text';
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('14 privilege metadata cannot use string instead of boolean',()=>{
 const x=clone(source);x.rpc[0].anonExecute='false';
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('15 custom RPC cannot be smuggled into snapshot',()=>{
 const x=clone(source);x.rpc[0].name='DROP_ACCOUNTS';
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('16 RPC granted anon cannot be reported as clean advisor',()=>{
 const x=clone(source);x.alerts.anonSecurityDefinerCallable=0;
 assert(assess(x).findings.includes('SECURITY_ADVISOR_AND_PG_CATALOG_DISAGREE'));
});
test('17 generated snapshot older than 24h cannot be used for current certification',()=>{
 const r=gate.assess(source,{now:NOW+25*3600000});
 assert.equal(r.validReadOnlyShape,false);
});
test('18 metadata time in the future denied',()=>{
 const x=clone(source);x.observedAtUtc='2026-11-16T07:30:00.000Z';
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('19 impossible store table count denied',()=>{
 const x=clone(source);x.storeTablesPresent=-1;
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('20 nonexistent nonce boolean value denied',()=>{
 const x=clone(source);x.actionNoncePrivateSchemaPresent='true';
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('21 hypothetical clean ACL/schema remains PENDING independent proof, not PASS',()=>{
 const x=clone(source);
 x.storeTablesPresent=2;x.storeColumnsOnOrdersAndMemberships=2;
 x.actionNoncePrivateSchemaPresent=true;
 for(const f of x.rpc){f.anonExecute=false;f.authenticatedExecute=false}
 x.alerts.anonSecurityDefinerCallable=0;x.alerts.authenticatedSecurityDefinerCallable=0;
 x.alerts.leakedPasswordProtectionDisabled=false;
 const a=assess(x);
 assert.equal(a.validReadOnlyShape,true);
 assert(a.findings.includes('INDEPENDENT_PRIVATE_AUTHORITY_AND_REAL_HOSTED_PROOFS_MISSING'));
 assert.equal(a.productionReleaseAuthorized,false);
});
test('22 no Controller/Reviewer/Operator authentication inferred',()=>{
 const a=assess(source);
 assert.equal(a.securityReviewerAuthorityVerified,false);
 assert.equal(a.rpcFunctionBehaviorCertified,false);
});
test('23 no source-only review can export data',()=>{
 for(const name of unsafeActions)assert.throws(()=>gate[name](),/ADV6E_HOSTED_EXECUTION_NOT_IMPLEMENTED/);
});
test('24 all sensitive operation flags explicitly false',()=>{
 const a=assess(source);
 for(const key of ['exportAuthorized','restoreAuthorized','grantAuthorized',
  'revokeAuthorized','migrationAuthorized','liveProviderSendAuthorized',
  'realCommerceWriteAuthorized','productionReleaseAuthorized'])
  assert.equal(a[key],false,key);
});
test('25 no private data or evidence paths emitted in report',()=>{
 const a=assess(source),o=JSON.stringify(a);
 assert(!o.includes('ifxlvrhyjhbzbrkdsida'));
 assert(!o.includes('postgres'));
 assert(!o.includes('private:'));
});
test('26 unknown caller role cannot be mistaken for approved admin',()=>{
 const x=clone(source);x.sqlAuditRole='authenticated';
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('27 missing evidence source metadata cannot pass',()=>{
 const x=clone(source);delete x.evidenceCaveat;
 assert.equal(assess(x).validReadOnlyShape,false);
});
test('28 inactive permission changes cannot be interpreted as a hosted fix',()=>{
 const a=assess(source);
 assert.equal(a.hostedCertificationIssued,false);
 assert.equal(a.actualHostedActionNonceCertified,false);
});
test('29 evidence gates cover independent backup and isolated restore',()=>{
 assert(gate.REQUIRED_EVIDENCE.some(x=>x.includes('ISOLATED_RESTORE')));
});
test('30 scope-based permission gate requires two live Owner sessions',()=>{
 assert(gate.REQUIRED_EVIDENCE.some(x=>x.includes('TWO_REAL_NON_BYPASS_OWNER_SESSIONS')));
});
