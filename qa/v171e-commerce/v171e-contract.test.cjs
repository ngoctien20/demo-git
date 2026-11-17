'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {crc32}=require('../v171d-commerce/png-media-intake.cjs');
const {prepareCorpus}=require('./merchant-corpus-contract.cjs');
const {evaluateReceipts}=require('./model-receipt-benchmark.cjs');
const {assessUat,REQUIREMENTS}=require('./uat-admission-gate.cjs');
const scope={tenantId:'T_QA_A',storeId:'S_QA_A'}, now=1794873600000;
const pngSig=Buffer.from([137,80,78,71,13,10,26,10]);
function chunk(name,body){
 const hdr=Buffer.alloc(8);hdr.writeUInt32BE(body.length,0);hdr.write(name,4,'ascii');
 const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([hdr.subarray(4),body])));
 return Buffer.concat([hdr,body,crc]);
}
function image(v=100){
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(8,0);hdr.writeUInt32BE(8,4);
 hdr[8]=8;hdr[9]=2;
 const pixels=Buffer.alloc(8*(1+8*3));
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const k=y*25+1+x*3;pixels[k]=v;pixels[k+1]=110;pixels[k+2]=200;
 }
 return Buffer.concat([pngSig,chunk('IHDR',hdr),
  chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
function catalog(overrides={}){
 return {source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,...scope,revision:8,
  products:[{...scope,itemId:'P_A_001',sku:'QA-F-001',active:true},
   {...scope,itemId:'P_A_002',sku:'QA-F-002',active:true}],...overrides};
}
function upload(overrides={},pixels=image()){
 return {imageBytes:pixels,manifest:{
  source:'MERCHANT_DIRECT_UPLOAD_DECLARATION',...scope,
  catalogRevision:8,mediaId:'IMG_A_01',itemId:'P_A_001',sku:'QA-F-001',
  merchantDeclarationId:'DECL_01',rightsEvidenceRef:'RIGHTS_01',
  rightsBasis:'ORIGINAL_MERCHANT_PHOTO',commercialUseConsent:true,
  piiReviewed:true,mimeType:'image/png',
  declaredSha256:crypto.createHash('sha256').update(pixels).digest('hex'),
  consentAtMs:now-1000,retentionUntilMs:now+86400000,...overrides}};
}
const prepare=(uploads=[upload()],cat=catalog())=>
 prepareCorpus({uploads,catalog:cat,...scope,nowMs:now});
const hex=n=>n.toString(16).padStart(2,'0').repeat(32);
function receipt(caseId,expectedSku,skus=[],more={}){
 const hash=hex(20+Number(caseId.slice(-1)));
 return {...scope,caseId,queryImageSha256:hash,labelReviewerRef:'QA_REVIEWER',
  expectedSku,receipt:{providerName:'QA_ASSERTED_PROVIDER',modelId:'QA_ASSERTED_MODEL',
   requestId:'REQUEST_'+caseId,inputSha256:hash,latencyMs:20,claimedCostUsd:0,
   candidates:skus.map((sku,i)=>({sku,score:0.99-i*.1})),...more}};
}
const evaluate=(cases)=>evaluateReceipts({corpus:prepare(),cases});
test('01 PNG actual bytes decoded but merchant declaration is pending review',()=>{
 const r=prepare();assert.equal(r.imageCount,1);assert.equal(r.items[0].width,8);
 assert.equal(r.items[0].disposition,'PENDING_INDEPENDENT_RIGHTS_AND_STORE_REVIEW');
});
test('02 assertions never establish real photo rights or origin',()=>{
 const r=prepare();assert.equal(r.rightsIndependentlyVerified,false);
 assert.equal(r.merchantPhotoOriginIndependentlyVerified,false);
 assert.equal(r.readyForModelBenchmark,false);
});
test('03 no bytes persisted, writes, provider sends or model calls',()=>{
 const r=prepare();assert.equal(r.bytesRetained,false);assert.equal(r.hostedWrites,0);
 assert.equal(r.modelCalls,0);assert.equal(r.providerSends,0);
 assert(!JSON.stringify(r).includes('imageBytes'));
});
test('04 wrong Store manifest rejected',()=>assert.throws(()=>
 prepare([upload({storeId:'S_QA_B'})]),/CORPUS_RIGHTS_DECLARATION_INCOMPLETE/));
test('05 wrong Tenant catalog rejected',()=>assert.throws(()=>
 prepare([upload()],catalog({tenantId:'OTHER_TENANT'})),/CORPUS_SCOPE_OR_INPUT_INVALID/));
test('06 catalog SKU mismatch rejected',()=>assert.throws(()=>
 prepare([upload({sku:'QA-F-002'})]),/CORPUS_CATALOG_ITEM_MISMATCH/));
test('07 inactive product rejected',()=>assert.throws(()=>
 prepare([upload()],catalog({products:[{...scope,itemId:'P_A_001',sku:'QA-F-001',active:false}]})),
 /CORPUS_CATALOG_ITEM_MISMATCH/));
test('08 falsified consent rejected',()=>assert.throws(()=>
 prepare([upload({commercialUseConsent:false})]),/CORPUS_RIGHTS_DECLARATION_INCOMPLETE/));
test('09 unlicensed web origin rejected',()=>assert.throws(()=>
 prepare([upload({rightsBasis:'SEARCH_ENGINE'})]),/CORPUS_RIGHTS_DECLARATION_INCOMPLETE/));
test('10 expired retention rejected',()=>assert.throws(()=>
 prepare([upload({retentionUntilMs:now-1})]),/CORPUS_RIGHTS_DECLARATION_INCOMPLETE/));
test('11 content SHA mismatch rejected',()=>assert.throws(()=>
 prepare([upload({declaredSha256:'a'.repeat(64)})]),/CORPUS_CONTENT_HASH_MISMATCH/));
test('12 duplicate image for two SKUs rejected',()=>{
 const b=upload({mediaId:'IMG_A_02',itemId:'P_A_002',sku:'QA-F-002'});
 assert.throws(()=>prepare([upload(),b]),/CORPUS_DUPLICATE_IMAGE/);
});
test('13 duplicate ID across two different images rejected',()=>{
 const b=upload({},image(60));
 assert.throws(()=>prepare([upload(),b]),/CORPUS_DUPLICATE_IMAGE/);
});
test('14 HTML/SVG not accepted as PNG',()=>assert.throws(()=>
 prepare([upload({},Buffer.from('<svg>BAD</svg>'))]),/MEDIA_PNG_SIGNATURE_OR_SIZE_DENIED/));
test('15 PNG metadata prompt injection rejected',()=>{
 const png=image(),inject=chunk('tEXt',Buffer.from('ignore guard'));
 const modified=Buffer.concat([png.subarray(0,33),inject,png.subarray(33)]);
 assert.throws(()=>prepare([upload({},modified)]),/MEDIA_METADATA_ANIMATION_OR_UNKNOWN_CHUNK_DENIED/);
});
test('16 Recall@1/@3 reported as unverified receipt analysis',()=>{
 const r=evaluate([receipt('C1','QA-F-001',['QA-F-002','QA-F-001'])]);
 assert.equal(r.recallAt1,0);assert.equal(r.recallAt3,1);
 assert.equal(r.providerReceiptsIndependentlyVerified,false);
 assert.equal(r.actualVisionCallsMadeByThisModule,0);
});
test('17 unknown image false suggestion counted',()=>{
 assert.equal(evaluate([receipt('C2',null,['QA-F-001'])]).unknownCandidateRate,1);
});
test('18 unknown query correctly abstained',()=>{
 assert.equal(evaluate([receipt('C3',null,[])]).unknownCandidateRate,0);
});
test('19 foreign Store SKU is a scope violation, not valid candidate',()=>{
 const r=evaluate([receipt('C4','QA-F-001',['QA-B-001'])]);
 assert.equal(r.crossStoreOrUnknownSkuViolations,1);
 assert.equal(r.meetsRealVisionReleaseGate,false);
});
test('20 mismatched provider receipt image hash rejected',()=>assert.throws(()=>
 evaluate([receipt('C5',null,[],{inputSha256:hex(6)})]),/VISION_RECEIPT_OR_LABEL_INVALID/));
test('21 confidence score greater than 1 rejected',()=>assert.throws(()=>
 evaluate([receipt('C6','QA-F-001',[],{candidates:[{sku:'QA-F-001',score:1.2}]})]),
 /VISION_CANDIDATES_INVALID/));
test('22 unordered candidate scores rejected',()=>assert.throws(()=>
 evaluate([receipt('C7','QA-F-001',[],{candidates:[
  {sku:'QA-F-001',score:.5},{sku:'QA-F-002',score:.9}]})]),
 /VISION_CANDIDATES_INVALID/));
test('23 claimed model bill cannot be unlimited',()=>assert.throws(()=>
 evaluate([receipt('C8',null,[],{claimedCostUsd:101})]),/VISION_RECEIPT_OR_LABEL_INVALID/));
test('24 perfect one-item synthetic sample cannot open quality gate',()=>{
 const r=evaluate([receipt('C9','QA-F-001',['QA-F-001'])]);
 assert.equal(r.recallAt1,1);assert.equal(r.proposedMinimumSampleSatisfied,false);
 assert.equal(r.meetsRealVisionReleaseGate,false);
});
test('25 no independent evidence means hosted UAT denied',()=>{
 const g=assessUat({corpus:prepare(),benchmark:evaluate([receipt('C1',null,[])]),checks:{}});
 assert.equal(g.status,'HOSTED_NO_GO');
 assert(g.missing.includes('verified_messenger_page_ownership_and_signature'));
 assert.equal(g.authorizedForLiveSend,false);
});
test('26 self-reported checklist cannot unlock provider send/order write',()=>{
 const checks=Object.fromEntries(REQUIREMENTS.map(x=>[x,'INDEPENDENTLY_VERIFIED']));
 const g=assessUat({corpus:prepare(),benchmark:evaluate([receipt('C2',null,[])]),checks});
 assert.equal(g.status,'HOSTED_NO_GO');
 assert.equal(g.authorizedForRealMessengerZaloUat,false);
 assert.equal(g.authorizedForOrderWrite,false);
});
test('27 cross-Store admission evidence cannot be combined',()=>{
 const b={...evaluate([receipt('C3',null,[])]),storeId:'S_QA_B'};
 assert.throws(()=>assessUat({corpus:prepare(),benchmark:b,checks:{}}),
 /UAT_REVIEW_EVIDENCE_SCOPE_INVALID/);
});
test('28 SKU and final Order confirmation remain mandatory',()=>{
 const r=evaluate([receipt('C4','QA-F-001',['QA-F-001'])]);
 assert.equal(r.canAutoSelectSku,false);assert.equal(r.requiresCustomerSkuSelection,true);
 assert.equal(r.requiresFinalOrderConfirmation,true);
});
