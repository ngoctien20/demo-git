"""Private manual QA against Render staging. Requires dedicated QA owners, no recordings."""
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

ORIGIN = "https://tien404-auth-staging.onrender.com"
DB = "https://ifxlvrhyjhbzbrkdsida.supabase.co"


def run_shop(chromium, profile, email, password, tenant):
    from playwright.sync_api import expect

    # Re-launch Chromium with the same profile. Do not export tokens or storage state.
    for first_launch in (True, False):
        context = chromium.launch_persistent_context(str(profile), viewport={"width": 360, "height": 780})
        try:
            page = context.new_page()
            def inspect_membership(response):
                return response.url.startswith(DB + "/rest/v1/tenant_memberships?") and response.status == 200
            with page.expect_response(inspect_membership, timeout=50000) as observed:
                if first_launch:
                    page.goto(ORIGIN + "/login.html")
                    page.locator("#auth-email").fill(email)
                    page.locator("#auth-password").fill(password)
                    page.locator("#auth-submit").click()
                else:
                    page.goto(ORIGIN + "/account.html")
            rows = observed.value.json()
            assert len(rows) == 1 and rows[0]["active"] and rows[0]["tenant_id"] == tenant
            expect(page.locator("#account-protected")).to_be_visible(timeout=35000)
            assert page.locator("#account-email").inner_text().casefold() == email.casefold()
            if first_launch:
                page.reload()
                expect(page.locator("#account-protected")).to_be_visible(timeout=35000)
            else:
                page.locator("#account-logout").click()
                page.wait_for_url(ORIGIN + "/login.html")
                page.goto(ORIGIN + "/account.html")
                expect(page.locator("#account-login-link")).to_be_visible(timeout=35000)
                expect(page.locator("#account-protected")).to_be_hidden()
        finally:
            context.close()


def main():
    accounts = [tuple(os.getenv(f"TIEN404_QA_{shop}_{field}", "") for field in ("EMAIL", "PASSWORD", "TENANT"))
                for shop in ("A", "B")]
    if not all(all(account) for account in accounts):
        print("BLOCKED: missing private staging QA account configuration")
        return 2
    if accounts[0][0].casefold() == accounts[1][0].casefold() or accounts[0][2] == accounts[1][2]:
        print("BLOCKED: distinct QA identities and tenants required")
        return 2
    from playwright.sync_api import sync_playwright
    with TemporaryDirectory() as temp, sync_playwright() as pw:
        for label, account in zip(("A", "B"), accounts):
            try:
                run_shop(pw.chromium, Path(temp) / label, *account)
            except Exception as error:
                print(f"FAIL: shop {label}, {type(error).__name__}")  # Never log email, page or token.
                return 1
            print(f"PASS: shop {label}, authenticated tenant, refresh, reopen, logout and route denial")
    return 0


if __name__ == "__main__":
    sys.exit(main())
