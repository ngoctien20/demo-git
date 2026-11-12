# Bằng chứng QA · 11/11/2026 JST

Mốc kiểm tra của phiên 07:00–12:36 JST. SHA là bản được thử. Kết quả có dữ liệu fixture được ghi riêng.

| ID | Môi trường / phiên bản | Đầu vào và kỳ vọng | Thực tế | Kết quả |
|---|---|---|---|---|
| AU-01 | Render Chrome, d25d683, deploy dep-dbpu1qajnfac73efpjr0 | Mở login khi chưa có session. SDK phải thoát trạng thái chờ. | Nút ban đầu disabled, sau đó bật và hiển thị hướng dẫn đăng nhập. | PASS lượt mở thật |
| AU-02 | [Auth CI](https://github.com/ngoctien20/demo-git/actions/runs/42952921292), d25d683 | Chromium mobile dark, thiếu module, SDK giả lập, recovery giả, đổi danh tính/refresh/logout | Có lỗi và nút thử lại khi mất module. Recovery giả bị từ chối. Owner thấy tổng đơn, staff không thấy, dữ liệu lẫn tenant bị xóa. | PASS transport giả lập |
| AU-03 | [Run lỗi trước đó](https://github.com/ngoctien20/demo-git/actions/runs/42919640696) | Gửi form recovery ngay khi HTML xuất hiện | Test chạy trước lúc JS gắn handler. Đã chờ nút login sẵn sàng và sửa assertion danh sách/overview. | FAIL cũ, đạt lại AU-02 |
| AU-04 | Trình duyệt Shop B trên bản cũ | Sau login hiển thị Shop B, quyền owner | Ảnh do chủ dự án cung cấp, ghi ở [hồ sơ](https://github.com/ngoctien20/demo-git/blob/0bdea384/docs/TIEN404_AI_V8_1_QA_EVIDENCE.md). | PASS phạm vi ảnh |
| AU-05 | HTTP thật A/B, browser Android | Login, refresh/expiry, kiểm tenant đối diện, logout rồi mở lại trang riêng | Runner live_auth_acceptance.py báo NOT_RUN vì không có bộ cấu hình tài khoản QA. Chưa có kết quả trên bản mới. Recovery email/allowlist chưa nghiệm thu. | BLOCKED |
| DB-01 | Supabase staging, transaction read only + rollback, thử lần lượt owner A và B | SET LOCAL ROLE authenticated, subject của từng QA owner. So sánh tổng truy cập với dữ liệu shop mình | Mỗi bên thấy 1 tenant, 1 product, 1 order. Số sản phẩm/đơn của chính mình đều 1. UPDATE membership false. | PASS tại DB |
| DB-02 | Supabase staging, evidence phiên phối hợp | Subject không membership và role anon | 8 bảng trả 0 với nonmember. Anon SELECT tenants bị từ chối 42501. | PASS tại DB, [nguồn](https://github.com/ngoctien20/demo-git/blob/0bdea384/docs/TIEN404_AI_V8_1_QA_EVIDENCE.md) |
| TX-01 | [Postgres 16](https://github.com/ngoctien20/demo-git/actions/runs/42911841059), 26148b9 | Gửi trùng đồng thời, retry, đổi payload cùng key, tranh đơn vị kho cuối, thiếu SKU giữa giao dịch, cancel hai lần | Một đơn cho cùng key, tổng tính từ DB, kho và audit khớp sau rollback/hoàn. Từ chối tenant khác. | PASS DB dùng một lần |
| CAT-01 | [Postgres 16 CI](https://github.com/ngoctien20/demo-git/actions/runs/42953568123), f4b465f | Gọi RPC tạo SKU, sửa metadata, gửi bản cũ, tạo SKU trùng và ghi sang tenant khác | Tạo/sửa đúng trong shop, stock giữ ở 8 khi sửa. Từ chối phiên bản cũ, SKU trùng và tenant khác. Có đúng hai audit. Anon không có EXECUTE, authenticated không có UPDATE bảng. | PASS RPC ứng viên, chưa áp dụng Supabase |
| DR-01 | [Postgres 16 CI](https://github.com/ngoctien20/demo-git/actions/runs/42953266129), 751fbf2 | Dump/restore sang DB khác, so checksum toàn bộ INSERT, đếm orders/audit, kiểm RLS/grant | Job restore thành công. Khôi phục 2 đơn và 3 sự kiện, sản phẩm vẫn có RLS và không cấp UPDATE cho authenticated. | PASS fixture |
| AI-01 | [n8n execution 1909](https://ngoctien20.app.n8n.cloud/workflow/NvQfIffOrZokPBPW/executions/1909), draft 4c2575de | Hỏi giá và tồn T-A. Fixture tool có 159000 VND, 8 chiếc. | gpt-5-mini gọi tool một lần, trả đúng giá và tồn. 13,639 giây toàn workflow, 1.272 token ước tính. Không có số chi phí tính tiền. | PASS hội thoại thật, catalog QA |
| LAB-01 | Python local, e73a580 | Knowledge thiếu version, tenant sai, scope ngành, fixture có credential/node ngoài allowlist | 10 unittest đạt. | PASS offline |
| GW-01 | [Gateway smoke](https://github.com/ngoctien20/demo-git/actions/runs/42911840579) + [Data suite](https://github.com/ngoctien20/demo-git/actions/runs/42911850960) | Kiểm bề mặt triển khai và contract data | Hai run success. | PASS phạm vi suite |
| NAV-01 | [CI navigation](https://github.com/ngoctien20/demo-git/actions/runs/42952921302), d25d683 | Kiểm điều hướng và tài nguyên | success. Kiểm local registry còn kiểm 15 trang marketing có một loader. | PASS static |
| ADM-01 | [Admin isolated QA](https://github.com/ngoctien20/demo-git/actions/runs/42911850953) | Suite bảo mật admin cô lập | success. Tích hợp MFA và merchant thật chưa chạy. | PASS isolated |

## So khớp trực tiếp 7 workflow

| Workflow | Draft | Published |
|---|---|---|
| [TIEN404 WEBSITE — DEMO & MARKETING AI (QA ISOLATED)](https://ngoctien20.app.n8n.cloud/workflow/wgkkmT7q4lm4HyuA) | `fcda12f3-35c6-473e-bc9d-2359ada3989c` | `fcda12f3-35c6-473e-bc9d-2359ada3989c` |
| [AI SALES - Manage Order](https://ngoctien20.app.n8n.cloud/workflow/fDB9dvs1qPPVt9Sp) | `2e8786fd-e5c5-410f-9d6c-655653c32278` | `137d5689-40c5-4147-9bbc-b22809ad5908` |
| [Create Order Tool (AI_SALES_DEMO)](https://ngoctien20.app.n8n.cloud/workflow/KrSn4DNR9ALX5ng4) | `af9ee686-2a9f-483e-9622-6e449500ac5e` | `4740251a-cd01-4f7f-b8e1-e300a8393151` |
| [TIEN404_MESSENGER_TEST](https://ngoctien20.app.n8n.cloud/workflow/Z7FdV7uDvApfbURQ) | `450d9d60-3853-45f3-979f-20164a4adc7b` | `450d9d60-3853-45f3-979f-20164a4adc7b` |
| [AI_SALES_DEMO - Main Agent](https://ngoctien20.app.n8n.cloud/workflow/v6PBwcqSapVzACMW) | `c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30` | `c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30` |
| [AI SALES - Revenue Report](https://ngoctien20.app.n8n.cloud/workflow/U2DJsxzSYPH5hRop) | `e4e16b90-1c66-48b9-a9e0-9d8fb6dbc6df` | `978b5a8d-d47b-4783-b27e-96fbc96d5262` |
| [AI SALES - Update Order.](https://ngoctien20.app.n8n.cloud/workflow/BkAi6TVUKAjCnI7v) | `3bd7043f-78e7-4a1c-93e5-2bc9d60ac767` | `93cf227a-ab8a-42c6-9185-7ec44f7aeb00` |

Các graph thay đổi vẫn trùng phiên bản ở [bằng chứng hành vi V7.1](TIEN404_AI_V7_1_QA_EVIDENCE.md). Create siết giá lỗi, Manage chặn tổng mâu thuẫn, Update siết địa chỉ/điện thoại, Revenue thay parse tiền và từ chối paid total lỗi. Revenue Published từng đạt 3/9 và Draft 9/9 trên cùng fixture. Chưa có shadow report trên dữ liệu đã khử định danh hoặc duyệt publish.
