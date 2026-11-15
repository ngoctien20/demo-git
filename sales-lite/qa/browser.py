"""Mobile browser E2E against real PostgreSQL and an ephemeral authenticated QA HTTP server."""
import json
import os
import shutil
import subprocess
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

artifacts = Path(os.environ.get("SALES_LITE_EVIDENCE", "/tmp/sales-lite-evidence"))
artifacts.mkdir(parents=True, exist_ok=True)
server = subprocess.Popen(["node", "qa/browser-server.mjs"], stdout=subprocess.PIPE, text=True)
results = []


def record(case, expected, actual):
    assert actual == expected, (case, actual, expected)
    results.append({"id": case, "expected": expected, "actual": actual, "status": "PASS"})


try:
    setup = json.loads(server.stdout.readline())
    origin, codes = setup["origin"], setup["codes"]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get("CHROME_BIN") or shutil.which("chromium") or shutil.which("google-chrome"),
                                     headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
        anon = browser.new_context(viewport={"width": 390, "height": 844})
        page = anon.new_page()
        page.goto(origin)
        expect(page.get_by_role("status")).to_have_text("Cần đăng nhập bằng tài khoản chủ shop.")
        record("UI01 · chưa đăng nhập", 401, anon.request.get(origin+"/api/view").status)
        record("UI01b · sự kiện QA thiếu chữ ký", 403, anon.request.post(origin+"/qa/inbound",data={"text":"F01 x 2"}).status)
        pages = {}
        for shop in ["A", "B"]:
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="vi-VN")
            ctx.add_cookies([{"name": "liteqa", "value": setup["keys"].pop(shop), "url": origin, "httpOnly": True, "sameSite": "Strict"}])
            p = ctx.new_page()
            p.goto(origin)
            expect(p.locator("article")).to_have_count(1)
            expect(p.get_by_text(codes[shop])).to_be_visible()
            expect(p.get_by_text(codes["B" if shop == "A" else "A"])).to_have_count(0)
            record("UI02-"+shop+" · đúng giá theo shop", "318.000đ" if shop=="A" else "398.000đ",
                   p.locator("article p").first.inner_text().split(" · ")[-1])
            record("UI03-"+shop+" · vừa màn hình 390 px", True, p.evaluate("document.documentElement.scrollWidth <= innerWidth"))
            pages[shop] = (ctx, p)
        A, p = pages["A"]
        p.screenshot(path=str(artifacts/"dashboard-mobile-new.png"), full_page=True)
        p.get_by_role("button", name="Xác nhận", exact=True).click()
        expect(p.get_by_role("dialog")).to_be_visible()
        p.get_by_role("button", name="Quay lại").click()
        record("UI04 · đóng hộp xác nhận giữ trạng thái", 1, p.get_by_text("Chờ xác nhận").count())
        p.get_by_role("button", name="Xác nhận", exact=True).click()
        p.get_by_role("button", name="Đồng ý").click()
        expect(p.get_by_role("status")).to_have_text("Chưa có yêu cầu chờ xác nhận.")
        p.get_by_role("button", name="Đơn hàng").click()
        expect(p.locator("article")).to_be_visible()
        record("UI05 · quyết định PostgreSQL đọc lại", "Đã xác nhận", p.locator("article .muted").inner_text())
        p.get_by_role("button", name="Doanh thu").click()
        expect(p.get_by_text("Tiền đã thu", exact=True)).to_be_visible()
        record("UI06 · đơn xác nhận chưa thu tiền", "0đ", p.locator(".amount").inner_text())
        for period in ["week","month"]:
            p.get_by_role("combobox").select_option(period)
            expect(p.locator(".amount")).to_have_text("0đ")
            expect(p.get_by_role("combobox")).to_have_value(period)
        p.screenshot(path=str(artifacts/"dashboard-mobile-revenue.png"), full_page=True)
        p.get_by_role("button", name="Cài đặt").click()
        p.get_by_role("button", name="Tắt thông báo thử nghiệm").click()
        expect(p.get_by_role("button", name="Bật thông báo thử nghiệm")).to_be_visible()
        p.reload()
        p.get_by_role("button", name="Cài đặt").click()
        expect(p.get_by_role("button", name="Bật thông báo thử nghiệm")).to_be_visible()
        record("UI07 · lưu cài đặt", False, A.request.get(origin+"/api/view?tab=settings").json()["alertsEnabled"])
        B, bp=pages["B"]
        data={"action":"confirm","code":codes["A"],"event":str(uuid.uuid4())}
        record("UI08 · mã shop A ở phiên kiểm thử B",404,B.request.post(origin+"/api/decision",data=data,headers={"Origin":origin}).status)
        record("UI09 · cài đặt B độc lập",True,B.request.get(origin+"/api/view?tab=settings").json()["alertsEnabled"])
        record("UI10 · quyết định sai origin",403,A.request.post(origin+"/api/decision",data=data,headers={"Origin":"http://unrelated.invalid"}).status)
        record("UI11 · phạm vi do máy chủ chọn",400,A.request.get(origin+"/api/view?tab=new&store=qa-shop-b").status)
        bp.get_by_role("button",name="Từ chối").click()
        bp.get_by_role("button",name="Đồng ý").click()
        expect(bp.get_by_role("status")).to_have_text("Chưa có yêu cầu chờ xác nhận.")
        bp.get_by_role("button",name="Đơn hàng").click()
        record("UI12 · từ chối ở Shop B","Đã từ chối",bp.locator("article .muted").inner_text())
        browser.close()
    print("Browser Chromium ·", len(results), "assertions PASS")
finally:
    (artifacts/"browser-qa.json").write_text(json.dumps(results,ensure_ascii=False,indent=2))
    server.terminate()
    server.wait(timeout=15)
