# Bằng chứng · 11/11/2026 JST

| ID | Môi trường, phiên bản, đầu vào | Mong đợi và kết quả |
|---|---|---|
| AUTH-ANON | Render gateway /tenants: không bearer và token sai; Supabase /user và PostgREST tenants/products/orders bằng publishable key | PASS. Gateway 401 AUTH_REQUIRED/INVALID_TOKEN_FORMAT. Supabase 401; PostgREST trả 42501. |
| AUTH-AB | Supabase staging, kiểm quyền authenticated với subject owner mỗi shop | PASS tầng DB. Mỗi bên thấy 1 sản phẩm, 1 đơn của mình. Không có quyền UPDATE membership hoặc products. Có 3 Auth user, 3 membership active, 2 tenant. |
| AUTH-HTTP | Hai JWT thật riêng cho A và B · runner PR5 3c29f70 | BLOCKED thiếu hai phiên độc lập của tài khoản QA trong runner. Có một session record ở mốc kiểm tra, chưa chứng minh token còn hạn. |
| BOT-RLS | [PostgreSQL 16 CI](https://github.com/ngoctien20/demo-git/actions/runs/42991022626), b4fabcb. Owner/manager của hai tenant, staff, nonmember, quyền ghi | PASS. DB staging sau migration: shop A đọc 1 cấu hình paused, B đọc 0, anon không có SELECT, merchant không có UPDATE. |
| TX | [HTTP fixture và PostgreSQL 16](https://github.com/ngoctien20/demo-git/actions/runs/42991004518/job/130423585981), 4ff447e | PASS tạo trùng, tranh kho cuối, rollback, thay số lượng theo giá ban đầu, xác nhận/hủy lại, thử giả actor/chéo tenant, retry, audit. Identity fixture. Gateway live chưa bật ghi. |
| ADMIN | [Admin isolated QA](https://github.com/ngoctien20/demo-git/actions/runs/42991247514), 0534ed3 | PASS backend, quota, quyền admin và mobile Chromium dùng fixture. |
| WEB | [Static/Sass QA](https://github.com/ngoctien20/demo-git/actions/runs/42991128894), 0f83a51 | PASS 27 trang và 877 liên kết/tài nguyên; không thử gửi yêu cầu liên hệ thực. |
| LAB | [QA scorer](https://github.com/ngoctien20/demo-git/actions/runs/42991189372), 55f49af | PASS sáu unit test và replay [trace 1909](https://ngoctien20.app.n8n.cloud/workflow/NvQfIffOrZokPBPW/executions/1909). Model dùng tool fixture, T-A 159.000đ/8. Các ca chưa ghi nhận giữ NOT_RUN. |
| N8N | [1910](https://ngoctien20.app.n8n.cloud/workflow/ZVmMlwe2g0bPjVEq/executions/1910), [1911](https://ngoctien20.app.n8n.cloud/workflow/tjsVobfjKLnv0o6b/executions/1911), [1912](https://ngoctien20.app.n8n.cloud/workflow/QR7aYMpLfKDLVgyH/executions/1912) | PASS 17 + 22 + 25 ca sandbox. Có 31 workflow, 16 active, 7 lõi có Published. 4 draft khác bản chạy là Create, Manage, Update, Revenue. [Cặp version](../coordination/TIEN404_AI_V8_QA_EVIDENCE.md). |
| RECOVERY | Email/PKCE hợp lệ, link hết hạn, dùng lại trên Android | BLOCKED: chưa có callback và phiên email QA để nghiệm thu. Trong Chromium fixture đã có kiểm chặn recovery giả. |

Chi phí thực, giao dịch bán hàng qua n8n, cấp quyền admin xuyên hệ thống và toàn bộ hành trình website tới shop thật chưa có bằng chứng nghiệm thu.
