'use strict';
// Browser QA only: package comparison in existing Merchant Portal, NO authenticated backend / no writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8080';
const sizes=[360,390,430,768,1280];
(async()=>{
 const browser=await chromium.launch({headless:true});
 let count=0;
 try{
  for(const width of sizes){
   const ctx=await browser.newContext({viewport:{width,height:840},locale:'vi-VN'});
   const page=await ctx.newPage();
   const writes=[];
   page.on('request',req=>{if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push(req.method()+' '+req.url())});
   await page.goto(base+'/qa/sales-lite/v133/account/',{waitUntil:'networkidle'});
   await page.getByRole('button',{name:/Thuê bao/}).first().click();
   await page.waitForFunction(()=>document.querySelector('#packagePreviewSelect')?.options?.length===3);
   const select=page.locator('#packagePreviewSelect');
   assert.equal(await select.inputValue(),'SALES_LITE');
   let text=await page.locator('#packagePreviewFeatures').innerText();
   assert.match(text,/Quản lý khách hàng/);
   assert.match(text,/Quản lý đơn/);
   assert.doesNotMatch(text,/Tạo bản nháp và xem trước menu/);
   await select.selectOption('SALES_PLUS');
   text=await page.locator('#packagePreviewFeatures').innerText();
   assert.match(text,/Tùy chỉnh lời chào/);
   assert.match(text,/Tạo bản nháp và xem trước menu/);
   assert.doesNotMatch(text,/Zalo OA theo hợp đồng/);
   await select.selectOption('SALES_ENTERPRISE');
   text=await page.locator('#packagePreviewFeatures').innerText();
   assert.match(text,/Zalo OA theo hợp đồng\/quyền API/);
   assert.match(text,/chỉ khi có hợp đồng và quyền provider/);
   const status=await page.locator('#packagePreviewStatus').innerText();
   assert.match(status,/KHÔNG CẤP QUYỀN/);
   const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
   assert.equal(horizontal,false,'Horizontal overflow at '+width);
   assert.deepEqual(writes,[], 'No actual writes may happen');
   await ctx.close();count++;
  }
  process.stdout.write('V13.4 Revised Merchant Portal research-rights Chromium QA: '+count+'/5 PASS; 0 mutation requests\\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
