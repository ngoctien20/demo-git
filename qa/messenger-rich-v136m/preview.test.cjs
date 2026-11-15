'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8080';
const widths=[360,390,430,768,1280];
(async()=>{
 const browser=await chromium.launch({headless:true});
 let total=0;
 try{
  for(const width of widths){
   const context=await browser.newContext({viewport:{width,height:860},locale:'vi-VN'});
   const page=await context.newPage();
   const badRequests=[],errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{
    if(!r.url().startsWith(base)||!['GET','HEAD'].includes(r.method()))
     badRequests.push(r.method()+' '+r.url());
   });
   await page.goto(base+'/qa/messenger-rich-v136m/preview.html',{waitUntil:'networkidle'});
   assert.match(await page.title(),/Messenger Rich UI Lab/);
   assert.match(await page.locator('body').innerText(),/OFFLINE/);
   const tabs=['cards','quick','menu','site'];
   for(const id of tabs){
    await page.locator('#tab-'+id).click();
    assert.equal(await page.locator('#tab-'+id).getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('#'+id).isVisible(),true);
    for(const other of tabs.filter(v=>v!==id))assert.equal(await page.locator('#'+other).isVisible(),false);
    const action=page.locator('#'+id+' [data-demo]').first();
    await action.click();
    assert.match(await page.locator('#output').innerText(),/PREVIEW ONLY/);
   }
   const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
   assert.equal(horizontal,false,'unexpected body horizontal overflow '+width);
   assert.deepEqual(badRequests,[],'No external/mutating network requests allowed');
   assert.deepEqual(errors,[]);
   const dir='qa-artifacts-messenger-rich';
   fs.mkdirSync(dir,{recursive:true});
   await page.screenshot({path:path.join(dir,'v136m-preview-'+width+'.png'),fullPage:true});
   await context.close();total++;
  }
  process.stdout.write('V13.6M Messenger Rich UI Lab Chromium '+total+'/5 viewports × 4 modules PASS; zero sends/mutations/external requests\n');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
