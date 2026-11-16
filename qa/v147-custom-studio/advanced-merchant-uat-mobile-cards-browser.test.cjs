'use strict';
/** ADV5B: validate real mobile CARDS, NOT merely document overflow. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url='http://127.0.0.1:8080/qa/v147-custom-studio/advanced-custom-studio.html';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,360,375,390,412,600,601,768,1280]){
   const page=await browser.newPage({viewport:{width,height:820}});
   const errors=[],networkWrites=[],offsite=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',request=>{
    if(!request.url().startsWith('http://127.0.0.1:8080/'))offsite.push(request.url());
    if(!['GET','HEAD'].includes(request.method()))networkWrites.push(request.method());
   });
   await page.goto(url,{waitUntil:'networkidle'});
   const row=page.locator('#uatRows tr[data-uat-case="UAT03"]');
   assert.equal(await page.locator('#uatRows tr').count(),16);
   const display=await row.evaluate(el=>getComputedStyle(el).display);
   assert.equal(display,width<=600?'grid':'table-row','Responsive mode '+width);
   if(width<=600){
    const rect=await row.boundingBox();
    assert(rect,'UAT mobile row must be visible');
    assert(rect.x>=0,'card x must be nonnegative');
    assert(rect.x+rect.width<=width+1,'card must fit the viewport');
    assert(await row.locator('.uat-mobile-label:visible').count()>=3);
    for(const field of ['select','input']){
     const box=await row.locator(field).boundingBox();
     assert(box&&box.width>=120,'touch input width at '+width);
     assert(box.height>=44,'touch input height at '+width);
     assert(box.x>=0&&box.x+box.width<=width+1,'field not clipped at '+width);
    }
    const wrapper=await page.locator('.uat-scroll').evaluate(el=>({
     overflowX:getComputedStyle(el).overflowX,
     contentWidth:el.scrollWidth,
     visibleWidth:el.clientWidth
    }));
    assert(wrapper.contentWidth<=wrapper.visibleWidth+2,'No UAT horizontal table scrolling at '+width);
    assert.notEqual(wrapper.overflowX,'auto','Mobile does not require sideways scrolling');
   }
   const status=row.locator('select'),note=row.locator('input');
   await status.selectOption('FAIL');
   await note.fill('Thử nghiệm UAT điện thoại '+width+'px');
   await note.press('Tab');
   assert.match(await page.locator('#uatSummary').textContent(),/Chưa đạt: 1/);
   // Responsive resize cannot reset UAT state or separate mobile/desktop records.
   if(width<=600){
    await page.setViewportSize({width:768,height:820});
    assert.equal(await status.inputValue(),'FAIL');
    assert.equal(await note.inputValue(),'Thử nghiệm UAT điện thoại '+width+'px');
    assert.equal(await row.evaluate(el=>getComputedStyle(el).display),'table-row');
    await page.setViewportSize({width,height:820});
    assert.equal(await row.evaluate(el=>getComputedStyle(el).display),'grid');
   }
   await page.locator('#exportUat').click();
   const report=JSON.parse(await page.locator('#uatExportJson').inputValue());
   assert.equal(report.counts.FAIL,1);
   assert.equal(report.cases.find(x=>x.caseId==='UAT03').observation,'Thử nghiệm UAT điện thoại '+width+'px');
   assert.equal(report.claims.merchantIdentityIndependentlyVerified,false);
   assert.equal(report.claims.merchantUatApproved,false);
   assert.equal(report.claims.releaseAuthorized,false);
   assert.equal(await page.locator('#screen button:not([disabled])').count(),0);
   const bodyOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert(bodyOverflow<=2,'No document horizontal overflow at '+width);
   assert.deepEqual(errors,[]);
   assert.deepEqual(networkWrites,[]);
   assert.deepEqual(offsite,[]);
   if(width===320||width===390||width===412){
    fs.mkdirSync('qa-artifacts-v152-adv5b',{recursive:true});
    await page.screenshot({path:'qa-artifacts-v152-adv5b/uat-mobile-card-'+width+'.png',fullPage:true});
   }
   console.log('PASS ADV5B UAT CARD '+width+'px: mode '+display+', 16 rows, same state, no writes/sends');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
