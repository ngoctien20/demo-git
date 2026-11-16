'use strict';
/* Advanced Studio safe adapter browser smoke — localhost only; no provider network. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [360,1280]){
   const page=await browser.newPage({viewport:{width,height:880}});
   const errors=[],external=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{
     if(!r.url().startsWith(BASE+'/'))external.push(r.url());
     if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());
   });
   await page.goto(BASE+'/qa/v147-custom-studio/advanced-studio.html',{waitUntil:'load'});
   await page.waitForFunction(()=>Boolean(window.T404SafeChannelAdapter)&&
     document.getElementById('json').textContent.includes('adapterKind'));
   const initial=JSON.parse(await page.locator('#json').textContent());
   assert.equal(initial.adapterContract,'T404_SAFE_CHANNEL_PREVIEW_V1');
   assert.equal(initial.delivery.canSend,false);
   assert.equal(initial.delivery.providerPayload,null);
   assert.equal(initial.delivery.recipient,null);
   assert.equal(initial.delivery.credential,null);
   assert.equal(await page.locator('#publish').isDisabled(),true);
   await page.locator('#channel').selectOption('ZALO_OA');
   await page.locator('#component').selectOption('ZBS_TEMPLATE');
   const oa=JSON.parse(await page.locator('#json').textContent());
   assert.equal(oa.adapterKind,'ZALO_OA_TEXT_FALLBACK_PREVIEW');
   assert.equal(oa.safeMessagePreview.zbsTemplate,null);
   assert.equal(oa.safeMessagePreview.spendApproved,false);
   await page.locator('#channel').selectOption('MESSENGER');
   await page.locator('#intent').selectOption('DISCOVER');
   const m=JSON.parse(await page.locator('#json').textContent());
   assert.equal(m.adapterKind,'MESSENGER_GENERIC_TEMPLATE_PREVIEW');
   assert.equal(m.safeMessagePreview.presentation.elements[0].image_url,null);
   assert.deepEqual(m.safeMessagePreview.presentation.elements[0].buttons,[]);
   await page.locator('#channel').selectOption('ZALO_BOT');
   await page.locator('#intent').selectOption('LOW_STOCK');
   const z=JSON.parse(await page.locator('#json').textContent());
   assert(z.adapterKind.startsWith('ZALO_BOT_'));
   assert.equal(z.delivery.canSend,false);
   await page.locator('#channel').selectOption('WEB_WIDGET');
   await page.locator('#intent').selectOption('QUOTE');
   const w=JSON.parse(await page.locator('#json').textContent());
   assert.equal(w.adapterKind,'WEB_WIDGET_SAFE_VIEW');
   assert.equal(w.safeMessagePreview.externalUrl,null);
   assert.equal(w.safeMessagePreview.htmlAllowed,false);
   assert.deepEqual(errors,[]);
   assert.deepEqual(external,[]);
   assert.deepEqual(writes,[]);
   console.log('PASS ADV5 browser '+width+' px no-send channel preview');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('ADV5 SAFE BROWSER QA FAILED',e);process.exitCode=1});
