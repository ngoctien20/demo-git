# Bước tiếp theo
Nhận ba việc có thể chạy song song: NGO-5 (Lab), NGO-6 (tenant/data), NGO-7 (diff AI SALES). NGO-8 thu kết quả và chặn trùng. Xem dependency và 10 ưu tiên trong MASTER_ROADMAP. Trước pilot cần kho staging, chính sách giá/chi phí, người nhận cảnh báo, consent và quyết định cho phép thử với shop cụ thể.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.

### Bàn giao theo issue
NGO-7: dùng chín fixture tái kiểm từng bản Revenue, xác định nguồn định dạng và lập phương án rollback trước review publish. NGO-5: chứng minh đường vận chuyển mock và kho fixture riêng trước khi chạy agent. NGO-9: chốt tiêu chí đánh giá cho 27 kịch bản nhiều lượt và 9 kịch bản một lượt.

## Giai đoạn 1 · Messenger Bot V1 cho một shop
Đầu phiên nhận mục theo số trong [MASTER_ROADMAP](MASTER_ROADMAP.md) và ghi nhận owner trên issue trước khi chỉnh sửa. Website nhận 9 trên nhánh staging; Super Admin nhận 6 trên cơ sở PR #2; Commerce nhận 4 và 5; Messenger Lab nhận 1, 3 và 7. Integration phụ trách 2, QA phụ trách 8, CTO/Operations phụ trách 10. Khi component đổi SHA hoặc workflow version, đọc diff trước khi tiếp tục. Ưu tiên chạy 1, 2 và 4 ngay; Website có thể đối chiếu nội dung ngay. Không merge các PR độc lập để lấy checkpoint. Chủ dự án duyệt chuyển từ fixture sang Page/shop thật và mọi thay đổi production liên quan.
