'use strict';
/**
 * TIEN404 AI V14.4.8 -- ZERO-I/O recovery dependency + four-row owner gate.
 * Everything here is a source-only structural linter. It CANNOT:
 * - read / export / restore auth.users or customer data
 * - attest a real merchant signature or independent reviewer
 * - authenticate a JWT or migrate Store/RLS/GRANT/schema
 * - authorize hosted writes, provider sends or production.
 *
 * SOURCE EVIDENCE is metadata-only, obtained read-only at 2026-11-16 JST.
 * All mutable input/claims are UNTRUSTED; output NEVER includes any row IDs.
 */
const PROJECT='ifxlvrhyjhbzbrkdsida';
const BASELINE=Object.freeze({postgresMajor:'17',authUsers:3,products:2,orders:2,tenantGroups:2});
const AUTH_FK=Object.freeze([
 ['public','tenant_memberships',1],
 ['public','tien404_tester_access',2],
 ['public','tien404_tester_google_sheets',1],
 ['public','tien404_tester_requests',2],
 ['public','tien404_tester_runs',1],
 ['public','tien404_tester_staff',1],
 ['tien404_r1_qa','owner_pairing_challenges',1]
]);
const REASONS=Object.freeze({
 PROJECT:'WRONG_OR_UNVERIFIED_PROJECT',
 SOURCE:'METADATA_NOT_VERIFIED_FROM_READ_ONLY_CATALOG',
 FKS:'AUTH_FK_DEPENDENCY_GRAPH_DRIFT',
 AUTH:'AUTH_USER_COUNT_DRIFT',
 GROUPS:'FOUR_ROW_BASELINE_DRIFT',
 FULL_ARCHIVE:'BACKUP_OMITS_AUTH_OR_RELATED_DATA',
 RESTORE:'CONSISTENT_FULL_DATA_RESTORE_NOT_VERIFIED',
 ROLLBACK:'INDEPENDENT_ROLLBACK_NOT_VERIFIED',
 OWNERS:'FOUR_INDEPENDENT_OWNER_STORE_ATTESTATIONS_MISSING',
 REVIEW:'INDEPENDENT_PRIVATE_REVIEW_NOT_VERIFIED',
 JWT:'REAL_SIGNED_STORE_JWT_ACCEPTANCE_NOT_VERIFIED',
 APPROVAL:'SEPARATE_HOSTED_CHANGE_APPROVAL_MISSING'
});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function safeResult(kind,reasons,extra={}){
 return Object.freeze({
  kind,status:reasons.length?'BLOCKED':'STRUCTURE_MATCHES_READ_ONLY_BASELINE',
  reasons:Object.freeze([...new Set(reasons)].sort()),...extra,
  fullRestoreCertified:false,ownerStoreAttributionCertified:false,
  canBackfill:false,canMigrate:false,canExecuteSql:false,
  canAlterAcl:false,canContactProvider:false,customerDataExported:false
 });
}
function inspectDependencySnapshot(snapshot){
 const s=obj(snapshot)?snapshot:{},why=[];
 if(s.projectRef!==PROJECT)why.push(REASONS.PROJECT);
 if(s.observationMode!=='HOSTED_READ_ONLY_AGGREGATE'||
    s.postgresMajor!==BASELINE.postgresMajor)why.push(REASONS.SOURCE);
 if(s.authUsers!==BASELINE.authUsers)why.push(REASONS.AUTH);
 if(!Array.isArray(s.authFkGraph)||s.authFkGraph.length!==AUTH_FK.length||
    AUTH_FK.some(([schema,table,count])=>
       !s.authFkGraph.some(r=>r?.schema===schema&&r?.table===table&&r?.fkCount===count))||
    s.authFkGraph.some(r=>!AUTH_FK.some(([schema,table,count])=>
       r?.schema===schema&&r?.table===table&&r?.fkCount===count)))
    why.push(REASONS.FKS);
 if(s.products!==2||s.orders!==2||s.tenantGroups!==2||
    !Array.isArray(s.anonymousGroups)||s.anonymousGroups.length!==2||
    s.anonymousGroups.some(g=>!obj(g)||g.products!==1||g.orders!==1||
      !Number.isInteger(g.activeOwners)||g.activeOwners<1||
      g.authMatchedOwners!==g.activeOwners)||
    ![1,2].every(n=>s.anonymousGroups.some(g=>g.groupOrdinal===n))||
    s.storesTableExists!==false||s.storeMembershipsTableExists!==false)
    why.push(REASONS.GROUPS);
 return safeResult('HOSTED_DEPENDENCY_BASELINE',why,{
   tableDependencyCount:AUTH_FK.length,
   expectedAuthForeignKeys:AUTH_FK.reduce((a,x)=>a+x[2],0),
   candidateRows:{products:BASELINE.products,orders:BASELINE.orders},
   reviewedIndividualRows:0,verifiedOwnerToStoreRelations:0,
   note:'Anonymous counts do not identify a Store, merchant or individual record'
 });
}
function assessRecoveryGate(source){
 const s=obj(source)?source:{},why=[];
 if(s.projectRef!==PROJECT)why.push(REASONS.PROJECT);
 if(s.authUsersIncludedInConsistentEncryptedArchive!==true||
    s.allNineAuthFkReferencesReconciled!==true||
    s.rolesSchemaAclPolicySnapshotVerified!==true||
    s.applicationDataAndAuthFromSameConsistentSnapshot!==true)
    why.push(REASONS.FULL_ARCHIVE);
 if(s.dataRestoreTransactionExitZero!==true||
    s.authUsersRestoredAndReferentialIntegrityVerified!==true||
    s.allFourAppRowsRecoveredWithSourceHashes!==true)
    why.push(REASONS.RESTORE);
 if(s.independentRollbackDrillVerified!==true)why.push(REASONS.ROLLBACK);
 return safeResult('RECOVERY_EVIDENCE_GATE',why,{
  schemaOnlyRestorePreviouslyPassed:true,
  originalAppOnlyArchiveSufficient:false,
  requiresTrustedPrivateOperatorVerification:true,
  note:'Claims are untrusted until independent restore artifacts and signoff are examined'
 });
}
function assessFourRowOwnershipGate(source){
 const s=obj(source)?source:{},why=[];
 if(s.projectRef!==PROJECT)why.push(REASONS.PROJECT);
 const l=s.privateLinterSummary;
 if(!obj(l)||l.mode!=='PRIVATE_OFFLINE_LINT_ONLY'||
    l.status!=='READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION'||
    l.candidateProducts!==2||l.candidateOrders!==2||
    !Array.isArray(l.issues)||l.issues.length!==0)
    why.push(REASONS.OWNERS);
 if(s.independentlyVerifiedRowCount!==4||
    s.realMerchantSignaturesPrivatelyVerified!==true||
    s.independentReviewerSignaturesPrivatelyVerified!==true||
    s.storeAuthorityIndependentOfTenantAndBotVerified!==true||
    s.freshRowHashesVerifiedPrivately!==true)
    why.push(REASONS.REVIEW);
 return safeResult('FOUR_ROW_OWNER_EVIDENCE_GATE',why,{
  requiredPrivateSlots:Object.freeze(['P01','P02','O01','O02']),
  reviewedIndividualRows:0,verifiedOwnerToStoreRelations:0,
  note:'Even complete supplied claims cannot become authoritative via this source-only linter'
 });
}
function combinedGate({dependency,recovery,ownership,realJwtAcceptance,separateHostedApproval}={}){
 const why=[];
 if(dependency?.status!=='STRUCTURE_MATCHES_READ_ONLY_BASELINE')why.push(REASONS.SOURCE);
 if(!recovery||recovery.kind!=='RECOVERY_EVIDENCE_GATE'||recovery.reasons.length)
   why.push(REASONS.RESTORE);
 if(!ownership||ownership.kind!=='FOUR_ROW_OWNER_EVIDENCE_GATE'||ownership.reasons.length)
   why.push(REASONS.OWNERS);
 if(realJwtAcceptance!==true)why.push(REASONS.JWT);
 if(separateHostedApproval!==true)why.push(REASONS.APPROVAL);
 return safeResult('COMBINED_RELEASE_DECISION',why,{
    status:'BLOCKED',
    reason:'Offline claims never authorize database migration; independent approval required'
 });
}
module.exports=Object.freeze({PROJECT,BASELINE,AUTH_FK,REASONS,
 inspectDependencySnapshot,assessRecoveryGate,assessFourRowOwnershipGate,combinedGate});
