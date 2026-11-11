/* V10.3 screenshot-safe browser QA. No forms submitted to backend, no Messenger sends. */
const { test, expect } = require('@playwright/test');

const pages=['index.html','solutions.html','demo.html','pricing.html','contact.html','login.html','dashboard.html'];
for(const pagePath of pages){
  for(const width of [390,768,1440]){
    test('V10.3 local '+pagePath+' @ '+width+'px',async({page})=>{
      await page.setViewportSize({width,height:850});
      const failures=[];
      page.on('pageerror',e=>failures.push(String(e.message).slice(0,160)));
      const result=await page.goto('/'+pagePath,{waitUntil:'domcontentloaded'});
      expect(result?.status()).toBe(200);
      await expect(page.locator('header .brand').first()).toBeVisible();
      const geometry=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport+3);
      expect(failures).toEqual([]);
    });
  }
}

test('V10.3 floating chat opens, closes on Escape, restores launcher focus',async({page})=>{
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  const launcher=page.locator('#tien404-chat-launcher'),panel=page.locator('#tien404-chat-panel');
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute('aria-expanded','false');
  await launcher.click();
  await expect(panel).toBeVisible();
  await expect(launcher).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(launcher).toHaveAttribute('aria-expanded','false');
  await expect(launcher).toBeFocused();
});

test('V10.3 mobile widget stays inside viewport',async({page})=>{
  await page.setViewportSize({width:360,height:740});
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#tien404-chat-launcher').click();
  const dims=await page.locator('#tien404-chat-panel').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:window.innerWidth,height:window.innerHeight}});
  expect(dims.left).toBeGreaterThanOrEqual(0);
  expect(dims.right).toBeLessThanOrEqual(dims.width+1);
  expect(dims.bottom).toBeLessThanOrEqual(dims.height+1);
  expect(dims.top).toBeGreaterThanOrEqual(0);
  await page.screenshot({path:'test-results/v10-3-chat-mobile.png'});
});

test('V10.3 theme inherits TIEN404 design tokens',async({page})=>{
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  const colors=await page.evaluate(()=>{
    const root=getComputedStyle(document.documentElement),widget=getComputedStyle(document.querySelector('.tien404-floating-widget'));
    return {violet:root.getPropertyValue('--violet').trim(),bg:root.getPropertyValue('--bg2').trim(),shadow:widget.getPropertyValue('--tien-chat-surface').trim(),present:!!document.querySelector('#tien404-chat-panel')};
  });
  expect(colors.violet).toBeTruthy();
  expect(colors.bg).toBeTruthy();
  expect(colors.present).toBe(true);
});

test('V10.3 staging public pages parity (read-only, no chat sent)',async({request})=>{
  const stage='https://tien404-ai-git-staging.pages.dev';
  const github='https://ngoctien20.github.io/demo-git';
  for(const route of ['','solutions.html','pricing.html','contact.html','login.html']){
    const a=await request.get(stage+'/'+route,{timeout:25000});
    const b=await request.get(github+'/'+route,{timeout:25000});
    expect(a.status(),stage+'/'+route).toBe(200);
    expect(b.status(),github+'/'+route).toBe(200);
    expect((await a.text()).includes('TIEN404 AI')).toBe(true);
    expect((await b.text()).includes('TIEN404 AI')).toBe(true);
  }
});


test('V10.3 Cloudflare immutable preview sends noindex and basic safety headers',async({request})=>{
  const response=await request.get('https://edf09e40.tien404-ai-git-staging.pages.dev/',{timeout:25000});
  expect(response.status()).toBe(200);
  const h=response.headers();
  expect(h['x-robots-tag']||'').toContain('noindex');
  expect(h['x-content-type-options']||'').toBe('nosniff');
  expect(h['x-frame-options']||'').toBe('DENY');
});
