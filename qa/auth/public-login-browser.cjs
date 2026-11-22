'use strict';
// V23: /login.html must land on the owner App login screen on the same origin, with no call to the
// retired Render auth host and without contacting Supabase (no session yet).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const host=process.env.QA_BASE_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],outbound=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{const u=new URL(r.url());if(u.origin!==new URL(host).origin)outbound.push(r.url())});
  await page.goto(host+'/login.html',{waitUntil:'domcontentloaded'});
  await page.waitForURL(u=>u.toString().endsWith('/app/#/dang-nhap'),{timeout:12000});
  await page.getByRole('heading',{name:'Đăng nhập'}).waitFor({timeout:8000});
  assert.equal(await page.locator('input[type="password"]').count(),1);
  assert.ok(!outbound.some(u=>u.includes('onrender.com')),outbound.join(','));
  assert.deepEqual(errors,[]);
  console.log('PASS: /login.html → same-origin owner App login (no external auth host contacted). Outbound:',outbound.length);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
