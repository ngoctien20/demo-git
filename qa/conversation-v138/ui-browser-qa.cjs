'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const url=process.env.QA_BASE_URL||'http://127.0.0.1:8080';
const widths=[360,390,430,768,1280];
async function tryAt(browser,width){
 const page=await browser.newPage({viewport:{width,height:900}});
 const errors=[],writes=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',req=>{
  if(!['GET','HEAD'].includes(req.method()))writes.push(req.method()+' '+req.url());
  if(!req.url().startsWith('http://127.0.0.1:8080/'))external.push(req.url());
 });
 await page.goto(url+'/qa/conversation-v138/ui/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#stateValue').textContent(),'AI_ACTIVE');
 assert.ok(await page.locator('#acceptBtn').isDisabled());
 await page.locator('#customerInput').fill('Mình muốn gặp nhân viên');
 await page.locator('#customerForm button[type=submit]').click();
 assert.equal(await page.locator('#stateValue').textContent(),'WAITING_STAFF');
 assert.equal(await page.locator('#acceptBtn').isEnabled(),true);
 await page.locator('#customerInput').fill('Hỏi thêm F01 được không?');
 await page.locator('#customerForm button[type=submit]').click();
 assert.equal(await page.locator('#stateValue').textContent(),'WAITING_STAFF');
 await page.locator('#acceptBtn').click();
 assert.equal(await page.locator('#stateValue').textContent(),'HUMAN_ACTIVE');
 assert.equal(await page.locator('#staffSendBtn').isEnabled(),true);
 await page.locator('#staffInput').fill('Chào bạn, em là nhân viên hỗ trợ Shop B.');
 await page.locator('#staffSendBtn').click();
 assert.match(await page.locator('#conversation').textContent(),/nhân viên hỗ trợ Shop B/);
 assert.match(await page.locator('#auditStatus').textContent(),/bản nháp phản hồi/);
 assert.match(await page.locator('#conversation').textContent(),/Chưa gửi Zalo/);
 await page.locator('#releaseBtn').click();
 assert.equal(await page.locator('#stateValue').textContent(),'AI_ACTIVE');
 await page.locator('[data-quick="Cho xem giá sản phẩm F01"]').click();
 assert.match(await page.locator('#conversation').textContent(),/Chưa có báo giá xác thực/);
 await page.locator('#pauseBtn').click();
 assert.match(await page.locator('#botStatus').textContent(),/tạm nghỉ/);
 await page.locator('[data-quick="Mình muốn mua F01"]').click();
 assert.match(await page.locator('#conversation').textContent(),/hoạt động trở lại/);
 await page.locator('#resumeBtn').click();
 assert.equal(await page.locator('#pauseBtn').isEnabled(),true);
 const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]);
 assert.ok(sizes[0]<=sizes[1]+1,'Horizontal overflow '+width+'px: '+sizes);
 assert.deepEqual(errors,[]);
 assert.deepEqual(writes,[]);
 assert.deepEqual(external,[]);
 if(width===390){
  fs.mkdirSync('qa-artifacts-v138',{recursive:true});
  await page.screenshot({path:'qa-artifacts-v138/customer-staff-390.png',fullPage:true});
 }
 await page.close();
 console.log('PASS V13.8 customer-staff handoff browser '+width+'px');
}
async function testClosure(browser){
 const page=await browser.newPage({viewport:{width:390,height:850}});
 await page.goto(url+'/qa/conversation-v138/ui/',{waitUntil:'networkidle'});
 await page.locator('[data-quick="Cho gặp nhân viên"]').click();
 await page.locator('#acceptBtn').click();
 await page.locator('#closeBtn').click();
 assert.equal(await page.locator('#stateValue').textContent(),'RESOLVED');
 assert.ok(await page.locator('#staffInput').isDisabled());
 await page.locator('#customerInput').fill('Xin chào');
 await page.locator('#customerForm button[type=submit]').click();
 assert.equal(await page.locator('#stateValue').textContent(),'AI_ACTIVE');
 await page.close();
 console.log('PASS V13.8 closure and customer reopen');
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const w of widths)await tryAt(browser,w);await testClosure(browser);
 console.log('V13.8 BROWSER QA: 5 responsive widths + 1 closure/reopen PASS; zero HTTP writes');}
 finally{await browser.close();}
})().catch(e=>{console.error('V13.8 BROWSER QA FAILURE',e);process.exitCode=1;});