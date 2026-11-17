import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectLegacyFourRowProvenance as inspect} from './legacy-provenance-admission.mjs';

const reference=JSON.parse(readFileSync(new URL('./observed-legacy-four-row-provenance-20261117.json',import.meta.url)));
const copy=()=>structuredClone(reference);
const locked=r=>{
  for(const key of ['realMerchantOwnershipVerified','originalSeedSourceVerified',
    'canCertifyDataSynthetic','canGrantMerchantOwnership','canAdmitRealUat',
    'canApplyStoreRls','canDeploy','canWrite','canReadMerchantDocuments',
    'canOpenMerchantUploadPortal','canEnableMetaNoSendCanary','canSendMessages'])
    assert.equal(r[key],false,key+' must not be elevated');
  assert.equal(r.noSend,true);
  assert.equal(Object.isFrozen(r),true);
};
function caseTest(name,mutate,reason){test(name,()=>{
  const snapshot=copy();mutate(snapshot);
  const result=inspect({snapshot});
  assert.equal(result.status,'BLOCKED');
  if(reason)assert.equal(result.reason,reason);
  locked(result);
});}

test('committed aggregate remains QA-LIKELY, never VERIFIED synthetic or owner',()=>{
  const r=inspect({snapshot:reference,nowIso:'2026-11-17T12:00:00Z'});
  assert.equal(r.status,'INDEPENDENT_SOURCE_REVIEW_REQUIRED');
  assert.equal(r.provenanceClassification,'QA_LIKELY_NOT_VERIFIED_SYNTHETIC');
  assert.equal(r.aggregateCountsMatch,true);
  assert.equal(r.deferSensitiveMerchantDocumentRequest,true);
  locked(r);
});
caseTest('reject synthetic promotion',s=>{s.classification.label='VERIFIED_SYNTHETIC'},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
caseTest('reject fabricated source-of-truth',s=>{s.classification.sourceOfTruth='OWNER_ATTESTED'},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
caseTest('reject canCertifyDataSynthetic true',s=>{s.classification.canCertifyDataSynthetic=true},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
caseTest('reject merchant proof shortcut',s=>{s.classification.canGrantMerchantOwnership=true},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
caseTest('reject real Store A/B shortcut',s=>{s.classification.canUseAsRealStoreAbAuthProof=true},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
caseTest('reject no-defer flag',s=>{s.classification.shouldDeferSensitiveDocumentRequestPendingClassification=false},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
caseTest('reject activating upload',s=>{s.classification.canOpenMerchantUploadPortal=true},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
caseTest('reject activating Meta callback',s=>{s.classification.canEnableMetaNoSendCanary=true},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
caseTest('reject deleting rows',s=>{s.classification.canPurgeOrMigrateRows=true},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
caseTest('reject forged original seed artifacts',s=>{s.observed.verifiedOriginalSeedArtifacts=1},'OBSERVED_LEGACY_FOUR_ROW_AGGREGATE_DRIFT');
caseTest('reject additional product',s=>{s.observed.products=3},'OBSERVED_LEGACY_FOUR_ROW_AGGREGATE_DRIFT');
caseTest('reject nonmanual order drift',s=>{s.observed.orderSourceManual=1},'OBSERVED_LEGACY_FOUR_ROW_AGGREGATE_DRIFT');
caseTest('reject customer-linked order drift',s=>{s.observed.ordersWithCustomerLink=1},'OBSERVED_LEGACY_FOUR_ROW_AGGREGATE_DRIFT');
caseTest('reject changed QA labels',s=>{s.observed.tenantsWithTestLikeNameAndSlug=1},'OBSERVED_LEGACY_FOUR_ROW_AGGREGATE_DRIFT');
caseTest('reject creation timestamp changes',s=>{s.observed.sharedCreationTimestampUtc='2026-11-11T14:04:29.056346Z'},'OBSERVED_LEGACY_FOUR_ROW_AGGREGATE_DRIFT');
caseTest('reject audit event count drift',s=>{s.observed.auditEventsTotal=1},'OBSERVED_LEGACY_FOUR_ROW_AGGREGATE_DRIFT');
caseTest('reject negative product count',s=>{s.observed.products=-1},'INVALID_AGGREGATE_COUNT');
caseTest('reject float tenant count',s=>{s.observed.tenantCount=2.1},'INVALID_AGGREGATE_COUNT');
caseTest('reject extra deploy permission',s=>{s.classification.canDeploy=true},'UNTRUSTED_METADATA_FIELDS');
caseTest('reject extra PII field',s=>{s.observed.customerEmail='someone@example.com'},'UNTRUSTED_METADATA_FIELDS');
caseTest('reject wrong project',s=>{s.projectRef='untrusted'},'SNAPSHOT_SCOPE_OR_CONTRACT_MISMATCH');
caseTest('reject wrong contract',s=>{s.contract='ATTACK'},'SNAPSHOT_SCOPE_OR_CONTRACT_MISMATCH');
caseTest('reject extra token at root',s=>{s.secret='test-secret'},'SNAPSHOT_SCOPE_OR_CONTRACT_MISMATCH');
caseTest('reject invalid observedOn',s=>{s.observedOn='2027-01-01'},'SNAPSHOT_SCOPE_OR_CONTRACT_MISMATCH');
caseTest('reject forced document upload',s=>{s.classification.merchantOriginalDocumentUploadRequiredNow=true},'UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');

test('reject caller-supplied receipt regardless of alleged approval',()=>{
  for(const claim of [{approved:true,operator:'Trusted'},{signature:'fake'},{url:'https://malicious.invalid/a'}]){
    const r=inspect({snapshot:copy(),claimedOriginalSource:claim});
    assert.equal(r.status,'BLOCKED');
    assert.equal(r.reason,'EXTERNAL_SOURCE_CLAIM_NOT_AN_INDEPENDENT_ATTESTATION');
    locked(r);
  }
});
test('missing snapshot blocked',()=>{const r=inspect({});assert.equal(r.status,'BLOCKED');locked(r)});
test('invalid review time blocked',()=>{const r=inspect({snapshot:copy(),nowIso:'not-a-date'});assert.equal(r.status,'BLOCKED');locked(r)});
test('review timestamp before DB creation blocked',()=>{
  const r=inspect({snapshot:copy(),nowIso:'2026-11-10T13:00:00Z'});
  assert.equal(r.status,'BLOCKED');locked(r);
});
