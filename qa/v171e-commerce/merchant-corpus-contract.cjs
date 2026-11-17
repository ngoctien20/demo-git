'use strict';
/**
 * V17.1E source-only intake of merchant-declared product photos.
 * Real rights/Store ownership are NOT established by supplied JSON.
 * Never persists image bytes, URL, credentials or personal metadata.
 */
const {inspectPng}=require('../v171d-commerce/png-media-intake.cjs');
const VERSION='T404_V171E_MERCHANT_CORPUS_PREPARATION_V1';
const fail=x=>{throw Error(x);};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function prepareCorpus({uploads,catalog,tenantId,storeId,nowMs}={}){
 if(!id(tenantId)||!id(storeId)||!Number.isSafeInteger(nowMs)||nowMs<=0||
   !obj(catalog)||catalog.source!=='SERVER_VERIFIED_SHOP_CATALOG'||
   catalog.verified!==true||catalog.tenantId!==tenantId||
   catalog.storeId!==storeId||!Number.isSafeInteger(catalog.revision)||
   catalog.revision<1||!Array.isArray(catalog.products)||
   catalog.products.length>1000||!Array.isArray(uploads)||
   uploads.length<1||uploads.length>100)
   fail('CORPUS_SCOPE_OR_INPUT_INVALID');
 const products=new Map();
 for(const p of catalog.products){
   if(!obj(p)||p.tenantId!==tenantId||p.storeId!==storeId||
     !id(p.itemId)||!id(p.sku)||typeof p.active!=='boolean'||
     products.has(p.itemId))fail('CORPUS_CATALOG_READBACK_INVALID');
   products.set(p.itemId,p);
 }
 const out=[],ids=new Set(),hashes=new Set();
 for(const u of uploads){
   const m=u&&u.manifest;
   if(!obj(m)||!Buffer.isBuffer(u.imageBytes)||
     m.source!=='MERCHANT_DIRECT_UPLOAD_DECLARATION'||
     m.tenantId!==tenantId||m.storeId!==storeId||
     m.catalogRevision!==catalog.revision||!id(m.mediaId)||
     !id(m.itemId)||!id(m.sku)||!id(m.merchantDeclarationId)||
     !id(m.rightsEvidenceRef)||m.rightsBasis!=='ORIGINAL_MERCHANT_PHOTO'||
     m.commercialUseConsent!==true||m.piiReviewed!==true||
     m.mimeType!=='image/png'||!hex(m.declaredSha256)||
     !Number.isSafeInteger(m.consentAtMs)||m.consentAtMs>nowMs||
     m.consentAtMs<=nowMs-365*24*3600*1000||
     !Number.isSafeInteger(m.retentionUntilMs)||
     m.retentionUntilMs<=nowMs||m.retentionUntilMs>nowMs+365*24*3600*1000)
     fail('CORPUS_RIGHTS_DECLARATION_INCOMPLETE');
   const product=products.get(m.itemId);
   if(!product||product.active!==true||product.sku!==m.sku)
     fail('CORPUS_CATALOG_ITEM_MISMATCH');
   const decoded=inspectPng(u.imageBytes);
   if(decoded.sha256!==m.declaredSha256)fail('CORPUS_CONTENT_HASH_MISMATCH');
   if(ids.has(m.mediaId)||hashes.has(decoded.sha256))
     fail('CORPUS_DUPLICATE_IMAGE');
   ids.add(m.mediaId);hashes.add(decoded.sha256);
   out.push(Object.freeze({tenantId,storeId,itemId:m.itemId,sku:m.sku,
     mediaId:m.mediaId,sha256:decoded.sha256,width:decoded.width,
     height:decoded.height,merchantDeclarationId:m.merchantDeclarationId,
     rightsEvidenceRef:m.rightsEvidenceRef,retentionUntilMs:m.retentionUntilMs,
     independentRightsVerified:false,independentStoreVerified:false,
     disposition:'PENDING_INDEPENDENT_RIGHTS_AND_STORE_REVIEW'}));
 }
 return Object.freeze({version:VERSION,mode:'SOURCE_ONLY_LOCAL_BYTES_NO_STORAGE',
   tenantId,storeId,catalogRevision:catalog.revision,
   items:Object.freeze(out),imageCount:out.length,
   pixelDecoderRan:true,merchantPhotoOriginIndependentlyVerified:false,
   rightsIndependentlyVerified:false,readyForModelBenchmark:false,
   bytesRetained:false,hostedWrites:0,providerSends:0,modelCalls:0,
   canPublish:false,canTrain:false});
}
module.exports=Object.freeze({VERSION,prepareCorpus});
