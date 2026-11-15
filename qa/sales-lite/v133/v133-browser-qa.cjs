'use strict';
// V13.3 browser-only QA: local static UI + intercepted READ-ONLY API fixtures.
// Do not confuse these with hosted Supabase RLS or Cloudflare Access evidence.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const host=process.env.QA_BASE_URL||'http://127.0.0.1:8080',sizes=[360,390,430,768,1280];
const fakeResponse={contract_version:'1.0.0',source:'SERVER_VERIFIED',
 account:{display_name:'Người kiểm thử',session_expires_at:'2026-12-30T00:00:00Z'},
 shop:{id:'store-fixture',name:'Shop fixture E2E',membership_role:'OWNER'},
 subscription:{state:'ACTIVE',plan_name:'Lite QA',starts_at:'2026-11-01T00:00:00Z',expires_at:'2026-12-30T00:00:00Z'},
 bot:{connection_state:'UNKNOWN',owner_pairing:'UNKNOWN',verified_name:null},generated_at:'2026-11-15T00:00:00Z'};
function route(page,width,name){return page.locator(width<=860?'.mobile-nav button[data-view="'+name+'"]':'.sidebar button[data-view="'+name+'"]');}
async function overflow(page,desc){const n=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert.ok(n[0]<=n[1]+1,desc+': horizontal overflow '+n);}
async function studio(browser,width){
 const p=await browser.newPage({viewport:{width,height:850}}),errors=[],writes=[];
 p.on('pageerror',x=>errors.push(x.message));p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());});
 await p.goto(host+'/qa/sales-lite/v133/studio/',{waitUntil:'networkidle'});await p.waitForFunction(()=>document.querySelector('#version')?.textContent==='1.1.0');
 await overflow(p,'Studio '+width);
 await route(p,width,'designer').click();await p.locator('#actions button.action').first().click();
 await p.locator('#label').fill('Tên bản nháp QA');await p.locator('#editor button[type=submit]').click();
 await p.locator('#saveVersion').click();await p.locator('#compareButton').click();
 assert.match(await p.locator('#diffOutput').textContent(),/CUS_CATALOG/);
 await p.locator('#reviewButton').click();assert.match(await p.locator('#versionStatus').textContent(),/REVIEW/);
 await route(p,width,'rich').click();await overflow(p,'Rich '+width);
 await p.locator('#richText').fill('Đơn 🛒 số 1');await p.locator('#styleType').selectOption('b');await p.locator('#styleApply').click();
 const value=JSON.parse(await p.locator('#richPayload').textContent());assert.deepEqual(value.text_styles,[{start:0,len:11,st:['b']}]);
 await route(p,width,'preview').click();await p.locator('#previewRole').selectOption('OWNER');
 assert.equal(await p.locator('#previewActions button').count(),7);await overflow(p,'Preview '+width);
 if(width===390){fs.mkdirSync('qa-artifacts-v133',{recursive:true});await p.screenshot({path:'qa-artifacts-v133/studio-v133-390.png',fullPage:true});}
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await p.close();
}
async function account(browser,width){
 const p=await browser.newPage({viewport:{width,height:850}}),errors=[],writes=[];
 p.on('pageerror',x=>errors.push(x.message));p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());});
 await p.route('**/api/sales-lite/me',async route=>{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fakeResponse)});});
 await p.goto(host+'/qa/sales-lite/v133/account/',{waitUntil:'networkidle'});
 await p.waitForFunction(()=>document.querySelector('[data-fill="shop"]')?.textContent==='Shop fixture E2E');
 assert.match(await p.locator('#modeBadge').textContent(),/READ-ONLY/);await overflow(p,'Merchant '+width);
 await route(p,width,'subscription').click();assert.match(await p.locator('[data-fill=subscriptionStatus]').first().textContent(),/ACTIVE/);assert.match(await p.locator('#expiryBanner').textContent(),/Chưa có cảnh báo gia hạn/);
 assert.ok(await p.locator('button:has-text("Gia hạn")').isDisabled());
 await p.locator('#previewMode').selectOption('expired');assert.match(await p.locator('#modeBadge').textContent(),/QA FIXTURE/);
 await p.locator('#previewMode').selectOption('live');await p.waitForFunction(()=>document.querySelector('#modeBadge')?.textContent.includes('READ-ONLY'));
 await p.unroute('**/api/sales-lite/me');
 await p.route('**/api/sales-lite/me',async route=>route.fulfill({status:401,contentType:'application/json',body:'{"error":"UNAUTHENTICATED"}'}));
 await p.locator('#previewMode').selectOption('empty');await p.locator('#previewMode').selectOption('live');
 await p.waitForFunction(()=>document.querySelector('#connectionMessage')?.textContent.includes('Chưa đăng nhập'));
 assert.doesNotMatch(await p.locator('[data-fill=shop]').first().textContent(),/fixture/);
 await route(p,width,'bot').click();assert.ok(await p.locator('button:has-text("Xem QR")').isDisabled());await overflow(p,'Bot '+width);
 if(width===390){await p.screenshot({path:'qa-artifacts-v133/account-v133-390.png',fullPage:true});}
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await p.close();
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{for(const w of sizes){await studio(browser,w);await account(browser,w);console.log('V13.3 BROWSER QA PASS '+w+'px');}console.log('V13.3 BROWSER QA: 10 viewport runs PASS; API mock only, no writes.');}finally{await browser.close()}})().catch(e=>{console.error('V13.3 BROWSER QA FAILURE',e);process.exitCode=1;});
