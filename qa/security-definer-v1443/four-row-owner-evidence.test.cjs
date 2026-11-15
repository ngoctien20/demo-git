'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reviewPrivateEvidence,PROJECT,TYPES}=require('./four-row-owner-evidence.cjs');
const NOW=Date.parse('2026-11-16T08:00:00.000Z');
const tenants=[
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222'
];
const stores=[
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
];
const merchants=[
 'cccccccc-0000-4000-8000-000000000001',
 'cccccccc-0000-4000-8000-000000000002'
];
const reviewer='dddddddd-0000-4000-8000-000000000003';
const recordIds=[
 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1',
 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbb2',
 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaa3',
 'bbbbbbbb-4444-4444-8444-bbbbbbbbbbb4'
];
const digest=i=>String.fromCharCode(97+i).repeat(64);
const date='2026-11-15T00:00:00.000Z';
const baseline={products:2,orders:2,distinctTenants:2,
 eachTenantHasOneProductAndOneOrder:true};
function rows(){
 return recordIds.map((rowId,i)=>{
  const table=i<2?'products':'orders',shop=i%2;
  const common={
   table,rowId,tenantId:tenants[shop],candidateStoreId:stores[shop],
   snapshotSha256:digest(i),sourceUpdatedAt:date,
   merchantActorId:merchants[shop],reviewerActorId:reviewer
  };
  return {...common,evidence:TYPES[table].map((type,j)=>({
   type,reference:'EVD-'+String(i*3+j).padStart(12,'0'),
   rowId,tenantId:common.tenantId,storeId:common.candidateStoreId,
   snapshotSha256:common.snapshotSha256,
   actorId:type==='INDEPENDENT_QA_REVIEW'?reviewer:common.merchantActorId,
   signedAt:date
  }))};
 });
}
const audit=(items=rows(),base=baseline,additional={})=>reviewPrivateEvidence({
 mode:'PRIVATE_OPERATOR_REVIEW_ONLY',projectRef:PROJECT,
 rows:items,baseline:base,...additional
},NOW);
const has=(a,x)=>a.issues.includes(x);
test('01 · exact 2 Products and 2 Orders expected',()=>{
 assert.equal(audit().candidateProducts,2);
 assert.equal(audit().candidateOrders,2);
});
test('02 · fully formed synthetic claims remain MANUAL review only',()=>{
 const r=audit();
 assert.deepEqual(r.issues,[]);
 assert.equal(r.status,'READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION');
 assert.equal(r.canBackfill,false);assert.equal(r.realOwnerAttributionVerified,false);
 assert.equal(r.independentlyVerifiedOwners,0);
});
test('03 · no automatic backfill even with all evidence',()=>{
 const r=audit();
 assert.equal(r.recordsWritten,0);
 assert.equal(r.canCreateStore,false);assert.equal(r.canChangeRls,false);
});
test('04 · never report source row, tenant, Store or actor UUID',()=>{
 const r=JSON.stringify(audit());
 for(const x of [...recordIds,...stores,...tenants,...merchants,reviewer])
  assert.equal(r.includes(x),false,x);
});
test('05 · no raw customer info in result',()=>{
 const r=JSON.stringify(audit());
 assert.equal(r.includes('phone'),false);
 assert.equal(r.includes('address'),false);
 assert.equal(r.includes('customerName'),false);
});
test('06 · wrong project denies claimed coverage',()=>{
 assert.ok(has(audit(rows(),baseline,{projectRef:'prod'}),'PRIVATE_PROJECT_SCOPE_NOT_ATTESTED'));
});
test('07 · wrong workflow mode denies',()=>{
 assert.ok(has(audit(rows(),baseline,{mode:'PRODUCTION'}),'PRIVATE_PROJECT_SCOPE_NOT_ATTESTED'));
});
test('08 · baseline only 1 order is incomplete',()=>{
 assert.ok(has(audit(rows(),{...baseline,orders:1}),'LIVE_BASELINE_NOT_RECONCILED'));
});
test('09 · baseline tenant mismatch rejects',()=>{
 assert.ok(has(audit(rows(),{...baseline,distinctTenants:1}),'LIVE_BASELINE_NOT_RECONCILED'));
});
test('10 · missing evidence input refuses claimed progress',()=>{
 assert.ok(has(audit(undefined,{...baseline,orders:3}),'LIVE_BASELINE_NOT_RECONCILED'));
});
test('11 · three rows cannot be treated as four',()=>{
 assert.ok(has(audit(rows().slice(0,3)),'FOUR_LEGACY_ROWS_NOT_PROVIDED'));
});
test('12 · altered table distribution 3 Product 1 Order rejected',()=>{
 const r=rows();r[2].table='products';
 assert.ok(has(audit(r),'EXACTLY_TWO_PRODUCTS_AND_TWO_ORDERS'));
});
test('13 · duplicate row IDs inside same table rejected',()=>{
 const r=rows();r[1].rowId=r[0].rowId;
 assert.ok(has(audit(r),'DUPLICATE_SOURCE_ROW'));
});
test('14 · one tenant missing matching Order rejected',()=>{
 const r=rows();r[2].tenantId=tenants[1];
 assert.ok(has(audit(r),'TENANT_PAIRING_NOT_MATCHING_LIVE_BASELINE'));
});
test('15 · one Store cannot belong to two tenant IDs',()=>{
 const r=rows();r[1].candidateStoreId=stores[0];
 assert.ok(has(audit(r),'STORE_MAPPED_TO_TWO_TENANTS'));
});
test('16 · cannot assign without record-level Store UUID',()=>{
 const r=rows();r[0].candidateStoreId='shop-a';
 assert.ok(has(audit(r),'RECORD_OR_ACTOR_SCOPE_INVALID'));
});
test('17 · merchant and independent reviewer cannot be same actor',()=>{
 const r=rows();r[0].reviewerActorId=r[0].merchantActorId;
 assert.ok(has(audit(r),'SAME_MERCHANT_AND_REVIEWER'));
});
test('18 · snapshot cannot be empty or a hash shorter than 256 bits',()=>{
 const r=rows();r[0].snapshotSha256='abcd';
 assert.ok(has(audit(r),'SNAPSHOT_DIGEST_INVALID'));
});
test('19 · source timestamp future/malformed rejected',()=>{
 const r=rows();r[0].sourceUpdatedAt='2029-01-01T00:00:00.000Z';
 assert.ok(has(audit(r),'SOURCE_TIMESTAMP_INVALID'));
});
test('20 · evidence must have exactly 3 scopes',()=>{
 const r=rows();r[0].evidence.pop();
 assert.ok(has(audit(r),'EXACTLY_THREE_PRIVATE_EVIDENCE_ITEMS_REQUIRED'));
});
test('21 · source document type mismatching Product/Order rejected',()=>{
 const r=rows();r[0].evidence[0].type='ORDER_ORIGIN_SOURCE';
 assert.ok(has(audit(r),'INVALID_EVIDENCE_CLASS'));
});
test('22 · two source documents cannot satisfy distinct evidence categories',()=>{
 const r=rows();r[0].evidence[1].type='PRODUCT_CATALOG_SOURCE';
 assert.ok(has(audit(r),'DUPLICATED_EVIDENCE_CLASS'));
});
test('23 · evidence references cannot be reused between records',()=>{
 const r=rows();r[1].evidence[0].reference=r[0].evidence[0].reference;
 assert.ok(has(audit(r),'DUPLICATE_EVIDENCE_REFERENCE'));
});
test('24 · arbitrary URLs, emails or free text not valid evidence references',()=>{
 const r=rows();r[0].evidence[0].reference='https://private.example';
 assert.ok(has(audit(r),'INVALID_OPAQUE_EVIDENCE_REFERENCE'));
});
test('25 · forged record ID on evidence denied',()=>{
 const r=rows();r[0].evidence[0].rowId=recordIds[2];
 assert.ok(has(audit(r),'UNBOUND_EVIDENCE_SCOPE'));
});
test('26 · forged Store ID on evidence denied',()=>{
 const r=rows();r[0].evidence[1].storeId=stores[1];
 assert.ok(has(audit(r),'UNBOUND_EVIDENCE_SCOPE'));
});
test('27 · changed record version digest on evidence denied',()=>{
 const r=rows();r[0].evidence[0].snapshotSha256='f'.repeat(64);
 assert.ok(has(audit(r),'UNBOUND_EVIDENCE_SCOPE'));
});
test('28 · merchant signing the independent QA review is denied',()=>{
 const r=rows();r[0].evidence[2].actorId=merchants[0];
 assert.ok(has(audit(r),'SIGNER_IDENTITY_MISMATCH'));
});
test('29 · reviewer signing a merchant source claim is denied',()=>{
 const r=rows();r[0].evidence[1].actorId=reviewer;
 assert.ok(has(audit(r),'SIGNER_IDENTITY_MISMATCH'));
});
test('30 · evidence timestamps missing or in future denied',()=>{
 const r=rows();r[0].evidence[2].signedAt='2029-05-01T00:00:00.000Z';
 assert.ok(has(audit(r),'EVIDENCE_TIMESTAMP_INVALID'));
});
test('31 · extra private customer fields are refused',()=>{
 const r=rows();r[0].phone='+84912345678';
 assert.ok(has(audit(r),'UNEXPECTED_PRIVATE_ROW_FIELD'));
});
test('32 · unexpected metadata in evidence object is refused',()=>{
 const r=rows();r[0].evidence[0].customerAddress='private address';
 assert.ok(has(audit(r),'UNEXPECTED_EVIDENCE_FIELD'));
});
test('33 · missing independent real signature verification remains false',()=>{
 const r=audit();
 assert.equal(r.independentRealSignatureCheck,false);
 assert.equal(r.baselineRevalidatedWithReadOnlyDB,false);
});
test('34 · fake human QA approval boolean cannot authorize an RLS change',()=>{
 const r=audit(rows(),baseline,{ownerApproved:true,
  canBackfill:true,independentSignatureVerified:true});
 assert.equal(r.canBackfill,false);assert.equal(r.canChangeRls,false);
});
test('35 · corrupt input types do not print raw content',()=>{
 const r=audit([null,{table:'orders',rowId:'secret'}]);
 assert.equal(r.status,'INCOMPLETE_OR_INCONSISTENT_CLAIMS');
 assert.equal(JSON.stringify(r).includes('secret'),false);
});
test('36 · no source has SQL executor, network endpoint, DB write or grant methods',()=>{
 const v=require('./four-row-owner-evidence.cjs');
 for(const n of ['applyBackfill','writeToSupabase','saveOrder','alterRls',
  'createStore','sendMessenger','updateCredentials'])
  assert.equal(v[n],undefined);
});
