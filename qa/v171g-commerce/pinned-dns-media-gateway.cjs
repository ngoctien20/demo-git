'use strict';
/**
 * TIEN404 V17.1G — offline-only pinned-DNS/transport evidence rehearsal.
 * NOT a real HTTPS fetcher: a fixture-only injected adapter is mandatory.
 * Never accepts URLs from customer messages; source refs come from V17.1F.
 */
const crypto=require('node:crypto');
const net=require('node:net');
const {inspectPng}=require('../v171d-commerce/png-media-intake.cjs');
const {VERSION:REGISTRY_VERSION}=require('../v171f-commerce/shop-media-source-registry.cjs');
const VERSION='T404_V171G_PINNED_DNS_MEDIA_OFFLINE_QA_V1';
const MAX_BYTES=2*1024*1024;
const fail=code=>{throw Error(code)};
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function publicIPv4(ip){
 if(typeof ip!=='string'||net.isIP(ip)!==4)return false;
 const a=ip.split('.').map(Number);
 // deny all reserved / private / loopback / link-local / CGNAT / testing.
 if(a[0]===0||a[0]===10||a[0]===127||a[0]>=224)return false;
 if(a[0]===100&&a[1]>=64&&a[1]<=127)return false;
 if(a[0]===169&&a[1]===254)return false;
 if(a[0]===172&&a[1]>=16&&a[1]<=31)return false;
 if(a[0]===192&&
    (a[1]===168||a[1]===0&&a[2]===0||
     a[1]===0&&a[2]===2||a[1]===88&&a[2]===99))return false;
 if(a[0]===198&&(a[1]===18||a[1]===19||
   a[1]===51&&a[2]===100))return false;
 if(a[0]===203&&a[1]===0&&a[2]===113)return false;
 if(a[0]===192&&a[1]===0&&a[2]===0)return false;
 return true;
}
function validateAuthority({registry,reference,grant,nowMs}={}){
 if(!plain(registry)||registry.version!==REGISTRY_VERSION||
   !plain(reference)||reference.kind!=='IMAGE_URL'||
   !['PRODUCTS_IMAGE_URL','PRODUCT_MEDIA'].includes(reference.sourceType)||
   !registry.references?.some(x=>x===reference)||
   registry.tenantId!==reference.tenantId||
   registry.storeId!==reference.storeId||
   !Number.isSafeInteger(nowMs)||nowMs<=0)
   fail('MEDIA_REFERENCE_OR_STORE_NOT_ATTESTED');
 const host=new URL(reference.url).hostname;
 if(!plain(grant)||grant.source!=='QA_ONLY_INDEPENDENT_REVIEW_PLACEHOLDER'||
   grant.reviewed!==true||grant.tenantId!==registry.tenantId||
   grant.storeId!==registry.storeId||
   grant.itemId!==reference.itemId||grant.sku!==reference.sku||
   grant.imageUrl!==reference.url||grant.hostname!==host||
   !hex(grant.expectedImageSha256)||
   !Number.isSafeInteger(grant.reviewedAtMs)||
   !Number.isSafeInteger(grant.expiresAtMs)||
   grant.reviewedAtMs>nowMs||grant.expiresAtMs<=nowMs||
   grant.expiresAtMs-grant.reviewedAtMs>24*3600000||
   grant.rightsDeclared!==true||grant.shopDomainDeclaredOwned!==true)
   fail('MEDIA_LICENSE_OR_DOMAIN_QA_ATTESTATION_MISSING');
 return host;
}
async function rehearseImageRead({registry,reference,grant,resolveAll,transport,
  nowMs}={}){
 const hostname=validateAuthority({registry,reference,grant,nowMs});
 if(typeof resolveAll!=='function'||!plain(transport)||
   transport.mode!=='OFFLINE_FIXTURE_TRANSPORT_ONLY'||
   typeof transport.read!=='function')
   fail('REAL_NETWORK_TRANSPORT_NOT_ALLOWED');
 const answers=await resolveAll(hostname);
 if(!Array.isArray(answers)||answers.length<1||answers.length>8||
    answers.some(x=>!plain(x)||x.hostname!==hostname||
      x.family!==4||!publicIPv4(x.address)))
   fail('DNS_PRIVATE_MIXED_IPV6_OR_REBIND_DENIED');
 const chosen=[...new Set(answers.map(x=>x.address))].sort()[0];
 const req=Object.freeze({method:'GET',protocol:'https:',port:443,
   hostname,pinnedIp:chosen,family:4,serverName:hostname,
   verifyTlsPeer:true,allowRedirects:false,
   allowProxy:false,allowAutomaticDecompression:false,
   timeoutMs:3000,maxBytes:MAX_BYTES,
   accept:'image/png',url:reference.url});
 const response=await transport.read(req);
 if(!plain(response)||response.source!=='OFFLINE_FIXTURE_HTTPS_RESPONSE'||
   response.pinnedIp!==chosen||response.peerAddress!==chosen||
   response.tlsServerName!==hostname||response.tlsAuthorized!==true||
   response.statusCode!==200||response.finalUrl!==reference.url||
   response.redirected!==false||response.contentType!=='image/png'||
   response.contentEncoding!=='identity'||
   !Number.isSafeInteger(response.contentLength)||
   response.contentLength<64||response.contentLength>MAX_BYTES||
   !Buffer.isBuffer(response.bytes)||response.bytes.length!==response.contentLength)
   fail('MEDIA_TRANSPORT_RESPONSE_UNTRUSTED');
 const decoded=inspectPng(response.bytes);
 if(decoded.sha256!==grant.expectedImageSha256)
   fail('MEDIA_HASH_CHANGED_AFTER_REVIEW');
 // Only a digest and bounded synthetic pixel descriptor leave the function.
 return Object.freeze({version:VERSION,mode:'OFFLINE_PINNED_DNS_REHEARSAL_ONLY',
   tenantId:registry.tenantId,storeId:registry.storeId,
   itemId:reference.itemId,sku:reference.sku,
   imageUrl:reference.url,sha256:decoded.sha256,
   width:decoded.width,height:decoded.height,
   descriptor:decoded.descriptor,
   rightsIndependentlyVerified:false,
   realWorldDomainOwnershipVerified:false,
   liveDnsResponseVerified:false,liveTlsSessionVerified:false,
   modelVisionInferencePerformed:false,
   actualExternalHttpRequests:0,hostedWrites:0,providerSends:0,
   requiresCustomerSkuSelection:true,requiresFinalOrderConfirmation:true,
   readyForRealVisionBenchmark:false});
}
module.exports=Object.freeze({VERSION,MAX_BYTES,publicIPv4,validateAuthority,
  rehearseImageRead});
