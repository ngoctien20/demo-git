"""TIEN404 V12.2 browser smoke — no real auth, no external network or customer data."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent / "auth-preview-dist"


def run():
    assert ROOT.is_dir(), "Build preview first"
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = "http://127.0.0.1:" + str(server.server_address[1])
    try:
        with sync_playwright() as browser_api:
            browser = browser_api.chromium.launch(headless=True)
            try:
                for width, height in [(390, 844), (768, 1024), (1440, 900)]:
                    page = browser.new_page(viewport={"width": width, "height": height})
                    # All public endpoints, Auth CDN and real Supabase traffic are blocked.
                    page.route("**/*", lambda route: route.continue_()
                               if route.request.url.startswith(base + "/")
                               else route.abort())
                    page.goto(base + "/merchant-portal.html", wait_until="domcontentloaded")
                    assert page.locator("#merchant-protected").is_hidden()
                    assert page.locator("#merchant-shop-select").is_hidden()
                    assert page.locator("#merchant-panel").is_hidden()
                    assert "Quản lý cửa hàng" in page.title()
                    overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth + 2")
                    assert not overflow, f"Horizontal overflow at {width}px"
                    page.close()
                signup = browser.new_page(viewport={"width": 390, "height": 844})
                signup.route("**/*", lambda route: route.continue_()
                             if route.request.url.startswith(base + "/")
                             else route.abort())
                signup.goto(base + "/register-staging.html", wait_until="domcontentloaded")
                assert signup.locator("#mp-register-submit").is_disabled()
                assert signup.get_by_text("Đăng ký tự phục vụ chưa được mở").is_visible()
                assert not signup.evaluate("document.documentElement.scrollWidth > innerWidth + 2")
                signup.close()
                print("PASS: 3 viewport checks, no unverified data, signup disabled and offline fail-closed")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    run()
