'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const host=process.env.QA_BASE_URL||'http://127.0.0.1:8080';
const target='https://tien404-auth-staging.onrender.com/login.html';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],outbound=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().startsWith('https://tien404-auth-staging.onrender.com/'))outbound.push(r.url())});
  await page.route(target,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="vi"><title>Supabase Auth QA stub</title><body>Trusted Auth target simulated in Chromium</body></html>'}));
  await page.goto(host+'/login.html',{waitUntil:'domcontentloaded'});
  await page.waitForURL(target,{timeout:12000});
  assert.equal(page.url(),target);
  assert.deepEqual(outbound,[target]);
  assert.deepEqual(errors,[]);
  assert.equal(await page.locator('text=Trusted Auth target simulated in Chromium').count(),1);
  console.log('PASS: fallback HTML routes to exact https Auth staging URL (provider page mocked; no real login).');
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
