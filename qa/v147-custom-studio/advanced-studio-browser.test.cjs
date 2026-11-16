'use strict';
/* ADV4 isolated local browser integration QA; NO external requests/sends. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const root='http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,360,390,430,768,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[],outside=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{
    if(!r.url().startsWith(root+'/'))outside.push(r.url());
    if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());
   });
   await page.goto(root+'/qa/v147-custom-studio/index.html',{waitUntil:'networkidle'});
   assert.equal(await page.locator('#advancedStudioV4').count(),1);
   assert.match(await page.locator('#adv4Scope').textContent(),/Shop|Tạp hóa An|v1/);
   assert.match(await page.locator('#adv4Canvas').textContent(),/NO-SEND/);
   assert.equal(await page.locator('#adv4Canvas button:disabled').count(),1);
   let e=JSON.parse(await page.locator('#adv4Evidence').textContent());
   assert.equal(e.canSend,false);assert.equal(e.canExecute,false);assert.equal(e.providerPayload,null);
   await page.locator('#adv4Preset').selectOption('TEXT_FIRST');
   await page.locator('#adv4CTA').selectOption('ASK_STAFF');
   await page.locator('#adv4Media').selectOption('QA_A_PRODUCT_PHOTO');
   await page.locator('#adv4Save').click();
   assert.match(await page.locator('#adv4Scope').textContent(),/Draft v2/);
   assert.match(await page.locator('#adv4History').textContent(),/v1 → v2/);
   e=JSON.parse(await page.locator('#adv4Evidence').textContent());
   assert.equal(e.component,'TEXT');assert.equal(e.actionId,'ASK_STAFF');
   assert.equal(e.mediaUrl,null);assert.equal(e.linkUrl,null);
   await page.locator('[data-shop="B"]').click();
   assert.match(await page.locator('#adv4Scope').textContent(),/Thời trang Bình/);
   assert.match(await page.locator('#adv4Scope').textContent(),/Draft v1/);
   assert.equal(await page.locator('#adv4Media option[value="QA_A_PRODUCT_PHOTO"]').count(),0);
   await page.locator('#adv4CTA').selectOption('TRACK_ORDER');
   await page.locator('#adv4Intent').selectOption('ORDER_LOOKUP');
   await page.locator('#adv4Save').click();
   assert.match(await page.locator('#adv4Canvas').textContent(),/xác minh/i);
   e=JSON.parse(await page.locator('#adv4Evidence').textContent());
   assert.equal(e.actionId,'TRACK_ORDER');assert.equal(e.canExecute,false);
   await page.locator('[data-channel="ZALO_BOT"]').click();
   assert.match(await page.locator('#adv4Scope').textContent(),/ZALO_BOT/);
   assert.match(await page.locator('#adv4Scope').textContent(),/Draft v1/);
   await page.locator('[data-channel="ZALO_OA"]').click();
   await page.locator('#adv4Intent').selectOption('DISCOVER');
   assert.match(await page.locator('#adv4Canvas').textContent(),/NO-SEND/);
   e=JSON.parse(await page.locator('#adv4Evidence').textContent());
   assert.equal(e.mode,'ZALO_OA_CONCEPT_PREVIEW');assert.equal(e.canSend,false);
   await page.locator('[data-channel="WEB_WIDGET"]').click();
   e=JSON.parse(await page.locator('#adv4Evidence').textContent());
   assert.equal(e.mode,'WEBSITE_WIDGET_CONCEPT_PREVIEW');
   await page.locator('[data-shop="A"]').click();
   await page.locator('[data-channel="MESSENGER"]').click();
   assert.match(await page.locator('#adv4Scope').textContent(),/Draft v2/);
   await page.locator('#adv4Rollback').click();
   assert.match(await page.locator('#adv4Scope').textContent(),/Draft v3/);
   assert.match(await page.locator('#adv4History').textContent(),/v1 → v2 → v3/);
   await page.locator('#adv4Intent').selectOption('ABSTAIN');
   assert.match(await page.locator('#adv4Canvas').textContent(),/chưa chắc/i);
   // Save V14.7 bot base v2 -> ADV4 must reject stale until explicit rebase.
   await page.locator('#greeting').fill('Xin chào khách hàng QA mới!');
   await page.locator('#save').click();
   assert.match(await page.locator('#adv4Status').textContent(),/đồng bộ|Bot nền/i);
   await page.locator('#adv4Rebase').click();
   assert.match(await page.locator('#adv4Scope').textContent(),/Bot nền v2/);
   assert.match(await page.locator('#adv4Canvas').textContent(),/NO-SEND/);
   await page.locator('#adv4Export').click();
   assert.match(await page.locator('#adv4Evidence').textContent(),/UNTRUSTED_QA_EXPORT/);
   const data=JSON.parse(await page.locator('#adv4Evidence').textContent());
   assert.equal(data.canPublish,false);assert.equal(data.credentialsIncluded,false);
   assert.deepEqual(errors,[],'browser runtime exceptions');
   assert.deepEqual(outside,[],'no external browser requests');
   assert.deepEqual(writes,[],'no browser writes');
   const widthOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert.ok(widthOverflow<=2,'horizontal overflow '+width+' = '+widthOverflow);
   if(width===390){
    fs.mkdirSync('qa-artifacts-v152-adv4',{recursive:true});
    await page.screenshot({path:'qa-artifacts-v152-adv4/advanced-custom-bot-390.png',fullPage:true});
   }
   console.log('PASS ADV4 integrated browser '+width+'px / 3 shops / 4 channels / rollback / no-send');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});