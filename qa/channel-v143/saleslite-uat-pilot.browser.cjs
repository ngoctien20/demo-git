'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root='http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [360,390,430,768,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const jsErrors=[],outbound=[],writes=[];
   page.on('pageerror',e=>jsErrors.push(e.message));
   page.on('request',r=>{
    if(!r.url().startsWith(root+'/'))outbound.push(r.url());
    if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());
   });
   await page.goto(root+'/qa/channel-v143/saleslite-uat-pilot.html');
   assert.equal(await page.locator('#chatTitle').innerText(),'AI Tạp hóa An');
   assert.match(await page.locator('#products').innerText(),/QA-A01/);
   await page.locator('[data-add="QA-A01"]').click();
   assert.match(await page.locator('#cartTotal').innerText(),/125\.000/);
   await page.locator('#checkoutBtn').click();
   assert.equal(await page.locator('#checkoutArea').isVisible(),true);
   await page.locator('#confirmBtn').click();
   assert.match(await page.locator('#feed').innerText(),/QA-A-001/);
   await page.locator('#ownerMode').click();
   assert.equal(await page.locator('#pendingCount').innerText(),'1');
   await page.locator('#shop').selectOption('b');
   await page.locator('#ownerMode').click();
   assert.equal(await page.locator('#pendingCount').innerText(),'0');
   assert.doesNotMatch(await page.locator('#orders').innerText(),/QA-A-001/);
   await page.locator('#shop').selectOption('a');
   await page.locator('#ownerMode').click();
   await page.locator('[data-done="QA-A-001"]').click();
   assert.equal(await page.locator('#pendingCount').innerText(),'0');
   assert.match(await page.locator('#revenue').innerText(),/125\.000/);
   await page.locator('#pauseBtn').click();
   await page.locator('#customerMode').click();
   assert.equal(await page.locator('[data-add="QA-A01"]').isDisabled(),true);
   await page.locator('#msg').fill('<img src=x onerror=alert(1)> shop khác');
   await page.locator('#form button').click();
   assert.equal(await page.locator('#feed img').count(),0);
   assert.deepEqual(jsErrors,[]);
   assert.deepEqual(outbound,[]);
   assert.deepEqual(writes,[]);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=2,'horizontal overflow width '+width+' px: '+overflow);
   if(width===390){fs.mkdirSync('qa-artifacts-saleslite',{recursive:true});
    await page.screenshot({path:'qa-artifacts-saleslite/saleslite-uat-390.png',fullPage:true});}
   console.log('PASS Sales Lite UAT '+width+'px — no network, no cross-shop data, order lifecycle');
   await page.close();
  }
  const p=await browser.newPage();
  await p.goto(root+'/qa/channel-v143/saleslite-uat-pilot.html');
  await p.locator('#shop').selectOption('b');
  await p.locator('#msg').fill('Tôi chốt với giá 1000đ');
  await p.locator('#form button').click();
  assert.match(await p.locator('#feed').innerText(),/không tự giảm giá/);
  await p.locator('#shop').selectOption('c');
  await p.locator('[data-add="QA-C01"]').click();
  await p.locator('#checkoutBtn').click();
  await p.locator('#confirmBtn').click();
  await p.locator('#ownerMode').click();
  assert.match(await p.locator('#orders').innerText(),/QA-C-001/);
  await p.locator('#reset').click();
  await p.locator('#ownerMode').click();
  assert.equal(await p.locator('#pendingCount').innerText(),'0');
  await p.close();
  console.log('PASS Sales Lite UAT: 5 responsive plus Shop C, invalid price and reset');
 }finally{await browser.close();}
})().catch(e=>{console.error('FAIL Sales Lite UAT',e);process.exitCode=1});
