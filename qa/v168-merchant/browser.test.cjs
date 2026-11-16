/* V16.8 local Playwright smoke / NO production URLs / NO provider send.
 * QA-only Chromium package installed in its own folder by CI.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ROOT='http://127.0.0.1:8080/qa/v168-merchant/index.html';
(async()=>{
 const browser=await chromium.launch({headless:true});
 fs.mkdirSync('qa-artifacts-v168',{recursive:true});
 let cases=0;
 try{
  for(const width of [320,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
   const page=await context.newPage();
   const pageErrors=[],outbound=[];
   page.on('pageerror',e=>pageErrors.push(e.message));
   page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8080/'))outbound.push(r.url())});
   await page.goto(ROOT,{waitUntil:'load'});
   await page.locator('#scope').waitFor({state:'visible'});
   assert.match(await page.locator('#scope').innerText(),/QA_STORE_A/);cases++;
   await page.locator('[data-tab="import"]').click();
   await page.locator('#sample').click();
   assert.match(await page.locator('#importResult').innerText(),/"accepted": 1/);cases++;
   assert.match(await page.locator('#importRows').innerText(),/159\.000/);cases++;
   await page.locator('[data-tab="runtime"]').click();
   await page.locator('[data-text="xin gia ao thun"]').click();
   await page.waitForFunction(()=>document.querySelector('#runtimeResult').textContent.includes('INTEGRATED_SYNTHETIC_PREVIEW'));
   assert.match(await page.locator('#runtimeResult').innerText(),/"store_id": "QA_STORE_A"/);cases++;
   await page.locator('#shop').selectOption('B');
   assert.match(await page.locator('#scope').innerText(),/QA_STORE_B/);cases++;
   await page.locator('[data-text="xin gia ao thun"]').click();
   await page.waitForFunction(()=>document.querySelector('#runtimeResult').textContent.includes('INTEGRATED_SYNTHETIC_PREVIEW'));
   assert.match(await page.locator('#runtimeResult').innerText(),/"price_vnd": 209000/);cases++;
   await page.locator('#shop').selectOption('C');
   await page.locator('[data-text="toi muon dat hang"]').click();
   await page.waitForFunction(()=>document.querySelector('#runtimeResult').textContent.includes('COMMERCE_BLOCKED'));
   assert.match(await page.locator('#runtimeResult').innerText(),/COMMERCE_BLOCKED/);cases++;
   await page.locator('[data-tab="finance"]').click();
   await page.locator('#shops').selectOption('500');
   await page.locator('#calculate').click();
   assert.match(await page.locator('#finResults').innerText(),/500\.000/);cases++;
   await page.locator('[data-tab="profile"]').click();
   await page.locator('#shop').selectOption('A');
   await page.locator('#greeting').fill('Xin chào QA bản nháp');
   await page.locator('#saveDraft').click();
   assert.match(await page.locator('#draftResult').innerText(),/"status": "DRAFT"/);cases++;
   await page.locator('#approveDraft').click();
   assert.match(await page.locator('#draftResult').innerText(),/OWNER_APPROVED_PREVIEW_ONLY/);cases++;
   const [docW,bodyW]=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
   assert(docW<=bodyW+2,'horizontal overflow at '+width+': '+docW+' > '+bodyW);cases++;
   assert.deepEqual(pageErrors,[]);cases++;
   assert.deepEqual(outbound,[]);cases++;
   await page.screenshot({path:'qa-artifacts-v168/studio-'+width+'.png',fullPage:true});
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const p=await context.newPage();
  await p.goto(ROOT);
  await p.locator('[data-tab="import"]').click();
  await p.locator('#merchantFile').setInputFiles({name:'test.csv',mimeType:'text/csv',
   buffer:Buffer.from('fixture_marker,sku,product_name,retail_price_vnd,wholesale_price_vnd,stock,unit\nLIVE,A1,Khách thật,10,9,1,cái')});
  assert.match(await p.locator('#importResult').innerText(),/"rejected": 1/);cases++;
  assert.match(await p.locator('button:disabled').first().innerText(),/BLOCKED/);cases++;
  await p.locator('[data-tab="new"]').click();
  await p.locator('#newName').fill('QA_SHOP_MOI');
  await p.locator('#createProposal').click();
  assert.match(await p.locator('#newResult').innerText(),/WAIT_TRUSTED_ENROLLMENT/);cases++;
  await context.close();
  process.stdout.write('V16.8 BROWSER PASS '+cases+' checks; viewports 320/390/768/1280, localhost-only; screenshots saved\n');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
