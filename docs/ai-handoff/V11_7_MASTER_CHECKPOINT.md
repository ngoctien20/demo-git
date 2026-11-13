# TIEN404 AI · V11.7 · 13/11/2026 JST

## 1. Kiến trúc và kiểm toán

WORK, bắt đầu từ c7ecde7 (V11.6), nhánh work/v11-5-zalo-first-notifications-20261113, [PR #32](https://github.com/ngoctien20/demo-git/pull/32). Auth staging bắt đầu từ 219dd086 trên [PR #7](https://github.com/ngoctien20/demo-git/pull/7). Nhánh gh-pages không tham gia release. Website công khai và account Render trả HTTP 200. Control Hub trả HTTP 403 cho GET công khai của phiên kiểm tra, chưa xác minh dữ liệu sau đăng nhập. Đã đọc preference n8n: tách DEMO và Commerce, giữ riêng Sheets, credential và workflow Published. Không sửa workflow n8n trong phiên này.

## 2. Workflow audit — VERIFIED

Bảng dưới ghi ID, version draft/published và execution gần nhất quan sát được. Messenger Published có memory, công cụ đọc Google Sheets, Create/Manage/Update Order, tra cứu trạng thái và tạo ticket. Bốn workflow Create, Manage, Update và Revenue có bản Draft khác Published. Execution Revenue 2695/2696 lỗi; 2696 báo tiền paid không hợp lệ tại Orders dòng 2. 2697 thành công; chưa kết luận đã sửa dữ liệu hoặc nguyên nhân. Telegram/Gmail 2689/2690 từng dừng ở bài thử chống trùng. Không ghi dữ liệu thật để tạo lại các lỗi.

| Workflow | ID | Draft | Published | Execution |
|---|---|---|---|---|
| TIEN404_MESSENGER_TEST | Z7FdV7uDvApfbURQ | d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92 | d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92 | 2246 success |
| AI_SALES_DEMO - Main Agent | v6PBwcqSapVzACMW | c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30 | c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30 | 2218 success |
| AI_SALES_AGENT_TEST | 3MzEyZgbwkRmO4NI | a7bf9c44-499c-4925-acc6-f7b046cfd2a7 | — | 978 success |
| Create Order Tool (AI_SALES_DEMO) | KrSn4DNR9ALX5ng4 | af9ee686-2a9f-483e-9622-6e449500ac5e | 4740251a-cd01-4f7f-b8e1-e300a8393151 | 2222 success |
| AI SALES - Manage Order | fDB9dvs1qPPVt9Sp | 2e8786fd-e5c5-410f-9d6c-655653c32278 | 137d5689-40c5-4147-9bbc-b22809ad5908 | 2233 success |
| AI SALES - Update Order. | BkAi6TVUKAjCnI7v | 3bd7043f-78e7-4a1c-93e5-2bc9d60ac767 | 93cf227a-ab8a-42c6-9185-7ec44f7aeb00 | 2236 success |
| AI SALES - Revenue Report | U2DJsxzSYPH5hRop | e4e16b90-1c66-48b9-a9e0-9d8fb6dbc6df | 978b5a8d-d47b-4783-b27e-96fbc96d5262 | 2697 success |
| TIEN404_AI_SALES_REVENUE_V2_STAGING | 6sdM8zacoYQP1g5X | 9a8f2378-a16f-442f-97b7-dd9271b73383 | — | 1604 success |
| TIEN404_MESSENGER_ORDER_STATUS | 4DFFCk60exrzaIl6 | 1faaa1ee-a45c-4bf0-8e3f-f197051f33f8 | 1faaa1ee-a45c-4bf0-8e3f-f197051f33f8 | 724 success |
| TIEN404_MESSENGER_SUPPORT_REQUESTS | KqSuGxCHixc6fsiu | ad55961f-2663-403f-b9b8-e110d4a44a18 | ad55961f-2663-403f-b9b8-e110d4a44a18 | 2247 success |

Lab V4.1 fixture 2iF5zAYxuO2AcCb3, draft 05c61de6-3ec8-4c26-aaa3-64001e3049b7 và chưa publish. Không xác định được artifact mang phiên bản V4.2 từ inventory có thể đọc. Không coi V4.2 đã được nghiệm thu. Giữ nguyên Zalo mock và Messenger guard V11.6.

## 3. Smart Order Notification — IMPLEMENTED / TESTED

Trên PostgreSQL CI, giao dịch checkout sẵn có tạo event/outbox cùng transaction. Hàm order_alert chỉ lấy nội dung khi claim hợp lệ, lease còn hạn, route phiên bản hiện tại, consent và membership còn hiệu lực. Đối chiếu pending và tổng order_items với orders; chỉ xuất SKU, số lượng, giá chốt, tổng, ID và thời gian. Format giờ Việt Nam, VND dạng văn bản; số điện thoại, địa chỉ, email, tên khách và mã nội bộ người nhận không đưa vào nội dung. Không tự suy ra tên sản phẩm lịch sử nếu chỉ có SKU và giá đã lưu. View pending_without_event phục vụ đối soát chỉ đọc. Chưa có job tự phát lại hoặc adapter V5 gọi provider thật. Lịch gửi đang tắt. Khi provider trả kết quả mơ hồ, kế thừa needs_review của V11.6.

## 4. Revenue Analytics V3 — VERIFIED trên Supabase staging

Migration 20261113034916 v11_7_merchant_revenue_v3_readonly tạo đúng một hàm STABLE SECURITY INVOKER. Quyền authenticated + RLS + active owner/manager. Hai chủ shop đọc kỳ 30 ngày có dữ liệu, đối chiếu số đơn và giá trị paid với RPC báo cáo ngày đã kiểm trước đó, bị từ chối 403/42501 khi đổi tenant. [Hai JWT trên staging](https://github.com/ngoctien20/demo-git/actions/runs/43361560766).

Kỳ ngày Việt Nam từ ngày đầu tới hết ngày cuối, tối đa 366 ngày; kỳ trước có cùng số ngày. Tổng số đơn, đơn pending/paid/cancelled, giá trị ghi trên tất cả đơn, giá trị paid, pending+confirmed, AOV paid và top 10 SKU theo số lượng trong đơn paid. Mỗi đơn được tổng hợp một lần, item được tổng hợp riêng. Định nghĩa theo ngày tạo và trạng thái hiện tại; chưa có payment ledger, paid_at, refund ledger, cost hay công nợ. Cash/profit/debt trả null. Số tiền dùng chuỗi số nguyên. Thiếu xếp hạng theo doanh thu, phân ngành, ngưỡng tồn theo shop và diễn biến chuyển trạng thái.

## 5. Customer Dashboard — IMPLEMENTED / TESTED

Render Auth triển khai LIVE commit d7bcf864d1dddde2e98dff2f1a70411c1fe0f6bc, deployment dep-dbr8irtckfvc73di0edg. Vào account với owner/manager → Báo cáo kinh doanh → chọn kỳ → Xem báo cáo. Giữ xuất CSV cũ. Kỳ hôm nay, hôm qua, 7 ngày, tháng đến hiện tại, năm đến hiện tại và tùy chọn. Giữ ranh giới khi đổi tài khoản/cửa hàng. UI notification candidate ưu tiên Telegram, Gmail và hộp thư, Zalo hiển thị tùy chọn. Hộp thư chưa gắn vào app đang LIVE vì schema notification chưa triển khai lên Supabase staging. [Account staging](https://tien404-auth-staging.onrender.com/account.html).

## 6. Merchant onboarding — IMPLEMENTED / TESTED ở Chromium cô lập

Component merchant/onboarding.mjs trình bày trạng thái do host đã xác minh, Messenger/Website Chat cho bán hàng, Dashboard cho thông báo và cho phép bỏ qua OA. Chưa kết nối tạo tenant, import sản phẩm, consent/OAuth và provisioning thật. Chưa tự kích hoạt trial hay production.

## 7. Messenger và Security — TESTED cô lập

Adapter nhận raw body, xác minh HMAC trước JSON, lấy tenant từ page binding đáng tin cậy, bỏ echo. Backend preview lấy giá/tồn theo tenant; giữ snapshot, sender, actor, hạn 10 phút; đối chiếu giá và tồn khi confirm, khóa preview và SKU, dùng cùng giao dịch với checkout; xác nhận cùng preview trả lại order ID cũ. Preview mới hủy preview cũ cùng sender và shop. Ingress MID có unique key; payload khác bị từ chối khi dùng lại cùng MID. Có thao tác rút preview trước khi mua. Đơn chỉ thông báo sau readback, pending. Commerce trừ kho theo backend thử nghiệm đã có; bot Sheets DEMO giữ nguyên quy trình hiện tại.

Giới hạn P0: adapter chưa nối webhook, sender/actor/mapping phải do server dựng. Cờ confirmed phải bắt nguồn từ hành động xác nhận của khách; chưa gắn nút xác nhận ký riêng, thu thập thông tin giao hàng hoặc nghiệm thu chuyển giao nhân viên. Chưa nghiệm thu AI hiểu tiếng Việt nhiều lượt bằng model live. Merchant Q&A candidate có bốn mẫu câu có dấu/không dấu, gọi report client được xác thực, từ chối kết luận lợi nhuận khi chưa có giá vốn. Chưa tích hợp vào n8n. Staff/nonmember JWT, hosted Super Admin/MFA, giới hạn subscription và quota ngoài phạm vi nghiệm thu lần này.

## 8. QA và release

- Ca doanh thu seed hai shop, hóa đơn trước/sau 00:00 Việt Nam, 1 paid, 1 pending, 1 cancelled. Mong đợi 3 đơn, paid 200, chưa thanh toán 500, kỳ trước 80, SKU 2 đơn vị. SQL kiểm đúng giá trị và chặn đọc chéo.
- Ca Commerce: khách chưa chốt, sai sender, đổi giá, rút preview, gửi lại cùng MID/confirm, xác nhận readback và event duy nhất. HMAC giả bị từ chối, text yêu cầu đổi tenant không thay đổi route.
- Kế thừa 2-worker claim, thu hồi consent, timeout/claim cũ, restore DB cô lập và policy V5. Chromium kiểm onboarding, báo cáo và khoảng ngày sai với RPC tổng hợp. [CI preview/order](https://github.com/ngoctien20/demo-git/actions/runs/43361407125).
- Lượt CI đầu 43360768880 FAIL vì schema auth ở fixture thiếu USAGE cho authenticated. Sửa fixture, giữ quyền staging hiện hành. [CI đã sửa](https://github.com/ngoctien20/demo-git/actions/runs/43360944679).
- Trước deploy UI: Auth CI 43361653542 và 43361647844, navigation CI 43361653722 thành công. Không thay đổi production, credential, billing hay workflow n8n.

## 9–13. Version, rollback, checkpoint và V11.8

Rollback UI: redeploy Render staging SHA 219dd0864d4a26500d758edbb803f3b8b5e61f73 (deployment trước dep-dbqjagd6e07s73fcpasg). Sau khi không còn client dùng V3, nếu cần thì thu hồi EXECUTE mới và gỡ đúng chữ ký public.merchant_revenue_v3(uuid,date,date) bằng corrective migration. Không đụng orders, RLS, RPC V11 hoặc lịch sử migration. Rollback candidate Commerce/notification bằng revert PR, không có schema tương ứng nào đã áp dụng cho dữ liệu thật.

V11.8:
1. P0 kiểm staff/nonmember thật, Super Admin/MFA và subscription server-side; kiểm chống lạm dụng report theo rate/quota.
2. Tách nguồn server đáng tin cậy cho page binding, xác nhận từng giỏ, thông tin khách hợp lệ, handoff và các tình huống thay đổi nhiều lượt; triển khai Messenger sandbox riêng với QA recipient.
3. Map recipient vault mỗi shop, tắt/bật và đổi người nhận có phân quyền/audit, tạm nghỉ, lịch report opt-in; kiểm consent ở thời điểm gửi. Đối soát pending thiếu event trước khi sửa. Không gửi tới người thật khi chưa duyệt.
4. Mount inbox/onboarding sau khi có API tương ứng, chạy mobile JWT E2E. Mở rộng báo cáo khi đã có nguồn giá vốn, lịch sử thanh toán/hoàn tiền và dữ liệu ngành.
5. Zalo OA tiếp tục tùy chọn, live BLOCKED — WAITING FOR OWNER. Production rollout và SaaS thu phí BLOCKED. Không tự tích checkbox Control Hub.

PILOT READINESS: NOT READY. PRODUCTION CHANGED: NO.

**Nghiệm thu cuối phiên.** [CI toàn bộ candidate a5be61a5](https://github.com/ngoctien20/demo-git/actions/runs/43361919950) SUCCESS. [Chromium đăng nhập thật sau deploy](https://github.com/ngoctien20/demo-git/actions/runs/43361830834) SUCCESS cho cả Shop A và Shop B: chọn tháng, số tiền render khớp response của đúng shop, reload, mở lại trình duyệt, logout và từ chối route. Mã nguồn Stage Auth d7bcf864; mã candidate cuối a5be61a5; commit bàn giao kế tiếp chỉ cập nhật tài liệu.
