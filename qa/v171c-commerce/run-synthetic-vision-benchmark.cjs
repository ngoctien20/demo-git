'use strict';
/* NO actual image bytes, embeddings API, hosted data or paid model calls. */
const assert=require('node:assert/strict');
const {buildIndex,benchmark}=require('./synthetic-vision-retrieval.cjs');
const corpus=require('./synthetic-vision-benchmark-corpus.json');
const indices={};
for(const s of corpus.stores){
 const snapshot={source:'TRUSTED_STORE_IMAGE_CATALOG',verified:true,
  tenantId:s.tenantId,storeId:s.storeId,revision:corpus.revision,
  items:s.items.map(p=>({...p,tenantId:s.tenantId,storeId:s.storeId,
   catalogRevision:corpus.revision,embeddingVersion:corpus.embeddingVersion,
   imageApproval:'MERCHANT_APPROVED',active:true}))};
 indices[s.storeId]=buildIndex({
  snapshot,tenantId:s.tenantId,storeId:s.storeId,
  embeddingVersion:corpus.embeddingVersion});
}
const r=benchmark({indices,queries:corpus.queries,topK:3,minScore:0.7});
assert.equal(r.queryCount,10);
assert.equal(r.positives,6);
assert.equal(r.negatives,4);
assert.equal(r.recallAt1,1);
assert.equal(r.recallAtK,1);
assert.equal(r.falsePositiveQueryRate,0.25);
assert.equal(r.actualVisualRecognitionBenchmarked,false);
assert.equal(r.canSetProductionSimilarityThreshold,false);
console.log(JSON.stringify({
 dataset:corpus.dataset,queries:r.queryCount,
 positiveQueries:r.positives,unknownQueries:r.negatives,
 syntheticRecallAt1:r.recallAt1,syntheticRecallAt3:r.recallAtK,
 syntheticUnknownFalsePositiveRate:r.falsePositiveQueryRate,
 knownFailure:'OUT_OF_CATALOG_LOOKALIKE_CANDIDATE',
 realImageBytesExamined:0,realModelCalls:0,providerSends:0,
 productionThresholdApproved:false
}));
