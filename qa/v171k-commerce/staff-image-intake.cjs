'use strict';
/* TIEN404 V17.1K — staff-curated local photo, NO WEB FETCH.
 * Human review replaces automatic crawling, NOT backend Store isolation,
 * image raster decode, protected storage or rights/license verification.
 */
const crypto=require('node:crypto');
const VERSION='T404_V171K_STAFF_CURATED_IMAGE_PREFLIGHT_V1';
const MAX_BYTES=2*1024*1024;
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const deny=s=>{throw Error(s)};
function staffPreflight({catalog,reviewer,merchantConsent,source,media,verifyStaffSession,nowMs}={}){
 if(!obj(catalog)||catalog.source!=='SERVER_VERIFIED_SHOP_CATALOG'||
    catalog.verified!==true||!id(catalog.tenantId)||!id(catalog.storeId)||
    !Number.isSafeInteger(catalog.revision)||catalog.revision<1||
    !Array.isArray(catalog.products)||catalog.products.length<1||
    !Number.isSafeInteger(nowMs)||nowMs<=0)deny('STAFF_CATALOG_AUTHORITY_DENIED');
 if(!obj(reviewer)||!id(reviewer.staffId)||
    !['MEDIA_REVIEWER','MEDIA_ADMIN'].includes(reviewer.role)||
    reviewer.tenantId!==catalog.tenantId||reviewer.storeId!==catalog.storeId||
    reviewer.mfaVerified!==true||typeof verifyStaffSession!=='function'||
    verifyStaffSession({reviewer,catalog,nowMs})!==true)
    deny('STAFF_INDEPENDENT_SESSION_DENIED');
 if(!obj(media)||!id(media.mediaId)||!id(media.sku)||!id(media.itemId)||
    !Buffer.isBuffer(media.bytes)||!hex(media.expectedSha256)||
    media.catalogRevision!==catalog.revision)
    deny('STAFF_MEDIA_SCOPE_OR_DIGEST_DENIED');
 const product=catalog.products.find(p=>p.tenantId===catalog.tenantId&&
     p.storeId===catalog.storeId&&p.sku===media.sku&&
     p.itemId===media.itemId&&p.active===true);
 if(!product)deny('STAFF_CROSS_STORE_OR_SKU_DENIED');
 if(!obj(merchantConsent)||merchantConsent.tenantId!==catalog.tenantId||
    merchantConsent.storeId!==catalog.storeId||
    merchantConsent.sku!==media.sku||merchantConsent.itemId!==media.itemId||
    !id(merchantConsent.rightsEvidenceRef)||!id(merchantConsent.consentRef)||
    merchantConsent.commercialUse!==true||
    merchantConsent.aiMatchingApproved!==true||
    merchantConsent.privacyReviewed!==true||
    !Number.isSafeInteger(merchantConsent.expiresAtMs)||
    merchantConsent.expiresAtMs<=nowMs||
    merchantConsent.expiresAtMs>nowMs+365*86400000)
    deny('STAFF_MEDIA_RIGHTS_DECLARATION_DENIED');
 if(!obj(source)||!['STAFF_UPLOADED_BYTES','MERCHANT_PROVIDED_FILE'].includes(source.kind)||
    source.remoteFetchRequested===true||source.autoScrape===true||
    source.isPublicWebhook===true)deny('STAFF_DIRECT_UPLOAD_ONLY');
 const b=media.bytes;
 if(b.length<64||b.length>MAX_BYTES)deny('STAFF_IMAGE_BYTES_LIMIT_DENIED');
 const png=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=b[0]===255&&b[1]===216&&b[2]===255;
 const webp=b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
 if(!((media.mime==='image/png'&&png)||(media.mime==='image/jpeg'&&jpg)||
      (media.mime==='image/webp'&&webp)))deny('STAFF_MEDIA_MIME_MAGIC_DENIED');
 const sha=crypto.createHash('sha256').update(b).digest('hex');
 if(sha!==media.expectedSha256)deny('STAFF_MEDIA_SHA_CHANGED');
 return Object.freeze({version:VERSION,mode:'STAFF_LOCAL_QUARANTINE_ONLY',
   tenantId:catalog.tenantId,storeId:catalog.storeId,
   mediaId:media.mediaId,itemId:media.itemId,sku:media.sku,
   imageSha256:sha,mediaMime:media.mime,byteCount:b.length,
   catalogRevision:catalog.revision,reviewerRef:reviewer.staffId,
   consentRef:merchantConsent.consentRef,rightsEvidenceRef:merchantConsent.rightsEvidenceRef,
   independentStaffSessionVerifiedByThisModule:false,
   independentMerchantOwnershipVerified:false,realLicenseIndependentlyVerified:false,
   isolatedRasterDecodedHere:false,protectedStorageReceiptVerified:false,
   returnedImageBytes:false,actualRemoteFetches:0,actualModelCalls:0,
   providerSends:0,hostedWrites:0,canUseForRealVision:false,
   requiredBackend:['INDEPENDENT_STORE_AUTH','PIXEL_DECODER_SANDBOX',
      'PRIVATE_MEDIA_STORAGE','IMMUTABLE_MEDIA_STORE_BINDING']});
}
module.exports=Object.freeze({VERSION,MAX_BYTES,staffPreflight});