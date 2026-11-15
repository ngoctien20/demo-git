'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PROJECT,PULL_REQUESTS,TABLES,RPCS,GATES,reviewPrGraph,reviewHosted,reportSnapshot}
 =require('./release-evidence-gate.cjs');
const git=()=>PULL_REQUESTS.map(x=>({
  number:x.number,head:x.head,base:x.base,state:'open',
  draft:true,merged:false,ciConclusion:'success'
}));
const db=()=>({
 source:'READ_ONLY_SUPABASE_SCHEMA_AUDIT',projectRef:PROJECT,
 storesExists:false,storeMembershipsExists:false,
 productCount:2,orderCount:2,productsUniqueTenantSku:true,
 tables:Object.fromEntries(TABLES.map(k=>[k,{hasStoreId:false,tenantOnlyPermissiveSelect:true}])),
 rpcs:Object.fromEntries(RPCS.map(k=>[k,{reviewedScoped:false}]))
});
const expected=()=>reviewPrGraph(git());
const hosted=(x={})=>reviewHosted({
 projectRef:PROJECT,graph:expected(),db:db(),...x
});
test('1 · known four PR heads are exact 40 hexadecimal SHAs',()=>{
 assert.deepEqual(PULL_REQUESTS.map(x=>x.number),[86,94,95,97]);
 for(const r of PULL_REQUESTS)assert.match(r.head,/^[a-f0-9]{40}$/);
});
test('2 · green OPEN DRAFT source ancestry only matches reviewed snapshot',()=>{
 const r=expected();
 assert.equal(r.status,'SNAPSHOT_MATCHES_READ_ONLY_AUDIT');
 assert.equal(r.branchesDiverged,true);assert.equal(r.mergeReady,false);
});
test('3 · HEAD change rejects old CI as stale',()=>{
 const a=git();a[0].head='f'.repeat(40);
 assert.deepEqual(reviewPrGraph(a).drift,['changed_head_86']);
});
test('4 · Base branch drift must require independent re-audit',()=>{
 const a=git();a[2].base='gh-pages';
 assert.deepEqual(reviewPrGraph(a).drift,['changed_base_95']);
});
test('5 · Missing PR cannot be skipped silently',()=>{
 const a=git().filter(x=>x.number!==95);
 assert.deepEqual(reviewPrGraph(a).drift,['missing_pr_95']);
});
test('6 · Duplicated PR causes explicit invalid evidence',()=>{
 assert.equal(reviewPrGraph([...git(),git()[1]]).status,'INVALID_PR_EVIDENCE');
});
test('7 · CI failure or pending is never green by inference',()=>{
 for(const status of ['failure','pending',null]){
  const a=git();a[3].ciConclusion=status;
  assert.ok(reviewPrGraph(a).drift.includes('missing_green_ci_97'));
 }
});
test('8 · Merged/closed/ready PR lifecycles are not same snapshot',()=>{
 const a=git();a[0].merged=true;a[0].draft=false;a[0].state='closed';
 assert.ok(reviewPrGraph(a).drift.includes('unexpected_pr_lifecycle_86'));
});
test('9 · Clean text-only merge-tree cannot mark integration approved',()=>{
 const r=reviewPrGraph(git(),{'97_plus_95':true,'combined_plus_86':true});
 assert.equal(r.offlineMergeObservations.length,2);
 assert.equal(r.offlineMergeObservations[0].observation,'CLEAN_TEXT_ONLY_REHEARSAL');
 assert.equal(r.canMerge,false);assert.equal(r.sourceIntegrationReviewed,false);
});
test('10 · Unknown merge rehearsal is explicitly NOT_RECONCILED',()=>{
 const r=expected();
 assert.equal(r.offlineMergeObservations[1].observation,'NOT_RECONCILED');
});
test('11 · current real schema baseline is HOSTED_RELEASE_BLOCKED',()=>{
 const r=hosted();
 assert.equal(r.status,'HOSTED_RELEASE_BLOCKED');
 assert.ok(r.blockers.includes('SIX_TABLES_NOT_STORE_SCOPED'));
 assert.ok(r.blockers.includes('CANONICAL_STORE_SCHEMA_ABSENT'));
 assert.ok(r.blockers.includes('TENANT_WIDE_PERMISSIVE_RLS_ACTIVE_OR_UNKNOWN'));
 assert.ok(r.blockers.includes('LEGACY_TENANT_SKU_UNIQUENESS'));
 assert.ok(r.blockers.includes('SECURITY_DEFINER_PATHS_NOT_STORE_REVIEWED'));
});
test('12 · wrong Supabase project ID is denied',()=>{
 const r=hosted({projectRef:'production'});
 assert.ok(r.blockers.includes('UNVERIFIED_STAGING_PROJECT'));
});
test('13 · no client-supplied DB marker accepted as read-only schema audit',()=>{
 const r=hosted({db:{...db(),source:'WIDGET_BODY'}});
 assert.ok(r.blockers.includes('DB_EVIDENCE_NOT_GROUNDED'));
});
test('14 · any missing one of six store columns blocks',()=>{
 const d=db();for(const v of Object.values(d.tables)){
  v.hasStoreId=true;v.tenantOnlyPermissiveSelect=false;
 }
 d.storesExists=true;d.storeMembershipsExists=true;
 d.productsUniqueTenantSku=false;
 d.tables.messages.hasStoreId=false;
 const r=hosted({db:d});
 assert.ok(r.blockers.includes('SIX_TABLES_NOT_STORE_SCOPED'));
});
test('15 · old permissive tenant policy blocks even with new Store policies',()=>{
 const d=db();for(const v of Object.values(d.tables)){
  v.hasStoreId=true;v.tenantOnlyPermissiveSelect=false;
 }
 d.storesExists=true;d.storeMembershipsExists=true;
 d.productsUniqueTenantSku=false;
 d.tables.products.tenantOnlyPermissiveSelect=true;
 const r=hosted({db:d});
 assert.ok(r.blockers.includes('TENANT_WIDE_PERMISSIVE_RLS_ACTIVE_OR_UNKNOWN'));
});
test('16 · row count drift invalidates four-row attribution baseline',()=>{
 const d=db();d.orderCount=3;
 assert.ok(hosted({db:d}).blockers.includes('FOUR_ROW_BASELINE_DRIFT_REVERIFY_OWNERS'));
});
test('17 · security definer RPCs require store-scoped independent review',()=>{
 const d=db();for(const x of RPCS)d.rpcs[x].reviewedScoped=true;
 delete d.rpcs.save_merchant_product;
 assert.ok(hosted({db:d}).blockers.includes('SECURITY_DEFINER_PATHS_NOT_STORE_REVIEWED'));
});
test('18 · fake true booleans do not count as evidence',()=>{
 const receipts=Object.fromEntries(GATES.map(k=>[k,true]));
 const r=hosted({receipts});
 assert.equal(r.claimCount,0);assert.equal(r.notDocumented.length,GATES.length);
});
test('19 · every claimed owner document remains UNTRUSTED and cannot authorize RLS',()=>{
 const receipts=Object.fromEntries(GATES.map(k=>[k,{
  claimed:true,category:'OWNER_SUPPLIED_DOCUMENT_FOR_REVIEW'
 }]));
 const r=hosted({receipts});
 assert.equal(r.notDocumented.length,0);
 assert.equal(r.claimCount,GATES.length);
 assert.equal(r.canMigrate,false);assert.equal(r.canAlterRls,false);
 assert.equal(r.canMerge,false);assert.equal(r.productionReady,false);
 assert.equal(r.realUserJwtRlsVerified,false);assert.equal(r.restoreVerified,false);
});
test('20 · service-role JWT is never a hosted QA stand-in',()=>{
 const r=hosted();
 assert.equal(r.canUseServiceRoleForRlsProof,false);
});
test('21 · forbidden production target triggers independent blocker',()=>{
 assert.ok(hosted({productionTarget:true}).blockers.includes('PRODUCTION_TARGET_DENIED'));
});
test('22 · cannot send Messenger, Zalo, publish Knowledge or change credential',()=>{
 const r=hosted();
 for(const k of ['canSendMeta','canSendZalo','canPublish','canChangeCredentials',
  'canDeployWidget','canBackfill'])assert.equal(r[k],false);
});
test('23 · absent graph cannot be interpreted as green',()=>{
 const r=hosted({graph:null});
 assert.ok(r.blockers.includes('PR_HEAD_OR_CI_NOT_CURRENTLY_VERIFIED'));
});
test('24 · provenance is a frozen audit record, not a release certificate',()=>{
 const r=reportSnapshot();
 assert.equal(r.version,'V14.4.1');assert.equal(r.heads.length,4);
 assert.match(r.comment,/NOT signed authorization/);
 assert.equal('canDeploy' in r,false);
});
test('25 · fields never carry user tokens, client secret, customer PII or Orders',()=>{
 const data=JSON.stringify({snapshot:reportSnapshot(),result:hosted()});
 for(const t of ['Bearer ','customer_phone','PAGE_ACCESS_TOKEN','password='])
  assert.equal(data.includes(t),false);
});
test('26 · fully synthetic future-looking DB data still does NOT unlock deployment',()=>{
 const d=db();
 d.storesExists=d.storeMembershipsExists=true;
 d.productsUniqueTenantSku=false;
 for(const k of TABLES)d.tables[k]={hasStoreId:true,tenantOnlyPermissiveSelect:false};
 for(const k of RPCS)d.rpcs[k]={reviewedScoped:true};
 const receipts=Object.fromEntries(GATES.map(k=>[k,{
  claimed:true,category:'OWNER_SUPPLIED_DOCUMENT_FOR_REVIEW'
 }]));
 const r=hosted({db:d,receipts});
 assert.equal(r.blockers.length,0);
 assert.equal(r.status,'HOSTED_RELEASE_BLOCKED');
 assert.equal(r.canMigrate,false);
 assert.equal(r.realUserJwtRlsVerified,false);
});
