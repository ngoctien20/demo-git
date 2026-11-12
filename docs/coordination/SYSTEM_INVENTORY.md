# Kiểm kê hệ thống
|Hệ thống|Trạng thái|Giới hạn|
|---|---|---|
|Website công khai|TESTED trên Pages|26 trang; 13 test contract|
|Customer Dashboard|IMPLEMENTED demo|Số liệu mẫu, chưa có tenant session đã nghiệm thu|
|Super Admin|IMPLEMENTED staging PR #2|Có backend RBAC và audit staging, production UNKNOWN|
|Subscription|TESTED staging PR #2|Entitlement/fixture đã kiểm; thu tiền thật UNKNOWN|
|Website Sales AI|IMPLEMENTED demo.html|n8n marketing riêng; chưa test E2E trong đợt này|
|Commerce|TESTED sandbox|64 ca, chưa nghiệm thu giao dịch thật|
|Messenger Lab|BLOCKED cho E2E ghi|Workflow tên TEST đang active và có công cụ ghi|
|Core Bot|PROPOSED|Thiếu candidate được duyệt|
|Industry Bot Factory|IMPLEMENTED mẫu ngành|Chưa phát hành core/profile|
|Integration Center|PROPOSED|Có một đường Messenger; chưa onboarding độc lập theo shop|
|QA & Security|TESTED từng phần|Ba lịch hiện có; chưa nghiệm thu RLS hoặc backup/restore|
|Control Hub|VERIFIED Site|V1 có publish, v2 có bản lưu; monitor GitHub riêng|

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.