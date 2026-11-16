/* TIEN404 V16.11P local browser QA. Zero external requests, zero private evidence. */
const {chromium}=require('../v169-security/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ROOT='http://127.0.0.1:8080/qa/v1611p-private/index.html';
(async()=>{
 const browser=await chromium.launch({headless:true});
 let checks=0;fs.mkdirSync('qa-artifacts-v1611p',{recursive:true});
 try{
  for(const width of [320,390,768,1280]){
   const ctx=await browser.newContext({viewport:{width,height:900}});
   const page=await ctx.newPage(),errors=[],outbound=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8080/'))outbound.push(r.url());});
   await page.goto(ROOT,{waitUntil:'load'});
   await page.locator('#shopScope').waitFor({state:'visible'});
   assert.match(await page.locator('#shopScope').innerText(),/QA_STORE_A/);checks++;
   assert.match(await page.locator('#goResult').innerText(),/"decision": "NO_GO"/);checks++;
   assert.equal(await page.locator('#kind option').count(),18);checks++;
   await page.locator('#draft').click();
   assert.match(await page.locator('#requestResult').innerText(),/PRIVATE_OPERATOR_REQUEST_DRAFT/);checks++;
   assert.match(await page.locator('#requestResult').innerText(),/"allow_hosted_backup": false/);checks++;
   await page.locator('#tryBackup').click();
   assert.match(await page.locator('#requestResult').innerText(),/REAL_HOSTED_ACTION_REQUIRES_SEPARATE_EXTERNAL_AUTHORIZATION/);checks++;
   await page.locator('#ask').click();
   assert.match(await page.locator('#evidenceResult').innerText(),/EVIDENCE_REQUESTED_NO_UPLOAD/);checks++;
   await page.locator('#receive').click();
   assert.match(await page.locator('#evidenceResult').innerText(),/QA_METADATA_RECEIVED/);checks++;
   await page.locator('#review').click();
   assert.match(await page.locator('#evidenceResult').innerText(),/QA_METADATA_REVIEWED_ONLY/);checks++;
   assert.match(await page.locator('#goResult').innerText(),/"metadata_reviewed": 1/);checks++;
   assert.match(await page.locator('#goResult').innerText(),/"verified_external": 0/);checks++;
   await page.locator('#shop').selectOption('B');
   assert.match(await page.locator('#shopScope').innerText(),/QA_STORE_B/);checks++;
   assert.match(await page.locator('#goResult').innerText(),/"metadata_reviewed": 0/);checks++;
   await page.locator('#ask').click();
   assert.match(await page.locator('#evidenceResult').innerText(),/EVIDENCE_REQUESTED_NO_UPLOAD/);checks++;
   await page.locator('#receive').click();
   assert.match(await page.locator('#evidenceResult').innerText(),/NO_QA_OPERATOR_ASSIGNED_TO_THIS_STORE/);checks++;
   const [sw,cw]=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
   assert(sw<=cw+2,'Horizontal overflow '+width+': '+sw+'/'+cw);checks++;
   assert.deepEqual(errors,[]);checks++;
   assert.deepEqual(outbound,[]);checks++;
   await page.screenshot({path:'qa-artifacts-v1611p/private-operator-'+width+'.png',fullPage:true});
   await ctx.close();
  }
  process.stdout.write('V16.11P BROWSER PASS '+checks+' checks; 320/390/768/1280 px, NO SEND / NO OUTBOUND\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
