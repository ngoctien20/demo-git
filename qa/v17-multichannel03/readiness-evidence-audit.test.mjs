import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectReadOnlyUatEvidence,REQUIRED_UAT_FLAGS,EXPECTED_TABLES}
 from './readiness-evidence-audit.mjs';
const snapshot=JSON.parse(readFileSync(new URL('./actual-sanitized-hosted-evidence-20261117.json',import.meta.url),'utf8'));
const fresh=()=>structuredClone(snapshot);
const audit=(a=fresh())=>inspectReadOnlyUatEvidence(a);
const contains=(a,x)=>a.missing.includes(x);
test('real hosted metadata is blocked: zero Store ID in all six Commerce tables',()=>{
 const v=audit();assert.equal(v.status,'BLOCKED');
 assert.equal(v.observed.coreStoreColumnCount,0);
 assert.equal(v.observed.coreStorePolicyCount,0);
 assert.equal(v.observed.auditedTableCount,6);
 assert.equal(v.missing.filter(x=>x.startsWith('STORE_ID_COLUMN_ABSENT:')).length,6);
 assert.equal(v.missing.filter(x=>x.startsWith('STORE_RLS_POLICY_ABSENT:')).length,6);
});
test('six tables RLS enabled but lack Store-level isolation',()=>{
 const a=fresh();assert.equal(a.coreTables.length,6);
 assert.equal(a.coreTables.every(x=>x.rlsEnabled),true);
 assert.equal(audit().status,'BLOCKED');
});
test('actual hosted snapshot reflects 3 active membership users',()=>{
 assert.equal(audit().observed.activeMemberUsers,3);
 assert.equal(audit().observed.tenantsWithTwoActiveMembers,1);
});
test('auth session record aggregate does not prove two signed same-Tenant Store sessions',()=>{
 const v=audit();
 assert.equal(v.observed.tenantsWithTwoMemberUsersWithDbSessions,0);
 assert.equal(v.observed.dbSessionRowsWithinNotAfter,5);
 assert.ok(contains(v,'NO_SAME_TENANT_PAIR_WITH_DB_SESSION_RECORDS'));
 assert.equal(v.actualJwtVerifiedByThisModule,false);
});
test('missing canonical Store and Staff registry is explicit P0',()=>{
 const v=audit();
 for(const x of ['CANONICAL_STORES_ABSENT','CANONICAL_STORE_MEMBERSHIPS_ABSENT',
  'COMMERCIAL_STAFF_REGISTRY_ABSENT'])
  assert.ok(contains(v,x),x);
});
test('missing native Page and real handover proof are explicit',()=>{
 const v=audit();
 for(const flag of ['independentMetaPageOwnershipVerified',
   'independentMetaAppRoleVerified','signedNativeHandoverEventNoSendVerified'])
  assert.ok(contains(v,'PRIVATE_PROOF_PENDING:'+flag));
});
test('no snapshot ever provides deployment or send authorization',()=>{
 const v=audit();
 assert.equal(v.realUatAuthorized,false);
 assert.equal(v.canSend,false);
 assert.equal(v.canDeploy,false);
 assert.equal(v.canReadRealCustomerInbox,false);
 assert.equal(v.canWriteOrder,false);
 assert.equal(v.canModifyPublished,false);
});
test('missing source marker denied',()=>{
 const a=fresh();delete a.source;
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('wrong project denied',()=>{
 const a=fresh();a.projectRef='other-project';
 assert.equal(audit(a).status,'BLOCKED');
});
test('production environment rejected',()=>{
 const a=fresh();a.environment='production';
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('missing core table rejected',()=>{
 const a=fresh();a.coreTables.pop();
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('repeated table to conceal Messages gap rejected',()=>{
 const a=fresh();a.coreTables[0].name='messages';
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('unexpected extra table key with PII rejected',()=>{
 const a=fresh();a.coreTables[1].customerPhone='0123456789';
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('malformed policy count rejected',()=>{
 const a=fresh();a.coreTables[0].storePolicyCount='12';
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('negative and enormous session counts rejected',()=>{
 const a=fresh();a.auth.activeMemberUsers=-1;
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
 const b=fresh();b.auth.dbSessionRowsWithinNotAfter=Number.MAX_SAFE_INTEGER;
 assert.equal(audit(b).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('different Messenger workflow version shape denied',()=>{
 const a=fresh();a.workflow.messengerVersion='client-canary';
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('wrong Messenger workflow ID denied',()=>{
 const a=fresh();a.workflow.messengerId='evil-id';
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('private evidence from a claimant must be Boolean not untrusted string',()=>{
 const a=fresh();a.privateUatEvidence.independentMetaPageOwnershipVerified='true';
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('client-added self-authorization field rejected by strict schema',()=>{
 const a=fresh();a.privateUatEvidence.canDeploy=true;
 assert.equal(audit(a).reason,'SOURCE_EVIDENCE_SHAPE_OR_SCOPE_INVALID');
});
test('partial metadata RLS fixes still cannot authorize real UAT',()=>{
 const a=fresh();a.coreTables[0].hasStoreId=true;a.coreTables[0].storePolicyCount=1;
 const v=audit(a);
 assert.equal(v.status,'BLOCKED');
 assert.equal(v.canDeploy,false);
});
test('independent Page claim without app permission remains blocked',()=>{
 const a=fresh();a.privateUatEvidence.independentMetaPageOwnershipVerified=true;
 const v=audit(a);
 assert.equal(v.status,'BLOCKED');
 assert.ok(contains(v,'PRIVATE_PROOF_PENDING:independentMetaAppRoleVerified'));
});
test('signed handover green flag without Page/App proof is inconsistent',()=>{
 const a=fresh();a.privateUatEvidence.signedNativeHandoverEventNoSendVerified=true;
 assert.ok(contains(audit(a),'HANDOVER_PROOF_INCONSISTENT_WITH_NATIVE_APP_PAGE_AUTH'));
});
test('all self-reported flags green still cannot issue provider, JWT or deployment authorization',()=>{
 const a=fresh();
 a.coreTables=a.coreTables.map(x=>({...x,hasStoreId:true,storePolicyCount:1,rlsEnabled:true}));
 a.registry={canonicalStoreTableCount:1,canonicalStoreMembershipTableCount:1,
    commercialStaffRegistryTableCount:1};
 a.auth.tenantsWithTwoMemberUsersWithDbSessions=1;
 for(const f of REQUIRED_UAT_FLAGS)a.privateUatEvidence[f]=true;
 const v=audit(a);
 assert.equal(v.readyToRequestIndependentReview,true);
 assert.equal(v.status,'REQUIRES_INDEPENDENT_PRIVATE_REVIEW');
 assert.equal(v.realUatAuthorized,false);
 assert.equal(v.canSend,false);
 assert.equal(v.canDeploy,false);
 assert.equal(v.actualJwtVerifiedByThisModule,false);
 assert.equal(v.evidenceIsIndependent,false);
});
test('injecting raw tokens in top level does not alter safe summary',()=>{
 const a=fresh();a.accessToken='DO_NOT_SHARE';
 const v=audit(a);
 assert.equal(v.realUatAuthorized,false);
 assert.equal(JSON.stringify(v).includes('DO_NOT_SHARE'),false);
});
test('all core table names are fixed',()=>{
 assert.deepEqual(EXPECTED_TABLES,['products','orders','customers','order_items','conversations','messages']);
});
test('private proof contract explicitly needs independent reviewer, permission, kill switch',()=>{
 for(const flag of ['independentOperatorApprovalVerified','merchantOwnerConsentVerified',
 'managedSecretsAndKillSwitchVerified','singleResponderLegacyNotSendingDuringUat',
 'revocationTestedWithRealJwt'])
 assert.ok(REQUIRED_UAT_FLAGS.includes(flag));
});
