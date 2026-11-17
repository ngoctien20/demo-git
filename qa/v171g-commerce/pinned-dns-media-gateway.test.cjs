'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {crc32}=require('../v171d-commerce/png-media-intake.cjs');
const {buildRegistry}=require('../v171f-commerce/shop-media-source-registry.cjs');
const {publicIPv4,rehearseImageRead,MAX_BYTES,validateAuthority}=
 require('./pinned-dns-media-gateway.cjs');
const now=1794873600000,scope={tenantId:'T_QA_01',storeId:'S_QA_A'};
const host='img.shop-example.vn',url='https://img.shop-example.vn/p/qa-white.png';
const sig=Buffer.from([137,80,78,71,13,10,26,10]);
function chunk(name,payload){
 const b=Buffer.alloc(8);b.writeUInt32BE(payload.length);b.write(name,4);
 const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([b.subarray(4),payload])));
 return Buffer.concat([b,payload,crc]);
}
function png(){
 const w=12,h=12,ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 const pixels=Buffer.alloc(h*(1+w*3));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*(1+w*3)+1+x*3;
  pixels[i]=y<6?245:15;pixels[i+1]=y<6?245:30;pixels[i+2]=y<6?245:45;
 }
 return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
function ready(){
 const catalog={source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
  ...scope,revision:2,products:[{...scope,itemId:'P_A_001',sku:'QA-F-001',active:true}]};
 const registry=buildRegistry({catalog,
  productsRows:[{store_id:scope.storeId,sku:'QA-F-001',image_url:url}],
  ...scope,allowImageHosts:[host],allowProductPageHosts:['shop-example.vn']});
 const reference=registry.references[0],bytes=png();
 const grant={source:'QA_ONLY_INDEPENDENT_REVIEW_PLACEHOLDER',reviewed:true,
   ...scope,itemId:'P_A_001',sku:'QA-F-001',imageUrl:url,hostname:host,
   expectedImageSha256:crypto.createHash('sha256').update(bytes).digest('hex'),
   reviewedAtMs:now-3000,expiresAtMs:now+60000,
   rightsDeclared:true,shopDomainDeclaredOwned:true};
 const resolveAll=async hostname=>[{hostname,address:'1.1.1.1',family:4}];
 const transport={mode:'OFFLINE_FIXTURE_TRANSPORT_ONLY',read:async req=>({
   source:'OFFLINE_FIXTURE_HTTPS_RESPONSE',pinnedIp:req.pinnedIp,
   peerAddress:req.pinnedIp,tlsServerName:req.serverName,tlsAuthorized:true,
   statusCode:200,redirected:false,finalUrl:req.url,contentType:'image/png',
   contentEncoding:'identity',contentLength:bytes.length,bytes})};
 return {registry,reference,grant,resolveAll,transport,nowMs:now,bytes};
}
function execute(m={}){return rehearseImageRead({...ready(),...m});}
test('01 global public IPv4 is accepted as fixture only',()=>assert.equal(publicIPv4('1.1.1.1'),true));
test('02 RFC1918 blocked',()=>{for(const ip of ['10.1.1.1','172.16.1.1','172.31.2.3','192.168.0.1'])assert.equal(publicIPv4(ip),false);});
test('03 loopback link-local CGNAT blocked',()=>{for(const ip of ['127.0.0.1','169.254.169.254','100.64.0.1','100.127.255.254'])assert.equal(publicIPv4(ip),false);});
test('04 documentation and benchmark IP ranges blocked',()=>{for(const ip of ['192.0.2.1','198.51.100.30','203.0.113.1','198.18.0.1','198.19.1.1'])assert.equal(publicIPv4(ip),false);});
test('05 multicast, unspecified and IPv6 disabled for this pilot',()=>{for(const ip of ['0.0.0.0','224.0.0.1','255.255.255.255','::1','::ffff:127.0.0.1','2606:4700:4700::1111'])assert.equal(publicIPv4(ip),false);});
test('06 simulated pinned DNS returns actual decoded fixture PNG',async()=>{
 const r=await execute();
 assert.equal(r.width,12);assert.equal(r.height,12);assert.equal(r.descriptor.length,16);
 assert.equal(r.itemId,'P_A_001');assert.equal(r.sku,'QA-F-001');
});
test('07 fixture output never implies live DNS/TLS or domain ownership',async()=>{
 const r=await execute();assert.equal(r.liveDnsResponseVerified,false);
 assert.equal(r.liveTlsSessionVerified,false);
 assert.equal(r.realWorldDomainOwnershipVerified,false);
});
test('08 offline transport produces zero provider, hosted and model actions',async()=>{
 const r=await execute();assert.equal(r.actualExternalHttpRequests,0);
 assert.equal(r.providerSends,0);assert.equal(r.hostedWrites,0);
 assert.equal(r.modelVisionInferencePerformed,false);
});
test('09 no image bytes retained in output',async()=>{
 const r=await execute();
 assert.equal(r.bytes,undefined);assert.equal(r.readyForRealVisionBenchmark,false);
});
test('10 caller cannot send unrelated or page-only image reference',async()=>{
 const h=ready();const forged={...h.reference,kind:'PRODUCT_PAGE_URL'};
 await assert.rejects(()=>execute({reference:forged}),/MEDIA_REFERENCE_OR_STORE_NOT_ATTESTED/);
});
test('11 foreign registry reference object denied',async()=>{
 const h=ready(),other=ready();
 await assert.rejects(()=>rehearseImageRead({...h,reference:other.reference}),
 /MEDIA_REFERENCE_OR_STORE_NOT_ATTESTED/);
});
test('12 foreign tenant grant denied',async()=>{
 const h=ready();await assert.rejects(()=>execute({grant:{...h.grant,tenantId:'T_OTHER'}}),
 /MEDIA_LICENSE_OR_DOMAIN_QA_ATTESTATION_MISSING/);
});
test('13 foreign store grant denied',async()=>{
 const h=ready();await assert.rejects(()=>execute({grant:{...h.grant,storeId:'S_QA_B'}}),
 /MEDIA_LICENSE_OR_DOMAIN_QA_ATTESTATION_MISSING/);
});
test('14 changed SKU or product ID grant denied',async()=>{
 const h=ready();
 for(const extra of [{sku:'QA-F-002'},{itemId:'P_A_002'}]){
  await assert.rejects(()=>execute({grant:{...h.grant,...extra}}),
   /MEDIA_LICENSE_OR_DOMAIN_QA_ATTESTATION_MISSING/);
 }
});
test('15 grants for different URL/domain denied',async()=>{
 const h=ready();
 for(const extra of [{imageUrl:'https://other.example/a.png'},{hostname:'other.example'}]){
  await assert.rejects(()=>execute({grant:{...h.grant,...extra}}),
   /MEDIA_LICENSE_OR_DOMAIN_QA_ATTESTATION_MISSING/);
 }
});
test('16 image-rights declaration missing fails closed',async()=>{
 const h=ready();await assert.rejects(()=>execute({grant:{...h.grant,rightsDeclared:false}}),
 /MEDIA_LICENSE_OR_DOMAIN_QA_ATTESTATION_MISSING/);
});
test('17 shop domain ownership declaration missing fails closed',async()=>{
 const h=ready();await assert.rejects(()=>execute({grant:{...h.grant,shopDomainDeclaredOwned:false}}),
 /MEDIA_LICENSE_OR_DOMAIN_QA_ATTESTATION_MISSING/);
});
test('18 expired or future-dated grant fails closed',async()=>{
 const h=ready();
 for(const extra of [{expiresAtMs:now-1},{reviewedAtMs:now+1}]){
  await assert.rejects(()=>execute({grant:{...h.grant,...extra}}),
  /MEDIA_LICENSE_OR_DOMAIN_QA_ATTESTATION_MISSING/);
 }
});
test('19 over-long review authorization window denied',async()=>{
 const h=ready();await assert.rejects(()=>execute({grant:{...h.grant,expiresAtMs:now+2*86400000}}),
 /MEDIA_LICENSE_OR_DOMAIN_QA_ATTESTATION_MISSING/);
});
test('20 absent real resolver or non-QA transport denied',async()=>{
 const h=ready();
 await assert.rejects(()=>execute({resolveAll:null}),/REAL_NETWORK_TRANSPORT_NOT_ALLOWED/);
 await assert.rejects(()=>execute({transport:{...h.transport,mode:'REAL_HTTP'}}),
 /REAL_NETWORK_TRANSPORT_NOT_ALLOWED/);
});
test('21 no DNS addresses fails closed',async()=>{
 await assert.rejects(()=>execute({resolveAll:async()=>[]}),
 /DNS_PRIVATE_MIXED_IPV6_OR_REBIND_DENIED/);
});
test('22 mixed good/private DNS rejected, not just first safe result',async()=>{
 await assert.rejects(()=>execute({resolveAll:async hostname=>[
 {hostname,address:'1.1.1.1',family:4},
 {hostname,address:'169.254.169.254',family:4}]}),
 /DNS_PRIVATE_MIXED_IPV6_OR_REBIND_DENIED/);
});
test('23 IPv6 answers disabled pending review',async()=>{
 await assert.rejects(()=>execute({resolveAll:async hostname=>[
 {hostname,address:'2606:4700:4700::1111',family:6}]}),
 /DNS_PRIVATE_MIXED_IPV6_OR_REBIND_DENIED/);
});
test('24 DNS record claimed for unexpected hostname denied',async()=>{
 await assert.rejects(()=>execute({resolveAll:async()=>[
 {hostname:'other.example',address:'1.1.1.1',family:4}]}),
 /DNS_PRIVATE_MIXED_IPV6_OR_REBIND_DENIED/);
});
test('25 pinning options have no proxy, redirects, decompression or unsupported method',async()=>{
 let pinned;const h=ready();const original=h.transport.read;
 h.transport.read=async req=>{pinned=req;return original(req)};
 await rehearseImageRead(h);
 assert.equal(pinned.method,'GET');assert.equal(pinned.serverName,host);
 assert.equal(pinned.allowProxy,false);assert.equal(pinned.allowRedirects,false);
 assert.equal(pinned.allowAutomaticDecompression,false);
 assert.equal(pinned.timeoutMs,3000);assert.equal(pinned.maxBytes,MAX_BYTES);
 assert.equal(pinned.pinnedIp,'1.1.1.1');
});
async function corruptResponse(extra){
 const h=ready(),base=h.transport.read;
 h.transport.read=async req=>({...await base(req),...extra});
 await assert.rejects(()=>rehearseImageRead(h),/MEDIA_TRANSPORT_RESPONSE_UNTRUSTED/);
}
test('26 TLS unauthorized rejected',()=>corruptResponse({tlsAuthorized:false}));
test('27 TLS hostname mismatch rejected',()=>corruptResponse({tlsServerName:'wrong.example'}));
test('28 DNS peer mismatch / connection rebind rejected',()=>corruptResponse({peerAddress:'8.8.8.8'}));
test('29 transport pin mismatch rejected',()=>corruptResponse({pinnedIp:'8.8.8.8'}));
test('30 redirect even with 200 response denied',()=>corruptResponse({redirected:true}));
test('31 HTTP 302 rejected',()=>corruptResponse({statusCode:302}));
test('32 final URL/hostname modified rejected',()=>corruptResponse({finalUrl:'https://other.example/a.png'}));
test('33 mismatched MIME rejected',()=>corruptResponse({contentType:'text/html'}));
test('34 compressed body rejected',()=>corruptResponse({contentEncoding:'gzip'}));
test('35 oversized Content-Length denied without decoding',()=>corruptResponse({contentLength:MAX_BYTES+1}));
test('36 truncated Content-Length denied',()=>corruptResponse({contentLength:10}));
test('37 fake JPEG is not valid PNG and cannot be silently promoted',async()=>{
 const h=ready(),base=h.transport.read;
 h.transport.read=async req=>({...await base(req),bytes:Buffer.alloc(h.bytes.length)});
 await assert.rejects(()=>rehearseImageRead(h),/MEDIA_PNG_SIGNATURE_OR_SIZE_DENIED/);
});
test('38 changed PNG hash after merchant review denied',async()=>{
 const h=ready();
 await assert.rejects(()=>rehearseImageRead({...h,grant:{
 ...h.grant,expectedImageSha256:'f'.repeat(64)}}),/MEDIA_HASH_CHANGED_AFTER_REVIEW/);
});
test('39 false grant claiming itself reviewed is never a real rights certificate',()=>{
 const h=ready();
 assert.equal(validateAuthority(h),host);
 assert.equal(h.grant.source,'QA_ONLY_INDEPENDENT_REVIEW_PLACEHOLDER');
});
test('40 customer SKU and final order confirmation stay mandatory',async()=>{
 const r=await execute();
 assert.equal(r.requiresCustomerSkuSelection,true);
 assert.equal(r.requiresFinalOrderConfirmation,true);
});
