'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const h=require('./recovery-owner-gate.cjs');
const PROJECT=h.PROJECT;
const authGraph=h.AUTH_FK.map(([schema,table,fkCount])=>({schema,table,fkCount}));
const anonymousGroups=[
 {groupOrdinal:1,products:1,orders:1,activeOwners:2,authMatchedOwners:2},
 {groupOrdinal:2,products:1,orders:1,activeOwners:1,authMatchedOwners:1}
];
const baseline=()=>({projectRef:PROJECT,observationMode:'HOSTED_READ_ONLY_AGGREGATE',
 postgresMajor:'17',authUsers:3,authFkGraph:authGraph.map(x=>({...x})),
 products:2,orders:2,tenantGroups:2,
 anonymousGroups:anonymousGroups.map(x=>({...x})),
 storesTableExists:false,storeMembershipsTableExists:false});
const restoration=()=>({projectRef:PROJECT,
 authUsersIncludedInConsistentEncryptedArchive:false,
 allNineAuthFkReferencesReconciled:false,
 rolesSchemaAclPolicySnapshotVerified:false,
 applicationDataAndAuthFromSameConsistentSnapshot:false,
 dataRestoreTransactionExitZero:false,
 authUsersRestoredAndReferentialIntegrityVerified:false,
 allFourAppRowsRecoveredWithSourceHashes:false,
 independentRollbackDrillVerified:false});
const linter=()=>({mode:'PRIVATE_OFFLINE_LINT_ONLY',
 status:'READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION',
 candidateProducts:2,candidateOrders:2,issues:[]});
const ownership=()=>({projectRef:PROJECT,privateLinterSummary:linter(),
 independentlyVerifiedRowCount:0,realMerchantSignaturesPrivatelyVerified:false,
 independentReviewerSignaturesPrivatelyVerified:false,
 storeAuthorityIndependentOfTenantAndBotVerified:false,
 freshRowHashesVerifiedPrivately:false});
const has=(result,code)=>result.reasons.includes(code);
test('01 expected hosted 7 dependent application tables, 9 Auth FKs',()=>{
 assert.equal(h.AUTH_FK.length,7);
 assert.equal(h.AUTH_FK.reduce((n,x)=>n+x[2],0),9);
 assert.ok(h.AUTH_FK.every(x=>x[2]>=1));
});
test('02 exact verified anonymous hosted metadata matches structural baseline only',()=>{
 const r=h.inspectDependencySnapshot(baseline());
 assert.equal(r.status,'STRUCTURE_MATCHES_READ_ONLY_BASELINE');
 assert.equal(r.tableDependencyCount,7);
 assert.equal(r.expectedAuthForeignKeys,9);
 assert.equal(r.reviewedIndividualRows,0);
 assert.equal(r.verifiedOwnerToStoreRelations,0);
 assert.equal(r.canMigrate,false);
});
test('03 default missing input fail-closed',()=>{
 for(const fn of [h.inspectDependencySnapshot,h.assessRecoveryGate,h.assessFourRowOwnershipGate]){
  assert.equal(fn().status,'BLOCKED');
  assert.equal(fn().canMigrate,false);
 }
});
test('04 wrong project fail-closed',()=>{
 assert.ok(has(h.inspectDependencySnapshot({...baseline(),projectRef:'production'}),h.REASONS.PROJECT));
 assert.ok(has(h.assessRecoveryGate({...restoration(),projectRef:'production'}),h.REASONS.PROJECT));
 assert.ok(has(h.assessFourRowOwnershipGate({...ownership(),projectRef:'production'}),h.REASONS.PROJECT));
});
test('05 metadata observation must be read-only, never client asserted',()=>{
 assert.ok(has(h.inspectDependencySnapshot({...baseline(),observationMode:'CLIENT_CONFIRMED'}),h.REASONS.SOURCE));
});
test('06 PostgreSQL major version drift requires re-baseline',()=>{
 assert.ok(has(h.inspectDependencySnapshot({...baseline(),postgresMajor:'18'}),h.REASONS.SOURCE));
});
test('07 Auth user count drift is NOT hidden by app row counts',()=>{
 assert.ok(has(h.inspectDependencySnapshot({...baseline(),authUsers:4}),h.REASONS.AUTH));
});
test('08 missing one Auth FK hard fails',()=>{
 const s=baseline();s.authFkGraph.pop();
 assert.ok(has(h.inspectDependencySnapshot(s),h.REASONS.FKS));
});
test('09 extra foreign key is also material graph drift',()=>{
 const s=baseline();s.authFkGraph.push({schema:'public',table:'unknown',fkCount:1});
 assert.ok(has(h.inspectDependencySnapshot(s),h.REASONS.FKS));
});
test('10 altered FK multiplicity detected (two FKs to tester_access)',()=>{
 const s=baseline();s.authFkGraph[1].fkCount=1;
 assert.ok(has(h.inspectDependencySnapshot(s),h.REASONS.FKS));
});
test('11 duplicate FK row cannot forge a complete graph',()=>{
 const s=baseline();s.authFkGraph[0]=s.authFkGraph[1];
 assert.ok(has(h.inspectDependencySnapshot(s),h.REASONS.FKS));
});
test('12 changed Products/Orders total detects source drift',()=>{
 const s=baseline();s.products=3;
 assert.ok(has(h.inspectDependencySnapshot(s),h.REASONS.GROUPS));
});
test('13 owner counts do not authorize Store attribution',()=>{
 const r=h.inspectDependencySnapshot(baseline());
 assert.equal(r.status,'STRUCTURE_MATCHES_READ_ONLY_BASELINE');
 assert.equal(r.ownerStoreAttributionCertified,false);
 assert.equal(r.canBackfill,false);
});
test('14 owner FK mismatch blocks the anonymous aggregate audit',()=>{
 const s=baseline();s.anonymousGroups[0].authMatchedOwners=1;
 assert.ok(has(h.inspectDependencySnapshot(s),h.REASONS.GROUPS));
});
test('15 canonical Store tables unexpectedly present require re-baseline',()=>{
 const s=baseline();s.storesTableExists=true;
 assert.ok(has(h.inspectDependencySnapshot(s),h.REASONS.GROUPS));
});
test('16 original 5-schema app-only archive is NOT a full Auth recovery',()=>{
 const r=h.assessRecoveryGate(restoration());
 assert.equal(r.status,'BLOCKED');
 for(const code of [h.REASONS.FULL_ARCHIVE,h.REASONS.RESTORE,h.REASONS.ROLLBACK])
  assert.ok(has(r,code));
 assert.equal(r.schemaOnlyRestorePreviouslyPassed,true);
 assert.equal(r.originalAppOnlyArchiveSufficient,false);
});
test('17 schema-only success cannot be promoted to full restore',()=>{
 const s=restoration();s.schemaOnlyRestorePreviouslyPassed=true;
 assert.ok(has(h.assessRecoveryGate(s),h.REASONS.RESTORE));
});
test('18 declaring archive complete without verified data restore remains BLOCKED',()=>{
 const s=restoration();for(const k of ['authUsersIncludedInConsistentEncryptedArchive',
  'allNineAuthFkReferencesReconciled','rolesSchemaAclPolicySnapshotVerified',
  'applicationDataAndAuthFromSameConsistentSnapshot'])s[k]=true;
 assert.ok(has(h.assessRecoveryGate(s),h.REASONS.RESTORE));
});
test('19 even all claimed restore fields true never auto-certify real artifact',()=>{
 const s=restoration();for(const k of Object.keys(s))if(typeof s[k]==='boolean')s[k]=true;
 const r=h.assessRecoveryGate(s);
 assert.equal(r.fullRestoreCertified,false);
 assert.equal(r.canMigrate,false);
 assert.equal(r.status,'STRUCTURE_MATCHES_READ_ONLY_BASELINE');
 assert.equal(r.requiresTrustedPrivateOperatorVerification,true);
});
test('20 four syntactically correct offline linter claims are NOT actual store ownership',()=>{
 const r=h.assessFourRowOwnershipGate(ownership());
 assert.equal(r.status,'BLOCKED');
 assert.ok(has(r,h.REASONS.REVIEW));
 assert.equal(r.ownerStoreAttributionCertified,false);
});
test('21 missing one source row is blocked',()=>{
 const s=ownership();s.privateLinterSummary={...linter(),candidateOrders:1};
 assert.ok(has(h.assessFourRowOwnershipGate(s),h.REASONS.OWNERS));
});
test('22 exactly four claimed owner+reviewer proofs still require private validation',()=>{
 const s=ownership();for(const k of Object.keys(s))if(typeof s[k]==='boolean')s[k]=true;
 s.independentlyVerifiedRowCount=4;
 const r=h.assessFourRowOwnershipGate(s);
 assert.equal(r.status,'STRUCTURE_MATCHES_READ_ONLY_BASELINE');
 assert.equal(r.verifiedOwnerToStoreRelations,0);
 assert.equal(r.canBackfill,false);
 assert.equal(r.ownerStoreAttributionCertified,false);
});
test('23 combined release always BLOCKED even with all claimed gates',()=>{
 const s=restoration();for(const k of Object.keys(s))if(typeof s[k]==='boolean')s[k]=true;
 const owner=ownership();for(const k of Object.keys(owner))if(typeof owner[k]==='boolean')owner[k]=true;
 owner.independentlyVerifiedRowCount=4;
 const r=h.combinedGate({dependency:h.inspectDependencySnapshot(baseline()),
  recovery:h.assessRecoveryGate(s),ownership:h.assessFourRowOwnershipGate(owner),
  realJwtAcceptance:true,separateHostedApproval:true});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.canMigrate,false);
 assert.equal(r.canExecuteSql,false);
});
test('24 outputs never reflect raw source row/customer/Auth IDs or tokens',()=>{
 const secret='private-secret-identifiers-never-render';
 const r=h.assessFourRowOwnershipGate({...ownership(),recordId:secret,customerPhone:secret,token:secret});
 const rendered=JSON.stringify(r);
 assert.equal(rendered.includes(secret),false);
 assert.equal(r.customerDataExported,false);
});
test('25 all gates forbid hosted mutation and provider traffic',()=>{
 const all=[h.inspectDependencySnapshot(baseline()),
  h.assessRecoveryGate(restoration()),h.assessFourRowOwnershipGate(ownership()),
  h.combinedGate({})];
 for(const r of all){
  assert.equal(r.canMigrate,false);
  assert.equal(r.canExecuteSql,false);
  assert.equal(r.canAlterAcl,false);
  assert.equal(r.canContactProvider,false);
  assert.equal(r.canBackfill,false);
 }
});
