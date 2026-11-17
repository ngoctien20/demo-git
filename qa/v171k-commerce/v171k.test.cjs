'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {staffPreflight}=require('./staff-image-intake.cjs');
const {proposeOneShot}=require('./vision-one-shot-quote.cjs');
const {validMetaFixtureHmac,verifyOfflineNoSend}=require('./signed-provider-shadow.cjs');
const NOW=1794873600000,scope={tenantId:'TENANT_A',storeId:'STORE_A'};
const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(100,42)]);
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(){
 return {
  catalog:{source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,...scope,revision:3,
    products:[{...scope,itemId:'ITEM_1',sku:'SKU_1',active:true}]},
  reviewer:{...scope,staffId:'STAFF_1',role:'MEDIA_REVIEWER',mfaVerified:true},
  merchantConsent:{...scope,sku:'SKU_1',itemId:'ITEM_1',rightsEvidenceRef:'RIGHTS_1',
    consentRef:'CONSENT_1',commercialUse:true,aiMatchingApproved:true,
    privacyReviewed:true,expiresAtMs:NOW+100000},
  media:{mediaId:'MEDIA_1',sku:'SKU_1',itemId:'ITEM_1',bytes,
    mime:'image/png',expectedSha256:sha,catalogRevision:3},
  source:{kind:'STAFF_UPLOADED_BYTES',remoteFetchRequested:false,autoScrape:false},
  verifyStaffSession:()=>true,nowMs:NOW
 };
}
const pre=()=>staffPreflight(fixture());
const bad=(pattern,fn)=>assert.throws(fn,new RegExp(pattern));
test('01 preflight returns quarantined media binding',()=>{
 const r=pre();assert.equal(r.mode,'STAFF_LOCAL_QUARANTINE_ONLY');
 assert.equal(r.storeId,'STORE_A');assert.equal(r.sku,'SKU_1');assert.equal(r.imageSha256,sha);
});
test('02 no real model, hosted write, network or reply',()=>{
 const r=pre();assert.equal(r.canUseForRealVision,false);
 assert.equal(r.actualModelCalls+r.actualRemoteFetches+r.providerSends+r.hostedWrites,0);
});
test('03 image bytes excluded from output',()=>assert.equal(JSON.stringify(pre()).includes('imageBytes'),false));
const staffBad=[
 ['04 refused staff role','STAFF_INDEPENDENT',x=>{x.reviewer.role='ACCOUNTANT';}],
 ['05 refused MFA missing','STAFF_INDEPENDENT',x=>{x.reviewer.mfaVerified=false;}],
 ['06 refused wrong staff Store','STAFF_INDEPENDENT',x=>{x.reviewer.storeId='STORE_B';}],
 ['07 refused wrong staff Tenant','STAFF_INDEPENDENT',x=>{x.reviewer.tenantId='TENANT_B';}],
 ['08 refused independent staff callback','STAFF_INDEPENDENT',x=>{x.verifyStaffSession=()=>false;}],
 ['09 refused absent staff callback','STAFF_INDEPENDENT',x=>{x.verifyStaffSession=null;}],
 ['10 refused fake catalog','STAFF_CATALOG',x=>{x.catalog.verified=false;}],
 ['11 refused wrong catalog revision','STAFF_MEDIA_SCOPE',x=>{x.media.catalogRevision=4;}],
 ['12 refused changed SKU','STAFF_CROSS_STORE',x=>{x.media.sku='SKU_2';}],
 ['13 refused changed itemId','STAFF_CROSS_STORE',x=>{x.media.itemId='ITEM_2';}],
 ['14 refused shop consent mismatch','STAFF_MEDIA_RIGHTS',x=>{x.merchantConsent.storeId='STORE_B';}],
 ['15 refused unapproved commercial use','STAFF_MEDIA_RIGHTS',x=>{x.merchantConsent.commercialUse=false;}],
 ['16 refused AI use consent','STAFF_MEDIA_RIGHTS',x=>{x.merchantConsent.aiMatchingApproved=false;}],
 ['17 refused missing privacy review','STAFF_MEDIA_RIGHTS',x=>{x.merchantConsent.privacyReviewed=false;}],
 ['18 refused expired rights','STAFF_MEDIA_RIGHTS',x=>{x.merchantConsent.expiresAtMs=NOW-1;}],
 ['19 refused rights >365d','STAFF_MEDIA_RIGHTS',x=>{x.merchantConsent.expiresAtMs=NOW+366*86400000;}],
 ['20 refused URL scraping','STAFF_DIRECT_UPLOAD',x=>{x.source.autoScrape=true;}],
 ['21 refused remote HTTP fetch','STAFF_DIRECT_UPLOAD',x=>{x.source.remoteFetchRequested=true;}],
 ['22 refused public webhook','STAFF_DIRECT_UPLOAD',x=>{x.source.isPublicWebhook=true;}],
 ['23 refused tampered checksum','STAFF_MEDIA_SHA',x=>{x.media.expectedSha256='a'.repeat(64);}],
 ['24 refused claimed wrong MIME','STAFF_MEDIA_MIME',x=>{x.media.mime='image/webp';}],
 ['25 refused huge image','STAFF_IMAGE_BYTES',x=>{x.media.bytes=Buffer.alloc(2*1024*1024+1);}],
 ['26 refused HTML as image','STAFF_MEDIA_MIME',x=>{x.media.bytes=Buffer.from('<html>'.repeat(20));}]
];
for(const [name,error,mutate] of staffBad){
 test(name,()=>{const x=fixture();mutate(x);bad(error,()=>staffPreflight(x));});
}
function oneShot(){
 return {quarantine:pre(),storageReceipt:{...scope,itemId:'ITEM_1',sku:'SKU_1',
   sha256:sha,status:'PRIVATE_QA_ONLY',evidenceRef:'STORAGE_1'},
 proposal:{provider:'VISION_VENDOR',model:'VISION_MODEL',caseId:'CASE_1',nonce:'NONCE_1'},
 budget:{origin:'HUMAN_QUOTE_UNVERIFIED',maxCalls:1,retryAllowed:false,...scope,
   provider:'VISION_VENDOR',model:'VISION_MODEL',approvalRef:'APPROVAL_1',
   pricingEvidenceRef:'PRICE_1',expiresAtMs:NOW+10000,
   maxMicroUsd:5000,perCallUpperBoundMicroUsd:4000},
 nowMs:NOW};
}
test('27 proposed one-shot always zero actual model calls',()=>{
 const r=proposeOneShot(oneShot());assert.equal(r.actualVisionCalls,0);
 assert.equal(r.actualBilledUsd,null);assert.equal(r.realModelEligible,false);
});
test('28 one-shot never retries',()=>{
 const r=proposeOneShot(oneShot());assert.equal(r.maxCalls,1);assert.equal(r.retryAllowed,false);
});
const oneBad=[
 ['29 refused foreign storage Store','ONESHOT_STORE_STORAGE',x=>{x.storageReceipt.storeId='STORE_B';}],
 ['30 refused mismatched image hash','ONESHOT_STORE_STORAGE',x=>{x.storageReceipt.sha256='f'.repeat(64);}],
 ['31 refused missing private receipt','ONESHOT_STORE_STORAGE',x=>{x.storageReceipt.evidenceRef='';}],
 ['32 refused budget with two calls','ONESHOT_UNAPPROVED',x=>{x.budget.maxCalls=2;}],
 ['33 refused budget retries','ONESHOT_UNAPPROVED',x=>{x.budget.retryAllowed=true;}],
 ['34 refused expired budget','ONESHOT_UNAPPROVED',x=>{x.budget.expiresAtMs=NOW-1;}],
 ['35 refused inflated per-call cost','ONESHOT_UNAPPROVED',x=>{x.budget.perCallUpperBoundMicroUsd=6000;}],
 ['36 refused forged budget source','ONESHOT_UNAPPROVED',x=>{x.budget.origin='VERIFIED_BY_USER';}],
 ['37 refused wrong Model','ONESHOT_UNAPPROVED',x=>{x.budget.model='OTHER_MODEL';}]
];
for(const [name,error,mutate] of oneBad){
 test(name,()=>{const x=oneShot();mutate(x);bad(error,()=>proposeOneShot(x));});
}
function signed(){
 const secret='fixture-secret-only-very-long-key';
 const rawBody=Buffer.from(JSON.stringify({...scope,pageId:'PAGE_A',
   messageId:'MESSAGE_A',origin:'OFFLINE_TEST_SIGNED_FIXTURE'}));
 const signatureHeader='sha256='+crypto.createHmac('sha256',secret).update(rawBody).digest('hex');
 return {channel:'MESSENGER',rawBody,signatureHeader,fixtureSecret:secret,
   installation:{...scope,active:false,stage:'SYNTHETIC_OFFLINE_ONLY',pageId:'PAGE_A'},
   nowMs:NOW};
}
test('38 synthetic Meta HMAC confirms exact raw fixture bytes',()=>{
 const x=signed();assert.equal(validMetaFixtureHmac(x.rawBody,x.signatureHeader,x.fixtureSecret),true);
});
test('39 tampered fixture raw bytes fail HMAC',()=>{
 const x=signed();x.rawBody=Buffer.from(x.rawBody.toString().replace('MESSAGE_A','MESSAGE_B'));
 assert.equal(validMetaFixtureHmac(x.rawBody,x.signatureHeader,x.fixtureSecret),false);
});
test('40 invalid signature header fails HMAC',()=>{
 const x=signed();assert.equal(validMetaFixtureHmac(x.rawBody,'sha256='+'0'.repeat(64),x.fixtureSecret),false);
});
test('41 signed Meta fixture is never real Page/OA admission',()=>{
 const r=verifyOfflineNoSend(signed());
 assert.equal(r.decision,'SYNTHETIC_CRYPTO_PASS_NO_REAL_UAT');
 assert.equal(r.actualRealProviderSignatureVerified,false);
 assert.equal(r.actualProviderSends+r.hostedWrites,0);
});
test('42 wrong Page fixture denied',()=>{
 const x=signed();x.installation.pageId='OTHER_PAGE';
 assert.equal(verifyOfflineNoSend(x).decision,'DENY');
});
test('43 active Provider installation blocked',()=>{
 const x=signed();x.installation.active=true;
 bad('SIGNED_SHADOW',()=>verifyOfflineNoSend(x));
});
test('44 Zalo always denied absent official signed OA authority',()=>{
 const x=signed();x.channel='ZALO';
 const r=verifyOfflineNoSend(x);assert.equal(r.decision,'DENY');
 assert.equal(r.actualProviderSends,0);
});
test('45 fake real webhook origin denied even with fixture HMAC',()=>{
 const x=signed();x.rawBody=Buffer.from(JSON.stringify({...scope,pageId:'PAGE_A',messageId:'MESSAGE_A',origin:'REAL_WEBHOOK'}));
 x.signatureHeader='sha256='+crypto.createHmac('sha256',x.fixtureSecret).update(x.rawBody).digest('hex');
 assert.equal(verifyOfflineNoSend(x).decision,'DENY');
});