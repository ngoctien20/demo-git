'use strict';
/**
 * TIEN404 V17.1D — bounded PNG byte/pixel intake for consented product media.
 * NO hosted object storage, no image URLs, no model calls or training.
 * Supports ONLY PNG 8-bit RGB/RGBA noninterlaced. Rejects metadata and
 * animations; raw customer media never retained by the returned records.
 * QA fixture pixels do NOT establish actual garment recognition.
 */
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {cosine}=require('../v171c-commerce/synthetic-vision-retrieval.cjs');
const VERSION='T404_V171D_PRODUCT_MEDIA_PIXEL_QA_V1';
const SIG=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_BYTES=2*1024*1024,MAX_PIXELS=1024*768;
const id=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(s);
const fail=x=>{throw Error(x);};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
let crcTable;
function crc32(b){
 if(!crcTable)crcTable=Array.from({length:256},(_,n)=>{
  let c=n;for(let i=0;i<8;i++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;return c>>>0;
 });
 let c=0xffffffff;for(const n of b)c=crcTable[(c^n)&255]^(c>>>8);
 return (c^0xffffffff)>>>0;
}
function inspectPng(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<64||bytes.length>MAX_BYTES||
    !bytes.subarray(0,8).equals(SIG))fail('MEDIA_PNG_SIGNATURE_OR_SIZE_DENIED');
 let pos=8,w=0,h=0,bpp=0,ihdr=false,done=false,idats=[];
 while(pos+12<=bytes.length){
  const len=bytes.readUInt32BE(pos),typ=bytes.toString('ascii',pos+4,pos+8);
  if(len>MAX_BYTES||pos+12+len>bytes.length)fail('MEDIA_CHUNK_BOUNDS_DENIED');
  if(!/^[A-Za-z]{4}$/.test(typ))fail('MEDIA_CHUNK_TYPE_INVALID');
  const data=bytes.subarray(pos+8,pos+8+len),check=bytes.readUInt32BE(pos+8+len);
  if(crc32(bytes.subarray(pos+4,pos+8+len))!==check)fail('MEDIA_CRC_MISMATCH');
  pos+=12+len;
  if(typ==='IHDR'){
   if(ihdr||pos!==8+25||len!==13)fail('MEDIA_IHDR_INVALID');
   ihdr=true;w=data.readUInt32BE(0);h=data.readUInt32BE(4);
   const bit=data[8],color=data[9],compression=data[10],
    filter=data[11],interlace=data[12];
   if(w<4||h<4||w>1024||h>1024||w*h>MAX_PIXELS||
      bit!==8||![2,6].includes(color)||compression!==0||filter!==0||
      interlace!==0)fail('MEDIA_DIMENSIONS_OR_FORMAT_UNSUPPORTED');
   bpp=color===2?3:4;
  }else if(typ==='IDAT'){
   if(!ihdr||done)fail('MEDIA_IDAT_ORDER_INVALID');
   idats.push(data);
  }else if(typ==='IEND'){
   if(!ihdr||len!==0||!idats.length||pos!==bytes.length)
    fail('MEDIA_PNG_END_INVALID');
   done=true;break;
  }else fail('MEDIA_METADATA_ANIMATION_OR_UNKNOWN_CHUNK_DENIED');
 }
 if(!done||!ihdr)fail('MEDIA_PNG_TRUNCATED');
 const rowSize=w*bpp,expected=h*(rowSize+1);
 if(expected>MAX_PIXELS*4+1024)fail('MEDIA_DECOMPRESS_LIMIT');
 let inflated;
 try{
  inflated=zlib.inflateSync(Buffer.concat(idats),{maxOutputLength:expected+1});
 }catch{fail('MEDIA_COMPRESSED_PAYLOAD_INVALID_OR_BOMB');}
 if(inflated.length!==expected)fail('MEDIA_DECODED_SIZE_MISMATCH');
 const pixels=Buffer.alloc(h*rowSize),prior=Buffer.alloc(rowSize);
 for(let y=0;y<h;y++){
  const start=y*(rowSize+1),filter=inflated[start];
  if(filter>4)fail('MEDIA_PNG_FILTER_UNSUPPORTED');
  const row=pixels.subarray(y*rowSize,(y+1)*rowSize);
  for(let i=0;i<rowSize;i++){
   const raw=inflated[start+1+i],a=i>=bpp?row[i-bpp]:0,
    b=prior[i],c=i>=bpp?prior[i-bpp]:0;
   let predictor=0;
   if(filter===1)predictor=a;
   else if(filter===2)predictor=b;
   else if(filter===3)predictor=Math.floor((a+b)/2);
   else if(filter===4){
    const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
    predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c;
   }
   row[i]=(raw+predictor)&255;
  }
  row.copy(prior);
 }
 // Four spatial RGB means and a dark-pixel proportion — primitive
 // color descriptor, explicitly NOT a semantic image model.
 const sums=Array(16).fill(0),counts=Array(4).fill(0),dark=Array(4).fill(0);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const j=(y*w+x)*bpp,alpha=bpp===4?pixels[j+3]/255:1;
  const rgb=[0,1,2].map(k=>pixels[j+k]*alpha+255*(1-alpha));
  const quadrant=(y>=h/2?2:0)+(x>=w/2?1:0);
  counts[quadrant]++;
  for(let k=0;k<3;k++)sums[quadrant*3+k]+=rgb[k]/255;
  if(rgb[0]+rgb[1]+rgb[2]<320)dark[quadrant]++;
 }
 const descriptor=[];
 for(let q=0;q<4;q++){
  for(let k=0;k<3;k++)descriptor.push(Number((sums[q*3+k]/counts[q]).toFixed(6)));
  descriptor.push(Number((dark[q]/counts[q]).toFixed(6)));
 }
 return Object.freeze({width:w,height:h,colorChannels:bpp,
  pixelCount:w*h,descriptor:Object.freeze(descriptor),
  sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
function intake({imageBytes,manifest,tenantId,storeId}={}){
 if(!object(manifest)||manifest.source!=='SERVER_ATTESTED_MEDIA_MANIFEST'||
  manifest.verified!==true||manifest.consent!==true||
  manifest.tenantId!==tenantId||manifest.storeId!==storeId||
  !id(tenantId)||!id(storeId)||!id(manifest.itemId)||
  !id(manifest.sku)||!id(manifest.imageId)||
  !id(manifest.catalogVersion)||manifest.mimeType!=='image/png'||
  manifest.demoOnly!==true||
  manifest.mediaOrigin!=='QA_GENERATED_LICENSE_FREE')
  fail('PRODUCT_MEDIA_MANIFEST_OR_PERMISSION_DENIED');
 const parsed=inspectPng(imageBytes);
 return Object.freeze({version:VERSION,mode:'REAL_PNG_PIXELS_SYNTHETIC_QA',
  tenantId,storeId,itemId:manifest.itemId,sku:manifest.sku,
  imageId:manifest.imageId,catalogVersion:manifest.catalogVersion,
  sha256:parsed.sha256,width:parsed.width,height:parsed.height,
  pixelCount:parsed.pixelCount,descriptor:parsed.descriptor,
  bytesRetained:false,metadataStripped:true,
  realPixelDecodePerformed:true,realProductPhotoCertified:false,
  semanticVisionModelCalled:false,merchantImageRightsVerified:false,
  hostedStorageWritten:false,providerSends:0,orderWrites:0});
}
function findCandidates({queryImage,index,tenantId,storeId,topK=3,threshold=0.985}={}){
 if(!object(index)||!Array.isArray(index.entries)||index.entries.length>100||
   index.tenantId!==tenantId||index.storeId!==storeId||
   !object(queryImage)||queryImage.tenantId!==tenantId||
   queryImage.storeId!==storeId||queryImage.mode!=='REAL_PNG_PIXELS_SYNTHETIC_QA'||
   !Number.isInteger(topK)||topK<1||topK>5||
   typeof threshold!=='number'||!Number.isFinite(threshold)||
   threshold<0.8||threshold>1)fail('MEDIA_SEARCH_SCOPE_INVALID');
 const unique=new Map();
 for(const e of index.entries){
  if(!object(e)||e.tenantId!==tenantId||e.storeId!==storeId||
   !id(e.itemId)||!id(e.sku)||e.catalogVersion!==index.catalogVersion||
   !Array.isArray(e.descriptor)||e.descriptor.length!==16)
    fail('MEDIA_INDEX_OR_STORE_UNTRUSTED');
  const score=cosine(queryImage.descriptor,e.descriptor);
  if(score>=threshold&&(!unique.has(e.itemId)||score>unique.get(e.itemId).score))
   unique.set(e.itemId,{itemId:e.itemId,sku:e.sku,score:Number(score.toFixed(6))});
 }
 const matches=[...unique.values()].sort((a,b)=>b.score-a.score||
  a.itemId.localeCompare(b.itemId)).slice(0,topK);
 return Object.freeze({version:VERSION,
  status:matches.length?'CANDIDATES_REQUIRE_CUSTOMER_SKU_SELECTION':'NO_RELIABLE_MATCH',
  candidates:matches,requiresSkuSelection:true,requiresFinalOrderConfirmation:true,
  mayCreateOrder:false,semanticVisionModelCalled:false,confidenceCalibrated:false,
  providerSends:0,hostedWrites:0});
}
module.exports=Object.freeze({VERSION,crc32,inspectPng,intake,findCandidates});
