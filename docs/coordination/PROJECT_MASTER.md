# TIEN404 AI · Quy ước điều phối
GitHub giữ mã và contract có version. n8n xác nhận cấu hình thực chạy. Linear giữ owner, trạng thái và dependency. Drive giữ báo cáo quản trị. Sites vận hành Control Hub. PostHog chỉ giữ số liệu sản phẩm khi có consent. Gmail dành cho thông báo đã được phép. DB nghiệp vụ SaaS chưa được chọn để vận hành thật.

Phiên Work đọc CURRENT_STATUS, nhận một issue, so SHA và cả draft/live n8n, rồi mới sửa. Khi mâu thuẫn, nguồn runtime quyết định bản đang chạy, Git quyết định mã được review, Linear quyết định quyền sở hữu task. Đăng discrepancy gồm nguồn A/B, thời điểm, owner và hành động. Trạng thái tài liệu gồm VERIFIED, IMPLEMENTED, TESTED, PROPOSED, BLOCKED, UNKNOWN.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.

## Giai đoạn 1 · Messenger Bot V1 cho một shop
| Thông tin | Nguồn chịu trách nhiệm |
|---|---|
| UI, contract, test, chính sách version | GitHub; gh-pages cho bản web, PR #2 cho staging admin, PR #3 cho điều phối |
| Cấu hình workflow đang chạy, kết quả execution | n8n activeVersionId và execution ID; draft để review |
| Catalog/order của AI SALES_DEMO | Sheets theo tool hiện hành; chỉ dùng fixture riêng cho QA |
| Tenant, subscription và tiền của SaaS | Chưa xác lập nguồn production. SQLite của PR #2 chỉ chứng minh staging |
| Phiên bản Control Hub | Sites version/deployment; D1 của Hub chỉ thuộc phạm vi Hub |
| Trạng thái công việc và chủ sở hữu theo nhóm | Linear TIEN404 AI |
| Quyết định quản trị và báo cáo nghiệm thu | Drive 09_REPORTS, liên kết đến SHA và issue |
| Analytics, thông báo, corpus | PostHog cho sự kiện có đồng ý; Gmail chuyển thông báo đã duyệt; CSV trong Project là dữ liệu kiểm thử tham chiếu |
