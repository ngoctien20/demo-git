"""Check the preview handoff on a mobile viewport and the real hosted anonymous Auth boundary."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

from playwright.sync_api import expect, sync_playwright

origin = 'https://tien404-auth-staging.onrender.com'
with ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory='.')) as server:
    Thread(target=server.serve_forever, daemon=True).start()
    preview = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={'width': 360, 'height': 780}, is_mobile=True, has_touch=True)
            for path in ('register.html', 'login.html'):
                page.goto(f'{preview}/{path}')
                link = page.get_by_role('link', name='Đăng nhập cửa hàng thử nghiệm', exact=True)
                expect(link).to_be_visible()
                expect(link).to_have_attribute('href', origin + '/login.html')
            link.click()
            expect(page).to_have_url(origin + '/login.html')
            expect(page.locator('#auth-submit')).to_be_enabled(timeout=30000)
            page.goto(origin + '/account.html')
            expect(page.locator('#account-login-link')).to_be_visible(timeout=30000)
            expect(page.locator('#account-protected')).to_be_hidden()
            expect(page.locator('#account-status')).to_contain_text('đăng nhập lại')
            browser.close()
    finally:
        server.shutdown()
print('PASS mobile preview handoff, hosted login ready and anonymous direct account denial')
