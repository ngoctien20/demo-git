"""Mobile Chromium smoke against deployed Render Auth using a new, empty profile."""
from playwright.sync_api import sync_playwright, expect

ORIGIN = "https://tien404-auth-staging.onrender.com"
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 360, "height": 780}, is_mobile=True, has_touch=True)
    page.goto(ORIGIN + "/login.html")
    expect(page.locator("#auth-submit")).to_be_enabled(timeout=35000)
    expect(page.locator("#auth-forgot-password")).to_be_disabled()
    expect(page.locator("#auth-password-update")).to_be_hidden()
    page.goto(ORIGIN + "/account.html")
    for attempt in range(2):
        expect(page.locator("#account-login-link")).to_be_visible(timeout=35000)
        expect(page.locator("#account-status")).to_contain_text("Phiên đăng nhập không hợp lệ")
        expect(page.locator("#account-protected")).to_be_hidden()
        if attempt == 0:
            page.reload()
    browser.close()
print("PASS: hosted login ready, recovery request disabled, anonymous account denied before/after refresh")
