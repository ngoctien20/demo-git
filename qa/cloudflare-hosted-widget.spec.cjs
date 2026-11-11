const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const origin='https://eb7edbed.tien404-ai-git-staging.pages.dev';

test('HTTPS serves the exact candidate assets and security headers',async({request})=>{
  for(const file of ['index.html','demo.html','assets/ai-consultant.js','assets/live-chat.css']){
    const response=await request.get(origin+'/'+file);
    expect(response.status()).toBe(200);
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect((await response.body()).equals(fs.readFileSync(file))).toBe(true);
  }
});

for(const path of ['index.html','demo.html']){
  test('Hosted mobile widget recovery '+path,async({page})=>{
    const sdkRequests=[];
    const writes=[];
    await page.setViewportSize({width:390,height:844});
    await page.route('**/*',route=>{
      const r=route.request();
      if(!['GET','OPTIONS','HEAD'].includes(r.method())){
        writes.push(r.method());
        return route.abort();
      }
      if(r.url().includes('cdn.jsdelivr.net/npm/@n8n/chat/')){
        sdkRequests.push(r.url());
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(origin+'/'+path);
    expect(sdkRequests).toEqual([]);
    const opener=path==='demo.html' ? page.locator('[data-tien404-open-chat]').first() : page.locator('#tien404-chat-launcher');
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#n8n-chat-fallback a')).toBeVisible();
    await expect(page.locator('#tien404-chat-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    expect(sdkRequests.length).toBeGreaterThan(0);
    expect(writes).toEqual([]);
  });
}
