"""Anonymous browser smoke for Tester Portal — all external/Auth traffic blocked.

The browser never logs in, uses no secret and cannot reach production resources.
Proves fail-closed initial render and mobile behavior only.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent/'auth-preview-dist'
def run():
    assert ROOT.is_dir(),"Build Render preview first"
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    thread=Thread(target=server.serve_forever,daemon=True);thread.start()
    origin='http://127.0.0.1:'+str(server.server_address[1])
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            try:
                for w,h in ((390,844),(768,1024),(1440,900)):
                    page=browser.new_page(viewport={'width':w,'height':h})
                    page.route('**/*',lambda route:route.continue_() if
                               route.request.url.startswith(origin+'/') else route.abort())
                    page.goto(origin+'/tester.html',wait_until='domcontentloaded')
                    assert page.locator('#tp-workspace').is_hidden()
                    assert page.locator('#tp-panel').is_hidden()
                    assert 'Tester Portal' in page.title()
                    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
                    page.close()
                for w,h in ((390,844),(768,1024),(1440,900)):
                    page=browser.new_page(viewport={'width':w,'height':h})
                    page.route('**/*',lambda route:route.continue_() if
                               route.request.url.startswith(origin+'/') else route.abort())
                    page.goto(origin+'/tester-request.html',wait_until='domcontentloaded')
                    assert page.locator('#tr-form').is_hidden()
                    assert page.locator('#tr-authorized').is_hidden()
                    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
                    page.close()
                admin=browser.new_page(viewport={'width':390,'height':844})
                admin.route('**/*',lambda route:route.continue_() if
                            route.request.url.startswith(origin+'/') else route.abort())
                admin.goto(origin+'/tester-admin.html',wait_until='domcontentloaded')
                assert admin.locator('#ta-protected').is_hidden()
                assert admin.locator('#ta-grant-card').is_hidden()
                assert admin.locator('#ta-assignment-card').is_hidden()
                assert not admin.evaluate('document.documentElement.scrollWidth>innerWidth+2')
                admin.close()
                print('PASS: 3 viewport tester + access-request anonymous fail-closed, admin locked, zero remote traffic')
            finally:browser.close()
    finally:
        server.shutdown();server.server_close()
if __name__=='__main__':run()
