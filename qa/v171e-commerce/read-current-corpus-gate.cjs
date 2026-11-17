'use strict';
/**
 * A SNAPSHOT of the sanitized 2026-11-17 read-only Google Sheets V17.2
 * audit (PRODUCT_MEDIA header-only). Never mistaken for an ongoing live
 * Sheets connector, a merchant media license, or a dynamic upload.
 */
const assert=require('node:assert/strict');
const {auditCorpus,privateIntakePlan}=require('./merchant-corpus-readiness.cjs');
const {planPaidPilot}=require('./vision-model-benchmark-gate.cjs');
const {review}=require('./meta-zalo-uat-admission.cjs');
const tenantId='T_QA_01',storeId='S_QA_A';
const products=[['P_A_001','QA-F-001'],['P_A_002','QA-F-002'],
 ['P_A_003','QA-F-003']].map(([productId,sku])=>({
 tenantId,storeId,productId,sku,demoOnly:true,published:false}));
const corpus=auditCorpus({tenantId,storeId,products,media:[],cases:[]});
const plan=privateIntakePlan(corpus);
const billing=planPaidPilot(); // No real provider price or balance disclosure.
const uat=review({projectRef:'ifxlvrhyjhbzbrkdsida'});
assert.equal(corpus.status,'NOT_ADMISSIBLE');
assert.equal(corpus.merchantPhotoClaims,0);
assert.equal(plan.canAuthorizeProviderCost,false);
assert.equal(billing.canInvokePaidModel,false);
assert.equal(uat.canSendProvider,false);
assert.equal(uat.canPublishWorkflow,false);
console.log(JSON.stringify({
 snapshotDate:'2026-11-17',
 source:'GOOGLE_SHEETS_V17_2_READ_ONLY_SNAPSHOT_NOT_LIVE',
 corpusStatus:corpus.status,
 merchantPhotosObserved:corpus.merchantPhotoClaims,
 qaProductsAuditedInStoreA:products.length,
 rightsProofVerified:false,
 modelBenchmarkCalls:0,
 paidProviderRunAllowed:false,
 realMetaZaloUatAllowed:false,
 hostedWorkflowChanges:0,
 blockers:corpus.reasons,
 metaZaloEvidenceBlocks:uat.missingEvidenceCount
}));
