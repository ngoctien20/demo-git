/* V16.11P.2 Chromium localhost-only acceptance. */
const {chromium}=require('../v169-security/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({headless:true});
 let checked=0;fs.mkdirSync('qa-artifacts-v1611p2',{recursive:true});
 try{
  for(const width of [320,390,768,1280]){
   const cx=await b.newContext({viewport:{width,height:900}});
   const page=await cx.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8080/'))external.push(r.url());});
   await page.goto('http://127.0.0.1:8080/qa/v1611p2-authority/index.html',{waitUntil:'load'});
   await page.waitForFunction(()=>document.getElementById('scope')?.textContent.includes('QA_STORE_A'));
   assert.match(await page.locator('#scope').innerText(),/QA_STORE_A/);checked++;
   assert.match(await page.locator('#release').innerText(),/NO_GO/);checked++;
   assert.equal(await page.locator('#quotes>div').count(),2);checked++;
   assert.match(await page.locator('#quotes').innerText(),/NOT QUERIED/);checked++;
   await page.locator('#draft').click();
   assert.match(await page.locator('#quoteResult').innerText(),/NOT_QUERIED_OR_VERIFIED/);checked++;
   assert.match(await page.locator('#quoteResult').innerText(),/authorized_to_call_provider": false/);checked++;
   await page.locator('#tryProvision').click();
   assert.match(await page.locator('#quoteResult').innerText(),/EXTERNAL_PRIVATE_HUMAN_AUTHORIZATION_REQUIRED/);checked++;
   await page.locator('#nominate').click();
   assert.match(await page.locator('#roleResult').innerText(),/QA_NOMINATION_ONLY/);checked++;
   await page.locator('#review').click();
   assert.match(await page.locator('#roleResult').innerText(),/QA_METADATA_REVIEWED_NOT_REAL_IDENTITY/);checked++;
   await page.locator('#draftApproval').click();
   assert.match(await page.locator('#approvalResult').innerText(),/DRAFT_UNSIGNED_NO_EFFECT/);checked++;
   assert.match(await page.locator('#approvalResult').innerText(),/"hosted_backup": false/);checked++;
   await page.locator('#store').selectOption('B');
   assert.match(await page.locator('#scope').innerText(),/QA_STORE_B/);checked++;
   assert.match(await page.locator('#roleList').innerText(),/UNASSIGNED/);checked++;
   await page.locator('#nominate').click();
   assert.match(await page.locator('#roleResult').innerText(),/NO_PLATFORM_REQUESTER_FOR_SHOP/);checked++;
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   assert(overflow<=2,'horizontal overflow at '+width+': '+overflow);checked++;
   assert.deepEqual(errors,[]);checked++;
   assert.deepEqual(external,[]);checked++;
   await page.screenshot({path:'qa-artifacts-v1611p2/one-action-'+width+'.png',fullPage:true});
   await cx.close();
  }
  console.log('V16.11P.2 BROWSER PASS '+checked+' checks at 320/390/768/1280 px; NO OUTBOUND');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
