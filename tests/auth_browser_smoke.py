"""Chromium acceptance of the preview UI using a synthetic Auth/DB transport."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, expect

MOCK = """
let callback;
function identity() {
  const id = sessionStorage.getItem('qa-shop');
  return id ? {id, email:'fixture@example.invalid'} : null;
}
function change(id) {
  if (id) sessionStorage.setItem('qa-shop', id);
  else sessionStorage.removeItem('qa-shop');
  callback(id ? 'SIGNED_IN' : 'SIGNED_OUT', {user:identity()});
}
window.changeFixtureIdentity = change;
const auth = {
  onAuthStateChange(fn) {callback = fn;},
  async getUser() {return {data:{user:identity()}};},
  async signInWithPassword({password}) {
    if (password !== 'fixture-only-valid') return {error:{code:'invalid_credentials'}};
    change('A'); return {data:{user:identity(),session:{}}};
  },
  async signOut() {change(null);return {};}
};
export const authClient = {auth, from(table) {
  const id = identity().id;
  const query = {
    select(){return query;},eq(){return query;},in(){return query;},order(){return query;},
    async limit(){
      if (table === 'orders') return {count:1,data:[{tenant_id:window.badScope ? 'B' : id,id:'QA-ORDER',status:'paid',total_vnd:15000,created_at:'2026-11-10T00:00:00Z'}]};
      if (table === 'products') return {data:[{tenant_id:window.badScope ? 'B' : id,sku:'QA',name:'Sản phẩm '+id,price_vnd:15000,stock_on_hand:2}]};
      return {data:table === 'tenants'
      ? [{id,name:'Shop '+id}]
      : [{tenant_id:id,user_id:id,role:id==='B'?'staff':'owner',active:true}]};}
  };
  return query;
}};
"""
MOCK = MOCK + "\nexport async function getAuthClient() { return authClient; }\n"

server = ThreadingHTTPServer(('127.0.0.1', 0),
    partial(SimpleHTTPRequestHandler, directory='auth-preview-dist'))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={'width':360,'height':780},
                            is_mobile=True,has_touch=True,color_scheme='dark')
    offline = browser.new_page()
    offline.route('**/assets/auth-account.js*', lambda route: route.abort())
    offline.clock.install()
    offline.goto(origin+'/account.html')
    offline.clock.fast_forward(24000)
    expect(offline.locator('#account-protected')).to_be_hidden()
    expect(offline.locator('#account-status')).to_have_attribute('data-state', 'error')
    expect(offline.locator('#auth-retry')).to_be_visible()
    offline.close()
    blocked = browser.new_page(java_script_enabled=False)
    blocked.goto(origin+'/login.html')
    expect(blocked.locator('#auth-submit')).to_be_disabled()
    for form in blocked.locator('form').all():
        expect(form).to_have_attribute('method', 'dialog')
    blocked.locator('#auth-email').fill('fixture@example.invalid')
    blocked.locator('#auth-password').fill('fixture-only-invalid')
    blocked.locator('#auth-password').press('Enter')
    expect(blocked).to_have_url(origin+'/login.html')
    blocked.close()
    page.route('**/assets/auth-client.js', lambda route: route.fulfill(
        content_type='application/javascript',body=MOCK))
    page.goto(origin+'/account.html')
    expect(page.locator('#account-login-link')).to_be_visible()
    expect(page.locator('#account-protected')).to_be_hidden()
    page.locator('#account-login-link').click()
    expect(page.locator('#auth-forgot-password')).to_be_disabled()
    # A forged recovery-looking URL or DOM-unhidden form cannot authorize updateUser.
    page.evaluate("""() => {
      const form = document.getElementById('auth-password-update');
      form.hidden = false;
      form.querySelector('button[type=submit]').disabled = false;
      document.getElementById('auth-new-password').value = 'Fixture-only-strong-password-123!';
      document.getElementById('auth-password-confirm').value = 'Fixture-only-strong-password-123!';
      form.requestSubmit();
    }""")
    expect(page.locator('#auth-status')).to_contain_text('Phiên khôi phục không hợp lệ')
    page.evaluate("document.getElementById('auth-password-update').hidden = true")
    password = page.locator('#auth-password')
    page.locator('#auth-email').fill('fixture@example.invalid')
    password.fill('fixture-only-invalid')
    assert password.evaluate("e=>getComputedStyle(e).color!==getComputedStyle(e).backgroundColor")
    page.locator('#auth-submit').click()
    expect(page.locator('#auth-status')).to_have_attribute('data-state','error')
    password.fill('fixture-only-valid')
    page.locator('#auth-submit').click()
    expect(page.get_by_text('Shop A',exact=True)).to_be_visible()
    page.get_by_role('button',name='Xem sản phẩm').click()
    expect(page.locator('#account-tenants li')).to_contain_text('Sản phẩm A')
    page.get_by_role('button',name='Xem đơn hàng').click()
    expect(page.get_by_text('QA-ORDER',exact=False)).to_be_visible()
    page.evaluate('window.badScope=true')
    page.get_by_role('button',name='Tải lại đơn hàng').click()
    expect(page.get_by_text('QA-ORDER',exact=False)).to_have_count(0)
    page.get_by_role('button',name='Tải lại danh mục').click()
    expect(page.locator('#account-tenants li')).to_have_count(0)
    expect(page.get_by_text('Chưa tải được danh mục.',exact=False)).to_be_visible()
    page.reload()
    expect(page.get_by_text('Shop A',exact=True)).to_be_visible()
    page.evaluate("window.changeFixtureIdentity('B')")
    expect(page.get_by_text('Shop B',exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Xem đơn hàng')).to_have_count(0)
    expect(page.get_by_text('Shop A',exact=True)).to_have_count(0)
    page.evaluate('window.changeFixtureIdentity(null)')
    expect(page.locator('#account-protected')).to_be_hidden()
    page.evaluate("window.changeFixtureIdentity('A')")
    expect(page.get_by_text('Shop A',exact=True)).to_be_visible()
    page.locator('#account-logout').click()
    expect(page.locator('#auth-login')).to_be_visible()
    browser.close()
server.shutdown()
print('PASS: anonymous, rejected login, mock login, refresh, account switch, expiry event, logout and mobile dark input.')
