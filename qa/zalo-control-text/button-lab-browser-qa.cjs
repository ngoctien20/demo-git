'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const host=process.env.QA_BASE_URL||'http://127.0.0.1:8080';
const widths=[360,390,430,768,1280];
async function run(browser,width){
 const page=await browser.newPage({viewport:{width,height:870}});
 const errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url());});
 await page.goto(host+'/qa/zalo-control-text/button-lab/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelectorAll('#buttonArea .action').length===6);
 assert.equal(await page.locator('#modeBot').getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('#messageText').textContent(),/1.*Xem sản phẩm/);
 assert.match(await page.locator('#modeNote').textContent(),/CHỈ TRONG DEMO/);
 assert.equal(await page.locator('#buttonArea [data-action-id]').count(),6);
 await page.locator('#buttonArea [data-action-id="CUS_CATALOG"]').click();
 assert.match(await page.locator('#selectionResult').textContent(),/CUS_CATALOG/);
 assert.match(await page.locator('#selectionResult').textContent(),/READ_PREVIEW_ONLY/);
 await page.locator('#modeOa').click();
 assert.equal(await page.locator('#modeOa').getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('#modeNote').textContent(),/MOCK/);
 await page.locator('#buttonArea [data-action-id="CUS_ORDER_DRAFT"]').click();
 assert.match(await page.locator('#selectionResult').textContent(),/DRAFT_PREVIEW_ONLY/);
 assert.match(await page.locator('#selectionResult').textContent(),/xác nhận ở backend/);
 const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
 assert.ok(sizes[0]<=sizes[1]+1,'Horizontal overflow '+sizes+' at '+width);
 assert.deepEqual(errors,[]);
 assert.deepEqual(writes,[]);
 if(width===390){
  fs.mkdirSync('qa-artifacts-zalo-buttons',{recursive:true});
  await page.screenshot({path:'qa-artifacts-zalo-buttons/button-lab-390.png',fullPage:true});
 }
 console.log('Button Lab Chromium PASS '+width+'px');
 await page.close();
}
async function failClosed(browser){
 const page=await browser.newPage();
 await page.route('**/qa/sales-lite/v131/menu-registry.json',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify({
   menu_version:'1.1.0',send_enabled:true,order_write_enabled:false,subscription_write_enabled:false,menus:[]
  })
 }));
 await page.goto(host+'/qa/zalo-control-text/button-lab/',{waitUntil:'networkidle'});
 assert.match(await page.locator('#selectionResult').textContent(),/BLOCKED/);
 assert.equal(await page.locator('#buttonArea .action').count(),0);
 assert.ok(await page.locator('#modeOa').isDisabled());
 await page.close();
 console.log('Button Lab invalid registry FAIL-CLOSED PASS');
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const width of widths)await run(browser,width);await failClosed(browser);
 console.log('V13.6 BUTTON LAB QA: 5 viewports + 1 tamper test PASS; no outbound writes.');}
 finally{await browser.close();}
})().catch(e=>{console.error('V13.6 BUTTON LAB BROWSER QA FAIL',e);process.exitCode=1;});
