'use strict';
// Chromium QA for simulated Auth only. This is NOT hosted Supabase RLS or real Access validation.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8080';
const fakeAuth=String.raw`export async function getAuthClient(){
 const user={id:'user-qa-0001',email:'qa-owner@example.test',user_metadata:{full_name:'Người kiểm thử'}};
 return {
 auth:{getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
 signOut:async()=>({error:null})},
 from(table){return {
 select(){return this;},eq(){return this;},in(){return this;},order(){return this;},
 limit(){return Promise.resolve(table==='orders'?{data:[{id:'30000000-0000-4000-8000-000000000003',tenant_id:'10000000-0000-4000-8000-000000000001',status:'pending',total_vnd:159000,created_at:'2026-11-15T06:00:00Z'}],error:null}:table==='tenant_memberships'
 ? {data:[{tenant_id:'10000000-0000-4000-8000-000000000001',user_id:user.id,active:true,role:'owner'}],error:null}
 :{data:[{id:'10000000-0000-4000-8000-000000000001',name:'Shop A QA'}],error:null});}
 };}};
}`;
const widths=[360,390,430,768,1280];
async function run(browser,width){
 const p=await browser.newPage({viewport:{width,height:850}}),errors=[],writes=[];
 p.on('pageerror',e=>errors.push(e.message));
 p.on('request',req=>{if(!['GET','HEAD'].includes(req.method()))writes.push(req.method()+' '+req.url());});
 await p.route('**/assets/auth-client.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:fakeAuth}));
 await p.goto(base+'/merchant-portal.html',{waitUntil:'networkidle'});
 await p.waitForFunction(()=>document.getElementById('merchant-protected')?.hidden===false,{timeout:12000});
 const ids=await p.locator('#merchant-nav button[data-panel]').evaluateAll(els=>els.map(x=>x.dataset.panel));
 assert.deepEqual(ids,['overview','orders','profile','subscription','billing','support']);
 const body=await p.locator('body').innerText();
 assert.doesNotMatch(body,/Sản phẩm & tồn kho|Khách hàng & lịch sử mua|AI Bot & kênh bán|Đơn chờ xử lý/);
 assert.match(body,/Shop A QA/);
 const scroll=await p.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(scroll.doc<=scroll.viewport+1,'overflow '+JSON.stringify(scroll));
 await p.locator('#merchant-nav button[data-panel="orders"]').click();
 await p.getByText('Mã đơn: 30000000-0000-4000-8000-000000000003').waitFor();
 assert.match(await p.locator('#merchant-panel').innerText(),/Tổng giá trị đơn: 159.000/);
 assert.match(await p.locator('#merchant-panel').innerText(),/chưa đối soát|không phải xác minh giao dịch/i);
 assert.ok(await p.locator('button:has-text("Xác nhận / thay đổi trạng thái đơn")').isDisabled());
 await p.locator('#merchant-nav button[data-panel="profile"]').click();
 assert.match(await p.locator('#merchant-panel').innerText(),/qa-owner@example.test/);
 assert.ok(await p.locator('button:has-text("Chỉnh sửa thông tin cá nhân")').isDisabled());
 await p.locator('#merchant-nav button[data-panel="subscription"]').click();
 assert.match(await p.locator('#merchant-panel').innerText(),/Chưa kết nối nguồn xác minh Subscription/);
 await p.locator('#merchant-nav button[data-panel="billing"]').click();
 assert.ok(await p.locator('button:has-text("Thay đổi thông tin thanh toán")').isDisabled());
 assert.match(await p.locator('#merchant-panel').innerText(),/Chưa có nguồn thanh toán đã xác minh/);
 await p.locator('#merchant-nav button[data-panel="support"]').click();
 assert.match(await p.locator('#merchant-panel').innerText(),/nhân sự TIEN404/i);
 if(width===390){fs.mkdirSync('qa-artifacts-account',{recursive:true});await p.screenshot({path:'qa-artifacts-account/shop-account-only-390.png',fullPage:true});}
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 await p.close();console.log('Account-only browser PASS '+width+'px');
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const width of widths)await run(browser,width);console.log('Browser PASS 5/5; mocked Auth only, no writes');}
 finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
