'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const root=__dirname;
const html=fs.readFileSync(root+'/advanced-custom-studio.html','utf8');
const ui=fs.readFileSync(root+'/advanced-merchant-uat-view.js','utf8');
const domain=require('./advanced-merchant-uat.js');
test('01 mobile UAT cards breakpoint <=600 and independent desktop layout',()=>{
 assert.match(html,/@media\(max-width:600px\)/);
 assert.match(html,/#merchantUat \.uat-table tr\{display:grid/);
 assert.match(html,/\.uat-mobile-label\{display:none\}/);
});
test('02 UAT uses exactly the original 16 cases and one tbody',()=>{
 assert.equal(domain.CASES.length,16);
 assert.equal((html.match(/id="uatRows"/g)||[]).length,1);
 assert.equal((html.match(/class="uat-table"/g)||[]).length,1);
});
test('03 no secondary mobile inputs or alternate evidence collection',()=>{
 assert(!html.includes('uatMobileRows'));
 assert(!ui.includes('mobileOutcomes'));
 assert.match(ui,/form\.update\(id,select\.value,note\.value\)/);
});
test('04 CSS removes min-width on mobile for four columns',()=>{
 assert.match(html,/#merchantUat \.uat-table\{display:block;min-width:0/);
 assert.match(html,/#merchantUat \.uat-table td\{display:block;min-width:0;width:100%/);
 assert.match(html,/#merchantUat \.uat-table select,#merchantUat \.uat-table input\{display:block;width:100%;min-width:0/);
});
test('05 mobile fields have visible labels and associated ids',()=>{
 assert.match(ui,/statusLabel\.htmlFor=select\.id/);
 assert.match(ui,/noteLabel\.htmlFor=note\.id/);
 assert.match(ui,/note\.id='uat_note_'\+id/);
 assert.match(ui,/expectedLabel\.className='uat-mobile-label'/);
});
test('06 touch targets are at least 44px',()=>{
 assert.match(html,/min-height:46px/);
 assert.match(html,/#merchantUat \.uat-control button\{min-height:44px\}/);
});
test('07 mobile notes are not rich HTML or untrusted injection',()=>{
 assert.match(ui,/document\.createTextNode\(item\.expected\)/);
 assert(!ui.includes('innerHTML'));
 assert(!ui.includes('insertAdjacentHTML'));
});
test('08 self-assessment 16 PASS remains unverified release gate',()=>{
 const s=domain.createSession();
 for(const t of domain.CASES)s.update(t.id,'PASS');
 const result=s.exportEvidence();
 assert.equal(result.counts.PASS,16);
 assert.equal(result.claims.merchantIdentityIndependentlyVerified,false);
 assert.equal(result.claims.merchantUatApproved,false);
 assert.equal(result.claims.releaseAuthorized,false);
});
test('09 network, persistent storage and provider APIs still absent',()=>{
 const source=html+ui;
 for(const pattern of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\bWebSocket\b/,/\blocalStorage\b/,/\bsessionStorage\b/,/\bindexedDB\b/,/\binnerHTML\b/])
  assert(!pattern.test(source),String(pattern));
 assert.match(html,/connect-src 'none'/);
});
test('10 no change to action execution or browser identity model',()=>{
 assert.match(html,/NO SEND/);
 assert.match(html,/NO COMMERCE WRITE/);
 assert.match(ui,/independentMerchantAcceptance|CHƯA NGHIỆM THU/);
 assert.match(ui,/renderCount:inspector\.renderCount,canSend:false,canWriteOrders:false/);
});
