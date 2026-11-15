'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const v=require('./migration-preflight.cjs');
const UUIDS=[
 'aaaaaaaa-1111-4111-8111-111111111111',
 'bbbbbbbb-2222-4222-8222-222222222222',
 'cccccccc-3333-4333-8333-333333333333',
 'dddddddd-4444-4444-8444-444444444444'];
function inventory(){
 return {
  source:'SUPABASE_READ_ONLY_CATALOG_INSPECTION',
  projectRef:'ifxlvrhyjhbzbrkdsida',postgresVersion:'17.11',
  storesExists:false,storeMembershipsExists:false,knowledgeReleasesExists:false,
  productsUniqueTenantSku:true,
  tables:Object.fromEntries(v.TABLES.map(t=>[t,{
    exists:true,rlsEnabled:true,rlsForced:true,hasStoreId:false,
    hasTenantWidePermissiveRead:true,rowCount:v.BASELINE[t]}])),
  functions:Object.fromEntries(v.FNS.map(f=>[f,{reviewedStoreScope:false}]))
 };
}
function four(){
 return [
  {table:'products',rowId:UUIDS[0],tenantId:UUIDS[2],canonicalStoreId:UUIDS[3],
    ownerVerified:true,independentReviewerVerified:true,sourceClass:'PRIVATE_OWNER_EVIDENCE'},
  {table:'products',rowId:UUIDS[1],tenantId:UUIDS[2],canonicalStoreId:UUIDS[3],
    ownerVerified:true,independentReviewerVerified:true,sourceClass:'PRIVATE_OWNER_EVIDENCE'},
  {table:'orders',rowId:UUIDS[0],tenantId:UUIDS[2],canonicalStoreId:UUIDS[3],
    ownerVerified:true,independentReviewerVerified:true,sourceClass:'PRIVATE_OWNER_EVIDENCE'},
  {table:'orders',rowId:UUIDS[1],tenantId:UUIDS[2],canonicalStoreId:UUIDS[3],
    ownerVerified:true,independentReviewerVerified:true,sourceClass:'PRIVATE_OWNER_EVIDENCE'}
 ];
}
test('01 · six public Commerce tables and three RPCs are required',()=>{
 assert.equal(v.TABLES.length,6);assert.equal(v.FNS.length,3);
});
test('02 · six distinct controlled phases from restore to JWT acceptance',()=>{
 assert.deepEqual(v.PHASES.map(x=>x.id),
 ['M0_RECOVERY','M1_EXPAND','M2_OWNER_BACKFILL',
  'M3_CONSTRAINTS','M4_ATOMIC_RLS','M5_ACCEPTANCE']);
});
test('03 · actual staging-like baseline returns blockers',()=>{
 const r=v.inspectInventory(inventory());
 assert.equal(r.status,'PREFLIGHT_HAS_BLOCKERS');
 assert.ok(r.blockers.includes('STORE_ID_MISSING_products'));
 assert.ok(r.blockers.includes('TENANT_PERMISSIVE_POLICY_PRESENT_orders'));
 assert.ok(r.blockers.includes('SKU_UNIQUE_STILL_TENANT_LEVEL'));
 assert.equal(r.canExecuteSql,false);assert.equal(r.canBackfill,false);
});
test('04 · cannot swap Supabase project',()=>{
 const d=inventory();d.projectRef='prod';
 assert.ok(v.inspectInventory(d).blockers.includes('WRONG_OR_UNVERIFIED_PROJECT'));
});
test('05 · unauthenticated provenance marker rejected',()=>{
 const d=inventory();d.source='CLIENT_JSON';
 assert.ok(v.inspectInventory(d).blockers.includes('CATALOG_PROVENANCE_UNVERIFIED'));
});
test('06 · PostgreSQL major drift blocks planning',()=>{
 const d=inventory();d.postgresVersion='18.7';
 assert.ok(v.inspectInventory(d).blockers.includes('PG_MAJOR_NOT_17'));
});
test('07 · missing table/disabled FORCE RLS are independently detected',()=>{
 const d=inventory();delete d.tables.messages;d.tables.orders.rlsForced=false;
 const r=v.inspectInventory(d);
 assert.ok(r.blockers.includes('MISSING_TABLE_messages'));
 assert.ok(r.blockers.includes('RLS_BASELINE_DRIFT_orders'));
});
test('08 · baseline row-count drift must halt attribution',()=>{
 const d=inventory();d.tables.orders.rowCount=3;
 assert.ok(v.inspectInventory(d).blockers.includes('ROW_COUNT_DRIFT_orders'));
});
test('09 · no Store schema or Knowledge is never silently accepted',()=>{
 const r=v.inspectInventory(inventory());
 for(const x of ['STORES_SCHEMA_NOT_APPLIED','STORE_ASSIGNMENTS_NOT_APPLIED',
    'KNOWLEDGE_BACKEND_NOT_APPLIED'])assert.ok(r.blockers.includes(x));
});
test('10 · one unreviewed SECURITY DEFINER RPC blocks',()=>{
 const d=inventory();for(const x of v.FNS)d.functions[x].reviewedStoreScope=true;
 d.functions.qa_shop_b_zalo_claim.reviewedStoreScope=false;
 assert.ok(v.inspectInventory(d).blockers.some(x=>x.endsWith('qa_shop_b_zalo_claim')));
});
test('11 · source-only future schema claims do not grant execute capability',()=>{
 const d=inventory();d.storesExists=d.storeMembershipsExists=d.knowledgeReleasesExists=true;
 d.productsUniqueTenantSku=false;
 for(const x of v.TABLES)d.tables[x]={...d.tables[x],
   hasStoreId:true,hasTenantWidePermissiveRead:false};
 for(const x of v.FNS)d.functions[x].reviewedStoreScope=true;
 const r=v.inspectInventory(d);
 assert.equal(r.blockers.length,0);
 assert.equal(r.canApplyMigration,false);
 assert.equal(r.status,'SCHEMA_CLAIMS_NEED_INDEPENDENT_VALIDATION');
});
test('12 · empty phase evidence always blocked',()=>{
 const r=v.inspectPhaseDocs({});
 assert.equal(r.phases.length,6);assert.equal(r.status,'MIGRATION_EXECUTION_BLOCKED');
 assert.equal(r.phases[0].status,'NOT_READY');
 assert.equal(r.canApplyDDL,false);assert.equal(r.canAlterRLS,false);
});
test('13 · random booleans and invalid document type do not count',()=>{
 const r=v.inspectPhaseDocs({isolated_restore_from_real_archive_pass:true,
  owner_approved_rollback_plan:{state:'YES',source:'OWNER_OFFLINE_RECORD'}});
 assert.equal(r.phases[0].claims,0);
});
test('14 · all claimed documents remain human-review only',()=>{
 const all=Object.fromEntries(v.PHASES.flatMap(p=>p.required).map(k=>[k,{
   state:'REVIEWED_DOCUMENT',source:'OWNER_OFFLINE_RECORD'}]));
 const r=v.inspectPhaseDocs(all);
 assert.ok(r.phases.every(x=>x.status==='CLAIMED_REQUIRES_INDEPENDENT_QA'));
 assert.ok(r.phases.every(x=>x.canRun===false));
 assert.equal(r.canApplyDDL,false);assert.equal(r.canBackfill,false);
});
test('15 · ledger cannot infer store from tenant alone',()=>{
 const rows=four();rows[1].ownerVerified=false;
 const r=v.reviewOwnershipLedger(rows);
 assert.ok(r.blockedReasons.includes('OWNER_ATTRIBUTION_NOT_VERIFIED'));
 assert.equal(r.canBackfill,false);
});
test('16 · every row needs independent reviewer',()=>{
 const rows=four();rows[2].independentReviewerVerified=false;
 assert.ok(v.reviewOwnershipLedger(rows).blockedReasons.includes('OWNER_ATTRIBUTION_NOT_VERIFIED'));
});
test('17 · 4 rows with wrong table split rejected',()=>{
 const rows=four();rows[3].table='products';
 assert.ok(v.reviewOwnershipLedger(rows).blockedReasons.includes('PRODUCT_AND_ORDER_PAIR_REQUIRED'));
});
test('18 · duplicated row ID within one table rejected',()=>{
 const rows=four();rows[1].rowId=rows[0].rowId;
 assert.ok(v.reviewOwnershipLedger(rows).blockedReasons.includes('DUPLICATE_LEDGER_ROW'));
});
test('19 · invalid Store UUID rejected',()=>{
 const rows=four();rows[0].canonicalStoreId='qa-store-a';
 assert.ok(v.reviewOwnershipLedger(rows).blockedReasons.includes('INVALID_ROW_STORE_TENANT_KEY'));
});
test('20 · even four supposedly verified rows remain blocked until independent review',()=>{
 const r=v.reviewOwnershipLedger(four());
 assert.equal(r.blockedReasons.length,0);
 assert.equal(r.status,'PRIVATE_LEDGER_CLAIMS_REQUIRE_INDEPENDENT_REVIEW');
 assert.equal(r.storesBackfilled,0);assert.equal(r.canBackfill,false);
 assert.equal(JSON.stringify(r).includes(UUIDS[0]),false);
});
test('21 · empty ledger is never valid',()=>{
 assert.ok(v.reviewOwnershipLedger([]).blockedReasons.includes('EXACTLY_FOUR_RECORDS_REQUIRED'));
});
test('22 · source SQL is metadata-only, no DML/DDL/unsafe COPY',()=>{
 const sql=fs.readFileSync(require('node:path').join(__dirname,'PREFLIGHT_READ_ONLY_CATALOG.sql'),'utf8');
 const statements=sql.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('--'));
 assert.match(statements.join(' '),/WITH\s+core\s+AS/i);
 assert.match(statements.join(' '),/SELECT\s+jsonb_build_object/i);
 for(const line of statements){
   assert.equal(/^(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|COPY|DO|CALL|EXECUTE|SET)\b/i.test(line),false,line);
 }
});
