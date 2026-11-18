'use strict';
/* V18.5 Chromium responsiveness - local mock gateway, never contacts n8n.
 * Verifies actual existing launcher/composer wired to candidate renderer.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin='http://127.0.0.1:8080';
const widths=[320,360,390,430,768,1280];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for (const width of widths){
   const page=await browser.newPage({viewport:{width,height:860}});
   const errors=[],external=[],realWrites=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>{
     const url=r.request().url();
     if (!url.startsWith(origin+'/')){external.push(url);return r.abort();}
     if (r.request().method()!=='GET')realWrites.push(r.request().method()+' '+url);
     return r.continue();
   });
   await page.goto(origin+'/qa/channel-v185/host.html',{waitUntil:'networkidle'});
   await page.locator('html.tien404-chat-ready').waitFor();
   assert.equal(await page.locator('#tien404-chat-panel').isVisible(),false);
   await page.locator('#tien404-chat-launcher').click();
   assert.equal(await page.locator('#tien404-chat-panel').isVisible(),true);
   assert.equal(await page.locator('#tien404-composer').isVisible(),true);
   await page.locator('#tien404-message').fill('Shop có những sản phẩm gì?');
   await page.locator('#tien404-send').click();
   await page.locator('.tien404-v185-product').first().waitFor();
   assert.match(await page.locator('.tien404-v185-feed').textContent(),/UI GIẢ LẬP/);
   assert.equal(await page.locator('.tien404-v185-product').count(),1);
   assert.equal(await page.locator('.tien404-v185-product img').count(),0);
   assert.match(await page.locator('.tien404-v185-product').textContent(),/159\.000/);
   const action=page.getByRole('button',{name:'Xem sản phẩm mẫu'});
   await action.click();
   assert.equal(await page.locator('#tien404-message').inputValue(),'Xem sản phẩm mẫu');
   const diag=await page.evaluate(()=>({
     width:innerWidth,documentWidth:document.documentElement.scrollWidth,
     visiblePanel:!!document.querySelector('.tien404-v185-widget'),
     status:document.querySelector('#tien404-composer-status')?.textContent||''
   }));
   assert.ok(diag.documentWidth<=diag.width+2,
     'horizontal overflow at width '+width+': '+JSON.stringify(diag));
   assert.deepEqual(errors,[]);
   assert.deepEqual(realWrites,[]);
   assert.deepEqual(external,[]);
   if(width===390||width===1280){
    fs.mkdirSync('qa-artifacts-v185',{recursive:true});
    await page.screenshot({path:'qa-artifacts-v185/widget-'+width+'.png',fullPage:true});
   }
   await page.locator('#tien404-chat-close').click();
   assert.equal(await page.locator('#tien404-chat-panel').isVisible(),false);
   await page.close();
   console.log('V18.5 WIDGET BROWSER PASS '+width+'px / no external requests');
  }
  // Failure/timeout behavior: no implicit n8n fallback or repeated send.
  const page=await browser.newPage({viewport:{width:390,height:800}});
  await page.goto(origin+'/qa/channel-v185/host.html',{waitUntil:'networkidle'});
  await page.locator('#tien404-chat-launcher').click();
  await page.evaluate(()=>{window.fetch=async()=>{throw Error('SIMULATED_GATEWAY_DOWN')}});
  await page.locator('#tien404-message').fill('Câu hỏi khi Gateway không khả dụng');
  await page.locator('#tien404-send').click();
  await page.waitForFunction(()=>document.querySelector('#tien404-composer-status')?.textContent.includes('không tự gửi lại'));
  assert.equal(await page.locator('#tien404-message').inputValue(),'Câu hỏi khi Gateway không khả dụng');
  assert.equal(await page.locator('.tien404-v185-product').count(),0);
  await page.close();
 }finally{await browser.close()}
 console.log('V18.5 PASS 6 responsive viewports + failure no-fallback/no-send mock');
})().catch(e=>{console.error('V18.5 BROWSER QA FAILURE',e);process.exitCode=1});
