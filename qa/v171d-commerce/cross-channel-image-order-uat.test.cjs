'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {crc32,intake,findCandidates}=require('./png-media-intake.cjs');
const {createReadOnlyPilot}=require('../v17-cbot/cbot-readonly-contract.cjs');
const {makeLinkService,createMemoryStoreQa}=require('./two-step-link-readonly.cjs');
const sha=x=>x.repeat(64),SIG=Buffer.from([137,80,78,71,13,10,26,10]);
const chunk=(name,body)=>{
 const h=Buffer.alloc(8);h.writeUInt32BE(body.length);h.write(name,4);
 const c=Buffer.alloc(4);c.writeUInt32BE(crc32(Buffer.concat([h.subarray(4),body])));
 return Buffer.concat([h,body,c]);
};
function qaPhoto(rgb=[245,245,240]){
 const w=32,h=32,header=Buffer.alloc(13);header.writeUInt32BE(w,0);
 header.writeUInt32BE(h,4);header[8]=8;header[9]=2;
 const raw=Buffer.alloc(h*(1+w*3));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const garment=x>5&&x<26&&y>5&&y<29,col=garment?rgb:[255,255,255];
  for(let z=0;z<3;z++)raw[y*(1+w*3)+1+x*3+z]=col[z];
 }
 return Buffer.concat([SIG,chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),
  chunk('IEND',Buffer.alloc(0))]);
}
const scope={tenantId:'T_QA_01',storeId:'S_QA_A'},account='page-qa-a';
const product={source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
 ...scope,itemId:'P_A_001',sku:'QA-F-001',name:'Áo thun cotton trắng',
 priceVnd:159000,stock:35};
let event=0;
function make(){
 const raw=qaPhoto();
 const m={source:'SERVER_ATTESTED_MEDIA_MANIFEST',verified:true,consent:true,
  ...scope,itemId:product.itemId,sku:product.sku,imageId:'qa-image-a',
  catalogVersion:'qa-v1',mimeType:'image/png',demoOnly:true,
  mediaOrigin:'QA_GENERATED_LICENSE_FREE'};
 const trusted=intake({imageBytes:raw,manifest:m,...scope});
 const idx={...scope,catalogVersion:'qa-v1',entries:[trusted]};
 const pilot=createReadOnlyPilot({
  attestInbound:async({channel,rawBody})=>{
   const e=JSON.parse(rawBody.toString());
   return {source:'SERVER_ATTESTED_INBOUND',verified:true,
    channel,accountId:account,subjectHash:sha('a'),...scope,
    eventId:e.eventId,occurredAtMs:e.occurredAtMs,
    kind:e.kind,text:e.text,imageRef:e.imageRef};
  },
  readCatalog:async x=>({...x,source:'TRUSTED_CATALOG_READBACK',verified:true,
   revision:1,products:[product]}),
  matchImage:async ctx=>{
   const match=findCandidates({queryImage:trusted,index:idx,...scope,threshold:0.9999});
   return match.candidates.map(x=>({itemId:x.itemId,score:x.score}));
  },
  resolveVerifiedLink:async()=>null,
  lookupOrder:async()=>{throw Error('ORDER_LOOKUP_MUST_USE_VERIFIED_TWO_STEP_SERVICE');},
  clock:()=>1794873600000
 });
 const sourceProof={source:'SERVER_VERIFIED_PROVIDER_AND_STORE',verified:true,consent:true,
  ...scope,channel:'MESSENGER',accountId:'page-qa-a',
  subjectHash:sha('a'),canonicalCustomerId:'qa-customer-a'};
 const targetProof={source:'SERVER_VERIFIED_PROVIDER_AND_STORE',verified:true,consent:true,
  ...scope,channel:'ZALO_OA',accountId:'oa-qa-a',subjectHash:sha('b')};
 const privateStore=createMemoryStoreQa();
 let source={...sourceProof},target={...targetProof};
 const link=makeLinkService({
  verifySource:async()=>source,verifyTarget:async()=>target,
  privateStore,pepper:Buffer.alloc(32,3),
  randomBytes:()=>crypto.createHash('sha256').update('qa-integration').digest(),
  clock:()=>1794873600000,
  lookupOrder:async q=>({source:'AUTHORIZED_ORDER_STATUS_READBACK',verified:true,
   tenantId:q.tenantId,storeId:q.storeId,
   canonicalCustomerId:q.canonicalCustomerId,
   orderRef:q.orderRef,status:'pending',
   privateAddress:'NEVER_SEND_CUSTOMER_PII'})
 });
 const ask=(e)=>pilot.run({channel:'MESSENGER',
  rawBody:Buffer.from(JSON.stringify({eventId:'qa-event-'+(++event),
   occurredAtMs:1794873600000,...e})),headers:{}});
 return {ask,link,privateStore,setTarget:p=>{target={...target,...p}},
  trusted,product};
}
test('01 full synthetic UAT: pixel photo -> candidate -> customer selects Commerce SKU -> draft -> final confirmation stays no-write -> Messenger approves Zalo -> only then read seeded Order',async()=>{
 const h=make();
 const img=await h.ask({kind:'image',imageRef:'qa-image-a'});
 assert.equal(img.status,'SIMILAR_PRODUCTS_REQUIRES_SKU_SELECTION');
 assert.equal(img.candidateProducts[0].sku,'QA-F-001');
 assert.equal(img.orderWrites,0);
 const chosen=await h.ask({kind:'text',text:'Đúng mã QA-F-001, lấy 2 cái'});
 assert.equal(chosen.status,'ORDER_DRAFT_AWAITING_CONFIRMATION');
 assert.equal(chosen.totalVnd,318000);
 const confirm=await h.ask({kind:'text',text:'xác nhận đặt hàng'});
 assert.equal(confirm.status,'CONFIRMATION_CANNOT_EXECUTE_IN_SOURCE_ONLY');
 assert.equal(confirm.hostedWrites,0);
 // An independently seeded QA order is NOT an order created by the draft.
 const issued=await h.link.issue({targetChannel:'ZALO_OA'});
 assert.equal((await h.link.present({token:issued.token})).status,'AWAIT_SOURCE_APPROVAL');
 assert.equal((await h.link.readOrder({orderRef:'T404-QA-0001'})).status,'ORDER_ACCESS_DENIED');
 assert.equal((await h.link.approve({token:issued.token})).status,'LINK_ACTIVE_QA_RECHECK_EACH_READ');
 const lookup=await h.link.readOrder({orderRef:'T404-QA-0001'});
 assert.equal(lookup.status,'ORDER_STATUS_READ_ONLY_QA');
 assert.equal(lookup.statusCode,'pending');
 assert(!JSON.stringify(lookup).includes('NEVER_SEND_CUSTOMER_PII'));
 assert.equal(lookup.providerSends,0);assert.equal(lookup.hostedWrites,0);
});
test('02 two-step linking still denies other Store even if buyer knows seeded order',async()=>{
 const h=make(),issued=await h.link.issue({targetChannel:'ZALO_OA'});
 h.setTarget({storeId:'S_QA_B'});
 assert.equal((await h.link.present({token:issued.token})).status,'LINK_CHALLENGE_DENIED');
 assert.equal((await h.link.readOrder({orderRef:'T404-QA-0001'})).status,'ORDER_ACCESS_DENIED');
});
test('03 alone presenting a pairing token never constitutes buyer confirmation',async()=>{
 const h=make(),issued=await h.link.issue({targetChannel:'ZALO_OA'});
 assert.equal((await h.link.present({token:issued.token})).requiresSourceConfirmation,true);
 assert.equal(h.privateStore.stats().activeLinks,0);
});
test('04 original source may not confirm same token twice',async()=>{
 const h=make(),issued=await h.link.issue({targetChannel:'ZALO_OA'});
 await h.link.present({token:issued.token});
 await h.link.approve({token:issued.token});
 assert.equal((await h.link.approve({token:issued.token})).status,'LINK_APPROVAL_DENIED');
});
test('05 original catalog SKU style remains accepted without reverting legacy A003 tests',async()=>{
 const h=make(),r=await h.ask({kind:'text',text:'QA-F-001 lấy 1 cái'});
 assert.equal(r.sku,'QA-F-001');assert.equal(r.totalVnd,159000);
 assert.equal(r.needsFinalOrderConfirmation,true);
});
