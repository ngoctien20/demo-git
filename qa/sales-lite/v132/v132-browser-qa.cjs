'use strict';
// Browser evidence for a local static, no-credential, no-send V13.2 preview.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const host=process.env.QA_BASE_URL||'http://127.0.0.1:8080';
const viewports=[360,390,430,768,1280],errors=[];
function route(page,width,view){return page.locator(width<=860?'.mobile-nav button[data-view="'+view+'"]':'.sidebar button[data-view="'+view+'"]')}
async function overflow(page,context){const result=await page.evaluate(()=>({document:document.documentElement.scrollWidth,window:window.innerWidth}));assert.ok(result.document<=result.window+1,context+' overflows: '+JSON.stringify(result));}
async function checkStudio(browser,width){const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});const nonGet=[],pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))nonGet.push(r.method()+' '+r.url());});
await page.goto(host+'/qa/sales-lite/v132/studio/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('version')?.textContent==='1.1.0',{timeout:12000});
assert.equal((await page.locator('#totalActions').textContent()).trim(),'17');await overflow(page,'Studio overview '+width);
if(width===390){fs.mkdirSync('qa-artifacts',{recursive:true});await page.screenshot({path:'qa-artifacts/studio-390.png',fullPage:true});}
await route(page,width,'designer').click();await overflow(page,'Studio designer '+width);
await page.locator('#role').selectOption('OWNER');assert.match(await page.locator('#actionCounter').textContent(),/7 hành động/);
await page.locator('#role').selectOption('TIEN404_SUPPORT');assert.match(await page.locator('#actionCounter').textContent(),/4 hành động/);
await page.locator('#role').selectOption('CUSTOMER');assert.match(await page.locator('#actionCounter').textContent(),/6 hành động/);
await page.locator('#actions button.action').first().click();assert.equal(await page.locator('#actionId').getAttribute('readonly'),'');
await page.locator('#label').fill('Kiểm tra nhãn giao diện');await page.locator('#editor button[type="submit"]').click();
assert.match(await page.locator('#feedback').textContent(),/Đã sửa trong bản nháp/);
await route(page,width,'preview').click();await page.locator('#previewRole').selectOption('OWNER');assert.equal(await page.locator('#previewActions button').count(),7);
await page.locator('#previewRole').selectOption('CUSTOMER');await page.locator('#chatInput').fill('1');await page.locator('#chatForm button').click();
assert.match(await page.locator('#chat').textContent(),/Fixture QA F01/);
await route(page,width,'rich').click();await overflow(page,'Studio rich '+width);await page.locator('#richText').fill('Đơn 🛒 số 1');
await page.locator('#styleApply').click();const styles=await page.locator('#richPayload').textContent();assert.match(styles,/"len": 11/);
await route(page,width,'qa').click();await page.locator('#localQA').click();assert.match(await page.locator('#qaResult').textContent(),/PASS/);
assert.deepEqual(pageErrors,[],'Studio JS page error');assert.deepEqual(nonGet,[],'Studio unexpected writes');await page.close();}
async function checkPortal(browser,width){const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});const pageErrors=[],writes=[];
page.on('pageerror',e=>pageErrors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
await page.goto(host+'/qa/sales-lite/v132/account/',{waitUntil:'networkidle'});assert.match(await page.locator('[data-fill=shop]').first().textContent(),/Cửa hàng mẫu/);await overflow(page,'Portal overview '+width);
if(width===390)await page.screenshot({path:'qa-artifacts/account-390.png',fullPage:true});
await route(page,width,'account').click();await overflow(page,'Portal account '+width);
await route(page,width,'subscription').click();await overflow(page,'Portal subscription '+width);assert.ok(await page.locator('button:has-text("Gia hạn")').isDisabled());
await page.locator('#previewMode').selectOption('expired');assert.match(await page.locator('[data-fill=subscriptionStatus]').first().textContent(),/EXPIRED/);
await page.locator('#previewMode').selectOption('empty');assert.match(await page.locator('[data-fill=shop]').first().textContent(),/Chưa có dữ liệu/);
await page.locator('#previewMode').selectOption('error');assert.match(await page.locator('[data-fill=botStatus]').first().textContent(),/Không rõ trạng thái/);
await route(page,width,'bot').click();await overflow(page,'Portal bot '+width);assert.ok(await page.locator('button:has-text("Xem QR")').isDisabled());
await route(page,width,'support').click();await overflow(page,'Portal support '+width);
assert.deepEqual(pageErrors,[],'Portal JS page error');assert.deepEqual(writes,[],'Portal unexpected network writes');await page.close();}
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{for(const width of viewports){await checkStudio(browser,width);await checkPortal(browser,width);console.log('BROWSER QA PASS: Studio + Portal at '+width+'px');}console.log('BROWSER QA COMPLETE: 10 page/viewport runs, no unexpected writes.');}finally{await browser.close();}})().catch(e=>{console.error('BROWSER QA FAILED:',e);process.exitCode=1;});