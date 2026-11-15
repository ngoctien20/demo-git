'use strict';
/* Browser QA for self-contained, synthetic-only V14.1 Staff Knowledge Manager. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='http://127.0.0.1:8080/qa/shop-knowledge-v141/ui/index.html';
const output='qa-artifacts-v141';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const failures=[],pages=[],viewports=[360,390,430,768,1280];
 try{
  for(const width of viewports){
   const page=await browser.newPage({viewport:{width,height:800},deviceScaleFactor:1});
   pages.push(page);
   const err=[],external=[];
   page.on('pageerror',e=>err.push(e.message));
   page.on('request',req=>{if(!req.url().startsWith('http://127.0.0.1:8080/'))external.push(req.url())});
   await page.goto(base,{waitUntil:'load'});
   await page.getByRole('tab',{name:'Tổng quan'}).waitFor();
   assert.equal(await page.locator('#storeSelect option').count(),3);
   assert.equal(await page.getByRole('tab').count(),7);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert.ok(overflow<=2,'Horizontal overflow on '+width+': '+overflow);
   assert.equal(err.length,0,'JS errors at '+width+': '+err.join(','));
   assert.equal(external.length,0,'Unexpected remote requests: '+external.join(','));
   if(width===390||width===1280)await page.screenshot({path:output+'/knowledge-'+width+'.png',fullPage:true});
   console.log('viewport '+width+' PASS; overflow='+overflow);
  }
  const page=pages[1];
  await page.locator('#storeSelect').selectOption('A');
  await page.getByRole('tab',{name:'Hồ sơ'}).click();
  assert.match(await page.locator('#content').innerText(),/Tạp hóa Mẫu A/);
  await page.locator('#content form input').fill('Tên cửa hàng chưa duyệt - chỉ bản nháp');
  await page.getByRole('button',{name:'Lưu nháp (không công khai)'}).click();
  await page.getByRole('tab',{name:'Tổng quan'}).click();
  assert.equal((await page.locator('.stat').last().locator('strong').textContent()).trim(),'1');
  assert.match(await page.locator('#content').innerText(),/Tạp hóa Mẫu A/);
  assert.doesNotMatch(await page.locator('#content').innerText(),/Tên cửa hàng chưa duyệt/);
  await page.locator('#storeSelect').selectOption('B');
  assert.equal((await page.locator('.stat').last().locator('strong').textContent()).trim(),'0');
  assert.match(await page.locator('#content').innerText(),/Thời trang Mẫu B/);
  await page.getByRole('tab',{name:'Câu hỏi thường gặp'}).click();
  await page.locator('#content form input').fill('Shop B có đóng gói đặc biệt không?');
  await page.locator('#content form textarea').fill('Đề xuất QA chưa được phê duyệt');
  await page.getByRole('button',{name:'Lưu FAQ nháp'}).click();
  assert.match(await page.locator('#content').innerText(),/DRAFT · chỉ ở trình duyệt/);
  await page.getByRole('tab',{name:'Thử nghiệm AI'}).click();
  await page.locator('#content input').fill('Shop có giao hàng không?');
  await page.getByRole('button',{name:'Xem phản hồi mẫu'}).click();
  assert.match(await page.locator('#content .output').textContent(),/QA B/);
  await page.locator('#storeSelect').selectOption('C');
  await page.getByRole('tab',{name:'Thử nghiệm AI'}).click();
  await page.locator('#content input').fill('Shop có giao hàng không?');
  await page.getByRole('button',{name:'Xem phản hồi mẫu'}).click();
  assert.match(await page.locator('#content .output').textContent(),/công trình/);
  assert.doesNotMatch(await page.locator('#content .output').textContent(),/QA B/);
  await page.screenshot({path:output+'/shop-c-qa-390.png',fullPage:true});
  console.log('staff UI mock: shop switch, isolated drafts, FAQ, policies, no-send preview PASS');
 }catch(e){failures.push(e.stack||e.message);throw e}finally{
  await browser.close();
  if(failures.length)console.error(failures.join('\n'));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
