'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TYPES}=require('../security-definer-v1443/four-row-owner-evidence.cjs');
const {CONTRACT,reconcilePrivateRows}=require('./private-fourrow-current-snapshot-reconcile.cjs');
const TS='2026-11-17T00:00:00.000Z';
const NOW=Date.parse('2026-11-17T00:05:00.000Z');
const TENANTS=['11111111-1111-4111-8111-111111111111',
               '22222222-2222-4222-8222-222222222222'];
const STORES=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const MERCHANTS=['cccccccc-0000-4000-8000-000000000001',
                 'cccccccc-0000-4000-8000-000000000002'];
const REVIEWER='dddddddd-0000-4000-8000-000000000003';
const IDS=['aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1',
           'bbbbbbbb-2222-4222-8222-bbbbbbbbbbb2',
           'aaaaaaaa-3333-4333-8333-aaaaaaaaaaa3',
           'bbbbbbbb-4444-4444-8444-bbbbbbbbbbb4'];
const dig=i=>String.fromCharCode(97+i).repeat(64);
function fixture(){
 const rows=IDS.map((rowId,i)=>{
  const table=i<2?'products':'orders',tenant=TENANTS[i%2],store=STORES[i%2];
  const common={table,rowId,tenantId:tenant,candidateStoreId:store,
   snapshotSha256:dig(i),sourceUpdatedAt:TS,
   merchantActorId:MERCHANTS[i%2],reviewerActorId:REVIEWER};
  return {...common,evidence:TYPES[table].map((type,j)=>({
   type,reference:'EVD-'+String(i*3+j).padStart(12,'0'),
   rowId,tenantId:tenant,storeId:store,snapshotSha256:dig(i),
   actorId:type==='INDEPENDENT_QA_REVIEW'?REVIEWER:MERCHANTS[i%2],
   signedAt:TS}))};
 });
 return {now:NOW,snapshot:{
  contract:'T404_RPC11_CURRENT_ROW_METADATA_SNAPSHOT_V1',
  projectRef:'ifxlvrhyjhbzbrkdsida',capturedAtUtc:TS,
  rows:rows.map(r=>({table:r.table,rowId:r.rowId,tenantId:r.tenantId,
    sourceUpdatedAt:r.sourceUpdatedAt,sourceSha256:r.snapshotSha256}))
 },ownerLedger:{projectRef:'ifxlvrhyjhbzbrkdsida',
  mode:'PRIVATE_OPERATOR_REVIEW_ONLY',rows}};
}
const review=p=>reconcilePrivateRows(p);
const has=(x,c)=>x.blockers.includes(c);
test('01 current 4-row metadata + private linter can be structurally joined',()=>{
 const r=review(fixture());
 assert.equal(r.contract,CONTRACT);
 assert.equal(r.status,'STRUCTURAL_ROW_JOIN_READY_FOR_EXTERNAL_PRIMARY_SOURCE_REVIEW');
 assert.equal(r.matchedSnapshotAndLedgerRows,4);
 assert.equal(r.distinctTenants,2);
});
test('02 matching all privately claimed rows never verifies actual hosted owner',()=>{
 const r=review(fixture());
 for(const k of ['actualCurrentHostedSnapshotAuthenticated',
  'actualOriginalStoreSourceInspected','independentMerchantReviewerAuthorityVerified',
  'cryptographicEvidenceSignaturesVerified','actualOwnerToCanonicalStoreProven',
  'canBackfill','canMigrate','canCreateStores','canChangeRls','canRevokeRpc']){
  assert.equal(r[k],false,k);
 }
});
test('03 no private ledger is denied',()=>{
 const x=fixture();delete x.ownerLedger;
 assert(has(review(x),'INHERITED_PRIVATE_OWNER_LINTER_NOT_READY'));
});
test('04 missing current source snapshot is denied',()=>{
 assert.equal(review({}).status,'PRIVATE_ROW_JOIN_NO_GO');
});
test('05 source snapshot older than ten minutes is stale',()=>{
 const x=fixture();x.now+=700000;
 assert(has(review(x),'PRIVATE_SOURCE_SNAPSHOT_NOT_RECENT'));
});
test('06 future-dated snapshot is rejected',()=>{
 const x=fixture();x.snapshot.capturedAtUtc='2027-01-01T00:00:00.000Z';
 assert(has(review(x),'PRIVATE_SOURCE_SNAPSHOT_NOT_RECENT'));
});
test('07 three rows are insufficient',()=>{
 const x=fixture();x.snapshot.rows.pop();
 assert(has(review(x),'EXPECTED_EXACT_FOUR_SNAPSHOT_ROWS'));
});
test('08 duplicate row cannot satisfy four distinct records',()=>{
 const x=fixture();x.snapshot.rows[1]={...x.snapshot.rows[0]};
 assert(has(review(x),'PRIVATE_SNAPSHOT_DUPLICATE_ROW'));
});
test('09 wrong table distribution is denied',()=>{
 const x=fixture();x.snapshot.rows[1].table='orders';
 assert(has(review(x),'PRIVATE_SNAPSHOT_NOT_TWO_PRODUCTS_TWO_ORDERS'));
});
test('10 two Tenant pairing must remain one Product and one Order each',()=>{
 const x=fixture();x.snapshot.rows[2].tenantId=x.snapshot.rows[1].tenantId;
 assert(has(review(x),'PRIVATE_SNAPSHOT_TENANT_PAIRING_MISMATCH'));
});
test('11 ledger row id not in actual source snapshot fails',()=>{
 const x=fixture();
 x.snapshot.rows[0].rowId='eeeeeeee-1111-4111-8111-eeeeeeeeeeee';
 assert(has(review(x),'PRIVATE_OWNER_LEDGER_ROW_NOT_IN_SNAPSHOT'));
});
test('12 mismatched tenant between two private sources denied',()=>{
 const x=fixture();x.ownerLedger.rows[0].tenantId=TENANTS[1];
 assert(has(review(x),'PRIVATE_LEDGER_TENANT_MISMATCH'));
});
test('13 stale source row updated_at blocks even with same row UUID',()=>{
 const x=fixture();x.snapshot.rows[0].sourceUpdatedAt='2026-11-16T20:00:00.000Z';
 assert(has(review(x),'PRIVATE_LEDGER_ROW_VERSION_STALE'));
});
test('14 digest mismatch blocks even with matching row ID/tenant/timestamp',()=>{
 const x=fixture();x.snapshot.rows[0].sourceSha256='f'.repeat(64);
 assert(has(review(x),'PRIVATE_LEDGER_SNAPSHOT_DIGEST_MISMATCH'));
});
test('15 unexpected PII field in private snapshot rejected',()=>{
 const x=fixture();x.snapshot.rows[0].phone='PRIVATE_FAKE_PHONE';
 assert(has(review(x),'PRIVATE_SNAPSHOT_ROW_SHAPE_INVALID'));
 assert(!JSON.stringify(review(x)).includes('PRIVATE_FAKE_PHONE'));
});
test('16 arbitrary extra metadata cannot be used for self-authorization',()=>{
 const x=fixture();x.snapshot.rows[0].iApproveMigration=true;
 assert.equal(review(x).canMigrate,false);
 assert(has(review(x),'PRIVATE_SNAPSHOT_ROW_SHAPE_INVALID'));
});
test('17 invalid source digest rejected without echoing source',()=>{
 const x=fixture();x.snapshot.rows[0].sourceSha256='TOPSECRET';
 assert(has(review(x),'PRIVATE_SNAPSHOT_ROW_METADATA_INVALID'));
 assert(!JSON.stringify(review(x)).includes('TOPSECRET'));
});
test('18 reviewer must be different merchant, enforced by inherited linter',()=>{
 const x=fixture();
 x.ownerLedger.rows[0].reviewerActorId=x.ownerLedger.rows[0].merchantActorId;
 assert(has(review(x),'INHERITED_PRIVATE_OWNER_LINTER_NOT_READY'));
});
test('19 wrong Supabase project denied',()=>{
 const x=fixture();x.snapshot.projectRef='wrong-project';
 assert(has(review(x),'PRIVATE_SOURCE_SNAPSHOT_CONTRACT_INVALID'));
});
test('20 ensure no sensitive UUID/digest/store identifiers leave module',()=>{
 const x=fixture(),report=JSON.stringify(review(x));
 for(const v of [...IDS,...TENANTS,...STORES,...MERCHANTS,REVIEWER,dig(0)])
  assert(!report.includes(v),v);
 assert.equal(JSON.parse(report).containsRowIdentifiers,false);
 assert.equal(JSON.parse(report).containsPrivateSourceDigests,false);
});
