'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,inspect}=require('./g02-provenance-readiness.cjs');
const baseline=require('./g02-hosted-provenance-sanitized.json');
const now='2026-11-17T02:05:00Z';
const copy=()=>JSON.parse(JSON.stringify(baseline));
const gate=x=>inspect(x,now);
function blocked(name,mutate,expected){
 test(name,()=>{
  const x=copy();mutate(x);const r=gate(x);
  assert.equal(r.status,'HOSTED_ORIGINAL_STORE_OWNER_NO_GO');
  assert.ok(r.blockers.includes(expected),JSON.stringify(r.blockers));
  for(const k of ['canAssignStore','canBackfill','canMigrate','canRevokeRpc','canRelease','canPublish',
  'sourceRowToCanonicalStoreProven','originalMerchantEvidenceAuthenticatedHere',
  'independentReviewerAuthorityAuthenticatedHere','actualJwtTested','currentRestorationAccepted'])
   assert.equal(r[k],false,k);
 });
}
test('source contract and current real hosted sanitized baseline are exactly aligned',()=>{
 assert.equal(baseline.contract,CONTRACT);
 const r=gate(copy());assert.equal(r.status,'HOSTED_ORIGINAL_STORE_OWNER_NO_GO');
 assert.equal(r.aggregateCounts.aggregateProducts,2);assert.equal(r.aggregateCounts.aggregateOrders,2);
 for(const b of [
  'CANONICAL_STORE_MEMBERSHIP_NOT_READY','TENANT_WIDE_PERMISSIVE_RLS_STILL_PRESENT',
  'NO_PROVENANCE_FIELDS_ON_PRIMARY_COMMERCE_ROWS','ORDER_ORIGIN_NOT_LINKED_TO_IDEMPOTENCY',
  'FACTORY_EVENT_OR_AGENT_LINEAGE_NOT_AVAILABLE','REAL_FOUR_ROW_OWNER_ORIGINAL_SOURCES_NOT_ATTESTED',
  'INDEPENDENT_RECOVERY_AND_REAL_JWT_NOT_CERTIFIED'])assert.ok(r.blockers.includes(b),b);
});
test('null untrusted input is denied',()=>assert.equal(gate(null).blockers[0],'UNTRUSTED_AGGREGATE_CONTRACT'));
blocked('reject altered contract',x=>x.contract='untrusted','UNTRUSTED_AGGREGATE_CONTRACT');
blocked('reject unsafe source mode',x=>x.scope='HOSTED_WRITE','UNTRUSTED_AGGREGATE_CONTRACT');
blocked('reject extra raw row identifier property',x=>x.rowId='11111111-1111-4111-8111-111111111111','UNTRUSTED_AGGREGATE_CONTRACT');
blocked('reject secret field',x=>x.token='do-not-leak','UNTRUSTED_AGGREGATE_CONTRACT');
blocked('reject missing contract key',x=>delete x.scope,'UNTRUSTED_AGGREGATE_CONTRACT');
blocked('reject negative count',x=>x.products=-1,'AGGREGATE_NUMERIC_SHAPE_INVALID');
blocked('reject fractional count',x=>x.orders=1.5,'AGGREGATE_NUMERIC_SHAPE_INVALID');
blocked('reject textual count',x=>x.tenants='2','AGGREGATE_NUMERIC_SHAPE_INVALID');
blocked('reject excess count',x=>x.factoryEvents=1e12,'AGGREGATE_NUMERIC_SHAPE_INVALID');
blocked('reject invalid Store schema flags',x=>x.canonicalStoresPresent='true','CANONICAL_SCHEMA_FLAG_INVALID');
blocked('reject missing anonymous Tenant slot',x=>x.slotAggregates.pop(),'EXPECTED_EXACT_TWO_ANONYMOUS_TENANT_SLOTS');
blocked('reject duplicate slots',x=>x.slotAggregates[1].slot=1,'TENANT_SLOT_SHAPE_OR_DUPLICATE_INVALID');
blocked('reject negative anonymous slot value',x=>x.slotAggregates[0].products=-1,'TENANT_SLOT_SHAPE_OR_DUPLICATE_INVALID');
blocked('reject extra identifier in Tenant slot',x=>x.slotAggregates[0].tenantId='fake','TENANT_SLOT_SHAPE_OR_DUPLICATE_INVALID');
blocked('reject contradictory order label count',x=>x.slotAggregates[0].sourceLabeledOrders=2,'ORDER_LINEAGE_AGGREGATE_CONTRADICTION');
blocked('reject contradictory linked customer count',x=>x.slotAggregates[0].customerLinkedOrders=3,'ORDER_LINEAGE_AGGREGATE_CONTRADICTION');
blocked('reject sums mismatch',x=>x.slotAggregates[0].products=2,'INCONSISTENT_HOSTED_TOTALS');
blocked('reject too many idempotency-linked orders',x=>x.ordersLinkedToIdempotency=3,'IMPOSSIBLE_IDEMPOTENCY_COVERAGE');
blocked('refuse changed Product count pending explicit real review',x=>x.products=3,'CURRENT_FOUR_ROW_BASELINE_DRIFT');
blocked('refuse changed Customer count',x=>x.customers=1,'CURRENT_FOUR_ROW_BASELINE_DRIFT');
blocked('refuse stale snapshot',x=>x.collectedAtUtc='2025-11-17T02:04:04Z','SOURCE_SNAPSHOT_STALE_OR_INVALID');
blocked('refuse future snapshot',x=>x.collectedAtUtc='2026-11-19T02:04:04Z','SOURCE_SNAPSHOT_STALE_OR_INVALID');
blocked('refuse old permissive Tenant policy (baseline)',x=>x.legacyPermissiveStorelessReadPolicies=4,'TENANT_WIDE_PERMISSIVE_RLS_STILL_PRESENT');
blocked('refuse missing Product provenance column',x=>x.productProvenanceCandidates=0,'NO_PROVENANCE_FIELDS_ON_PRIMARY_COMMERCE_ROWS');
blocked('refuse missing Order provenance column',x=>x.orderProvenanceCandidates=0,'NO_PROVENANCE_FIELDS_ON_PRIMARY_COMMERCE_ROWS');
blocked('refuse partial idempotency linkage',x=>x.ordersLinkedToIdempotency=1,'ORDER_ORIGIN_NOT_LINKED_TO_IDEMPOTENCY');
blocked('refuse zero factory lineage',x=>x.factoryAgentRuns=0,'FACTORY_EVENT_OR_AGENT_LINEAGE_NOT_AVAILABLE');
test('all-green hypothetical counts still cannot attest a merchant or perform hosted migration',()=>{
 const x=copy();x.canonicalStoresPresent=true;x.storeMembershipsPresent=true;x.commerceStoreColumns=6;
 x.legacyPermissiveStorelessReadPolicies=0;x.productProvenanceCandidates=1;x.orderProvenanceCandidates=1;
 x.idempotencyRows=2;x.ordersLinkedToIdempotency=2;x.factoryEvents=2;
 const r=gate(x);
 assert.deepEqual(r.blockers,['INDEPENDENT_RECOVERY_AND_REAL_JWT_NOT_CERTIFIED','REAL_FOUR_ROW_OWNER_ORIGINAL_SOURCES_NOT_ATTESTED']);
 assert.equal(r.canMigrate,false);assert.equal(r.canAssignStore,false);
});
test('output never returns raw row or account secrets even if injected in an extra field',()=>{
 const x=copy();x.ownerSecret='HIDDEN_TOP_SECRET_1234';x.slotAggregates[0].tenantId='OWNER_PII';
 const s=JSON.stringify(gate(x));
 assert.ok(!s.includes('HIDDEN_TOP_SECRET_1234'));
 assert.ok(!s.includes('OWNER_PII'));
});
test('actual source status never confuses labeled Order source with verified Store Owner',()=>{
 const r=gate(copy());
 assert.equal(baseline.slotAggregates[0].sourceLabeledOrders,1);
 assert.equal(baseline.slotAggregates[1].sourceLabeledOrders,1);
 assert.equal(r.originalMerchantEvidenceAuthenticatedHere,false);
 assert.ok(r.blockers.includes('REAL_FOUR_ROW_OWNER_ORIGINAL_SOURCES_NOT_ATTESTED'));
});
