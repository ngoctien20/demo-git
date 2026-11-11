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
  const predicates = {};
  const query = {
    select(fields, options){query.head=options?.head;return query;},
    eq(column,value){
      predicates[column]=value;
      if (query.head) {
        if (column!=='tenant_id' || value!==id) throw Error('missing scope');
        return {count:table==='products'?3:1};
      }
      return query;
    },in(){return query;},order(){return query;},
    ilike(column,value){predicates[column]=value;return query;},
    async range(start,end){
      if (predicates.tenant_id!==id || end-start!==19) throw Error('invalid scope or range');
      const tenant_id=window.badScope ? 'B' : id;
      if(table==='order_items') return {count:1,data:[{tenant_id,order_id:window.badParent?'wrong':predicates.order_id,product_id:'T-A',quantity:2,unit_price_vnd:7500,line_total_vnd:15000}]};
      if(table==='orders') return {count:1,data:[{tenant_id,customer_id:predicates.customer_id,id:'QA-ORDER',status:'paid',total_vnd:15000,created_at:'2026-11-10T00:00:00Z'}]};
      if(table==='customers') return {count:1,data:[{id:'qa-customer',tenant_id,display_name:'Khách QA',created_at:'2026-11-10T00:00:00Z'}]};
      if(table==='conversations') return {count:1,data:[{id:'qa-conversation',tenant_id,channel:'web',created_at:'2026-11-10T00:00:00Z'}]};
      if(table==='messages') return {count:1,data:[{tenant_id,conversation_id:predicates.conversation_id,sender:'agent',body:'Lời chào QA',created_at:'2026-11-10T00:00:00Z'}]};
      if(table==='tenant_agent_configs') return {count:0,data:[]};
      if(table==='products') {
        const row={tenant_id,sku:'QA',name:'Sản phẩm '+id,price_vnd:15000,stock_on_hand:2,is_active:true};
        if(predicates.name) return {count:0,data:[]};
        if(start===20) return {count:21,data:[{...row,name:'Hàng trang hai'}]};
        return {count:21,data:Array.from({length:20},(_,i)=>({...row,sku:'QA-'+i}))};
      }
      throw Error('unexpected table');
    },
    async limit(){
      if (window.dualShop && id==='A') return {data:table==='tenants'
        ? [{id:'A',name:'Shop A'},{id:'C',name:'Shop C'}]
        : ['A','C'].map(tenant_id=>({tenant_id,user_id:id,role:'owner',active:true}))};
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
    expect(page.locator('#auth-submit')).to_be_enabled()
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
    expect(page.get_by_text('Sản phẩm: 3',exact=True)).to_be_visible()
    expect(page.get_by_text('Đơn hàng: 1',exact=True)).to_be_visible()
    page.get_by_role('button',name='Xem sản phẩm').click()
    expect(page.locator('#account-tenants section').filter(has=page.get_by_role('button', name='Tải lại danh mục')).locator('li').first).to_contain_text('Sản phẩm A')
    page.get_by_role('button',name='Xem đơn hàng').click()
    expect(page.get_by_text('QA-ORDER',exact=False)).to_be_visible()
    orders = page.locator('section').filter(has=page.get_by_role('button',name='Tải lại đơn hàng')).last
    orders.get_by_role('button',name='Chi tiết đơn').click()
    expect(page.get_by_text('Thành tiền',exact=False)).to_be_visible()
    page.evaluate('window.badParent=true')
    orders.get_by_role('button',name='Chi tiết đơn').click()
    expect(page.get_by_text('Thành tiền',exact=False)).to_have_count(0)
    catalog = page.locator('section').filter(has=page.get_by_role('button',name='Tải lại danh mục')).last
    catalog.get_by_role('button',name='Trang sau').click()
    expect(catalog.get_by_text('Hàng trang hai',exact=False)).to_be_visible()
    catalog.get_by_role('button',name='Trang trước').click()
    expect(catalog.get_by_text('Hàng trang hai',exact=False)).to_have_count(0)
    catalog.get_by_label('Tìm sản phẩm theo').select_option('name')
    catalog.get_by_label('Tên sản phẩm',exact=True).fill('không tìm thấy')
    catalog.get_by_role('button',name='Áp dụng').click()
    expect(catalog.get_by_text('Không có sản phẩm phù hợp.')).to_be_visible()
    catalog.get_by_label('Tên sản phẩm',exact=True).fill('')
    catalog.get_by_role('button',name='Áp dụng').click()
    expect(catalog.locator('li')).to_have_count(20)
    page.get_by_role('button',name='Xem AI Agent').click()
    expect(page.get_by_text('Không có cấu hình AI phù hợp.')).to_be_visible()
    page.get_by_role('button',name='Xem khách hàng').click()
    expect(page.get_by_text('Khách QA',exact=False)).to_be_visible()
    page.get_by_role('button',name='Lịch sử mua hàng').click()
    expect(page.get_by_text('QA-ORDER',exact=False)).to_have_count(2)
    page.get_by_role('button',name='Xem hội thoại').click()
    page.get_by_role('button',name='Lịch sử tương tác').click()
    expect(page.get_by_text('Lời chào QA',exact=False)).to_be_visible()
    page.evaluate('window.badScope=true')
    page.get_by_role('button',name='Tải lại đơn hàng').click()
    expect(orders.get_by_text('QA-ORDER',exact=False)).to_have_count(0)
    page.get_by_role('button',name='Tải lại danh mục').click()
    expect(page.locator('#account-tenants section').filter(has=page.get_by_role('button', name='Tải lại danh mục')).locator('li')).to_have_count(0)
    expect(page.get_by_text('Chưa tải được danh mục.',exact=False)).to_be_visible()
    page.reload()
    expect(page.get_by_text('Shop A',exact=True)).to_be_visible()
    page.evaluate('window.dualShop=true')
    page.locator('#account-refresh').click()
    page.get_by_label('Cửa hàng đang xem').select_option('C')
    expect(page.locator('.auth-tenant-card strong')).to_have_text('Shop C')
    expect(page.locator('.auth-tenant-card').get_by_text('Sản phẩm A',exact=False)).to_have_count(0)
    page.evaluate("window.changeFixtureIdentity('B')")
    expect(page.get_by_text('Shop B',exact=True)).to_be_visible()
    expect(page.get_by_text('Sản phẩm: 3',exact=True)).to_be_visible()
    expect(page.get_by_text('Đơn hàng: 1',exact=True)).to_have_count(0)
    for private_module in ('Xem đơn hàng','Xem khách hàng','Xem hội thoại','Xem AI Agent'):
        expect(page.get_by_role('button',name=private_module)).to_have_count(0)
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
