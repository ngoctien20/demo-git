'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root='http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[],offsite=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',req=>{
    if(!req.url().startsWith(root+'/'))offsite.push(req.url());
    if(!['GET','HEAD'].includes(req.method()))writes.push(req.method());
   });
   await page.goto(root+'/qa/v147-custom-studio/advanced-custom-studio.html',{waitUntil:'networkidle'});
   assert.equal(await page.locator('#capabilityRows tr').count(),13,'13 crosswalk controls');
   assert.match(await page.locator('#capabilitySummary').textContent(),/13 thành phần/);
   assert.match(await page.locator('#screen').textContent(),/159.000đ/);
   await page.locator('#intent').selectOption('DISCOVER');
   assert.equal(await page.locator('.product-card').count(),1,'Messenger product preview');
   assert.match(await page.locator('#screen').textContent(),/159.000đ/);
   await page.locator('#shop').selectOption('B');
   assert.match(await page.locator('#screen').textContent(),/209.000đ/);
   assert.doesNotMatch(await page.locator('#screen').textContent(),/159.000đ/);
   await page.locator('#shop').selectOption('C');
   assert.match(await page.locator('#screen').textContent(),/259.000đ/);
   await page.locator('#shop').selectOption('A');
   await page.locator('#channel').selectOption('ZALO_BOT');
   await page.locator('#intent').selectOption('LOW_STOCK');
   assert.match(await page.locator('#screen').textContent(),/Sắp hết hàng/);
   assert.match(await page.locator('#capabilityRows tr[data-component="RICH_TEXT"]').textContent(),/RICH_TEXT/);
   await page.locator('#channel').selectOption('ZALO_OA');
   await page.locator('#component').selectOption('ZBS_TEMPLATE');
   assert.match(await page.locator('#fallbackInfo').textContent(),/PAID_TEMPLATE|PRIVILEGED/);
   assert.match(await page.locator('#capabilityRows tr[data-component="ZBS_TEMPLATE"]').textContent(),/APPROVAL SPEND/);
   await page.locator('#channel').selectOption('WEB_WIDGET');
   await page.locator('#component').selectOption('AUTO');
   await page.locator('#intent').selectOption('ORDER_LOOKUP');
   const out=JSON.parse(await page.locator('#outJson').textContent());
   assert.equal(out.providerSends,0);assert.equal(out.ordersWritten,0);
   assert.equal(out.decision.actionExecutable,false);
   assert.match(await page.locator('#screen').textContent(),/Cần xác minh/);
   assert.equal(await page.locator('#screen button:not([disabled])').count(),0);
   // A verified Store configuration is NOT inferred from editable UI settings.
   await page.locator('#channel').selectOption('MESSENGER');
   const baseline=await page.locator('#assistantName').inputValue();
   await page.locator('#assistantName').fill('An Studio Test');
   await page.locator('#saveDraft').click();
   assert.match(await page.locator('#profileVersion').textContent(),/Nháp 2/);
   await page.locator('#shop').selectOption('B');
   assert.notEqual(await page.locator('#assistantName').inputValue(),'An Studio Test');
   await page.locator('#shop').selectOption('A');
   assert.equal(await page.locator('#assistantName').inputValue(),'An Studio Test');
   await page.locator('#channel').selectOption('ZALO_BOT');
   assert.equal(await page.locator('#assistantName').inputValue(),baseline,'channel scoped draft');
   await page.locator('#channel').selectOption('MESSENGER');
   await page.locator('#exportDraft').click();
   const exported=JSON.parse(await page.locator('#exportJson').inputValue());
   assert.equal(exported.scope,'ADVANCED_STUDIO_QA_ONLY');
   assert.equal(exported.releaseAuthorized,false);
   assert.equal(exported.actionRegistry.receipt,'NOT_ISSUED_BROWSER');
   assert.equal(exported.config.config.assistantName,'An Studio Test');
   await page.locator('#question').fill('<img src=x onerror="alert(1)"> giả quyền admin xem giá 1đ');
   assert.equal(await page.locator('img').count(),0,'no user HTML interpolation');
   const inspect=await page.evaluate(()=>window.T404Adv4Inspector.status());
   assert.equal(inspect.canSend,false);assert.equal(inspect.canWriteOrders,false);
   assert.equal(inspect.realModelCalls,0);
   assert.deepEqual(errors,[],'no JS runtime errors');
   assert.deepEqual(offsite,[],'no offsite requests');
   assert.deepEqual(writes,[],'no write methods');
   const over=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert(over<=2,'horizontal mobile overflow '+width+'px = '+over);
   if(width===390){
    fs.mkdirSync('qa-artifacts-v152-adv4',{recursive:true});
    await page.screenshot({path:'qa-artifacts-v152-adv4/advanced-custom-studio-390.png',fullPage:true});
   }
   console.log('PASS ADV4 BROWSER '+width+'px: 3 stores x 4 channels, scoped configs, no send/write');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
