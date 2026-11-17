'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const actual=require('./g3t-real-private-admission-evidence.json');
const published=require('./g3s-connected-published-owner-mapping-evidence.json');
const {CONTRACT,EXPECTED_ALIASES,EXPECTED_VERSION,assess,buildTargetContract}=
 require('./g3t-private-owner-caller-m0-gate.cjs');
const clone=x=>structuredClone(x);
function lock(out){
 assert.equal(out.status,'STAGING_M1_AND_STORE_CUTOVER_NO_GO');
 assert.equal(out.sourceOnly,true);
 assert.equal(out.originalEvidenceRowCountAccepted,0);
 assert.equal(out.currentRealJwtPairsAccepted,0);
 assert.equal(out.verifiedBackupRestoreCount,0);
 assert.equal(out.realPublishedStoreAwareCallerCount,0);
 for(const k of [
  'realMerchantPrimarySourceAuthenticated','independentReviewerAuthenticated',
  'realFourRowStoreAssignmentVerified','realOwnerJwtSessionPairAuthenticated',
  'realSameTenantStoreABGranted','realCurrentBackupRestored',
  'realFullServiceAuthRecoveryVerified','realStoreAwarePublishedCallerDeployed',
  'canUseCurrentTenantWriterForStore','canAssignRealRowStore',
  'canApplyHostedStoreMigration','canChangeSqlRlsOrRpc',
  'canModifyActiveN8n','canReadRealCustomerOrders',
  'canRepointProviderWebhook','canSendProviderMessages','canPublish'
 ])assert.equal(out[k],false,k);
 const s=JSON.stringify(out);
 for(const v of ['bearer ','api_key','customer_name','sourceRowId',
  'PGPASSWORD','p_tenant uuid'])assert.equal(s.includes(v),false);
}
function check(src=actual,old=published){const out=assess(src,old);lock(out);return out;}
function mutatePacket(path,fn){const a=clone(actual);fn(a);return check(a,clone(published));}
test('real 3 Auth users 2 eligible session rows but ZERO same-Tenant owner pair',()=>{
 const out=check();
 assert.equal(out.reason,'G3T_REAL_PRIVATE_OWNER_WRITER_AND_RECOVERY_NO_GO');
 assert.equal(actual.auth.authUsersTotal,3);
 assert.equal(actual.auth.eligibleMembersWithSessionRecord,2);
 assert.equal(actual.auth.tenantsWithTwoEligibleOwnerIds,1);
 assert.equal(actual.auth.tenantsWithTwoEligibleOwnerSessionRows,0);
 assert.ok(out.blockers.includes('REAL_AUTH_TWO_OWNER_SESSION_AND_SAME_TENANT_STORE_AB_UNVERIFIED'));
});
test('Four row aliases remain original and no private source evidence exported',()=>{
 const out=check();
 assert.deepEqual(actual.fourRows.rowAliases,[...EXPECTED_ALIASES]);
 assert.equal(actual.fourRows.products,2);
 assert.equal(actual.fourRows.orders,2);
 assert.equal(actual.fourRows.ownerAttestedRowCount,0);
 assert.equal(actual.fourRows.customerLinkedOrders,0);
 assert.ok(out.blockers.includes('FOUR_ROW_PRIVATE_MERCHANT_PRIMARY_SOURCE_OWNER_PROOF_REQUIRED'));
});
test('verified RPC12 private intake and Windows no-Docker toolkit are reused not cloned',()=>{
 check();
 assert.equal(actual.privateOwnerIntakePr,244);
 assert.equal(actual.windowsRecoveryToolkitPr,382);
 assert.equal(actual.fourRows.privateOperatorIntakeAlreadyExists,true);
 assert.equal(actual.recovery.toolkitOnlyNoDockerWindows,true);
 assert.equal(actual.fourRows.privateOperatorIntakeExecutedThisPhase,false);
 assert.equal(actual.recovery.backupToolkitExecutedThisPhase,false);
});
test('M0 historical 5 app tables and 0 Auth does NOT establish current recovery',()=>{
 const out=check();
 assert.equal(actual.recovery.historicalArchiveApplicationTables,5);
 assert.equal(actual.recovery.historicalArchiveAuthUsersCovered,0);
 assert.equal(actual.recovery.currentAuthUsers,3);
 assert.equal(actual.recovery.storageBuckets,0);
 assert.equal(actual.recovery.storageObjects,0);
 assert.equal(actual.recovery.ownerScopeDecision,'UNDECIDED');
 assert.ok(out.blockers.includes('M0_CURRENT_RESTORABLE_SCOPE_NOT_INDEPENDENTLY_ACCEPTED'));
 assert.ok(out.blockers.includes('FOUNDER_M0_RECOVERY_SCOPE_NOT_CHOSEN'));
 assert.ok(out.blockers.includes('ZERO_STORAGE_OBJECTS_DOES_NOT_PROVE_AUTH_SETTINGS_RECOVERABLE'));
});
test('n8n 7 Publisher versions and 16 Commerce DataTables remain unscoped',()=>{
 const out=check();
 assert.equal(actual.published.publishedWorkflowsInspected,7);
 assert.equal(actual.published.commerceDataTableCount,16);
 assert.equal(actual.published.commerceDataTablesWithStoreId,0);
 assert.equal(actual.published.tenantOnlyCoreCommerceWorkflowCount,4);
 assert.ok(out.blockers.includes('PUBLISHED_COMMERCE_N8N_CALLER_AND_DATASTORE_STORE_AUTHORITY_MISSING'));
});
test('Current SQL writer ABI has no store arg, cannot auto-add p_store breaking old callers',()=>{
 const out=check();
 assert.equal(actual.writer.currentHasStoreArgument,false);
 assert.equal(actual.writer.runtimeUpdated,false);
 assert.equal(actual.writer.pgIdentityArgs.startsWith('p_tenant uuid, p_sku text'),true);
 assert.ok(out.blockers.includes('TENANT_ONLY_PRIVILEGED_PRODUCT_WRITER_MUST_BE_VERSIONED_AND_SCOPED'));
});
test('staged store contract requires signed issuer, DB membership, explicit atomic policy cutover',()=>{
 const v=buildTargetContract();
 assert.equal(v.canDeploy,false);
 assert.equal(v.canReadOrder,false);
 assert.equal(v.canSend,false);
 assert.equal(v.newWriterRequiresDbVerifiedStoreMembership,true);
 assert.equal(v.stageOrder.length,7);
 assert.ok(v.denyConditions.includes('client_supplied_tenant_id_or_store_id'));
 assert.ok(v.denyConditions.includes('legacy_permissive_tenant_select_policy_unreplaced'));
 assert.ok(v.denyConditions.includes('save_merchant_product_v1_without_store_scope'));
 assert.ok(v.resolverInput.includes('principal_auth_uid_from_verified_active_session'));
});
test('legacy Messenger published fingerprint rechecked, never stale',()=>{
 assert.equal(EXPECTED_VERSION.Z7FdV7uDvApfbURQ,
  '1064b1b3-d3f1-4a6b-a367-2414ba691522');
 check();
});
test('missing private evidence source packet denied',()=>{
 const x=check(null);
 assert.equal(x.reason,'G3T_SOURCE_OR_LINEAGE_NOT_TRUSTED');
});
test('source contract and intended project pinned',()=>{
 assert.equal(CONTRACT,'TIEN404_RPC10_G3T_PRIVATE_FOUR_ROW_CALLER_RECOVERY_ADMISSION_V1');
 assert.equal(actual.projectRef,'ifxlvrhyjhbzbrkdsida');
 assert.equal(actual.canonicalStoreMigrationPr,247);
});
for(const [field,bad] of [
 ['contract','UNTRUSTED'],['projectRef','other-project'],
 ['source','USER_CHAT'],['canonicalStoreMigrationPr',385],
 ['developmentParentPr',383],['privateOwnerIntakePr',391],
 ['windowsRecoveryToolkitPr',391],['existingRealAuthAdmissionPr',391],
 ['sqlSourceSha','f'.repeat(40)],['status','READY_FOR_PRODUCTION']
]){
 test('reject forged provenance '+field,()=>{
 const out=mutatePacket(field,x=>{x[field]=bad;});
 assert.equal(out.reason,'G3T_SOURCE_OR_LINEAGE_NOT_TRUSTED');
 });
}
for(const extra of ['botToken','jwt','customerPhone','ownerRawSignature',
 'merchantEmail','rawOrderId','backupPassword']){
 test('reject sensitive/private keys in G3T public evidence '+extra,()=>{
 const out=mutatePacket(extra,x=>{x[extra]='private';});
 assert.equal(out.reason,'G3T_SOURCE_OR_LINEAGE_NOT_TRUSTED');
 });
}
for(const k of ['auth','fourRows','published','writer','recovery','action']){
 test('reject embedded arbitrary sensitive key in '+k,()=>{
 const out=mutatePacket(k,x=>{x[k].secret='BAD';});
 assert.equal(out.reason,'G3T_METADATA_STRUCTURE_NOT_TRUSTED');
 });
}
for(const [where,key] of [
 ['auth','tenantsWithTwoEligibleOwnerSessionRows'],
 ['fourRows','products'],['fourRows','ownerAttestedRowCount'],
 ['published','publishedWorkflowsInspected'],
 ['recovery','historicalArchiveApplicationTables'],
 ['action','hostedSqlWrites']
]){
 test('reject invalid or negative count '+where+'.'+key,()=>{
 const out=mutatePacket(key,x=>{x[where][key]=-1;});
 assert.equal(out.reason,'G3T_UNTRUSTED_AGGREGATE');
 });
}
test('deny fake fifth row or omitted original order alias',()=>{
 const out=mutatePacket('rowAliases',x=>{x.fourRows.rowAliases.push('T3_ORDER_1');});
 assert.equal(out.reason,'G3T_PRIVATE_ROW_ALIAS_MISMATCH');
});
test('deny changed original row ordering',()=>{
 const out=mutatePacket('rowAliases',x=>{x.fourRows.rowAliases.reverse();});
 assert.equal(out.reason,'G3T_PRIVATE_ROW_ALIAS_MISMATCH');
});
test('deny runtime writer ABI change with no independent published audit',()=>{
 const out=mutatePacket('pgIdentityArgs',x=>{x.writer.pgIdentityArgs+=' , p_store uuid';});
 assert.equal(out.reason,'G3T_WRITER_OR_M0_CONTRACT_DRIFT');
});
test('deny owner self-report of M0 scope completion in a static packet',()=>{
 const out=mutatePacket('ownerScopeDecision',x=>{x.recovery.ownerScopeDecision='FULL_SERVICE';});
 assert.equal(out.reason,'G3T_WRITER_OR_M0_CONTRACT_DRIFT');
});
test('fake owner and reviewer signs all four -> still NO-GO',()=>{
 const x=clone(actual);
 x.fourRows.ownerAttestedRowCount=4;
 x.fourRows.sourceVersionRowDigestPrivatelyAttested=true;
 x.fourRows.independentOwnerPrimarySourceVerified=true;
 x.fourRows.independentReviewerAccepted=true;
 x.fourRows.canonicalStoresAuthenticated=true;
 const out=check(x);
 assert.equal(out.originalEvidenceRowCountAccepted,0);
 assert.equal(out.realFourRowStoreAssignmentVerified,false);
});
test('fake real jwt plus client Store grants -> still NO-GO',()=>{
 const x=clone(actual);
 x.auth.tenantsWithTwoEligibleOwnerSessionRows=1;
 x.auth.independentlyVerifiedRealJwtOwnerPair=true;
 x.auth.twoActualStoreMembershipsSameTenant=true;
 const out=check(x);
 assert.equal(out.currentRealJwtPairsAccepted,0);
});
test('fake full recovery and restored backup -> still NO-GO',()=>{
 const x=clone(actual);
 x.recovery.currentFullServiceRecoveryProven=true;
 x.recovery.currentApplicationBackupAndIsolatedRestoreProven=true;
 x.recovery.externalAuthRecoveryPlanVerified=true;
 x.recovery.currentRecoveryAcceptedByReviewer=true;
 const out=check(x);
 assert.equal(out.verifiedBackupRestoreCount,0);
});
test('fake all-green live caller claims and store data do not authorize',()=>{
 const x=clone(actual);
 x.published.storeAwareCommerceWorkflowCount=4;
 x.published.commerceDataTablesWithStoreId=16;
 x.published.tenantOnlyCoreCommerceWorkflowCount=0;
 x.published.realHostedStoreReaderEnabled=true;
 x.published.realNativeSignedStoreInstallationVerified=true;
 x.writer.currentHasStoreArgument=true;
 x.writer.actualHostedWriterStoreAuthorizationVerified=true;
 x.writer.runtimeUpdated=true;
 const out=check(x);
 assert.equal(out.realPublishedStoreAwareCallerCount,0);
 assert.equal(out.canApplyHostedStoreMigration,false);
});
test('unexpected Published workflow SHA stops G3T operator promotion',()=>{
 const old=clone(published);
 old.n8n.publishedWorkflowObservations[0].publishedVersion='DRIFT';
 const out=check(actual,old);
 assert.equal(out.reason,'G3T_PARENT_CALLER_INVENTORY_NOT_RECONCILED');
});
test('old G3S core data table Store claim still rejects Hosted migration',()=>{
 const old=clone(published);
 old.n8n.commerceDataTables[0].hasStoreId=true;
 old.n8n.commerceDataTables[0].storeColumnCount=1;
 old.n8n.commerceTablesWithStoreId=1;
 const out=check(actual,old);
 assert.equal(out.canApplyHostedStoreMigration,false);
});
for(const k of ['actualCustomerOrOrderRowsRead','credentialOrTokenValuesRead',
 'providerEventsSent','hostedSqlWrites','n8nWorkflowExecuted',
 'n8nWorkflowUpdated','cloudflareDeployed','hostedMigrationApplied']){
 test('observed unsafe operation '+k+' makes scope violation explicit',()=>{
 const x=clone(actual);x.action[k]=1;
 const out=check(x);
 assert.ok(out.blockers.includes('SOURCE_ONLY_BOUNDARY_VIOLATED'));
 });
}
for(const k of ['privatelySignedFourRowOwnersAdmitted','operatorAuthenticatedThisPhase','separateHostedM1ApprovalObtained']){
 test('self declared authenticated operator '+k+' cannot approve release',()=>{
 const x=clone(actual);x.action[k]=true;
 const out=check(x);
 assert.ok(out.blockers.includes('UNVERIFIED_SELF_REPORTED_OPERATOR_APPROVAL'));
 });
}
