'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,cosine,buildIndex,retrieve,benchmark}=
  require('./synthetic-vision-retrieval.cjs');
const item=(tenantId,storeId,itemId,sku,imageId,embedding,extra={})=>({
 tenantId,storeId,itemId,sku,imageId,embedding,
 catalogRevision:7,embeddingVersion:'qa-v1',imageApproval:'MERCHANT_APPROVED',
 active:true,...extra
});
const snap=(t,s,items)=>({source:'TRUSTED_STORE_IMAGE_CATALOG',
 verified:true,tenantId:t,storeId:s,revision:7,items});
const A=snap('tenant-one','store-a',[
 item('tenant-one','store-a','prod-a003','A003','pic-a003',[1,0,0,0]),
 item('tenant-one','store-a','prod-a004','A004','pic-a004',[0.8,0.6,0,0]),
 item('tenant-one','store-a','prod-a015','A015','pic-a015',[0,0,1,0])
]);
const B=snap('tenant-one','store-b',[
 item('tenant-one','store-b','prod-b003','A003','pic-b003',[0,0,0,1])
]);
const C=snap('tenant-two','store-c',[
 item('tenant-two','store-c','prod-c003','A003','pic-c003',[0,-1,0,0])
]);
const build=(s)=>buildIndex({snapshot:s,tenantId:s.tenantId,storeId:s.storeId});
const IA=build(A),IB=build(B),IC=build(C);
const get=(index,tenantId,storeId,queryEmbedding,opts={})=>
 retrieve({index,tenantId,storeId,queryEmbedding,...opts});
test('01 cosine is bounded for valid QA vectors',()=>{
 assert.equal(cosine([1,0,0],[1,0,0]),1);
 assert.equal(cosine([1,0,0],[-1,0,0]),-1);
});
test('02 incompatible vectors fail closed',()=>{
 assert.throws(()=>cosine([1,0,0],[1,0,0,0]),/EMBEDDING_DIMENSION_INVALID/);
});
test('03 zero vector not a meaningful product similarity',()=>{
 assert.throws(()=>cosine([0,0,0],[1,0,0]),/EMBEDDING_ZERO_DENIED/);
});
test('04 search A003 returns candidate with confirmation, not order',()=>{
 const r=get(IA,'tenant-one','store-a',[1,0,0,0]);
 assert.equal(r.matches[0].sku,'A003');
 assert.equal(r.requiresCustomerSkuSelection,true);
 assert.equal(r.canCreateOrder,false);
});
test('05 similar A004 retrieved by labeled numeric vector',()=>{
 const r=get(IA,'tenant-one','store-a',[0.79,0.61,0,0]);
 assert.equal(r.matches[0].itemId,'prod-a004');
});
test('06 B-only visually orthogonal SKU is never returned in Shop A',()=>{
 const r=get(IA,'tenant-one','store-a',[0,0,0,1]);
 assert.equal(r.status,'NO_RELIABLE_MATCH');
});
test('07 Store B has same SKU as A but different product identity',()=>{
 const r=get(IB,'tenant-one','store-b',[0,0,0,1]);
 assert.equal(r.matches[0].itemId,'prod-b003');
 assert.notEqual(r.matches[0].itemId,'prod-a003');
});
test('08 Store C source Tenant cannot query using Tenant A',()=>{
 assert.throws(()=>get(IC,'tenant-one','store-c',[0,-1,0,0]),/VISION_QUERY_SCOPE_INVALID/);
});
test('09 wrong Store record in image index denied at build',()=>{
 const poisoned=snap('tenant-one','store-a',[
  item('tenant-one','store-b','prod-b003','A003','pic-b003',[0,0,0,1])
 ]);
 assert.throws(()=>build(poisoned),/UNAPPROVED_IMAGE_OR_EMBEDDING/);
});
test('10 unapproved merchant image blocked from catalog',()=>{
 const poisoned=snap('tenant-one','store-a',[
  item('tenant-one','store-a','prod-a003','A003','pic-unapproved',[1,0,0,0],
    {imageApproval:'DRAFT'})
 ]);
 assert.throws(()=>build(poisoned),/UNAPPROVED_IMAGE_OR_EMBEDDING/);
});
test('11 image embedding/catalog version mismatch denied',()=>{
 const poisoned=snap('tenant-one','store-a',[
  item('tenant-one','store-a','prod-a003','A003','pic-a003',[1,0,0,0],
    {embeddingVersion:'stale'})
 ]);
 assert.throws(()=>build(poisoned),/UNAPPROVED_IMAGE_OR_EMBEDDING/);
});
test('12 duplicate same product image ID forbidden',()=>{
 const poisoned=snap('tenant-one','store-a',[A.items[0],{...A.items[0]}]);
 assert.throws(()=>build(poisoned),/DUPLICATE_IMAGE_ID/);
});
test('13 invalid score cutoff cannot force always-match',()=>{
 assert.throws(()=>get(IA,'tenant-one','store-a',[1,0,0,0],{minScore:-0.5}),
  /VISION_QUERY_SCOPE_INVALID/);
});
test('14 topK bounded 1-5 and no outside-store leakage',()=>{
 assert.throws(()=>get(IA,'tenant-one','store-a',[1,0,0,0],{topK:9}),
  /VISION_QUERY_SCOPE_INVALID/);
 assert(get(IA,'tenant-one','store-a',[1,0,0,0],{topK:1}).matches.length<=1);
});
const examples=[
 {caseId:'qa-a-exact',tenantId:'tenant-one',storeId:'store-a',embedding:[1,0,0,0],expectedItemId:'prod-a003'},
 {caseId:'qa-a-tilt',tenantId:'tenant-one',storeId:'store-a',embedding:[0.99,0.1,0,0],expectedItemId:'prod-a003'},
 {caseId:'qa-a-medium',tenantId:'tenant-one',storeId:'store-a',embedding:[0.78,0.62,0,0],expectedItemId:'prod-a004'},
 {caseId:'qa-a-style',tenantId:'tenant-one',storeId:'store-a',embedding:[0,0,1,0],expectedItemId:'prod-a015'},
 {caseId:'qa-b-only',tenantId:'tenant-one',storeId:'store-b',embedding:[0,0,0,1],expectedItemId:'prod-b003'},
 {caseId:'qa-c-only',tenantId:'tenant-two',storeId:'store-c',embedding:[0,-1,0,0],expectedItemId:'prod-c003'},
 {caseId:'qa-a-outside-b',tenantId:'tenant-one',storeId:'store-a',embedding:[0,0,0,1],expectedItemId:null},
 {caseId:'qa-a-outside-c',tenantId:'tenant-one',storeId:'store-a',embedding:[0,-1,0,0],expectedItemId:null},
 {caseId:'qa-a-unknown-opposite',tenantId:'tenant-one',storeId:'store-a',embedding:[-1,0,0,0],expectedItemId:null},
 // Adversarial negative: visually similar *out-of-catalog* item. A raw
 // embedding matcher will falsely suggest A003, proving QA needs human SKU confirmation.
 {caseId:'qa-a-unknown-lookalike',tenantId:'tenant-one',storeId:'store-a',
  embedding:[0.91,0.21,0,0],expectedItemId:null}
];
test('15 synthetic labeled retrieval benchmark reports Recall@1/K and false positives',()=>{
 const r=benchmark({indices:{'store-a':IA,'store-b':IB,'store-c':IC},
  queries:examples,topK:3,minScore:0.7});
 assert.equal(r.queryCount,10);
 assert.equal(r.positives,6);
 assert.equal(r.negatives,4);
 assert.equal(r.recallAt1,1);
 assert.equal(r.recallAtK,1);
 assert.equal(r.falsePositiveQueryRate,0.25);
 assert.equal(r.actualVisualRecognitionBenchmarked,false);
 assert.equal(r.canSetProductionSimilarityThreshold,false);
});
test('16 benchmark exposes lookalike false-positive, never claims true recognition',()=>{
 const r=benchmark({indices:{'store-a':IA,'store-b':IB,'store-c':IC},
  queries:examples});
 const x=r.details.find(x=>x.caseId==='qa-a-unknown-lookalike');
 assert.equal(x.falseCandidateOnUnknown,true);
 assert.equal(r.dataset,'HAND_LABELED_SYNTHETIC_VECTOR_FIXTURES');
});
test('17 unknown product yields no invented SKU or price',()=>{
 const r=get(IA,'tenant-one','store-a',[-1,0,0,0]);
 assert.equal(r.matches.length,0);
 assert.equal(r.providerSends,0);
 assert.equal(r.hostedWrites,0);
});
test('18 benchmark fails closed on missing Store index',()=>{
 assert.throws(()=>benchmark({indices:{'store-a':IA},queries:examples}),
  /MISSING_STORE_INDEX/);
});
test('19 benchmark contract clearly distinguishes synthetic embedding from Vision',()=>{
 assert.equal(CONTRACT,'T404_V171C_SYNTHETIC_VISION_RETRIEVAL_V1');
 const r=get(IA,'tenant-one','store-a',[1,0,0,0]);
 assert.equal(r.realModelInference,false);
 assert.equal(r.realImageDecoded,false);
 assert.equal(r.recallOnRealImagesCertified,false);
});
