const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const base = 'http://127.0.0.1:4173';
const live = 'https://ngoctien20.github.io/demo-git/';
const routes = [
  'index.html','about.html','solutions.html','demo.html','pricing.html','contact.html','faq.html',
  'industries.html','industry-fashion.html','industry-beauty.html','industry-accessories.html',
  'industry-ecommerce.html','industry-services.html','privacy.html','terms.html','refund.html',
  '404.html','login.html','register.html','dashboard.html','checkout.html','billing.html',
  'invoice.html','onboarding.html','lab.html','impact.html'
];

for (const route of routes) {
  for (const width of [1440,390]) {
    test('Route: ' + route + ' @ ' + width + 'px responds and fits viewport', async ({ page }) => {
      await page.setViewportSize({width, height:860});
      const response=await page.goto('/'+route,{waitUntil:'domcontentloaded'});
      expect(response,'HTTP response for '+route).toBeTruthy();
      expect(response.status(),'HTTP status for '+route).toBe(200);
      await expect(page.locator('header .brand').first()).toBeVisible();
      const geometry=await page.evaluate(()=>({screen:window.innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      expect(geometry.scroll,'overflow on '+route+ ' width '+width).toBeLessThanOrEqual(geometry.screen+2);
    });
  }
}

test('320px narrow screens on important flows',async ({page})=>{
  await page.setViewportSize({width:320,height:740});
  for(const path of ['index.html','demo.html','lab.html','register.html','checkout.html','onboarding.html','impact.html']){
    await page.goto('/'+path,{waitUntil:'domcontentloaded'});
    const metrics=await page.evaluate(()=>({width:window.innerWidth,overflow:document.documentElement.scrollWidth}));
    expect(metrics.overflow,'overflow at 320px: '+path).toBeLessThanOrEqual(322);
  }
});
test('Mobile menu opens, closes and navigates',async({page})=>{
  await page.setViewportSize({width:390,height:800});
  await page.goto('/index.html');
  const button=page.locator('#nav-toggle');
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded','true');
  await page.locator('#main-menu a[href="solutions.html"]').first().click();
  await expect(page).toHaveURL(/solutions.html/);
});

test('Registration validation and onboarding demo',async({page})=>{
  await page.goto('/register.html');
  await page.locator('#name').fill('A');
  await page.locator('#email').fill('not-an-email');
  await page.locator('#saas-auth button[type="submit"]').click();
  await expect(page.locator('[data-saas-output]')).toContainText(/email/);
  await page.locator('#name').fill('Shop Kiwi QA');
  await page.locator('#email').fill('qa+register@example.test');
  await page.locator('#saas-auth button[type="submit"]').click();
  await expect(page).toHaveURL(/dashboard.html/);
  await expect(page.locator('body')).toContainText('Shop Kiwi QA');
});

test('Unauthorized invoice redirects to login',async({page})=>{
  await page.goto('/invoice.html');
  await expect(page).toHaveURL(/login.html/);
});

test('Deep-linked protected page restores destination after login',async({page})=>{
  await page.goto('/invoice.html');
  await expect(page).toHaveURL(/login.html\?next=invoice.html/);
  await page.locator('#email').fill('qa+deep@example.test');
  await page.locator('#saas-auth button[type="submit"]').click();
  await expect.poll(async()=>new URL(page.url()).pathname,{timeout:6000}).toMatch(/\/invoice\.html$/);
});


test('Deep-linked billing returns to billing after login',async({page})=>{
  await page.goto('/billing.html');
  await expect(page).toHaveURL(/login.html\?next=billing.html/);
  await page.locator('#email').fill('qa+billing@example.test');
  await page.locator('#saas-auth button[type=submit]').click();
  await expect(page).toHaveURL(/\/billing.html$/);
});

for(const unsafe of ['https://example.test/', '//example.test/', '../about.html', '%2F%2Fexample.test', 'invoice.html?bad=1']) {
  test('Login ignores unsafe post-auth redirect: '+unsafe,async({page})=>{
    await page.goto('/login.html?next='+encodeURIComponent(unsafe));
    await page.locator('#email').fill('qa+redirect@example.test');
    await page.locator('#saas-auth button[type=submit]').click();
    await expect(page).toHaveURL(/\/dashboard.html$/);
    expect(page.url()).not.toContain('example.test/');
  });
}

test('Sign-out purges demo invoice/subscription so another visitor cannot see them',async({page})=>{
  await page.goto('/login.html');
  await page.locator('#email').fill('first-qa@example.test');
  await page.locator('#saas-auth button[type=submit]').click();
  await expect(page).toHaveURL(/dashboard.html$/);
  await page.goto('/checkout.html?plan=business');
  await page.locator('#checkout-name').fill('First Account');
  await page.locator('[name=terms]').check();
  await page.locator('#checkout-form button[type=submit]').click();
  await expect(page).toHaveURL(/invoice.html$/);
  await expect(page.locator('#invoice-plan')).toContainText('AI Business');
  await page.goto('/dashboard.html');
  await page.locator('#sign-out').click();
  await expect(page).toHaveURL(/login.html$/);
  await page.locator('#email').fill('second-qa@example.test');
  await page.locator('#saas-auth button[type=submit]').click();
  await expect(page).toHaveURL(/dashboard.html$/);
  await page.goto('/invoice.html');
  await expect(page.locator('#invoice-plan')).toContainText('Chưa chọn gói');
  await expect(page.locator('#invoice-id')).toContainText('Chưa có hóa đơn demo');
});

test('Checkout is simulation and invoice/billing state works',async({page})=>{
  await page.goto('/login.html');
  await page.locator('#email').fill('qa+checkout@example.test');
  await page.locator('#saas-auth button[type="submit"]').click();
  await expect(page).toHaveURL(/dashboard.html/);
  await page.goto('/checkout.html?plan=business');
  await expect(page.locator('#checkout-plan')).toContainText('AI Business');
  await page.locator('#checkout-name').fill('Shop QA');
  await page.locator('input[name="terms"]').check();
  await page.locator('#checkout-form button[type="submit"]').click();
  await expect(page).toHaveURL(/invoice.html/);
  await expect(page.locator('#invoice-plan')).toContainText('AI Business');
  await expect(page.locator('#invoice-id')).toContainText('DEMO-');
  await expect(page.locator('body')).toContainText(/0\s*VND|0\s*₫/);
  await page.goto('/billing.html');
  await expect(page.locator('body')).toContainText('AI Business');
  await page.locator('#cancel-demo').click();
  await expect(page.locator('body')).toContainText('Chưa chọn gói');
});

test('Dashboard analytics filter switches sample series',async({page})=>{
  await page.goto('/login.html');
  await page.locator('#email').fill('qa+dashboard@example.test');
  await page.locator('#saas-auth button[type="submit"]').click();
  await expect(page).toHaveURL(/dashboard.html/);
  await expect(page.locator('#v4-dash-bars .v4-chart-bar')).toHaveCount(7);
  await page.locator('[data-v4-period="month"]').click();
  await expect(page.locator('#v4-dash-bars .v4-chart-bar')).toHaveCount(15);
  await expect(page.locator('#v4-dash-queue .v4-queue-row')).toHaveCount(3);
});

test('Wizard blocks next without selection and opens filtered lab',async({page})=>{
  await page.goto('/onboarding.html');
  await expect(page.locator('#v4-step-count')).toContainText('01');
  await page.locator('#v4-next').click();
  await expect(page.locator('#v4-step-count')).toContainText('01');
  for(const step of [1,2,3]) {
    await page.locator('#v4-wizard-stage .v4-choice').first().click();
    await page.locator('#v4-next').click();
    await expect(page.locator('#v4-step-count')).toContainText('0'+(step+1));
  }
  await expect(page.locator('#v4-wizard-stage')).toContainText('Đây là kịch bản');
  await page.locator('#v4-next').click();
  await expect(page).toHaveURL(/lab.html\?industry=fashion&channel=facebook&pain=faq/);
});

test('AI Sales Lab catalogue add, duplicate rejection and reset',async({page})=>{
  await page.goto('/lab.html?industry=fashion');
  await expect(page.locator('#v4-products-count')).toContainText('4 sản phẩm');
  const form=page.locator('#v4-product-form');
  await form.locator('[name=name]').fill('Áo denim xanh');
  await form.locator('[name=sku]').fill('QA001');
  await form.locator('[name=price]').fill('123000');
  await form.locator('[name=stock]').fill('5');
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#v4-products-count')).toContainText('5 sản phẩm');
  await form.locator('[name=name]').fill('Áo trùng SKU');
  await form.locator('[name=sku]').fill('QA001');
  await form.locator('[name=price]').fill('122000');
  await form.locator('[name=stock]').fill('3');
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#v4-product-error')).toContainText(/SKU không trùng/);
  await page.locator('#v4-reset-products').click();
  await expect(page.locator('#v4-products-count')).toContainText('4 sản phẩm');
});

test('Lab local simulation handles buying without real order writes',async({page})=>{
  await page.goto('/lab.html');
  await expect(page.locator('input[name="v4-mode"][value="ai"]')).toBeDisabled();
  await page.locator('#v4-chat-input').fill('Tôi muốn mua 2 áo thun đen size L mã A001');
  await page.locator('#v4-chat-form button[type=submit]').click();
  await expect(page.locator('#v4-chat-messages')).toContainText('YÊU CẦU MUA GIẢ LẬP');
  await expect(page.locator('#v4-chat-messages')).toContainText('318.000');
  await page.locator('#v4-chat-clear').click();
  await expect(page.locator('#v4-chat-remaining')).toContainText('20 lượt thử');
});

test('Impact calculator updates and recomputes from sliders',async({page})=>{
  await page.goto('/impact.html');
  for(const [id,val] of [['messages','1200'],['minutes','5'],['repeat','50'],['hourly','50000']]){
    await page.locator('#v4-'+id).evaluate((el,value)=>{
      el.value=value; el.dispatchEvent(new Event('input',{bubbles:true}));
    },val);
  }
  await expect(page.locator('#v4-hours-result')).toHaveText('100');
  await expect(page.locator('#v4-repeat-result')).toContainText('50');
  await expect(page.locator('#v4-cost-result')).toContainText('2.500.000');
});

test('Classic demo scenarios and conversation reply',async({page})=>{
  await page.goto('/demo.html');
  await page.locator('[data-scenario="budget"]').click();
  await page.locator('#chat-input').fill('Có sản phẩm dưới 300k không?');
  await page.locator('#chat-form button[type=submit]').click();
  await expect(page.locator('#chat-feed .sim-message')).toHaveCount(3);
  await page.locator('[data-scenario="human"]').click();
  await expect(page.locator('#chat-feed')).toContainText(/nhân viên|tư vấn/i);
});

test('Contact request cannot falsely claim success without backend',async({page})=>{
  await page.goto('/contact.html');
  await page.locator('#lead-name').fill('Khach Thu Nghiem');
  await page.locator('#lead-business').fill('Shop Thu Nghiem');
  await page.locator('#lead-email').fill('qa-contact@example.test');
  await page.locator('#lead-industry').selectOption({index:1});
  await page.locator('#lead-consent').check();
  await page.locator('#lead-submit').click();
  await expect(page.locator('#form-alert')).toBeVisible();
  await expect(page.locator('#form-alert')).toContainText(/chưa kết nối|không thể|không gửi|không hợp lệ|404/i);
  await expect(page.locator('#form-alert')).not.toContainText(/Đã ghi nhận yêu cầu/);
});

for (const p of routes) {
  test('Accessibility serious/critical check: ' + p, async({page})=>{
    await page.goto('/'+p,{waitUntil:'domcontentloaded'});
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze();
    const serious=results.violations.filter(v=>v.impact==='serious'||v.impact==='critical');
    console.log('AXE '+p+' '+JSON.stringify(serious.map(v=>({rule:v.id,impact:v.impact,count:v.nodes.length,help:v.help}))));
    expect(serious,'serious accessibility violations: '+p).toEqual([]);
  });
}


test('AI widget displays usable fallback when external chat script is unavailable',async({page})=>{
  await page.route('**/cdn.jsdelivr.net/npm/@n8n/chat/**', route=>route.abort());
  await page.goto('/demo.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#n8n-chat-fallback')).toBeVisible({timeout:10000});
  await expect(page.locator('#n8n-chat-fallback a[href="lab.html"]')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/tien404-chat-ready/);
});

test('Sample dashboard and homepage capture visual QA screenshots',async({page})=>{
  for(const [route,width,name] of [['index.html',1440,'home-desktop'],['index.html',390,'home-mobile'],['dashboard.html',1440,'dashboard'],['demo.html',390,'chat-mobile']]){
    await page.setViewportSize({width,height:850});
    if(route==='dashboard.html'){
      await page.goto('/login.html');
      await page.locator('#email').fill('visual-qa@example.test');
      await page.locator('#saas-auth button[type=submit]').click();
      await expect(page).toHaveURL(/dashboard.html$/);
    }else{
      await page.goto('/'+route,{waitUntil:'domcontentloaded'});
    }
    // IntersectionObserver motion reveals only after scroll; capture the experienced page, not offscreen pending states.
    const max=await page.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
    for(let y=0;y<=max;y+=Math.max(480,Math.round(850*0.72))){
      await page.evaluate(pos=>window.scrollTo(0,pos),y);
      await page.waitForTimeout(25);
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForTimeout(120);
    await page.screenshot({path:'qa-results/screenshots/'+name+'.png',fullPage:true,animations:'disabled'});
  }
});


test('Motion reveal becomes visible after user scroll and honors reduced-motion settings',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/index.html');
  const node=page.locator('#loi-ich .section-header').first();
  await node.scrollIntoViewIfNeeded();
  await expect.poll(()=>node.evaluate(el=>Number(getComputedStyle(el).opacity)),{timeout:9000}).toBeGreaterThan(0.9);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  const hidden=await page.locator('main .motion-pending').count();
  expect(hidden,'Reduced motion must not leave content hidden').toBe(0);
});



test('Critical homepage content remains visible in reduced-motion browsers',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/index.html',{waitUntil:'load'});
  await page.waitForTimeout(250);
  const result=await page.evaluate(()=>{
    const elements=[...document.querySelectorAll('.section-header,.feature-card,.solution-card,.motion-lab,.timeline > *')];
    return {
      reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      pending:document.querySelectorAll('.motion-pending').length,
      values:elements.slice(0,30).map(x=>({
        name:x.className,
        content:x.textContent.slice(0,55).replace(/\s+/g,' '),
        y:Math.round(x.getBoundingClientRect().top+scrollY),
        opacity:getComputedStyle(x).opacity,
        visibility:getComputedStyle(x).visibility,
        display:getComputedStyle(x).display,
        rect:x.getBoundingClientRect().height
      }))
    };
  });
  console.log('HOME_VISIBILITY_DIAGNOSTIC '+JSON.stringify(result));
  expect(result.reduced).toBe(true);
  expect(result.pending).toBe(0);
  expect(result.values.filter(x=>Number(x.opacity)<0.95||x.visibility!=='visible'||x.display==='none')).toEqual([]);
});

test('Public pages expose correct canonical SEO links and internal demos stay noindex',async({page})=>{
  const publicPages = ['index.html','about.html','solutions.html','demo.html','pricing.html','faq.html','industries.html','industry-fashion.html','industry-beauty.html','industry-accessories.html','industry-ecommerce.html','industry-services.html','onboarding.html','lab.html','impact.html','privacy.html','terms.html','refund.html'];
  const hiddenPages = ['login.html','register.html','dashboard.html','checkout.html','billing.html','invoice.html','contact.html','404.html'];
  for(const path of publicPages){
    await page.goto('/'+path,{waitUntil:'domcontentloaded'});
    const expected='https://ngoctien20.github.io/demo-git/'+(path==='index.html'?'':path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',expected);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content',expected);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  }
  for(const path of hiddenPages){
    await page.goto('/'+path,{waitUntil:'domcontentloaded'});
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
  }
  const sitemap=await page.request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  const xml=await sitemap.text();
  expect((xml.match(/<url>/g)||[]).length).toBe(publicPages.length);
});

test('Live GitHub Pages public URL renders the latest AI panel', async({page})=>{
  const response=await page.goto(live+'demo.html',{waitUntil:'domcontentloaded',timeout:20000});
  expect(response.status()).toBe(200);
  await expect(page.locator('#ai-live')).toBeVisible();
});

test('Live n8n AI chat loads and accepts an inquiry without real orders',async({page})=>{
  test.setTimeout(70000);
  await page.goto(live+'demo.html#ai-live',{waitUntil:'domcontentloaded',timeout:20000});
  const chat=page.locator('#n8n-chat');
  await expect(chat).toBeVisible();
  const input=chat.locator('textarea,input[type="text"]').first();
  await expect(input).toBeVisible({timeout:18000});
  const before=await chat.locator('.chat-message-from-bot').count();
  console.log('CHAT_INITIAL_BOT_COUNT '+before);
  console.log('CHAT_DOM '+(await chat.innerHTML()).slice(0,1700).replace(/\s+/g,' '));
  await input.fill('Tôi bán thời trang online, bạn gợi ý bắt đầu từ tính năng AI nào?');
  await input.press('Enter');
  await expect.poll(async()=>await chat.locator('.chat-message-from-bot').count(),{timeout:45000,intervals:[1000,2000,3000]}).toBeGreaterThan(before);
  await expect.poll(async()=>(await chat.locator('.chat-message-from-bot').last().innerText()).trim().length,{timeout:45000,intervals:[1000,2000,3000]}).toBeGreaterThan(50);
  const reply=await chat.locator('.chat-message-from-bot').last().innerText();
  console.log('AI_REAL_RESPONSE '+reply.slice(0,700));
  expect(reply).not.toContain('Rất tiếc, trợ lý đang bận');
  expect(reply).toMatch(/shop|AI|giải pháp|thời trang|bán hàng|tư vấn/i);
});
