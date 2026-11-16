'use strict';
/* V15.2 ADV.4: localhost-only browser contract. No real provider, model, database or network writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const BASE='http://127.0.0.1:8080';
const widths=[320,360,390,430,768,1280];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:920},acceptDownloads:true});
   const errors=[],external=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{
     if(!r.url().startsWith(BASE+'/')&&!r.url().startsWith('blob:'))external.push(r.url());
     if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url());
   });
   await page.goto(BASE+'/qa/v147-custom-studio/advanced-studio.html',{waitUntil:'load'});
   await page.waitForFunction(()=>!!window.T404PresentationEvaluator&&
     document.getElementById('decisionTitle').textContent.includes('Báo giá'));
   assert.match(await page.title(),/V15.2 ADV.4/);
   assert.match(await page.locator('#chat').textContent(),/159\.000đ/);
   assert.equal(await page.locator('#publish').isDisabled(),true);
   assert.equal(await page.locator('#approval').isDisabled(),true);
   assert.match(await page.locator('#json').textContent(),/"providerSends": 0/);

   // Exact same SKU, three separate Shop-specific QA prices.
   await page.locator('#shop').selectOption('B');
   assert.match(await page.locator('#chat').textContent(),/209\.000đ/);
   assert.doesNotMatch(await page.locator('#chat').textContent(),/159\.000đ/);
   await page.locator('#shop').selectOption('C');
   assert.match(await page.locator('#chat').textContent(),/259\.000đ/);
   assert.doesNotMatch(await page.locator('#chat').textContent(),/209\.000đ/);

   // Channel downgrade from risky paid template to safe text.
   await page.locator('#channel').selectOption('ZALO_OA');
   await page.locator('#component').selectOption('ZBS_TEMPLATE');
   assert.match(await page.locator('#decisionFallback').textContent(),/chưa được duyệt/);
   assert.match(await page.locator('#json').textContent(),/"selectedComponent": "TEXT"/);

   // Switch to Zalo Bot: low stock C verified, B is NOT falsely red.
   await page.locator('#channel').selectOption('ZALO_BOT');
   await page.locator('#intent').selectOption('LOW_STOCK');
   assert.match(await page.locator('#chat').textContent(),/Sắp hết hàng/);
   assert.ok(await page.locator('#chat .warning').count()>=1);
   await page.locator('#shop').selectOption('B');
   assert.doesNotMatch(await page.locator('#chat').textContent(),/Sắp hết hàng/);
   assert.equal(await page.locator('#chat .warning').count(),0);

   // Draft storage is scoped to Shop/channel, rollback creates new version.
   await page.locator('#channel').selectOption('MESSENGER');
   await page.locator('#intent').selectOption('GREETING');
   await page.locator('#assistantName').fill('Trợ lý Bình ADV4 QA');
   await page.locator('#greeting').fill('Xin chào, hôm nay bạn cần tôi tư vấn gì?');
   await page.locator('#save').click();
   assert.match(await page.locator('#version').textContent(),/v2/);
   assert.match(await page.locator('#chat').textContent(),/Xin chào, hôm nay/);
   await page.locator('#channel').selectOption('ZALO_BOT');
   assert.doesNotMatch(await page.locator('#assistantName').inputValue(),/ADV4 QA/);
   await page.locator('#channel').selectOption('MESSENGER');
   assert.match(await page.locator('#assistantName').inputValue(),/ADV4 QA/);
   await page.locator('#history button:not([disabled])').first().click();
   assert.match(await page.locator('#version').textContent(),/v3/);
   assert.doesNotMatch(await page.locator('#chat').textContent(),/Xin chào, hôm nay/);
   await page.locator('#validate').click();
   assert.match(await page.locator('#qaStatus').textContent(),/PASS 8\/8/);
   assert.match(await page.locator('#json').textContent(),/"providerSends": 0/);
   await page.locator('#desktop').click();
   assert.equal(await page.locator('#device').getAttribute('data-device'),'DESKTOP');
   await page.locator('#mobile').click();
   assert.equal(await page.locator('#device').getAttribute('data-device'),'MOBILE');

   // Malicious merchant text rejected by policy without HTML execution.
   await page.locator('#greeting').fill('<img src=x onerror=alert(1)>');
   assert.match(await page.locator('#decisionTitle').textContent(),/Đã chặn/);
   assert.equal(await page.locator('#chat img').count(),0);
   await page.locator('#greeting').fill('Chào bạn tại cửa hàng Bình.');
   await page.locator('#reset').click();
   assert.match(await page.locator('#status').textContent(),/khôi phục mẫu/);

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=2,'horizontal overflow '+width+': '+overflow);
   assert.deepEqual(errors,[],'browser JS errors '+width);
   assert.deepEqual(external,[],'external requests '+width);
   assert.deepEqual(writes,[],'network writes '+width);
   if(width===390){
     fs.mkdirSync('qa-artifacts-v152adv4',{recursive:true});
     await page.screenshot({path:'qa-artifacts-v152adv4/advanced-studio-390.png',fullPage:true});
   }
   console.log('PASS ADV4 browser '+width+'px / three Shops / four channels / no send');
   await page.close();
  }

  // Export is a user-initiated local JSON download only.
  const page=await browser.newPage({acceptDownloads:true});
  await page.goto(BASE+'/qa/v147-custom-studio/advanced-studio.html');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
  assert.match(download.suggestedFilename(),/^TIEN404_ADV4_QA_A_MESSENGER\.json$/);
  await page.close();
  console.log('PASS ADV4 local draft export, no authenticated backend');
 }finally{await browser.close()}
})().catch(err=>{console.error('ADV4 BROWSER QA FAILED',err);process.exitCode=1});
