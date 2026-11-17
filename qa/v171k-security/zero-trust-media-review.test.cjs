'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {prepareUntrustedLink,proposePrivateMediaReview}=require('./zero-trust-media-review.cjs');
const scope={tenantId:'TENANT_A',storeId:'STORE_A'},now=1794873600000;
const safe='https://shop.example.vn/img/shirt-001.jpg';
const link=(rawLink=safe,rest={})=>prepareUntrustedLink({
 ...scope,submissionId:'SUB_001',rawLink,...rest});
const sha='a'.repeat(64),original='b'.repeat(64);
const review=()=>({
 quarantine:{...scope,itemId:'ITEM_A',sku:'SKU_A',sourceSha256:original,
   sanitizedSha256:sha,sanitizedMime:'image/png',
   mode:'OFFLINE_SANITIZED_FILE_QUARANTINE_ONLY'},
 storage:{...scope,itemId:'ITEM_A',sku:'SKU_A',contentSha256:sha,
   visibility:'PRIVATE_QUARANTINE_ONLY',privateStorageReceiptRef:'STO_001'},
 scan:{...scope,contentSha256:sha,status:'CLEAN_BY_EXTERNAL_SCANNER_DECLARATION',
   engineVersionRef:'SCAN_V001',scannerReceiptRef:'SCAN_001',scannedAtMs:now-50},
 reviewer:{...scope,staffId:'STAFF_REVIEW_01',
   role:'SECURITY_MEDIA_REVIEWER',mfaVerified:true},
 submittedBy:'STAFF_UPLOAD_01',
 verifyReviewer:()=>true,nowMs:now
});
test('01 link is only untrusted text; no auto preview or remote request',()=>{
 const r=link();assert.equal(r.networkRequests,0);assert.equal(r.dnsQueries,0);
 assert.equal(r.autoPreviewAllowed,false);assert.equal(r.canAdmitImage,false);
});
test('02 returned link is a SHA256 digest, never a clickable URL',()=>{
 const r=link();assert.match(r.urlSha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(r).includes(safe),false);assert.equal(r.linkClickable,false);
});
const badLinks=[
 ['03 javascript URL', 'javascript:alert(1)'],
 ['04 file URL','file:///etc/passwd'],
 ['05 data URL','data:image/svg+xml,%3Csvg%3E'],
 ['06 ftp URL','ftp://shop.example.vn/foo'],
 ['07 local network IPv4','https://127.0.0.1/img.jpg'],
 ['08 local server hostname','https://admin.local/a.jpg'],
 ['09 untrusted credentials','https://admin:pass@shop.example.vn/a.jpg'],
 ['10 extra query token','https://shop.example.vn/a.jpg?access_key=private'],
 ['11 fragment','https://shop.example.vn/a.jpg#token'],
 ['12 unsafe html tag','https://shop.example.vn/<script>alert(1)</script>'],
 ['13 double encoded slash','https://shop.example.vn/a%2Fb.jpg'],
 ['14 embedded newline','https://shop.example.vn/a.jpg\nfoo'],
 ['15 untrusted markdown quote','https://shop.example.vn/a".jpg'],
 ['16 trailing whitespace','https://shop.example.vn/a.jpg '],
 ['17 private ipv4 metadata','https://169.254.169.254/path']
];
for(const [name,rawLink] of badLinks)test(name,()=>assert.throws(
 ()=>link(rawLink),/^Error: LINK_/));
test('18 review only a sanitized source',()=>{
 const r=proposePrivateMediaReview(review());
 assert.equal(r.mode,'REVIEW_CANDIDATE_NOT_PUBLISHED');
 assert.equal(r.safeToServePublicly,false);
});
test('19 reviewer green cannot authorize actual model or publish',()=>{
 const r=proposePrivateMediaReview(review());
 assert.equal(r.canInvokeRealVision,false);assert.equal(r.actualMerchantMediaPublished,0);
});
test('20 wrong storage tenant denied',()=>{
 const f=review();f.storage.tenantId='TENANT_B';
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_PRIVATE_STORE/);
});
test('21 wrong storage Store denied',()=>{
 const f=review();f.storage.storeId='STORE_B';
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_PRIVATE_STORE/);
});
test('22 wrong storage sanitized hash denied',()=>{
 const f=review();f.storage.contentSha256='c'.repeat(64);
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_PRIVATE_STORE/);
});
test('23 publicly exposed storage denied',()=>{
 const f=review();f.storage.visibility='PUBLIC_CDN';
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_PRIVATE_STORE/);
});
test('24 missing malware scan denied',()=>{
 const f=review();f.scan=null;
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_FRESH_SCAN/);
});
test('25 unsafe external scanner result denied',()=>{
 const f=review();f.scan.status='MALICIOUS';
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_FRESH_SCAN/);
});
test('26 stale scan over 1 hour denied',()=>{
 const f=review();f.scan.scannedAtMs=now-3600001;
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_FRESH_SCAN/);
});
test('27 false scanner hash denied',()=>{
 const f=review();f.scan.contentSha256='d'.repeat(64);
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_FRESH_SCAN/);
});
test('28 missing scanner evidence ref denied',()=>{
 const f=review();f.scan.scannerReceiptRef='';
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_FRESH_SCAN/);
});
test('29 reviewer same as uploader denied',()=>{
 const f=review();f.submittedBy='STAFF_REVIEW_01';
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_SEPARATE_MFA/);
});
test('30 staff reviewer missing MFA denied',()=>{
 const f=review();f.reviewer.mfaVerified=false;
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_SEPARATE_MFA/);
});
test('31 staff reviewer wrong shop denied',()=>{
 const f=review();f.reviewer.storeId='STORE_B';
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_SEPARATE_MFA/);
});
test('32 role without media authority denied',()=>{
 const f=review();f.reviewer.role='ACCOUNTANT';
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_SEPARATE_MFA/);
});
test('33 external reviewer verifier missing denied',()=>{
 const f=review();f.verifyReviewer=null;
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_SEPARATE_MFA/);
});
test('34 external reviewer verifier false denied',()=>{
 const f=review();f.verifyReviewer=()=>false;
 assert.throws(()=>proposePrivateMediaReview(f),/REVIEW_SEPARATE_MFA/);
});
test('35 no real scanner/reviewer verification certified by source',()=>{
 const r=proposePrivateMediaReview(review());
 assert.equal(r.independentMalwareScanVerifiedByModule,false);
 assert.equal(r.independentStaffAuthenticationVerifiedByModule,false);
 assert.equal(r.legalMerchantImageRightsVerifiedByModule,false);
});
test('36 no hosted mutations or provider sends in proposed review',()=>{
 const r=proposePrivateMediaReview(review());
 assert.equal(r.hostedWrites+r.providerSends,0);
});
