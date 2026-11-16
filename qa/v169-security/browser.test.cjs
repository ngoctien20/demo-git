/* V16.9 local synthetic security UI Playwright QA. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({headless:true});let count=0;
 fs.mkdirSync('qa-artifacts-v169',{recursive:true});
 try{
  for(const width of [320,390,768,1280]){
   const context=await b.newContext({viewport:{width,height:900}});
   const page=await context.newPage(),errors=[],outbound=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8080/'))outbound.push(r.url())});
   await page.goto('http://127.0.0.1:8080/qa/v169-security/index.html',{waitUntil:'load'});
   await page.locator('#scope').waitFor({state:'visible'});
   assert.match(await page.locator('#scope').innerText(),/QA_STORE_A/);count++;
   assert.match(await page.locator('#releaseResult').innerText(),/NO-GO/);count++;
   await page.locator('#submitProof').click();
   assert.match(await page.locator('#evidenceResult').innerText(),/SUBMITTED_UNVERIFIED_METADATA/);count++;
   await page.locator('#reviewProof').click();
   assert.match(await page.locator('#evidenceResult').innerText(),/REVIEWED_METADATA_QA_ONLY/);count++;
   assert.match(await page.locator('#releaseResult').innerText(),/"hosted_certified": false/);count++;
   await page.locator('#startImport').click();
   assert.match(await page.locator('#importResult').innerText(),/QUARANTINED_METADATA_ONLY/);count++;
   await page.locator('#scanImport').click();
   assert.match(await page.locator('#importResult').innerText(),/QA_SCAN_SIMULATED/);count++;
   await page.locator('#previewImport').click();
   assert.match(await page.locator('#importResult').innerText(),/"preview_accepted": 1/);count++;
   await page.locator('#ownerApprove').click();
   assert.match(await page.locator('#importResult').innerText(),/OWNER_APPROVED_QA_ONLY/);count++;
   await page.locator('#reviewImport').click();
   assert.match(await page.locator('#importResult').innerText(),/METADATA_REVIEWED_OFFLINE_QA_ONLY/);count++;
   await page.locator('#attemptCommit').click();
   assert.match(await page.locator('#importResult').innerText(),/LIVE_CATALOG_COMMIT_FORBIDDEN/);count++;
   await page.locator('#shop').selectOption('B');
   assert.match(await page.locator('#scope').innerText(),/QA_STORE_B/);count++;
   assert.match(await page.locator('#releaseResult').innerText(),/"reviewed_qa_metadata": 0/);count++;
   assert(!/QUARANTINED_METADATA_ONLY/.test(await page.locator('#evidenceResult').innerText()));count++;
   const [scroll,client]=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
   assert(scroll<=client+2,'overflow '+width+' '+scroll+'/'+client);count++;
   assert.deepEqual(errors,[]);count++;
   assert.deepEqual(outbound,[]);count++;
   await page.screenshot({path:'qa-artifacts-v169/security-'+width+'.png',fullPage:true});
   await context.close();
  }
  process.stdout.write('V16.9 BROWSER PASS '+count+' checks at 320/390/768/1280 px, localhost only\n');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
