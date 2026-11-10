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
    select(){return query;},eq(){return query;},in(){return query;},
    async limit(){return {data:table === 'tenants'
      ? [{id,name:'Shop '+id}]
      : [{tenant_id:id,user_id:id,role:'owner',active:true}]};}
  };
  return query;
}};
"""

server = ThreadingHTTPServer(('127.0.0.1', 0),
    partial(SimpleHTTPRequestHandler, directory='auth-preview-dist'))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={'width':360,'height':780},
                            is_mobile=True,has_touch=True,color_scheme='dark')
    page.route('**/assets/auth-client.js', lambda route: route.fulfill(
        content_type='application/javascript',body=MOCK))
    page.goto(origin+'/account.html')
    expect(page.locator('#account-login-link')).to_be_visible()
    expect(page.locator('#account-protected')).to_be_hidden()
    page.locator('#account-login-link').click()
    expect(page.locator('#auth-forgot-password')).to_be_disabled()
    password = page.locator('#auth-password')
    page.locator('#auth-email').fill('fixture@example.invalid')
    password.fill('fixture-only-invalid')
    assert password.evaluate("e=>getComputedStyle(e).color!==getComputedStyle(e).backgroundColor")
    page.locator('#auth-submit').click()
    expect(page.locator('#auth-status')).to_have_attribute('data-state','error')
    password.fill('fixture-only-valid')
    page.locator('#auth-submit').click()
    expect(page.get_by_text('Shop A',exact=True)).to_be_visible()
    page.reload()
    expect(page.get_by_text('Shop A',exact=True)).to_be_visible()
    page.evaluate("window.changeFixtureIdentity('B')")
    expect(page.get_by_text('Shop B',exact=True)).to_be_visible()
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
