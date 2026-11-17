'use strict';
/**
 * V17.1F offline reference registry for merchant website and per-SKU media.
 * Never fetches a URL. Does not verify domain/photo rights or actual Store
 * ownership; a server-claimed catalog is a fixture until independently audited.
 */
const net=require('node:net');
const VERSION='T404_V171F_SHOP_MEDIA_REFERENCE_REGISTRY_V1';
const fail=x=>{throw Error(x);};
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{2,90}$/.test(x);
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function allowedHosts(hosts){
 if(!Array.isArray(hosts)||hosts.length<1||hosts.length>12)
   fail('MEDIA_HOST_ALLOWLIST_REQUIRED');
 const set=new Set();
 for(const h of hosts){
  if(typeof h!=='string'||h!==h.toLowerCase()||
     h.length>253||!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(h)||
     !h.includes('.')||h.includes('..')||net.isIP(h)||
     h.endsWith('.local')||h.endsWith('.internal')||
     h.endsWith('.localhost')||h==='localhost'||set.has(h))
     fail('MEDIA_HOST_ALLOWLIST_INVALID');
  set.add(h);
 }
 return set;
}
function strictHttpsUrl(raw,hosts){
 if(typeof raw!=='string'||raw.length<12||raw.length>2048||
    raw!==raw.trim()||/[\u0000-\u001f\u007f\\]/.test(raw))
   fail('MEDIA_URL_INVALID');
 let u;try{u=new URL(raw);}catch{fail('MEDIA_URL_INVALID');}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||
    (u.port&&u.port!=='443')||!hosts.has(u.hostname)||
    net.isIP(u.hostname)||u.pathname==='/'||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(u.pathname))
   fail('MEDIA_URL_SCOPE_OR_TOKEN_DENIED');
 return u.toString();
}
function buildRegistry({catalog,productsRows=[],mediaRows=[],
 tenantId,storeId,allowImageHosts,allowProductPageHosts}={}){
 if(!id(tenantId)||!id(storeId)||!obj(catalog)||
   catalog.source!=='SERVER_VERIFIED_SHOP_CATALOG'||catalog.verified!==true||
   catalog.tenantId!==tenantId||catalog.storeId!==storeId||
   !Number.isSafeInteger(catalog.revision)||catalog.revision<1||
   !Array.isArray(catalog.products)||catalog.products.length>100||
   !Array.isArray(productsRows)||!Array.isArray(mediaRows)||
   productsRows.length>100||mediaRows.length>500)
   fail('MEDIA_CATALOG_OR_STORE_SCOPE_INVALID');
 const imageHosts=allowedHosts(allowImageHosts);
 const pageHosts=allowedHosts(allowProductPageHosts);
 const products=new Map(),skuSet=new Set();
 for(const p of catalog.products){
  if(!obj(p)||p.tenantId!==tenantId||p.storeId!==storeId||
    !id(p.itemId)||!id(p.sku)||p.active!==true||
    products.has(p.itemId)||skuSet.has(p.sku))
    fail('MEDIA_TRUSTED_CATALOG_INVALID');
  products.set(p.itemId,p);skuSet.add(p.sku);
 }
 const bySku=new Map([...products.values()].map(p=>[p.sku,p]));
 const refs=[], seenUrls=new Map(), seenMediaIds=new Set();
 function pushRef({itemId,sku,sourceType,kind,url,mediaId=null}){
  const count=refs.filter(x=>x.itemId===itemId&&x.kind==='IMAGE_URL').length;
  if(kind==='IMAGE_URL'&&count>=5)fail('MEDIA_MAX_FIVE_PER_PRODUCT');
  const normalized=strictHttpsUrl(url,kind==='PRODUCT_PAGE_URL'?pageHosts:imageHosts);
  const owner=seenUrls.get(normalized);
  if(owner&&owner!==itemId)fail('MEDIA_URL_SHARED_ACROSS_PRODUCTS_REVIEW');
  if(owner===itemId&&kind==='IMAGE_URL')return;
  seenUrls.set(normalized,itemId);
  refs.push(Object.freeze({tenantId,storeId,itemId,sku,sourceType,kind,
    mediaId,url:normalized,fetchPerformed:false,htmlParsed:false,
    rightsIndependentlyVerified:false,domainIndependentlyVerified:false,
    imageBytesVerified:false,visionEmbeddingCreated:false,
    status:kind==='PRODUCT_PAGE_URL'?'PAGE_TO_IMAGE_MAPPING_REQUIRED':
      'PENDING_OWNER_RIGHTS_AND_BYTES_REVIEW'}));
 }
 const simpleSeen=new Set();
 for(const r of productsRows){
  if(!obj(r)||r.store_id!==storeId||
     (r.tenant_id!==undefined&&r.tenant_id!==tenantId)||
     !id(r.sku)||simpleSeen.has(r.sku))
    fail('MEDIA_PRODUCTS_ROW_STORE_OR_SKU_INVALID');
  const p=bySku.get(r.sku);
  if(!p||(r.product_id!==undefined&&r.product_id!==p.itemId))
    fail('MEDIA_PRODUCTS_ROW_CATALOG_MISMATCH');
  simpleSeen.add(r.sku);
  if(r.image_url)pushRef({itemId:p.itemId,sku:p.sku,
    sourceType:'PRODUCTS_IMAGE_URL',kind:'IMAGE_URL',url:r.image_url});
  if(r.product_page_url)pushRef({itemId:p.itemId,sku:p.sku,
    sourceType:'SHOP_PRODUCT_PAGE',kind:'PRODUCT_PAGE_URL',url:r.product_page_url});
 }
 for(const r of mediaRows){
  if(!obj(r)||r.tenant_id!==tenantId||r.store_id!==storeId||
     !id(r.media_id)||!id(r.product_id)||seenMediaIds.has(r.media_id)||
     r.media_type!=='image'||typeof r.public_safe_url!=='string')
    fail('MEDIA_PRODUCT_MEDIA_ROW_INVALID');
  seenMediaIds.add(r.media_id);
  const p=products.get(r.product_id);
  if(!p)fail('MEDIA_PRODUCT_MEDIA_CATALOG_MISMATCH');
  if(r.variant_id&&(!id(r.variant_id)||r.variant_id.length>90))
    fail('MEDIA_VARIANT_INVALID');
  pushRef({itemId:p.itemId,sku:p.sku,sourceType:'PRODUCT_MEDIA',
    kind:'IMAGE_URL',url:r.public_safe_url,mediaId:r.media_id});
 }
 return Object.freeze({version:VERSION,mode:'OFFLINE_REFERENCE_ONLY',
  tenantId,storeId,catalogRevision:catalog.revision,
  references:Object.freeze(refs),referenceCount:refs.length,
  websiteImageReferences:refs.filter(r=>r.sourceType==='PRODUCTS_IMAGE_URL').length,
  productMediaReferences:refs.filter(r=>r.sourceType==='PRODUCT_MEDIA').length,
  productPagesNeedingMapping:refs.filter(r=>r.kind==='PRODUCT_PAGE_URL').length,
  catalogSourceIndependentlyVerifiedHere:false,
  shopDomainOwnershipIndependentlyVerified:false,
  imageRightsIndependentlyVerified:false,realImageBytesInspected:false,
  readyForVisionBenchmark:false,authorizedToFetch:false,
  actualHttpRequests:0,visionModelCalls:0,providerSends:0,hostedWrites:0});
}
/** Inspect proposed page-mapped image, never fetch or certify it. */
function proposePageImage({registry,pageRef,candidateImageUrl,allowImageHosts}={}){
 if(!obj(registry)||registry.version!==VERSION||
   !obj(pageRef)||pageRef.kind!=='PRODUCT_PAGE_URL'||
   pageRef.sourceType!=='SHOP_PRODUCT_PAGE'||
   pageRef.tenantId!==registry.tenantId||
   pageRef.storeId!==registry.storeId||
   !registry.references.some(x=>x===pageRef))
  fail('MEDIA_PAGE_REFERENCE_NOT_TRUSTED');
 const url=strictHttpsUrl(candidateImageUrl,allowedHosts(allowImageHosts));
 return Object.freeze({tenantId:registry.tenantId,storeId:registry.storeId,
  itemId:pageRef.itemId,sku:pageRef.sku,sourceType:'UNVERIFIED_PAGE_IMAGE_CANDIDATE',
  parentProductPageUrl:pageRef.url,candidateImageUrl:url,
  status:'INDEPENDENT_PAGE_IMAGE_MAPPING_REVIEW_REQUIRED',
  imageUrlApproved:false,canFetch:false,canInferVision:false,
  actualHttpRequests:0,providerSends:0,hostedWrites:0});
}
module.exports=Object.freeze({VERSION,strictHttpsUrl,allowedHosts,buildRegistry,proposePageImage});
