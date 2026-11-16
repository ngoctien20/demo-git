'use strict';
/* ADV5 standalone artifact regression. Tests the exact downloadable HTML over
 * file:// with CSP SHA-256, no local web server and no network at all. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const file=path.resolve('qa-artifacts-v152-adv5-package/TIEN404_ADV5_Merchant_UAT_Offline.html');
const url=pathToFileURL(file).toString();
(async()=>{
 assert(fs.existsSync(file),'Standalone UAT HTML must be generated first');
 const html=fs.readFileSync(file,'utf8');
 assert.equal((html.match(/<script>/g)||[]).length,1);
 assert.match(html,/script-src 'sha256-[A-Za-z0-9+/=]+'/);
 assert.match(html,/connect-src 'none'/);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const exceptions=[],remote=[],writeMethods=[],cspViolations=[];
   page.on('pageerror',e=>exceptions.push(e.message));
   page.on('request',req=>{
    if(!req.url().startsWith('file://'))remote.push(req.url());
    if(!['GET','HEAD'].includes(req.method()))writeMethods.push(req.method());
   });
   page.on('console',message=>{
    if(message.type()==='error'&&/Content Security Policy/.test(message.text()))cspViolations.push(message.text());
   });
   await page.goto(url,{waitUntil:'load'});
   assert.equal(await page.locator('#uatRows tr').count(),16,'CSP-hashed inline script executed');
   assert.equal(await page.locator('#capabilityRows tr').count(),13);
   assert.match(await page.locator('#screen').textContent(),/159.000đ/);
   await page.locator('#uatRows tr[data-uat-case="UAT03"] select').selectOption('FAIL');
   await page.locator('#exportUat').click();
   const uat=JSON.parse(await page.locator('#uatExportJson').inputValue());
   assert.equal(uat.cases.length,16);
   assert.equal(uat.counts.FAIL,1);
   assert.equal(uat.claims.merchantUatApproved,false);
   assert.equal(uat.claims.releaseAuthorized,false);
   assert.equal(uat.technicalPreview.canSend,false);
   assert.equal(await page.locator('#screen button:not([disabled])').count(),0);
   assert.deepEqual(exceptions,[]);
   assert.deepEqual(remote,[]);
   assert.deepEqual(writeMethods,[]);
   assert.deepEqual(cspViolations,[]);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert(overflow<=2,'Standalone overflow at '+width+' px: '+overflow);
   if(width===390)await page.screenshot({path:'qa-artifacts-v152-adv5/standalone-uat-390.png',fullPage:true});
   console.log('PASS ADV5 FILE OFFLINE '+width+'px: CSP hash + 16 UAT + no network/write/certification');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
