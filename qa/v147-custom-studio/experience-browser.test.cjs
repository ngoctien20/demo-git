'use strict';
/* V14.7-04/05 E2E is an OFFLINE browser simulation on 127.0.0.1. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root='http://127.0.0.1:8080';
const widths=[320,360,390,430,768,1280];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[],outside=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{
    if(!r.url().startsWith(root+'/'))outside.push(r.url());
    if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());
   });
   await page.goto(root+'/qa/v147-custom-studio/index.html',{waitUntil:'networkidle'});
   await page.locator('[data-experience="CAROUSEL"]').click();
   assert.equal(await page.locator('#experienceOutput .exp-card').count(),3);
   assert.match(await page.locator('#experienceOutput').textContent(),/159.000đ/);
   await page.locator('[data-experience="QUICK_REPLIES"]').click();
   assert.equal(await page.locator('#experienceOutput .exp-choice').count(),3);
   await page.locator('[data-experience="PERSISTENT_MENU"]').click();
   assert.equal(await page.locator('#experienceOutput .exp-menu-item').count(),3);
   await page.locator('[data-experience="WEBVIEW"]').click();
   assert.match(await page.locator('#experienceOutput').textContent(),/không đọc đơn riêng tư/);
   await page.locator('[data-shop="B"]').click();
   assert.equal(await page.locator('[data-experience="CAROUSEL"]').count(),1);
   await page.locator('[data-experience="CAROUSEL"]').click();
   assert.match(await page.locator('#experienceOutput').textContent(),/209.000đ/);
   assert.doesNotMatch(await page.locator('#experienceOutput').textContent(),/159.000đ/);
   await page.locator('[data-channel="ZALO_BOT"]').click();
   assert.equal(await page.locator('[data-experience="CAROUSEL"]').count(),0);
   await page.locator('[data-experience="RICH_TEXT"]').click();
   assert.match(await page.locator('#experienceOutput .exp-rich').textContent(),/209.000đ/);
   await page.locator('[data-experience="PHOTO_CAPTION"]').click();
   assert.equal(await page.locator('#experienceOutput .exp-photo-preview').count(),1);
   assert.match(await page.locator('#experienceOutput').textContent(),/không gọi sendPhoto/);
   await page.locator('[data-experience="NUMBERED_MENU"]').click();
   assert.match(await page.locator('#experienceOutput').textContent(),/1\. Xem sản phẩm/);
   await page.locator('[data-channel="ZALO_OA"]').click();
   await page.locator('[data-experience="OA_CTA"]').click();
   assert.match(await page.locator('#experienceStatus').textContent(),/quyền provider/);
   await page.locator('[data-experience="ZBS_TEMPLATE"]').click();
   assert.match(await page.locator('#experienceStatus').textContent(),/ngân sách/);
   assert.match(await page.locator('#experienceOutput').textContent(),/thiếu approved template ID/);
   await page.locator('[data-channel="WEB_WIDGET"]').click();
   assert.equal(await page.locator('[data-experience="CAROUSEL"]').count(),0);
   await page.locator('[data-shop="C"]').click();
   await page.locator('[data-channel="MESSENGER"]').click();
   await page.locator('[data-experience="CAROUSEL"]').click();
   assert.match(await page.locator('#experienceOutput').textContent(),/259.000đ/);
   assert.doesNotMatch(await page.locator('#experienceOutput').textContent(),/209.000đ/);
   assert.deepEqual(errors,[],'browser JS errors');
   assert.deepEqual(outside,[],'no external network');
   assert.deepEqual(writes,[],'no HTTP writes');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert.ok(overflow<=2,'horizontal overflow width '+width+' actual '+overflow);
   if(width===390){
    fs.mkdirSync('qa-artifacts-v147-rich',{recursive:true});
    await page.screenshot({path:'qa-artifacts-v147-rich/v147-rich-390.png',fullPage:true});
   }
   console.log('PASS V14.7-04/05 responsive '+width+'px, 3 shops, no send');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
