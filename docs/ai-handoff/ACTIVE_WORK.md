# Công việc đang mở · WORK V9 → GPT V9.1

| Ưu tiên | Phụ trách | Điểm tiếp tục |
|---|---|---|
| P0 | Integration + QA | Dùng hai phiên bảo mật của hai account QA đã tồn tại. Chạy live_auth_acceptance.py tại PR5 với bộ cấu hình QA riêng, kiểm A/B qua Auth → gateway và PostgREST, refresh và session-local logout. Chỉ ghi mã HTTP, số dòng và PASS/FAIL. |
| P0 | Website | Kiểm recovery thực, mobile và sau logout với hai phiên độc lập. Kiểm trang Merchant có hiện đúng dữ liệu Shop A và màn hình trống tương ứng Shop B. |
| P0 | Data + Security | Form đã kiểm fixture, cờ tắt. Trình duyệt riêng phạm vi hai shop QA cho quyền chạy RPC tạo/sửa sản phẩm. Chờ duyệt thay đổi quyền ghi trước khi mở cho merchant. |
| P1 | Commerce | Kết nối giao dịch với identity DB giới hạn, xác minh quyền trên đường HTTP thật; sau đó kiểm n8n trong sandbox. |
| P1 | Messenger Lab | Phủ các ca còn thiếu trong scorer, giữ trace, version và loại nguồn; thêm hội thoại nhiều lượt và thiếu thông tin. |
| P1 | Admin + Ops | Nối quota vào adapter pilot sau kiểm chữ ký; thử tenant hết hạn, retries, sự cố, restore và cảnh báo. |

Khi bắt đầu mỗi phiên, fetch trước; ghi agent, version, branch, PR, start/end SHA, files, tests, deploy và blockers. Nếu nhánh đổi thì đọc diff và đối chiếu kết quả trước khi ghi checkpoint mới.


## GPT V10.1 — các release gate còn mở (ưu tiên phiên kế tiếp)

1. **P0 signed HTTP QA:** chạy `ops/data-platform/scripts/live_auth_acceptance.py` với hai phiên QA riêng trong kênh bí mật, bổ sung RPC negative (staff, anonymous, nonmember, sai shop, bảng trực tiếp). Không đưa mật khẩu/JWT vào GitHub hay chat. Chưa được đánh dấu PASS từ SQL mô phỏng.
2. **P0 Auth staging:** sau HTTP negative PASS, bật `PRODUCT_EDITOR_ENABLED` ở `assets/merchant-product.mjs` trên nhánh Auth PR7; chạy Chromium CI, xác minh SHA deploy Render, thử create/edit QA sản phẩm bằng account thật, rollback bằng tắt UI + thu hồi EXECUTE nếu lỗi. Không thay đổi production.
3. **P0 Messenger:** duyệt diff của Draft `d5c96b6b` so với Published `450d9d60`; kiểm phiên bản Published của Create/Manage/Update/Revenue trước bất kỳ promotion nào. Xác minh Page test, người nhận QA, Send API và webhook, bằng chứng backup JSON. Không Publish/tự gửi tin thật khi chưa có QA kênh riêng và phê duyệt.
4. **P1 AI Lab:** chạy Python scorer trên `qa/agent/recorded_v10_1_final.json` (5/7 kỳ vọng từ rule review) và `recorded_v10_1_hotfix.json` (2 ca hotfix), bổ sung bài test mô hình thực tế và rerun toàn bộ 7/7 trên phiên bản final mới nhất. Không tuyên bố 7/7 PASS từ hai ca hotfix.
5. **P1 pilot:** triển khai kênh Messenger QA riêng hoặc dùng môi trường isolated trước, không nối AI_SALES_DEMO Google Sheets vào TIEN404 Commerce tenant. Nghiệm thu giao dịch và xác thực khách hàng rồi mới đề xuất promotion.


## Website V10.2 — GitHub-first workstream

**Owner scope:** Tiếp tục nâng cấp qua GitHub và GitHub Pages demo/preview; chủ dự án tự mua domain sau này; **chưa phê duyệt production hosting/domain cutover**.

1. P0 — Widget: thống nhất design tokens từ `assets/style.css`; sửa lớp chat `assets/live-chat.css` và `assets/ai-consultant.js` tại branch riêng, kiểm mobile/keyboard/error; không đổi Messenger workflow.
2. P0 — Login/Account: chỉnh UI của nhánh `work/supabase-auth-staging-v1`; giữ nguyên Supabase Auth/RLS; test recovery, sessions, tenant A/B. Không bật merchant product editor trước signed JWT.
3. P0 — Super Admin: đưa nguyên mẫu `ops/super-admin` thành cổng read-only staging thật, tách khỏi trang Merchant; RBAC backend/MFA + audit, không ghi production.
4. P1 — Website release: triển khai CI, visual regressions và demo GitHub Pages sau QA; **không chuyển sang website thật**. Chỉ chuẩn bị hướng dẫn chi tiết cho domain/Render/Supabase production để sử dụng sau khi chủ dự án phê duyệt.
5. Mỗi hạng mục báo ba trạng thái riêng: mã đã commit, đã có link staging/preview, đã production (phải là NO đến khi cutover được duyệt). Xem `WEBSITE_V10_2_ROADMAP.md` và `RELEASE_GATES.md`.
