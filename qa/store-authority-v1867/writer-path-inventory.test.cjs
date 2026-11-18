'use strict';
// Static evidence integrity: tests metadata only. NO network, Supabase, n8n, Render or customers.
const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('./writer-path-inventory.json');
const existing = require('../store-authority-v1866/evidence.snapshot.json');
const NO_GO = Object.freeze({release:'NO_GO',realAuthUat:'BLOCKED',commerceWriterCutover:'BLOCKED',dbMigration:'NOT_AUTHORIZED'});
function disposition(x) {
  if (!x || x.evidenceClass !== 'READ_ONLY_PARTIAL_WRITER_INVENTORY_NOT_RELEASE_AUTHORITY' || x.completeness !== 'PARTIAL' || x.provesNoOtherWriters !== false) throw new Error('INVALID_EVIDENCE');
  if (!x.supabase || !x.n8n || !x.cloudflare || !x.render || !x.design || !x.safety || !Array.isArray(x.writers)) throw new Error('INCOMPLETE_INVENTORY');
  return NO_GO; // This source-only artifact can never authorize an actual release.
}
test('inventory remains explicitly partial',()=>assert.equal(disposition(inventory),NO_GO));
test('legacy V18.6.6 baseline remains no-store',()=>{
 assert.equal(existing.supabase.canonicalTablesPresent,0);
 assert.equal(existing.supabase.commerceTablesWithStoreId,0);
 assert.equal(existing.supabase.publicRestrictivePolicies,0);
});
test('canonical design is reused not independently reinvented',()=>{
 assert.equal(inventory.design.canonicalDesignPr,417);
 assert.equal(inventory.design.fullDmlPgTapReferencePr,421);
 assert.equal(inventory.design.fullDmlPgTapReferenceAssertionsPassed,61);
 assert.notEqual(inventory.design.canonicalDesignStatus,'APPROVED');
});
test('live Supabase remains tenant-only with privileged product writer',()=>{
 assert.equal(inventory.supabase.commerceStoreIdCount,0);
 assert.equal(inventory.supabase.privilegedWriteRpcStoreScoped,false);
 assert.equal(inventory.supabase.privilegedWriteRpcAuthExecute,true);
 assert.equal(inventory.supabase.directAuthenticatedCommerceTableWrites,false);
});
test('published Messenger still references exactly three DEMO writer workflows',()=>{
 assert.equal(inventory.n8n.publishedMessengerActive,true);
 assert.equal(inventory.n8n.messengerUsesDemoOrderSubworkflows,true);
 assert.equal(inventory.n8n.publishedDraftVersionMismatchOnThreeWriters,true);
 assert.deepEqual(new Set([inventory.n8n.publishedCreateWorkflowId,inventory.n8n.publishedManageWorkflowId,inventory.n8n.publishedAddressUpdateWorkflowId]).size,3);
});
test('all four verified writers have separate explicit cutover policies',()=>{
 const names=new Set(inventory.writers.map(w=>w.id));
 assert.equal(names.size,4);
 for(const w of inventory.writers){assert.equal(w.publishedOrCallable,true);assert.equal(w.storeScoped,false);assert.equal(w.canChangeLiveData,true);assert.match(w.policy,/^(P1_|KEEP_DEMO_)/);}
});
test('Demo Google Sheets and Supabase never silently share canonical store authority',()=>{
 assert.equal(inventory.n8n.orderStorageBackend,'GOOGLE_SHEETS_DEMO_NOT_SUPABASE_COMMERCE');
 assert.ok(inventory.writers.filter(w=>w.platform.includes('Google Sheets')).every(w=>w.policy==='KEEP_DEMO_ISOLATED_DO_NOT_ROUTE_TO_COMMERCE'));
});
test('Render workspace selection is a blocker, not a claim of audit',()=>{
 assert.equal(inventory.render.deployedSourceAuditedThisCheckpoint,false);
 assert.equal(inventory.render.status,'BLOCKED_WORKSPACE_SELECTION_REQUIRED');
});
test('SKU and role mapping remain unapproved decisions',()=>{
 assert.match(inventory.design.skuD02,/^UNDECIDED_/);
 assert.match(inventory.design.roleCompatibility,/^UNDECIDED_/);
 assert.equal(inventory.design.stagingDbMigration,'NOT_AUTHORIZED');
});
test('live Owner Auth and deployed Store writer are NOT claimed verified',()=>{
 assert.equal(inventory.cloudflare.liveOwnerSupabaseAuthVerifiedOnThisWorker,false);
 assert.equal(inventory.cloudflare.deployedStoreWriterAdapterVerified,false);
});
test('safety ledger has no connected writes, deployment or send',()=>{
 assert.equal(Object.values(inventory.safety).every(x=>x===false),true);
});
test('tampered metadata cannot authorize release even if booleans are changed',()=>{
 const copy=structuredClone(inventory);
 copy.supabase.commerceStoreIdCount=6;
 copy.supabase.privilegedWriteRpcStoreScoped=true;
 copy.render.deployedSourceAuditedThisCheckpoint=true;
 copy.safety.productionDeployed=true;
 assert.equal(disposition(copy).release,'NO_GO');
 assert.equal(disposition(copy).dbMigration,'NOT_AUTHORIZED');
});
test('unknown or overstated inventory completeness is rejected',()=>{
 for(const change of [{completeness:'COMPLETE'},{provesNoOtherWriters:true},{evidenceClass:'REAL_AUTH_UAT_PASS'}])
  assert.throws(()=>disposition({...inventory,...change}));
});
