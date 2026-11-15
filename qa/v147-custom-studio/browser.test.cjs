'use strict';
/* V14.7 Playwright visual acceptance — local localhost only; NO provider/DB/model. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root='http://127.0.0.1:8080';
const widths=[320,360,390,430,768,1280];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
   const errors=[],external=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',req=>{
    if(!req.url().startsWith(root+'/'))external.push(req.url());
    if(!['GET','HEAD'].includes(req.method()))writes.push(req.method());
   });
   await page.goto(root+'/qa/v147-custom-studio/index.html',{waitUntil:'networkidle'});
   assert.match(await page.title(),/V14.7/);
   assert.match(await page.locator('#chatTitle').textContent(),/Tạp hóa An/);
   assert.match(await page.locator('#chat').textContent(),/Gạo thơm/);
   await page.locator('[data-shop="B"]').click();
   assert.match(await page.locator('#chat').textContent(),/Áo kiểu/);
   assert.doesNotMatch(await page.locator('#chat').textContent(),/Gạo thơm/);
   await page.locator('[data-channel="ZALO_BOT"]').click();
   assert.match(await page.locator('#chat').textContent(),/dạng văn bản/);
   assert.equal(await page.locator('.product-card').count(),0);
   await page.locator('#assistantName').fill('Trợ lý Bình QA');
   await page.locator('#greeting').fill('Chào bạn, mời chọn đồ tại Bình.');
   await page.locator('#save').click();
   assert.match(await page.locator('#version').textContent(),/v2/);
   assert.match(await page.locator('#chat').textContent(),/Chào bạn, mời chọn đồ/);
   await page.locator('[data-channel="MESSENGER"]').click();
   assert.doesNotMatch(await page.locator('#chat').textContent(),/Chào bạn, mời chọn đồ/);
   assert.equal(await page.locator('.product-card').count(),1);
   await page.locator('[data-flow="QUOTE"]').click();
   assert.match(await page.locator('#chat').textContent(),/209.000đ/);
   await page.locator('[data-flow="ORDER"]').click();
   assert.match(await page.locator('#chat').textContent(),/KHÔNG lưu đơn/);
   await page.locator('#runQa').click();
   assert.match(await page.locator('#qaOutput').textContent(),/PASS 4\/4/);
   await page.locator('[data-shop="C"]').click();
   assert.match(await page.locator('#chat').textContent(),/Xi măng/);
   assert.doesNotMatch(await page.locator('#chat').textContent(),/Áo kiểu/);
   await page.locator('[data-channel="ZALO_OA"]').click();
   assert.match(await page.locator('#capability').textContent(),/quyền OA/);
   await page.locator('[data-channel="WEB_WIDGET"]').click();
   assert.match(await page.locator('#channelTitle').textContent(),/Widget/);
   await page.locator('[data-flow="CONSULT"]').click();
   assert.equal(await page.locator('.product-card').count(),1);
   await page.locator('#reset').click();
   assert.match(await page.locator('#status').textContent(),/khôi phục/);
   assert.deepEqual(errors,[],'browser errors');
   assert.deepEqual(external,[],'external URLs forbidden');
   assert.deepEqual(writes,[],'network writes forbidden');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert.ok(overflow<=2,'horizontal overflow at '+width+': '+overflow);
   if(width===390){
     fs.mkdirSync('qa-artifacts-v147',{recursive:true});
     await page.screenshot({path:'qa-artifacts-v147/studio-390.png',fullPage:true});
   }
   console.log('PASS V14.7 browser '+width+'px, 3 shops, 4 channels, no external calls');
   await page.close();
  }
  const page=await browser.newPage({acceptDownloads:true});
  const external=[],writes=[];
  page.on('request',req=>{if(!req.url().startsWith(root+'/'))external.push(req.url());if(!['GET','HEAD'].includes(req.method()))writes.push(req.method());});
  await page.goto(root+'/qa/v147-custom-studio/index.html');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
  assert.match(download.suggestedFilename(),/TIEN404_V147_QA_A_MESSENGER.json/);
  assert.deepEqual(external,[]);
  assert.deepEqual(writes,[]);
  await page.close();
  console.log('PASS V14.7 export draft no network, no real provider send');
 }finally{await browser.close()}
})().catch(e=>{console.error('V14.7 BROWSER QA FAILED',e);process.exitCode=1});
