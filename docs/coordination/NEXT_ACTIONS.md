# Bước tiếp theo
Nhận ba việc có thể chạy song song: NGO-5 (Lab), NGO-6 (tenant/data), NGO-7 (diff AI SALES). NGO-8 thu kết quả và chặn trùng. Xem dependency và 10 ưu tiên trong MASTER_ROADMAP. Trước pilot cần kho staging, chính sách giá/chi phí, người nhận cảnh báo, consent và quyết định cho phép thử với shop cụ thể.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.