'use strict';
/** V14.2 synthetic-only Playwright QA. No provider, backend or Supabase calls. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const output='qa-artifacts-v142';fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true}),pages=[];
 try {
  for(const width of [320,360,390,430,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});pages.push(page);
   const external=[],errors=[];
   page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8080/'))external.push(r.url())});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8080/qa/shop-onboarding-v142/ui/index.html',{waitUntil:'load'});
   assert.equal(await page.locator('#store option').count(),3);
   assert.equal(await page.getByRole('button',{name:'Bắt đầu tạo hồ sơ nháp'}).count(),1);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert.ok(overflow<=2,'overflow at '+width+': '+overflow);
   assert.equal(errors.length,0,'JS errors '+errors.join(','));
   assert.equal(external.length,0,'unexpected remote request '+external.join(','));
   if(width===390||width===1280)await page.screenshot({path:output+'/onboarding-start-'+width+'.png',fullPage:true});
   console.log('responsive '+width+' PASS; overflow='+overflow);
  }
  const page=pages[2];
  await page.locator('#store').selectOption('B');
  await page.getByRole('button',{name:'Bắt đầu tạo hồ sơ nháp'}).click();
  assert.match(await page.locator('#scope').innerText(),/Shop B/);
  assert.match(await page.locator('#answerLabel').innerText(),/Tên cửa hàng/);
  const answer=async(v)=>{await page.locator('#answer').fill(v);await page.getByRole('button',{name:'Gửi câu trả lời'}).click()};
  await answer('Thời trang QA B');
  await answer('Thời trang');
  await page.getByRole('button',{name:'Chưa biết / bỏ qua'}).click();
  await answer('090123'); // expected invalid phone, no advance
  assert.match(await page.locator('#error').innerText(),/0xxxxxxxxx/);
  assert.match(await page.locator('#answerLabel').innerText(),/Số điện thoại/);
  await answer('0912345678');
  await answer('Địa chỉ QA B, không phải địa chỉ thật');
  await answer('09:00–21:00');
  await answer('Khu vực QA B');
  await answer('Giao hàng theo xác nhận nhân viên');
  await answer('Đổi size trong điều kiện được duyệt');
  await answer('COD, chuyển khoản');
  await answer('thân thiện');
  assert.equal(await page.locator('#review').isVisible(),true);
  assert.match(await page.locator('#missing').innerText(),/Năm thành lập/);
  await page.getByRole('button',{name:'Tạo bản nháp (cục bộ)'}).click();
  const x=JSON.parse(await page.locator('#jsonPreview').innerText());
  assert.equal(x.shop_fixture,'B');assert.equal(x.fields.shop_name,'Thời trang QA B');
  assert.equal(x.fields.founding_year,undefined);assert.equal(x.fields.public_phone,'0912345678');
  assert.equal(x.verified,false);assert.equal(x.published,false);
  assert.equal(x.database_writes,0);assert.equal(x.external_sends,0);assert.equal(x.ready_for_staff_review,true);
  await page.screenshot({path:output+'/onboarding-shop-b-review-390.png',fullPage:true});
  await page.reload({waitUntil:'load'});
  assert.equal(await page.locator('#startPanel').isVisible(),true);
  assert.equal(await page.locator('#interview').isVisible(),false);
  await page.locator('#store').selectOption('C');
  await page.getByRole('button',{name:'Bắt đầu tạo hồ sơ nháp'}).click();
  assert.match(await page.locator('#scope').innerText(),/Shop C/);
  assert.equal(await page.locator('#jsonPreview').innerText(),'');
  console.log('11-step conversation, bad phone, missing year, draft export, reload and shop switch PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
