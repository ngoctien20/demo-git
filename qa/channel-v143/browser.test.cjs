'use strict';
/* Visual QA of synthetic Staff Console and actual embeddable QA iframe.
 * No Meta, Supabase, OpenAI, n8n or other outbound network call.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root='http://127.0.0.1:8080';
const sizes=[360,390,430,768,1280];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of sizes){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errs=[],writes=[],outside=[];
   page.on('pageerror',e=>errs.push(e.message));
   page.on('request',r=>{
    if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url());
    if(!r.url().startsWith(root+'/'))outside.push(r.url());
   });
   await page.goto(root+'/qa/channel-v143/staff.html',{waitUntil:'networkidle'});
   assert.match(await page.title(),/V14\.3/);
   assert.equal(await page.locator('#shopname').textContent(),'Thời trang Bình');
   assert.equal(await page.locator('#carousel .card').count(),3);
   await page.locator('button[data-action="staff"]').click();
   assert.match(await page.locator('#actionlog').textContent(),/không gọi Meta/);
   await page.locator('#shop').selectOption('qa_shop_a');
   assert.equal(await page.locator('#shopname').textContent(),'Tạp hóa An');
   assert.match(await page.locator('#carousel').textContent(),/QA-A1/);
   assert.doesNotMatch(await page.locator('#carousel').textContent(),/QA-B1/);
   await page.locator('#tabWebsite').click();
   const host=page.frameLocator('#host');
   await host.locator('[data-tien404-qa-widget]').waitFor({state:'attached',timeout:15000});
   await page.locator('#host').scrollIntoViewIfNeeded();
   const inner=host.frameLocator('[data-tien404-qa-widget]');
   console.log('V143_FRAME_VISIBILITY',JSON.stringify(await inner.locator('#bubble').evaluate(el=>({hidden:el.hidden,display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,rect:{w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height},viewport:{w:innerWidth,h:innerHeight}}))));
   await inner.locator('#bubble').click({force:true,timeout:5000});
   assert.equal(await inner.locator('#panel').isVisible(),true);
   await inner.getByRole('button',{name:'Xem sản phẩm'}).click();
   assert.match(await inner.locator('#feed').textContent(),/QA-A01/);
   await inner.locator('#message').fill('Cho tôi xem hàng');
   await inner.locator('#form button[type="submit"]').click();
   assert.match(await inner.locator('#feed').textContent(),/Khách QA/);
   await inner.locator('#close').click();
   assert.equal(await inner.locator('#panel').isVisible(),false);
   await page.locator('#shop').selectOption('qa_shop_c');
   await page.waitForFunction(()=>document.getElementById('host')?.contentWindow?.location?.search==='?shop=qa_shop_c');
   await host.locator('[data-tien404-qa-widget]').waitFor({state:'attached',timeout:15000});
   const after=page.frameLocator('#host').frameLocator('[data-tien404-qa-widget]');
   await after.locator('#bubble').click({force:true,timeout:5000});
   assert.match(await after.locator('#shopname').textContent(),/Vật liệu Cường/);
   assert.deepEqual(errs,[]);
   assert.deepEqual(writes,[]);
   assert.deepEqual(outside,[]);
   const dimensions=await page.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]);
   assert.ok(dimensions[0]<=dimensions[1]+2,'horizontal overflow '+width+': '+dimensions);
   if(width===390){fs.mkdirSync('qa-artifacts-v143',{recursive:true});
    await page.screenshot({path:'qa-artifacts-v143/staff-channels-390.png',fullPage:true});
   }
   console.log('PASS V14.3 browser '+width+'px, no network writes');
   await page.close();
  }
  const p=await browser.newPage();
  await p.goto(root+'/qa/channel-v143/widget/host.html?shop=qa_shop_b',{waitUntil:'networkidle'});
  await p.locator('[data-tien404-qa-widget]').waitFor({state:'attached'});
  const iframe=p.frameLocator('[data-tien404-qa-widget]');
  await iframe.locator('#bubble').click();
  assert.match(await iframe.locator('#shopname').textContent(),/Thời trang Bình/);
  await iframe.getByRole('button',{name:'Hỏi giá'}).click();
  assert.match(await iframe.locator('#feed').textContent(),/Chưa có báo giá thực/);
  console.log('PASS V14.3 embed in existing-website QA host');
  await p.close();
 }finally{await browser.close()}
 console.log('PASS V14.3 browser suite: 5 responsive + embed, 0 external network writes');
})().catch(e=>{console.error('V14.3 BROWSER QA FAILED',e);process.exitCode=1});
