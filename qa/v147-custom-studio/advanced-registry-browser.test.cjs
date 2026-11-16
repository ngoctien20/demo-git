'use strict';
/* V15.2 ADV.1/2 local-only browser QA. No connected provider/API. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[],outside=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',req=>{
    if(!req.url().startsWith(base+'/'))outside.push(req.url());
    if(!['GET','HEAD'].includes(req.method()))writes.push(req.method());
   });
   await page.goto(base+'/qa/v147-custom-studio/advanced-preview.html',{waitUntil:'networkidle'});
   assert.equal(await page.locator('#capabilityRows tr').count(),13,'all 13 components');
   assert.match(await page.locator('#capabilitySummary').textContent(),/13 thành phần/);
   assert.match(await page.locator('#capabilitySelected').textContent(),/Bản xem trước|Cần xác minh/);
   await page.locator('#manualIntent').selectOption('DISCOVER');
   assert.equal(await page.locator('.product-card').count(),1);
   assert.match(await page.locator('#screen').textContent(),/159.000đ/);
   await page.locator('#shop').selectOption('B');
   assert.match(await page.locator('#screen').textContent(),/209.000đ/);
   assert.doesNotMatch(await page.locator('#screen').textContent(),/159.000đ/);
   await page.locator('#channel').selectOption('ZALO_BOT');
   assert.equal(await page.locator('#capabilityRows tr').count(),13);
   assert.match(await page.locator('#capabilitySelected').textContent(),/Thiếu ảnh được phê duyệt/);
   await page.locator('#manualIntent').selectOption('LOW_STOCK');
   assert.match(await page.locator('#screen').textContent(),/Tồn kho còn đủ/);
   await page.locator('#shop').selectOption('A');
   assert.match(await page.locator('#screen').textContent(),/Sắp hết hàng/);
   await page.locator('#channel').selectOption('ZALO_OA');
   const zbs=page.locator('#capabilityRows tr[data-component="ZBS_TEMPLATE"]');
   assert.match(await zbs.textContent(),/Cần duyệt mẫu và ngân sách/);
   assert.match(await zbs.textContent(),/Chuyển sang văn bản/);
   await page.locator('#channel').selectOption('WEB_WIDGET');
   assert.match(await page.locator('#capabilityRows tr[data-component="RICH_TEXT"]').textContent(),/Chỉ dựng được trong Widget/);
   await page.locator('#manualIntent').selectOption('ORDER_LOOKUP');
   assert.match(await page.locator('#screen').textContent(),/xác minh quyền/);
   const json=JSON.parse(await page.locator('#json').textContent());
   assert.equal(json.canPublish,false);assert.equal(json.orderWrites,0);assert.equal(json.providerSends,0);
   assert.deepEqual(errors,[],'browser errors');
   assert.deepEqual(outside,[],'external browser requests');
   assert.deepEqual(writes,[],'no HTTP write requests');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert(overflow<=2, 'horizontal overflow at '+width+': '+overflow);
   if(width===390){
    fs.mkdirSync('qa-artifacts-v152-adv2',{recursive:true});
    await page.screenshot({path:'qa-artifacts-v152-adv2/advanced-registry-390.png',fullPage:true});
   }
   console.log('PASS V15.2 ADV1/ADV2 '+width+'px | 3 shops | 4 channels | 0 send');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});