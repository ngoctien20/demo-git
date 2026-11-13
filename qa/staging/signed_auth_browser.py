"""Private manual QA against Render staging. Requires dedicated QA owners, no recordings."""
import csv
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

ORIGIN = "https://tien404-auth-staging.onrender.com"
DB = "https://ifxlvrhyjhbzbrkdsida.supabase.co"


def check_report_download(page, tenant):
    report = page.get_by_role("button", name="Xem giá trị đơn đã thanh toán")
    export = page.get_by_role("button", name="Xuất báo cáo CSV")
    for days in (7, 30):
        with page.expect_response(lambda response: response.url == DB + "/rest/v1/rpc/merchant_paid_orders_daily"
                                  and response.request.method == "POST") as observed:
            if days == 7:
                report.click()
            else:
                page.get_by_label("Kỳ thống kê đơn hàng").select_option(str(days))
        response = observed.value
        assert response.ok and response.request.post_data_json == {"p_tenant": tenant, "p_days": days}
        rows = response.json()
        assert rows and all(row["tenant_id"] == tenant for row in rows)
        with page.expect_download() as download:
            export.click()
        result = download.value
        assert result.suggested_filename == f"don-hang-{tenant}-{days}-ngay.csv"
        with result.path().open(encoding="utf-8-sig", newline="") as source:
            data = list(csv.reader(source))
        assert data[0] == ["Ngày tạo đơn (Việt Nam)", "Tổng số đơn",
                           "Số đơn đang ở trạng thái đã thanh toán", "Giá trị đơn đã thanh toán (VND)"]
        assert data[1:] == [[str(row[key]) for key in ("order_day", "order_count", "paid_count", "paid_vnd")]
                            for row in rows]


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
                check_report_download(page, tenant)
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
            print(f"PASS: shop {label}, authenticated tenant, 7/30-day CSV, refresh, reopen, logout and route denial")
    return 0


if __name__ == "__main__":
    sys.exit(main())
