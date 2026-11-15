'use strict';
// V13.5R.1 Chromium: no user session; canonical redirect and deny-by-default.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8080';
const widths=[360,390,430,768,1280];
const fake=String.raw`export async function getAuthClient(){
 return {auth:{getUser:async()=>({data:{user:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
 from(){throw Error('No membership request should run before verified session')}}
}`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of widths){
    const context=await browser.newContext({viewport:{width,height:820},locale:'vi-VN'});
    const page=await context.newPage();
    const writes=[],outside=[],legacy=[],errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',req=>{
      const u=new URL(req.url());
      if(!['GET','HEAD'].includes(req.method()))writes.push(req.url());
      if(u.origin!==base)outside.push(req.url());
      if(u.pathname.endsWith('/assets/auth-account.js'))legacy.push(req.url());
    });
    await page.route('**/assets/auth-client.js',r=>r.fulfill({
      status:200,contentType:'text/javascript',body:fake
    }));
    await page.goto(base+'/account.html',{waitUntil:'networkidle'});
    await page.waitForURL(u=>u.pathname.endsWith('/merchant-portal.html'),{timeout:15000});
    await page.locator('#merchant-login').waitFor({state:'visible'});
    assert.equal(await page.locator('#merchant-protected').isHidden(),true);
    const url=new URL(page.url());
    assert.equal(url.search,'');assert.equal(url.hash,'');
    assert.deepEqual(writes,[]);assert.deepEqual(outside,[]);assert.deepEqual(legacy,[]);
    assert.deepEqual(errors,[]);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    assert.equal(overflow,false,'Horizontal overflow at '+width);
    await context.close();console.log('V13.5R.1 canonical Account redirect/locked PASS '+width+'px');
  }
  console.log('V13.5R.1 5/5 responsive PASS — Auth MOCK only, 0 writes, 0 legacy requests');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
