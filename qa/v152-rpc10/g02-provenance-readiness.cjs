'use strict';
/*
 * TIEN404 RPC10-G0.2. PII-free hosted aggregate provenance inspector.
 * Inputs are untrusted read-only aggregate receipts; original source records
 * and merchant/reviewer signatures MUST be verified in private RPC12.
 * Even structurally complete hypothetical metadata NEVER authorizes hosted.
 */
const CONTRACT='T404_RPC10_G02_HOSTED_AGGREGATES_V1';
const KEYS=Object.freeze(['contract','scope','collectedAtUtc','tenants','products','orders','customers',
 'canonicalStoresPresent','storeMembershipsPresent','slotAggregates','productProvenanceCandidates',
 'orderProvenanceCandidates','commerceStoreColumns','orderSourceColumnPresent','idempotencyRows',
 'ordersLinkedToIdempotency','factoryEvents','factoryAgentRuns','legacyPermissiveStorelessReadPolicies']);
const SLOT_KEYS=Object.freeze(['slot','products','orders','sourceLabeledOrders','customerLinkedOrders',
 'tenantOwnerMemberships','agentConfigRows']);
const LIMIT=1e9;
const nat=x=>Number.isSafeInteger(x)&&x>=0&&x<=LIMIT;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const utc=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)&&Number.isFinite(Date.parse(x));
function inspect(snapshot,now='2026-11-17T02:05:00Z'){
 const issues=new Set(),add=x=>issues.add(x);
 if(!exact(snapshot,KEYS)||snapshot.contract!==CONTRACT||snapshot.scope!=='HOSTED_READ_ONLY_AGGREGATES')
  return deny(['UNTRUSTED_AGGREGATE_CONTRACT']);
 if(!utc(now)||!utc(snapshot.collectedAtUtc)||
    Date.parse(snapshot.collectedAtUtc)>Date.parse(now)+60000||
    Date.parse(now)-Date.parse(snapshot.collectedAtUtc)>24*3600000)
  add('SOURCE_SNAPSHOT_STALE_OR_INVALID');
 for(const k of ['tenants','products','orders','customers','productProvenanceCandidates','orderProvenanceCandidates',
  'commerceStoreColumns','orderSourceColumnPresent','idempotencyRows','ordersLinkedToIdempotency',
  'factoryEvents','factoryAgentRuns','legacyPermissiveStorelessReadPolicies']){
   if(!nat(snapshot[k]))add('AGGREGATE_NUMERIC_SHAPE_INVALID');
 }
 if(typeof snapshot.canonicalStoresPresent!=='boolean'||typeof snapshot.storeMembershipsPresent!=='boolean')
  add('CANONICAL_SCHEMA_FLAG_INVALID');
 if(!Array.isArray(snapshot.slotAggregates)||snapshot.slotAggregates.length!==2)
  add('EXPECTED_EXACT_TWO_ANONYMOUS_TENANT_SLOTS');
 else{
  const seen=new Set();
  for(const row of snapshot.slotAggregates){
   if(!exact(row,SLOT_KEYS)||
    !SLOT_KEYS.every(k=>nat(row[k]))||
    ![1,2].includes(row.slot)||seen.has(row.slot))
    add('TENANT_SLOT_SHAPE_OR_DUPLICATE_INVALID');
   else seen.add(row.slot);
   if(plain(row)&&nat(row.products)&&nat(row.orders)&&nat(row.sourceLabeledOrders)&&
      nat(row.customerLinkedOrders)&&
      (row.sourceLabeledOrders>row.orders||row.customerLinkedOrders>row.orders))
    add('ORDER_LINEAGE_AGGREGATE_CONTRADICTION');
  }
  if(seen.size!==2)add('MISSING_TENANT_SLOT');
  if([...seen].length===2&&snapshot.slotAggregates.every(x=>exact(x,SLOT_KEYS)&&SLOT_KEYS.every(k=>nat(x[k])))){
   if(snapshot.slotAggregates.reduce((n,x)=>n+x.products,0)!==snapshot.products||
      snapshot.slotAggregates.reduce((n,x)=>n+x.orders,0)!==snapshot.orders)
    add('INCONSISTENT_HOSTED_TOTALS');
  }
 }
 if(nat(snapshot.ordersLinkedToIdempotency)&&nat(snapshot.orders)&&
  snapshot.ordersLinkedToIdempotency>snapshot.orders)add('IMPOSSIBLE_IDEMPOTENCY_COVERAGE');
 if(snapshot.tenants!==2||snapshot.products!==2||snapshot.orders!==2||snapshot.customers!==0)
  add('CURRENT_FOUR_ROW_BASELINE_DRIFT');
 if(snapshot.canonicalStoresPresent!==true||snapshot.storeMembershipsPresent!==true||
    snapshot.commerceStoreColumns!==6)add('CANONICAL_STORE_MEMBERSHIP_NOT_READY');
 if(snapshot.legacyPermissiveStorelessReadPolicies!==0)
  add('TENANT_WIDE_PERMISSIVE_RLS_STILL_PRESENT');
 if(snapshot.productProvenanceCandidates===0||snapshot.orderProvenanceCandidates===0)
  add('NO_PROVENANCE_FIELDS_ON_PRIMARY_COMMERCE_ROWS');
 if(snapshot.ordersLinkedToIdempotency<snapshot.orders)
  add('ORDER_ORIGIN_NOT_LINKED_TO_IDEMPOTENCY');
 if(snapshot.factoryEvents===0&&snapshot.factoryAgentRuns===0)
  add('FACTORY_EVENT_OR_AGENT_LINEAGE_NOT_AVAILABLE');
 // A source label, Tenant Owner group, synthetic Store, or self-reported flag
 // is NEVER a real 4-row Merchant+independent-reviewer owner proof.
 add('REAL_FOUR_ROW_OWNER_ORIGINAL_SOURCES_NOT_ATTESTED');
 add('INDEPENDENT_RECOVERY_AND_REAL_JWT_NOT_CERTIFIED');
 return deny([...issues].sort(),{
  tenantSlots:Array.isArray(snapshot.slotAggregates)?snapshot.slotAggregates.length:0,
  aggregateProducts:nat(snapshot.products)?snapshot.products:null,
  aggregateOrders:nat(snapshot.orders)?snapshot.orders:null
 });
}
function deny(blockers,counts={}){
 return Object.freeze({contract:'T404_RPC10_G02_PROVENANCE_NO_GO_V1',
  status:'HOSTED_ORIGINAL_STORE_OWNER_NO_GO',
  blockers:Object.freeze([...new Set(blockers)].sort()),
  aggregateCounts:Object.freeze({...counts}),
  originalMerchantEvidenceAuthenticatedHere:false,
  independentReviewerAuthorityAuthenticatedHere:false,
  sourceRowToCanonicalStoreProven:false,
  actualJwtTested:false,currentRestorationAccepted:false,
  canAssignStore:false,canBackfill:false,canMigrate:false,
  canRevokeRpc:false,canRelease:false,canPublish:false,
  mayReadCustomerRows:false,sourceDataDisclosed:false});
}
module.exports=Object.freeze({CONTRACT,inspect});
if(require.main===module){
 try{
  const s=require('node:fs').readFileSync(0,'utf8');
  if(s.length>16000)throw Error('OVERSIZED');
  console.log(JSON.stringify(inspect(JSON.parse(s),new Date().toISOString()),null,2));
  process.exitCode=3; // no CLI success path; cannot authorize hosted
 }catch(_err){
  process.stderr.write('RPC10_G02_INVALID_PRIVATE_INPUT_NO_SOURCE_DISCLOSURE\n');
  process.exitCode=2;
 }
}
