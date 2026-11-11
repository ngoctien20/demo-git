import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1] / 'app/ui'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844})
 logged=[True]
 def route(r):
  path=r.request.url.split('admin.test')[-1]
  if path in ['/admin','/admin/assets/admin.js','/admin/assets/admin.css']:
   name=path.split('/')[-1] if path!='/admin' else 'index.html'
   r.fulfill(path=root/name,content_type={'index.html':'text/html','admin.js':'application/javascript','admin.css':'text/css'}[name])
  elif path.endswith('/auth/me'):
   r.fulfill(json={'role':'SUPER_ADMIN'} if logged[0] else {},status=200 if logged[0] else 401)
  elif path.endswith('/auth/csrf'): r.fulfill(json={'csrf':'fixture'})
  elif path.endswith('/admin/tenants'):r.fulfill(json={'items':[],'source':'staging_sqlite'})
  elif '/admin/usage?' in path:
   n=int(path.split('=')[-1])
   r.fulfill(json={'items':[{'name':'QA Shop '+str(n),'reserved':1,'quota':20}],'month_utc':'2026-11','page':n,'has_more':n==1})
  elif path.endswith('/auth/logout'):
   logged[0]=False;r.fulfill(json={'revoked':True})
  else:r.abort()
 page.route('https://admin.test/**',route)
 page.goto('https://admin.test/admin')
 page.get_by_role('button',name='Hạn mức tin nhắn').click()
 expect(page.get_by_text('QA Shop 1')).to_be_visible()
 page.get_by_role('button',name='Trang sau').click()
 expect(page.get_by_text('QA Shop 2')).to_be_visible()
 expect(page.get_by_role('button',name='Trang sau')).to_be_disabled()
 page.get_by_role('button',name='Đăng xuất').click()
 expect(page.get_by_text('QA Shop 2')).to_have_count(0)
 expect(page.locator('#login-form')).to_be_visible()
 print('PASS synthetic Chromium 390x844: paginated quota UI and private rows cleared on logout')
 browser.close()
