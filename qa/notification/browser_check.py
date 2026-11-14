"""Isolated browser contract test. Browser input is synthetic, no provider connections."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

code = Path("merchant/notification-center.mjs").read_text().replace("export function", "function", 1)
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={"width":360,"height":780})
    page.set_content('<html lang="vi"><meta name="viewport" content="width=device-width"><main></main></html>')
    page.add_script_tag(content=code)
    page.evaluate("""() => {
      window.mode='ok';
      const client={rpc:async(name,body)=>{
        if (body.p_shop!=='A') throw Error();
        if (name==='mark_merchant_notification_viewed') return {data:body.p_event==='e'};
        if (window.mode==='error') return {error:true};
        if (window.mode==='denied') return {data:[]};
        return name==='merchant_notification_channels' ? {data:[{channel:'zalo',connection_state:'waiting_for_owner'}]}
          : {data:[{event_id:'e',order_id:'QA-1',created_at:'2026-11-13T00:00:00Z',deliveries:[{channel:'zalo_bot',status:'held',attempts:0,last_error_code:'SEND_DISABLED'}]}]};
      }};
      window.unmount=mountNotificationCenter(document.querySelector('main'),client,'A');
    }""")
    expect(page.get_by_text("Zalo · Tùy chọn · Chờ xác minh OA")).to_be_visible()
    expect(page.get_by_text("Bot Zalo của cửa hàng · Tạm giữ · Số lần thử: 0 · Đang khóa gửi tin")).to_be_visible()
    page.get_by_role("button",name="Đánh dấu đã xem").click()
    expect(page.get_by_role("button",name="Đã xem trong hộp thư")).to_be_disabled()
    for mode, message in [('error','Chưa tải được thông báo.'),('denied','Bạn chưa có quyền')]:
        page.evaluate('(m)=>window.mode=m',mode)
        page.get_by_role("button",name="Tải lại").click()
        expect(page.get_by_role('status')).to_contain_text(message)
        expect(page.get_by_text('Đơn QA-1')).to_have_count(0)
    page.evaluate('window.unmount()')
    expect(page.get_by_role('button')).to_have_count(0)
    browser.close()
print("PASS mobile Chromium, mock RPC, read confirmation, error, denied and unmount")

# Exercise the revenue panel against a synthetic tenant-scoped RPC. No credentials.
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={"width":360,"height":780})
    page.set_content('<html lang="vi"><main></main></html>')
    for script in ['revenue-panel','onboarding']:
        page.add_script_tag(content=Path(f'merchant/{script}.mjs').read_text().replace('export function','function'))
    page.evaluate("""() => {
        const root=document.querySelector('main');
        mountOnboarding(root,{membershipVerified:true,dashboardAvailable:true});
        mountRevenuePanel(root,{rpc:async(name,args)=>{
          if(name!=='merchant_revenue_v3'||args.p_shop!=='A')throw Error();
          return {data:{basis:'created_at_current_status',periods:{current:{paid_order_value_vnd:'200',unpaid_order_value_vnd:'500',
            orders:2,pending:1,paid:1,cancelled:0},previous:{paid_order_value_vnd:'0'}},top_skus_by_units:[]}};
        }},'A');
    }""")
    expect(page.get_by_text('Zalo OA · Tùy chọn · Có thể bỏ qua')).to_be_visible()
    page.get_by_role('button',name='Xem báo cáo').click()
    expect(page.get_by_role('status')).to_contain_text('Giá trị đơn đã thanh toán: 200 đ')
    page.get_by_label('Kỳ báo cáo').select_option('custom')
    page.get_by_label('Từ ngày').fill('2026-11-15')
    page.get_by_label('Đến ngày').fill('2026-11-01')
    page.get_by_role('button',name='Xem báo cáo').click()
    expect(page.get_by_role('status')).to_contain_text('Chọn kỳ báo cáo')
    browser.close()
