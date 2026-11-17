"""V18.0-P0N: hosted Chromium UI smoke with synthetic Auth client only.
Never signs in, extracts credentials, uses real JWT, or writes Supabase data.
"""
from playwright.sync_api import sync_playwright, expect

ORIGIN="https://tien404-auth-staging.onrender.com"
URL=ORIGIN+"/auth-evidence.html"
NONCE="44444444-4444-4444-8444-444444444444"
STUB=r"""
window.__qaCalls={getUser:0,getClaims:0,db:0};
window.__qaMockMode='deny';
window.__qaClient={
 auth:{
   async getUser(){
     window.__qaCalls.getUser++;
     if(window.__qaMockMode!=='accept')return {data:{user:null},error:{code:'qa_synthetic'}};
     return {data:{user:{id:'22222222-2222-4222-8222-222222222222',is_anonymous:false}},error:null};
   },
   async getClaims(){
     window.__qaCalls.getClaims++;
     const now=Math.floor(Date.now()/1000);
     return {data:{claims:{
       iss:'https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1',
       aud:'authenticated',role:'authenticated',
       sub:'22222222-2222-4222-8222-222222222222',
       session_id:'33333333-3333-4333-8333-333333333333',
       iat:now-1, exp:now+500
     }},error:null};
   }
 },
 from(table){
   window.__qaCalls.db++;
   if(table!=='tenant_memberships')throw Error('Unexpected table');
   return {select(){return this},eq(){return this},
     async limit(){return {data:[{tenant_id:'11111111-1111-4111-8111-111111111111',role:'owner',active:true}],error:null}}
   };
 }
};
"""
def check(browser, mobile):
    ctx=browser.new_context(viewport={"width":390,"height":844} if mobile else {"width":1280,"height":800},locale="vi-VN")
    ctx.add_init_script(STUB)
    ctx.route("**/assets/auth-client.js",lambda route: route.fulfill(status=200,content_type="application/javascript",
      body="export async function getAuthClient(){return window.__qaClient;}"))
    # Block any accidental real Supabase request to keep the suite zero-token/zero-write.
    ctx.route("https://ifxlvrhyjhbzbrkdsida.supabase.co/**",lambda route: route.abort("blockedbyclient"))
    writes=[]
    ctx.on("request",lambda req:writes.append(req.url) if req.method.upper() not in ("GET","HEAD","OPTIONS") else None)
    page=ctx.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(type(e).__name__))
    response=page.goto(URL,wait_until="domcontentloaded",timeout=30000)
    assert response and response.status==200
    expect(page.get_by_role("heading",name="Kiểm tra hai phiên Auth")).to_be_visible()
    expect(page.locator("#result")).to_be_hidden()
    button=page.locator("#check")
    button.click()
    expect(page.locator("#status")).to_contain_text("BLOCKED")
    assert page.evaluate("window.__qaCalls.getUser")==0,"Without consent may not contact Auth"
    page.locator("#consent").check()
    page.locator("#nonce").fill("not-a-uuid")
    button.click()
    expect(page.locator("#status")).to_contain_text("BLOCKED")
    assert page.evaluate("window.__qaCalls.getUser")==0,"Malformed nonce must not call Auth"
    page.locator("#nonce").fill(NONCE)
    button.click()
    expect(page.locator("#status")).to_contain_text("BLOCKED")
    expect(page.locator("#result")).to_be_hidden()
    assert page.evaluate("window.__qaCalls.getUser")==1
    page.evaluate("window.__qaMockMode='accept'")
    button.click()
    expect(page.locator("#status")).to_contain_text("Đã kiểm tra đọc cục bộ")
    expect(page.locator("#result")).to_be_visible()
    assert page.locator("#nonce-output").inner_text()==NONCE
    assert len(page.locator("#actor-code").inner_text())==40
    assert len(page.locator("#tenant-codes").inner_text())==40
    visible=page.locator("body").inner_text()
    for secret in ("22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333","11111111-1111-4111-8111-111111111111"):
        assert secret not in visible,"Raw private subject/session/tenant leaked to page"
    assert not errors,"Unexpected browser JS errors: "+str(errors)
    assert not writes,"Unexpected browser-side write attempt"
    assert page.evaluate("window.__qaCalls.db")==1
    print("PASS_P0N_HOSTED_CHROMIUM", "mobile" if mobile else "desktop",
          "real_https=200 consent_deny=pass invalid_nonce_deny=pass",
          "anonymous_deny=pass synthetic_owner_render=pass raw_ids_hidden=pass hosted_writes=0")
    ctx.close()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    try:
        check(browser,False)
        check(browser,True)
    finally:browser.close()
print("P0N_ANONYMOUS_LIVE_BROWSER_QA_PASS_REAL_JWT_NOT_EXECUTED")
