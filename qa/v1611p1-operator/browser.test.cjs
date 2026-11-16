/* TIEN404 V16.11P.1 browser QA: localhost-only, no payments/data. */
const {chromium}=require('../v169-security/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 let count=0;fs.mkdirSync('qa-artifacts-v1611p1',{recursive:true});
 try{
  for(const width of [320,390,768,1280]){
   const ctx=await browser.newContext({viewport:{width,height:900}});
   const page=await ctx.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8080/'))external.push(r.url());});
   await page.goto('http://127.0.0.1:8080/qa/v1611p1-operator/index.html',{waitUntil:'load'});
   await page.waitForFunction(()=>document.getElementById('scope')?.textContent.includes('QA_STORE_A'));
   assert.match(await page.locator('#scope').innerText(),/QA_STORE_A/);count++;
   assert.match(await page.locator('#gate').innerText(),/NO_GO/);count++;
   assert.equal(await page.locator('.qcard').count(),3);count++;
   assert.match(await page.locator('#quotes').innerText(),/0\.32256/);count++;
   await page.locator('#hours').selectOption('8');
   assert.match(await page.locator('#quotes').innerText(),/0\.10752/);count++;
   await page.locator('#draftQuote').click();
   assert.match(await page.locator('#quoteResult').innerText(),/QUOTE_REQUEST_DRAFT_UNSENT/);count++;
   assert.match(await page.locator('#quoteResult').innerText(),/allow_provision": false/);count++;
   await page.locator('#tryProvision').click();
   assert.match(await page.locator('#quoteResult').innerText(),/EXTERNAL_SIGNED_APPROVAL/);count++;
   await page.locator('#nominate').click();
   assert.match(await page.locator('#operatorResult').innerText(),/QA_PROPOSED_NOT_REAL_ASSIGNMENT/);count++;
   await page.locator('#review').click();
   assert.match(await page.locator('#operatorResult').innerText(),/QA_METADATA_REVIEWED_NO_REAL_PERSON_PROOF/);count++;
   await page.locator('#draftAuthorization').click();
   assert.match(await page.locator('#authorizationResult').innerText(),/WRITTEN_APPROVAL_DRAFT_UNSIGNED/);count++;
   assert.match(await page.locator('#authorizationResult').innerText(),/safe_to_restore": false/);count++;
   await page.locator('#shop').selectOption('B');
   assert.match(await page.locator('#scope').innerText(),/QA_STORE_B/);count++;
   assert.match(await page.locator('#roles').innerText(),/NOT_ASSIGNED/);count++;
   await page.locator('#nominate').click();
   assert.match(await page.locator('#operatorResult').innerText(),/NO_PLATFORM_REQUESTER_VERIFIED/);count++;
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   assert(overflow<=2,'horizontal overflow width '+width+' difference '+overflow);count++;
   assert.deepEqual(errors,[]);count++;
   assert.deepEqual(external,[]);count++;
   await page.screenshot({path:'qa-artifacts-v1611p1/quote-auth-'+width+'.png',fullPage:true});
   await ctx.close();
  }
  process.stdout.write('V16.11P.1 BROWSER PASS '+count+' checks / 320 390 768 1280 / ZERO EXTERNAL REQUESTS\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
