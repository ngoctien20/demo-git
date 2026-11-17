'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditCorpus,privateIntakePlan,CONTRACT}=require('./merchant-corpus-readiness.cjs');
const scope={tenantId:'T_QA_01',storeId:'S_QA_A'};
const product=(id='P_A_001',sku='QA-F-001',extra={})=>({...scope,
  productId:id,sku,demoOnly:true,published:false,...extra});
const media=(imageId='img-a',extra={})=>({...scope,
  productId:'P_A_001',productSku:'QA-F-001',mediaId:imageId,
  sha256:(imageId==='img-a'?'a':imageId==='img-b'?'b':'c').repeat(64),
  mimeType:'image/png',width:640,height:640,bytes:20480,
  catalogVersion:'qa-v2',privateObjectRef:'qa-private-a',contentStoredInGithub:false,
  origin:'MERCHANT_UPLOADED',rightsScope:'PRODUCT_SEARCH_AND_EVALUATION',
  processingConsent:true,licenseState:'CLAIMED_MERCHANT_OR_LICENSED',
  merchantAttestor:'qa-merchant-owner',independentReviewer:'qa-indie-reviewer',
  privateEvidenceRef:'local-proof-only',trainingPermission:false,...extra});
const ca=(caseId,imageId,labelType,partition='HOLDOUT',extra={})=>({...scope,
  caseId,imageId,labelType,partition,
  expectedSku:labelType==='positive'?'QA-F-001':null,
  labeler:'qa-labeler-1',independentReviewer:'qa-labeler-2',...extra});
const candidate=()=>({ ...scope,products:[product()],
  media:[media('img-a'),media('img-b',{origin:'QA_GENERATED'}),
    media('img-c',{origin:'QA_GENERATED'}),
    media('img-d',{origin:'QA_GENERATED',sha256:'d'.repeat(64)})],
  cases:[ca('case-ref','img-a','positive','REFERENCE'),
    ca('case-positive','img-b','positive','HOLDOUT'),
    ca('case-unknown','img-c','unknown','HOLDOUT'),
    ca('case-hard','img-d','hard_negative','HOLDOUT')]});
test('01 current empty Commerce media registry remains NOT_ADMISSIBLE',()=>{
 const r=auditCorpus({...scope,products:[product()],media:[],cases:[]});
 assert.equal(r.status,'NOT_ADMISSIBLE');
 assert(r.reasons.includes('NO_MERCHANT_PHOTO_WITH_PRIVATE_RIGHTS_PROOF'));
 assert.equal(r.merchantPhotoClaims,0);
});
test('02 zero Store scope rejected',()=>assert.throws(
 ()=>auditCorpus({tenantId:'',storeId:'S_QA_A'}),/CORPUS_SCOPE/));
test('03 valid QA claim packet still needs independent source audit',()=>{
 const r=auditCorpus(candidate());
 assert.equal(r.status,'CLAIMED_CORPUS_PACKET_REQUIRES_INDEPENDENT_SOURCE_AUDIT');
 assert.equal(r.realMerchantPhotoRightsVerifiedHere,false);
 assert.equal(r.realStoreOwnershipVerifiedHere,false);
 assert.equal(r.canTrainModel,false);
});
test('04 Store B media never can join Store A corpus',()=>{
 const x=candidate();x.media[0].storeId='S_QA_B';
 assert(auditCorpus(x).reasons.includes('IMAGE_PRODUCT_OR_STORE_BINDING_INVALID'));
});
test('05 cross-Tenant product rejected',()=>{
 const x=candidate();x.products[0].tenantId='T_QA_02';
 assert(auditCorpus(x).reasons.includes('PRODUCT_SCOPE_OR_DEMO_CONTRACT_INVALID'));
});
test('06 live Published product not silently brought into QA corpus',()=>{
 const x=candidate();x.products[0].published=true;
 assert(auditCorpus(x).reasons.includes('PRODUCT_SCOPE_OR_DEMO_CONTRACT_INVALID'));
});
test('07 incorrect product SKU for image is rejected',()=>{
 const x=candidate();x.media[0].productSku='QA-F-003';
 assert(auditCorpus(x).reasons.includes('IMAGE_DIGEST_DIMENSIONS_OR_PRIVATE_STORAGE_INVALID'));
});
test('08 media cannot enter without owner rights scope',()=>{
 const x=candidate();x.media[0].rightsScope='ANY_PURPOSE_FOREVER';
 assert(auditCorpus(x).reasons.includes('MERCHANT_RIGHTS_OR_INDEPENDENT_REVIEW_NOT_READY'));
});
test('09 owner and independent reviewer must differ',()=>{
 const x=candidate();x.media[0].independentReviewer=x.media[0].merchantAttestor;
 assert(auditCorpus(x).reasons.includes('MERCHANT_RIGHTS_OR_INDEPENDENT_REVIEW_NOT_READY'));
});
test('10 training is explicitly OFF when only product search was approved',()=>{
 const x=candidate();x.media[0].trainingPermission=true;
 assert(auditCorpus(x).reasons.includes('MERCHANT_RIGHTS_OR_INDEPENDENT_REVIEW_NOT_READY'));
});
test('11 raw public image URL in private contract rejected',()=>{
 const x=candidate();x.media[0].publicUrl='https://example.com/product.png';
 assert(auditCorpus(x).reasons.includes('IMAGE_DIGEST_DIMENSIONS_OR_PRIVATE_STORAGE_INVALID'));
});
test('12 image with duplicate content hash rejected',()=>{
 const x=candidate();x.media[1].sha256=x.media[0].sha256;
 assert(auditCorpus(x).reasons.includes('IMAGE_DIGEST_DIMENSIONS_OR_PRIVATE_STORAGE_INVALID'));
});
test('13 huge image size blocks intake',()=>{
 const x=candidate();x.media[0].bytes=99*1024*1024;
 assert(auditCorpus(x).reasons.includes('IMAGE_DIGEST_DIMENSIONS_OR_PRIVATE_STORAGE_INVALID'));
});
test('14 invalid MIME type including SVG and HTML rejected',()=>{
 for(const mime of ['text/html','image/svg+xml','application/javascript']){
  const x=candidate();x.media[0].mimeType=mime;
  assert(auditCorpus(x).reasons.includes('IMAGE_DIGEST_DIMENSIONS_OR_PRIVATE_STORAGE_INVALID'));
 }
});
test('15 absent positive label prevents meaningful Recall@K',()=>{
 const x=candidate();x.cases=x.cases.filter(c=>c.labelType!=='positive');
 assert(auditCorpus(x).reasons.includes('MISSING_POSITIVE_UNKNOWN_OR_HARD_NEGATIVE_LABELS'));
});
test('16 missing hard negative prevents practical false-positive evaluation',()=>{
 const x=candidate();x.cases=x.cases.filter(c=>c.labelType!=='hard_negative');
 assert(auditCorpus(x).reasons.includes('MISSING_POSITIVE_UNKNOWN_OR_HARD_NEGATIVE_LABELS'));
});
test('17 mislabeled positive SKU denied',()=>{
 const x=candidate();x.cases[0].expectedSku='QA-F-003';
 assert(auditCorpus(x).reasons.includes('POSITIVE_LABEL_NOT_GROUNDED_IN_PRODUCT'));
});
test('18 ungrounded supposed negative cannot carry actual SKU',()=>{
 const x=candidate();x.cases[2].expectedSku='QA-F-001';
 assert(auditCorpus(x).reasons.includes('UNKNOWN_LABEL_HAS_EXPECTED_SKU'));
});
test('19 source image appearing in both reference and holdout is leakage',()=>{
 const x=candidate();x.cases.push(ca('case-leaked','img-a','positive','HOLDOUT'));
 assert(auditCorpus(x).reasons.includes('REFERENCE_HOLDOUT_IMAGE_LEAKAGE'));
});
test('20 no private image bytes or credentials are in audit report',()=>{
 const r=auditCorpus(candidate());
 const str=JSON.stringify(r);
 assert(!str.includes('local-proof-only'));
 assert(!str.includes('qa-private-a'));
 assert(!str.includes('https://'));
 assert.equal(r.hostedWrites,0);assert.equal(r.providerSends,0);
});
test('21 final intake plan always requires private verified evidence',()=>{
 const p=privateIntakePlan(auditCorpus(candidate()));
 assert.equal(p.requiresPrivateStorage,true);
 assert.equal(p.actualImagesReviewed,0);
 assert.equal(p.canAuthorizeProviderCost,false);
});
test('22 fake all-good claims never authorize production training',()=>{
 const r=auditCorpus(candidate());
 assert.equal(r.canTrainModel,false);
 assert.equal(r.canUploadPhotos,false);
 assert.equal(r.canPublish,false);
 assert.equal(CONTRACT,'T404_V171E_PRIVATE_MERCHANT_MEDIA_CORPUS_V1');
});
