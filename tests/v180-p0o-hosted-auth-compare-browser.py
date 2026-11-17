"""TIEN404 V18.0-P0O — real HTTPS two-browser-profile UI QA (synthetic Auth only).
No passwords, real JWT, actual owner account, Supabase network, database changes or provider messages.
"""
from playwright.sync_api import sync_playwright, expect

ORIGIN = "https://tien404-auth-staging.onrender.com"
PAGE = ORIGIN + "/auth-evidence.html"
NONCE = "44444444-4444-4444-8444-444444444444"
ACTOR_A = "22222222-2222-4222-8222-222222222222"
ACTOR_B = "66666666-6666-4666-8666-666666666666"
ACTOR_C = "77777777-7777-4777-8777-777777777777"
TENANT_A = "11111111-1111-4111-8111-111111111111"
TENANT_C = "99999999-9999-4999-8999-999999999999"
SESSION_ID = "33333333-3333-4333-8333-333333333333"
FAKE_CLIENT_MODULE = "export async function getAuthClient(){return window.__qaClient;}"
MOCK = r"""
window.__qaCalls={getUser:0,getClaims:0,db:0};
window.__qaClient={
 auth:{
  async getUser(){
   window.__qaCalls.getUser++;
   return {data:{user:{id:window.__qaActor,is_anonymous:false}},error:null};
  },
  async getClaims(){
   window.__qaCalls.getClaims++;
   const now=Math.floor(Date.now()/1000);
   return {data:{claims:{
    iss:'https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1',
    aud:'authenticated',role:'authenticated',sub:window.__qaActor,
    session_id:'33333333-3333-4333-8333-333333333333',iat:now-1,exp:now+600
   }},error:null};
  }
 },
 from(name){
  window.__qaCalls.db++;
  if(name!=='tenant_memberships')throw Error('QA_UNEXPECTED_READ');
  return {
   select(){return this},eq(){return this},
   async limit(){return {data:[{tenant_id:window.__qaTenant,role:'owner',active:true}],error:null}}
  };
 }
};
"""
def open_profile(browser, actor, tenant, viewport):
    context=browser.new_context(viewport=viewport, locale="vi-VN")
    context.add_init_script(MOCK)
    context.add_init_script("window.__qaActor="+repr(actor)+"; window.__qaTenant="+repr(tenant)+";")
    context.route("**/assets/auth-client.js",
       lambda route: route.fulfill(status=200,content_type="application/javascript",body=FAKE_CLIENT_MODULE))
    # The real Supabase host must never be used by a mocked test client.
    context.route("https://ifxlvrhyjhbzbrkdsida.supabase.co/**",
       lambda route: route.abort("blockedbyclient"))
    errors, write_requests=[],[]
    context.on("request",lambda r: write_requests.append(r.url)
       if r.method.upper() not in ("GET","HEAD","OPTIONS") else None)
    page=context.new_page()
    page.on("pageerror",lambda error: errors.append(str(type(error).__name__)))
    response=page.goto(PAGE,wait_until="domcontentloaded",timeout=30000)
    assert response and response.status==200, "Hosted QA page must be live HTTP 200"
    expect(page.locator("#compare-receipt")).to_be_hidden()
    expect(page.locator("#peer-receipt")).to_be_hidden()
    page.locator("#consent").check()
    page.locator("#nonce").fill(NONCE)
    page.locator("#check").click()
    expect(page.locator("#status")).to_contain_text("Đã kiểm tra cục bộ")
    expect(page.locator("#result")).to_be_visible()
    expect(page.locator("#compare-receipt")).to_be_visible()
    expect(page.locator("#peer-receipt")).to_be_visible()
    assert page.evaluate("window.__qaCalls.getUser")==1
    assert page.evaluate("window.__qaCalls.getClaims")==1
    assert page.evaluate("window.__qaCalls.db")==1
    assert not errors, "Browser JavaScript errors: "+str(errors)
    assert not write_requests, "Hosted write HTTP method attempted"
    for ident in (ACTOR_A,ACTOR_B,ACTOR_C,TENANT_A,TENANT_C,SESSION_ID):
        assert ident not in page.locator("body").inner_text(), "Private raw ID displayed in QA UI"
    return context,page

def compare(browser,viewport,designation):
    a,pa=open_profile(browser,ACTOR_A,TENANT_A,viewport)
    b,pb=open_profile(browser,ACTOR_B,TENANT_A,viewport)
    c,pc=open_profile(browser,ACTOR_C,TENANT_C,viewport)
    try:
        a_receipt=pa.locator("#receipt-output").input_value()
        b_receipt=pb.locator("#receipt-output").input_value()
        c_receipt=pc.locator("#receipt-output").input_value()
        assert a_receipt and b_receipt and c_receipt
        for private in (ACTOR_A,ACTOR_B,TENANT_A,TENANT_C,SESSION_ID):
            assert private not in a_receipt+b_receipt+c_receipt, "Raw Auth ID leaked in receipt"

        pa.locator("#peer-receipt").fill(b_receipt)
        pa.locator("#compare-receipt").click()
        expect(pa.locator("#compare-status")).to_contain_text("ĐỐI CHIẾU CỤC BỘ ĐẠT")

        pa.locator("#peer-receipt").fill(a_receipt)
        pa.locator("#compare-receipt").click()
        expect(pa.locator("#compare-status")).to_contain_text("CHƯA ĐẠT: SAME_ACTOR_FINGERPRINT")

        pa.locator("#peer-receipt").fill(c_receipt)
        pa.locator("#compare-receipt").click()
        expect(pa.locator("#compare-status")).to_contain_text("CHƯA ĐẠT: NO_COMMON_OWNER_TENANT")

        pa.locator("#peer-receipt").fill("{not-json")
        pa.locator("#compare-receipt").click()
        expect(pa.locator("#compare-status")).to_contain_text("CHƯA ĐẠT: INVALID_RECEIPT_JSON")

        for name,page in (("A",pa),("B",pb),("C",pc)):
            assert "chưa có Store Authority A/B" in page.locator("body").inner_text()
        print("PASS_P0O_REAL_HTTPS_TWO_PROFILE_UI",designation,
              "different_actor_common_owner=local_pass"
              " same_actor=deny different_tenant=deny forged_json=deny"
              " no_raw_ids=pass host_writes=0 real_jwt=not_run")
    finally:
        a.close(); b.close(); c.close()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    try:
        compare(browser,{"width":1280,"height":820},"desktop")
        compare(browser,{"width":390,"height":844},"mobile")
    finally:browser.close()
print("P0O_HOSTED_BROWSER_COMPARISON_UAT_SUCCESS_SYNTHETIC_ONLY")
