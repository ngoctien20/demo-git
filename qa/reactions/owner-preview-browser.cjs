// V21.3 Owner App Page reaction preview browser acceptance.
// Completely mocked Supabase Auth + data; no credentials, no remote writes or Meta requests.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const uid='d0000000-0000-4000-8000-0000000000e1';
const storeId='s0000000-0000-4000-8000-000000000001';
const tenantId='t0000000-0000-4000-8000-000000000001';
const session={ access_token:'x.'+Buffer.from(JSON.stringify({sub:uid,exp:9999999999})).toString('base64url')+'.y',
  token_type:'bearer',expires_in:3600,expires_at:9999999999,refresh_token:'r',
  user:{id:uid,email:'qa-owner@example.invalid',aud:'authenticated',role:'authenticated'} };
const fixtures={
  store_memberships:[{store_id:storeId,tenant_id:tenantId,role:'owner',active:true}],
  stores:[{id:storeId,tenant_id:tenantId,name:'Shop QA',is_default:true}],
  tenants:[{id:tenantId,name:'Shop QA'}],
  channel_connections:[
    {id:'conn-owner-qa',tenant_id:tenantId,store_id:storeId,channel:'messenger',status:'active',environment:'demo',display_name:'Fanpage QA A'},
    {id:'conn-shop-b',tenant_id:'tenant-other',store_id:'store-other',channel:'messenger',status:'active',environment:'demo',display_name:'Fanpage Shop B'},
  ],
};
const errors=[];
const requests=[];
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  const name=path.resolve(root,'.'+pathname);
  if(!name.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  if(!fs.existsSync(name)){res.writeHead(404);return res.end();}
  const resolved=fs.statSync(name).isDirectory()?path.join(name,'index.html'):name;
  if(!fs.existsSync(resolved)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':mime[path.extname(resolved)]||'application/octet-stream'});
  res.end(fs.readFileSync(resolved));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/app/#/bieu-cam-fanpage';
  const browser=await chromium.launch();
  let passed=0;
  const check=(condition,name)=>{if(!condition)throw Error('FAIL '+name);passed++;console.log('PASS '+name)};
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}});
    await context.addInitScript(([key,value])=>localStorage.setItem(key,value),
      ['sb-ifxlvrhyjhbzbrkdsida-auth-token',JSON.stringify(session)]);
    await context.route(/supabase\.co\//,route=>{
      const u=new URL(route.request().url());
      requests.push({url:u.pathname,method:route.request().method(),query:u.search});
      if(u.pathname.startsWith('/auth/v1/'))
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:session.user})});
      const match=u.pathname.match(/\/rest\/v1\/(\w+)/);
      const key=match?.[1]||'';
      let rows=fixtures[key]||[];
      for(const [k,v] of u.searchParams)
        if(v.startsWith('eq.')&&rows.length&&Object.hasOwn(rows[0],k))
          rows=rows.filter(x=>String(x[k])===v.slice(3));
      const single=(route.request().headers().accept||'').includes('vnd.pgrst.object');
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(single?(rows[0]||null):rows)});
    });
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
    await page.goto(base);
    await page.getByRole('heading',{name:'Biểu cảm Fanpage'}).waitFor();
    const prefix='width'+width+' ';
    const picker=page.getByRole('combobox',{name:'Chọn kết nối Messenger (chỉ xem)'});
    await picker.waitFor();
    check((await picker.locator('option').allTextContents()).length===1,prefix+'only current store connection visible');
    check((await picker.locator('option').first().innerText())==='Fanpage QA A',prefix+'owned Page label from scoped registry');
    check(await page.getByText(/Chưa có bằng chứng Meta Page Installation/).count()===1,prefix+'connected does not mean Meta-verified');
    check((await page.getByText('Bản xem trước — chưa phát hành.').count())===1,prefix+'explicit preview-only badge');
    const toggle=page.getByRole('switch',{name:'Bật reaction trong mô phỏng'});
    check(await toggle.getAttribute('aria-checked')==='false',prefix+'default OFF');
    await toggle.click();
    check(await page.getByLabel('Đề xuất biểu cảm ❤️').count()===1,prefix+'retail thanks candidate');
    await page.locator('#reaction-industry').selectOption('legal');
    check(await toggle.isDisabled(),prefix+'law Page cannot enable');
    check(await page.getByLabel('Đề xuất biểu cảm ❤️').count()===0,prefix+'law has no reaction');
    check(await page.locator('input[value="expressive"]').isDisabled(),prefix+'law expressive forbidden');
    await page.locator('#reaction-industry').selectOption('artist');
    check(await toggle.getAttribute('aria-checked')==='false',prefix+'switch reset when changing Page type');
    await toggle.click();
    await page.getByRole('button',{name:'Đỉnh quá!'}).click();
    check(await page.getByLabel('Đề xuất biểu cảm 👍').count()===1,prefix+'artist social praise');
    await page.getByRole('button',{name:'Cảm ơn shop, giá bao nhiêu?'}).click();
    check(await page.getByLabel('Đề xuất biểu cảm 👍').count()===0,prefix+'commerce question not a reaction');
    await page.locator('#reaction-industry').selectOption('wholesale');
    check(await page.locator('input[value="expressive"]').isDisabled(),prefix+'wholesale expressive forbidden');
    check(await toggle.getAttribute('aria-checked')==='false',prefix+'wholesale starts OFF');
    await toggle.click();
    await page.getByRole('button',{name:'Shop dễ thương quá!'}).click();
    check(await page.getByLabel('Đề xuất biểu cảm 👍').count()===0,prefix+'wholesale praise excluded');
    await page.getByRole('button',{name:'Cảm ơn shop nhé!'}).click();
    check(await page.getByLabel('Đề xuất biểu cảm ❤️').count()===1,prefix+'wholesale thanks allowed in mock');
    await page.reload();
    await page.getByRole('heading',{name:'Biểu cảm Fanpage'}).waitFor();
    check(await page.getByRole('switch',{name:'Bật reaction trong mô phỏng'}).getAttribute('aria-checked')==='false',prefix+'reload still OFF');
    check(!(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)),prefix+'no horizontal overflow');
    if(process.env.SHOTS_DIR){
      fs.mkdirSync(process.env.SHOTS_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.SHOTS_DIR,'reaction_owner_'+width+'.png'),fullPage:true});
    }
    await context.close();
  }
  const channelReads=requests.filter(r=>r.url.endsWith('/channel_connections'));
  check(channelReads.length>=4 && channelReads.every(r => {
    const p=new URLSearchParams(r.query);
    return p.get('store_id')==='eq.'+storeId && p.get('tenant_id')==='eq.'+tenantId && p.get('channel')==='eq.messenger';
  }), 'read-only channel connections always tenant/store/channel scoped');
  check(requests.every(r=>['GET','HEAD'].includes(r.method)), 'no backend mutation');
  check(requests.every(r=>!r.url.includes('reaction')&&(!r.url.includes('rpc/')||(r.url.endsWith('rpc/platform_catalog')&&r.method==='GET'))), 'no policy send or publish endpoint');
  check(errors.length===0,'no browser console/page errors');
  console.log('T404_REACTION_OWNER_UI_PASS '+passed+' assertions (mocked Supabase, no send)');
  await browser.close();
  server.close();
})().catch(e=>{console.error(e.stack||e);server.close();process.exit(1)});
