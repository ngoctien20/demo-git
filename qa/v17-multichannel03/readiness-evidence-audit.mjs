// TIEN404 V17.MULTI-CHANNEL-03 — source-only, sanitized evidence reconciliation.
// Does not verify private Supabase JWTs, Meta Page ownership or real webhook.
// Does not call Supabase/Meta/n8n, use credentials, deploy, send or write.
// This audits *claimed read-only metadata*, NOT an independent witness signature.
// A positive structural review can NEVER authorize a real UAT.
const EXPECTED_TABLES=Object.freeze(['products','orders','customers',
  'order_items','conversations','messages']);
const REQUIRED_IDS=Object.freeze({
  project:'ifxlvrhyjhbzbrkdsida',
  messenger:'Z7FdV7uDvApfbURQ',
  zaloBot:'yIJk8LvJoLF40Z62',
  zaloRouter:'sIPs6egzIwOY1GNv'
});
const REQUIRED_UAT_FLAGS=Object.freeze([
 'realStoreAOwnerJwtReadOnlyVerified','realStoreBOwnerJwtReadOnlyVerified',
 'sameTenantDifferentStoreVerified','storeCrossReadDeniedByRealRls',
 'commercialStaffAssignmentsVerified','revocationTestedWithRealJwt',
 'independentMetaPageOwnershipVerified','independentMetaAppRoleVerified',
 'isolatedQaPageAppDifferentFromProduction',
 'independentMetaHandoverPermissionVerified','signedNativeHandoverEventNoSendVerified',
 'durableAtomicReplayVerified','singleResponderLegacyNotSendingDuringUat',
 'merchantOwnerConsentVerified','independentOperatorApprovalVerified',
 'managedSecretsAndKillSwitchVerified'
]);
const DENY=Object.freeze({
  realUatAuthorized:false,canDeploy:false,canSend:false,
  canReadRealCustomerInbox:false,canWriteOrder:false,canModifyPublished:false
});
const strictObject=(obj,keys)=>obj!==null&&typeof obj==='object'&&
  !Array.isArray(obj)&&Object.keys(obj).length===keys.length&&
  keys.every(k=>Object.hasOwn(obj,k));
const int=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000;
const fail=(reason)=>Object.freeze({
  contract:'T404_V17_MC03_READ_ONLY_EVIDENCE_AUDIT_V1',
  ...DENY,status:'BLOCKED',reason,missing:Object.freeze([])
});
function extractShape(o) {
  if(!o||o.source!=='CONNECTED_READ_ONLY_SANITIZED_METADATA'||
    o.projectRef!==REQUIRED_IDS.project||o.environment!=='staging'||
    typeof o.snapshotDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(o.snapshotDate)||
    !Array.isArray(o.coreTables)||o.coreTables.length!==EXPECTED_TABLES.length||
    !o.coreTables.every(row=>strictObject(row,['name','hasStoreId','storePolicyCount','rlsEnabled'])&&
      EXPECTED_TABLES.includes(row.name)&&typeof row.hasStoreId==='boolean'&&
      typeof row.rlsEnabled==='boolean'&&int(row.storePolicyCount))||
    new Set(o.coreTables.map(x=>x.name)).size!==EXPECTED_TABLES.length||
    !strictObject(o.auth,['activeMemberUsers','tenantsWithTwoActiveMembers',
      'tenantsWithTwoMemberUsersWithDbSessions','dbSessionRowsWithinNotAfter'])||
    !Object.values(o.auth).every(int)||
    !strictObject(o.registry,['canonicalStoreTableCount','canonicalStoreMembershipTableCount',
      'commercialStaffRegistryTableCount'])||
    !Object.values(o.registry).every(int)||
    !strictObject(o.workflow,['messengerId','messengerVersion',
      'zaloBotId','zaloBotVersion','zaloRouterId','zaloRouterVersion'])||
    o.workflow.messengerId!==REQUIRED_IDS.messenger||
    o.workflow.zaloBotId!==REQUIRED_IDS.zaloBot||
    o.workflow.zaloRouterId!==REQUIRED_IDS.zaloRouter||
    !['messengerVersion','zaloBotVersion','zaloRouterVersion']
      .every(k=>/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(o.workflow[k]))||
    !strictObject(o.privateUatEvidence,REQUIRED_UAT_FLAGS)||
    !Object.values(o.privateUatEvidence).every(x=>x===true||x===false))
     return false;
  // Reject fake automatically asserted "has real JWT" from registry/session counts;
  // the real provenance of flags must be checked out of band by human reviewer.
  return true;
}
export function inspectReadOnlyUatEvidence(o) {
  if(!extractShape(o))return fail('SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
  const blockers=[];
  const a=o.auth,reg=o.registry,proof=o.privateUatEvidence;
  for(const row of o.coreTables) {
    if(!row.rlsEnabled) blockers.push('CORE_RLS_DISABLED:'+row.name);
    if(!row.hasStoreId) blockers.push('STORE_ID_COLUMN_ABSENT:'+row.name);
    if(row.storePolicyCount===0) blockers.push('STORE_RLS_POLICY_ABSENT:'+row.name);
  }
  if(reg.canonicalStoreTableCount<1)blockers.push('CANONICAL_STORES_ABSENT');
  if(reg.canonicalStoreMembershipTableCount<1)blockers.push('CANONICAL_STORE_MEMBERSHIPS_ABSENT');
  if(reg.commercialStaffRegistryTableCount<1)blockers.push('COMMERCIAL_STAFF_REGISTRY_ABSENT');
  if(a.tenantsWithTwoActiveMembers<1)blockers.push('NO_SAME_TENANT_MEMBER_PAIR');
  if(a.tenantsWithTwoMemberUsersWithDbSessions<1)blockers.push('NO_SAME_TENANT_PAIR_WITH_DB_SESSION_RECORDS');
  for(const key of REQUIRED_UAT_FLAGS)
    if(proof[key]!==true) blockers.push('PRIVATE_PROOF_PENDING:'+key);
  if(proof.signedNativeHandoverEventNoSendVerified===true &&
    (proof.independentMetaPageOwnershipVerified!==true ||
      proof.independentMetaAppRoleVerified!==true ||
      proof.isolatedQaPageAppDifferentFromProduction!==true))
    blockers.push('HANDOVER_PROOF_INCONSISTENT_WITH_NATIVE_APP_PAGE_AUTH');
  // These are descriptive evidence checks only. No self-asserted input can
  // ever elevate this module to an AUTHORIZATION token.
  const readyToRequestIndependentReview=blockers.length===0;
  return Object.freeze({
    contract:'T404_V17_MC03_READ_ONLY_EVIDENCE_AUDIT_V1',
    status:readyToRequestIndependentReview?'REQUIRES_INDEPENDENT_PRIVATE_REVIEW':'BLOCKED',
    ...DENY,
    missing:Object.freeze(blockers),
    observed:Object.freeze({
      coreStoreColumnCount:o.coreTables.filter(t=>t.hasStoreId).length,
      coreStorePolicyCount:o.coreTables.filter(t=>t.storePolicyCount>0).length,
      activeMemberUsers:a.activeMemberUsers,
      tenantsWithTwoActiveMembers:a.tenantsWithTwoActiveMembers,
      tenantsWithTwoMemberUsersWithDbSessions:a.tenantsWithTwoMemberUsersWithDbSessions,
      dbSessionRowsWithinNotAfter:a.dbSessionRowsWithinNotAfter,
      canonicalStoreTableCount:reg.canonicalStoreTableCount,
      commercialStaffRegistryTableCount:reg.commercialStaffRegistryTableCount,
      auditedTableCount:EXPECTED_TABLES.length
    }),
    evidenceIsIndependent:false,
    realSignedMetaHandoverVerifiedByThisModule:false,
    actualJwtVerifiedByThisModule:false,
    readyToRequestIndependentReview
  });
}
export {REQUIRED_UAT_FLAGS,EXPECTED_TABLES};
