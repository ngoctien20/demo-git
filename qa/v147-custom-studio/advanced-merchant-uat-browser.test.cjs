'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root='http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[],offsite=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',req=>{
    if(!req.url().startsWith(root+'/'))offsite.push(req.url());
    if(!['GET','HEAD'].includes(req.method()))writes.push(req.method());
   });
   await page.goto(root+'/qa/v147-custom-studio/advanced-custom-studio.html',{waitUntil:'networkidle'});
   assert.equal(await page.locator('#capabilityRows tr').count(),13,'Canonical crosswalk');
   assert.equal(await page.locator('#uatRows tr').count(),16,'16 UAT cases');
   assert.match(await page.locator('#uatSummary').textContent(),/0\/16/);
   assert.match(await page.locator('#uatReviewGate').textContent(),/CHƯA NGHIỆM THU/);
   const initial=await page.evaluate(()=>window.T404Adv5UatInspector.status());
   assert.equal(initial.counts.NOT_RUN,16);
   assert.equal(initial.independentMerchantAcceptance,false);
   const row=page.locator('#uatRows tr[data-uat-case="UAT03"]');
   await row.locator('select').selectOption('FAIL');
   await row.locator('input').fill('Giá hiện ra cần kiểm tra');
   await row.locator('input').press('Tab');
   assert.match(await page.locator('#uatSummary').textContent(),/Chưa đạt: 1/);
   await page.locator('#exportUat').click();
   let report=JSON.parse(await page.locator('#uatExportJson').inputValue());
   assert.equal(report.kind,'MERCHANT_SELF_REPORTED_NOT_VERIFIED');
   assert.equal(report.cases.length,16);
   assert.equal(report.counts.FAIL,1);
   assert.equal(report.claims.merchantUatApproved,false);
   assert.equal(report.claims.releaseAuthorized,false);
   assert.equal(report.technicalPreview.canSend,false);
   assert.equal(report.technicalPreview.canWriteOrders,false);
   await page.locator('#uatRows tr[data-uat-case="UAT03"] input')
    .fill('<img src=x onerror=alert(1)>');
   await page.locator('#uatRows tr[data-uat-case="UAT03"] input').press('Tab');
   assert.equal(await page.locator('img').count(),0,'Text notes not interpreted as markup');
   await page.locator('#resetUat').click();
   assert.match(await page.locator('#uatSummary').textContent(),/0\/16/);
   assert.equal(await page.locator('#uatRows tr[data-uat-case="UAT03"] select').inputValue(),'NOT_RUN');
   assert.equal(await page.locator('#uatExportJson').inputValue(),'');
   // User-declared all PASS still must not certify Owner or release.
   if(width===390){
    for(let i=1;i<=16;i++)
     await page.locator('#uatRows tr[data-uat-case="UAT'+String(i).padStart(2,'0')+'"] select').selectOption('PASS');
    await page.locator('#exportUat').click();
    report=JSON.parse(await page.locator('#uatExportJson').inputValue());
    assert.equal(report.counts.PASS,16);
    assert.equal(report.claims.merchantIdentityIndependentlyVerified,false);
    assert.equal(report.claims.merchantUatApproved,false);
    assert.equal(report.claims.platformReviewCompleted,false);
    assert.equal(report.claims.releaseAuthorized,false);
    fs.mkdirSync('qa-artifacts-v152-adv5',{recursive:true});
    await page.screenshot({path:'qa-artifacts-v152-adv5/advanced-merchant-uat-390.png',fullPage:true});
   }
   const inspect=await page.evaluate(()=>window.T404Adv4Inspector.status());
   assert.equal(inspect.canSend,false);
   assert.equal(inspect.canWriteOrders,false);
   assert.equal(inspect.realModelCalls,0);
   assert.deepEqual(errors,[],'No page exceptions');
   assert.deepEqual(offsite,[],'No offsite resource requests');
   assert.deepEqual(writes,[],'No HTTP write methods');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert(overflow<=2,'No page horizontal overflow at '+width+': '+overflow);
   console.log('PASS ADV.5 UAT browser '+width+'px: 16 cases, no leak/write/send/certification');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
