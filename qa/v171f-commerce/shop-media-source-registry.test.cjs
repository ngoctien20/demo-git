'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildRegistry,proposePageImage,strictHttpsUrl,allowedHosts}=
 require('./shop-media-source-registry.cjs');
const scope={tenantId:'T_QA_01',storeId:'S_QA_A'};
const imgHost='img.shop-example.vn',siteHost='shop-example.vn';
const image1='https://img.shop-example.vn/assets/white.png';
const image2='https://img.shop-example.vn/assets/white-side.png';
const page1='https://shop-example.vn/san-pham/ao-thun-trang';
const product=(id,sku,storeId=scope.storeId)=>
 ({...scope,storeId,itemId:id,sku,active:true});
const catalog=(more={})=>({source:'SERVER_VERIFIED_SHOP_CATALOG',
 verified:true,...scope,revision:3,products:[
 product('P_A_001','QA-F-001'),product('P_A_002','QA-F-002')],...more});
const row=(more={})=>({store_id:scope.storeId,sku:'QA-F-001',image_url:image1,...more});
const media=(more={})=>({tenant_id:scope.tenantId,store_id:scope.storeId,
 media_id:'IMG_A_001',product_id:'P_A_001',media_type:'image',
 public_safe_url:image2,...more});
const build=(more={})=>buildRegistry({catalog:catalog(),productsRows:[row()],
 mediaRows:[media()],...scope,allowImageHosts:[imgHost],
 allowProductPageHosts:[siteHost],...more});
test('01 simple Products image_url maps to the proper SKU',()=>{
 const r=build({mediaRows:[]});
 assert.equal(r.references[0].sku,'QA-F-001');assert.equal(r.websiteImageReferences,1);
});
test('02 PRODUCT_MEDIA joins by product_id and store, independent of SKU column',()=>{
 const r=build({productsRows:[]});
 assert.equal(r.references[0].sku,'QA-F-001');assert.equal(r.productMediaReferences,1);
});
test('03 both sources combine without changing catalog price/stock',()=>{
 const r=build();assert.equal(r.referenceCount,2);
 assert.equal(r.readyForVisionBenchmark,false);assert.equal(r.hostedWrites,0);
});
test('04 same-Store identical photo URL deduplicated',()=>{
 const r=build({mediaRows:[media({public_safe_url:image1})]});
 assert.equal(r.referenceCount,1);
});
test('05 independent photo rights and domain ownership remain unverified',()=>{
 const r=build();assert.equal(r.imageRightsIndependentlyVerified,false);
 assert.equal(r.shopDomainOwnershipIndependentlyVerified,false);
 assert.equal(r.actualHttpRequests,0);
});
test('06 product page URL is not a photo/embedding',()=>{
 const r=build({productsRows:[row({image_url:'',product_page_url:page1})],mediaRows:[]});
 assert.equal(r.references[0].kind,'PRODUCT_PAGE_URL');
 assert.equal(r.references[0].status,'PAGE_TO_IMAGE_MAPPING_REQUIRED');
 assert.equal(r.realImageBytesInspected,false);
});
test('07 proposed og:image needs independent mapping review',()=>{
 const r=build({productsRows:[row({image_url:'',product_page_url:page1})],mediaRows:[]});
 const p=proposePageImage({registry:r,pageRef:r.references[0],
  candidateImageUrl:image1,allowImageHosts:[imgHost]});
 assert.equal(p.sku,'QA-F-001');assert.equal(p.imageUrlApproved,false);
 assert.equal(p.canInferVision,false);
});
test('08 cannot use foreign page ref from another registry',()=>{
 const r=build({productsRows:[row({image_url:'',product_page_url:page1})],mediaRows:[]});
 const foreign=build({productsRows:[row({image_url:'',product_page_url:page1})],mediaRows:[]});
 assert.throws(()=>proposePageImage({registry:r,pageRef:foreign.references[0],
  candidateImageUrl:image1,allowImageHosts:[imgHost]}),/MEDIA_PAGE_REFERENCE_NOT_TRUSTED/);
});
test('09 other store product row rejected',()=>assert.throws(()=>
 build({productsRows:[row({store_id:'S_QA_B'})],mediaRows:[]}),
 /MEDIA_PRODUCTS_ROW_STORE_OR_SKU_INVALID/));
test('10 DEMO_LEGACY product row never becomes Commerce media',()=>assert.throws(()=>
 build({productsRows:[row({store_id:'DEMO_LEGACY'})],mediaRows:[]}),
 /MEDIA_PRODUCTS_ROW_STORE_OR_SKU_INVALID/));
test('11 other tenant media row rejected',()=>assert.throws(()=>
 build({productsRows:[],mediaRows:[media({tenant_id:'T_OTHER'})]}),
 /MEDIA_PRODUCT_MEDIA_ROW_INVALID/));
test('12 other store media row rejected',()=>assert.throws(()=>
 build({productsRows:[],mediaRows:[media({store_id:'S_QA_B'})]}),
 /MEDIA_PRODUCT_MEDIA_ROW_INVALID/));
test('13 SKU unknown in trusted catalog rejected',()=>assert.throws(()=>
 build({productsRows:[row({sku:'NO_SUCH_SKU'})],mediaRows:[]}),
 /MEDIA_PRODUCTS_ROW_CATALOG_MISMATCH/));
test('14 product ID mismatching SKU rejected',()=>assert.throws(()=>
 build({productsRows:[row({product_id:'P_A_002'})],mediaRows:[]}),
 /MEDIA_PRODUCTS_ROW_CATALOG_MISMATCH/));
test('15 duplicate SKU rows rejected',()=>assert.throws(()=>
 build({productsRows:[row(),row({image_url:image2})],mediaRows:[]}),
 /MEDIA_PRODUCTS_ROW_STORE_OR_SKU_INVALID/));
test('16 duplicate media IDs rejected',()=>assert.throws(()=>
 build({productsRows:[],mediaRows:[media(),media({public_safe_url:image1})]}),
 /MEDIA_PRODUCT_MEDIA_ROW_INVALID/));
test('17 one URL cannot belong to two different products',()=>assert.throws(()=>
 build({productsRows:[row(),row({sku:'QA-F-002',image_url:image1})],mediaRows:[]}),
 /MEDIA_URL_SHARED_ACROSS_PRODUCTS_REVIEW/));
test('18 media product ID unknown in catalog rejected',()=>assert.throws(()=>
 build({productsRows:[],mediaRows:[media({product_id:'P_OTHER'})]}),
 /MEDIA_PRODUCT_MEDIA_CATALOG_MISMATCH/));
test('19 image media type other than image denied',()=>assert.throws(()=>
 build({productsRows:[],mediaRows:[media({media_type:'video'})]}),
 /MEDIA_PRODUCT_MEDIA_ROW_INVALID/));
test('20 HTTPS required',()=>assert.throws(()=>
 strictHttpsUrl('http://img.shop-example.vn/assets/a.png',allowedHosts([imgHost])),
 /MEDIA_URL_SCOPE_OR_TOKEN_DENIED/));
test('21 arbitrary external domain denied',()=>assert.throws(()=>
 build({productsRows:[row({image_url:'https://random-cdn.example/a.png'})],mediaRows:[]}),
 /MEDIA_URL_SCOPE_OR_TOKEN_DENIED/));
test('22 SSRF direct private IP denied even if declared allowlist',()=>assert.throws(()=>
 allowedHosts(['127.0.0.1']),/MEDIA_HOST_ALLOWLIST_INVALID/));
test('23 localhost domain denied',()=>assert.throws(()=>
 allowedHosts(['metadata.internal']),/MEDIA_HOST_ALLOWLIST_INVALID/));
test('24 credential-bearing URL rejected',()=>assert.throws(()=>
 build({productsRows:[row({image_url:'https://user:pass@img.shop-example.vn/a.png'})],mediaRows:[]}),
 /MEDIA_URL_SCOPE_OR_TOKEN_DENIED/));
test('25 tokenized/signed query URL rejected from public Sheets',()=>assert.throws(()=>
 build({productsRows:[row({image_url:image1+'?token=PRIVATE'})],mediaRows:[]}),
 /MEDIA_URL_SCOPE_OR_TOKEN_DENIED/));
test('26 user fragment and tracking hashes rejected',()=>assert.throws(()=>
 build({productsRows:[row({image_url:image1+'#tracking'})],mediaRows:[]}),
 /MEDIA_URL_SCOPE_OR_TOKEN_DENIED/));
test('27 proposed page image from unapproved image host blocked',()=>{
 const r=build({productsRows:[row({image_url:'',product_page_url:page1})],mediaRows:[]});
 assert.throws(()=>proposePageImage({registry:r,pageRef:r.references[0],
  candidateImageUrl:'https://bad.example/a.png',allowImageHosts:[imgHost]}),
 /MEDIA_URL_SCOPE_OR_TOKEN_DENIED/);
});
test('28 unsafe unsupported page input cannot be treated as image source',()=>assert.throws(()=>
 build({productsRows:[row({image_url:'',product_page_url:'https://shop-example.vn/'})],
  mediaRows:[]}),/MEDIA_URL_SCOPE_OR_TOKEN_DENIED/));
test('29 customer SKU always required: no model or send/write authority',()=>{
 const r=build();assert.equal(r.visionModelCalls,0);assert.equal(r.providerSends,0);
 assert.equal(r.authorizedToFetch,false);
});
test('30 cannot feed raw catalog of wrong Store as trusted catalog',()=>assert.throws(()=>
 build({catalog:catalog({storeId:'S_QA_B'})}),/MEDIA_CATALOG_OR_STORE_SCOPE_INVALID/));
test('31 empty inputs are supported without inventing photos',()=>{
 const r=build({productsRows:[],mediaRows:[]});
 assert.equal(r.referenceCount,0);assert.equal(r.readyForVisionBenchmark,false);
});
test('32 duplicate store product media across tenants never silently accepted',()=>assert.throws(()=>
 build({mediaRows:[media({tenant_id:'T_QA_01'}),
  media({tenant_id:'T_QA_02',media_id:'IMG_A_002'})]}),
 /MEDIA_PRODUCT_MEDIA_ROW_INVALID/));
