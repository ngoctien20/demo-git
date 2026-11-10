# QA baseline · 10/11/2026
|Bộ kiểm|Kết quả|Bằng chứng|
|---|---|---|
|Pages tĩnh tại 7bf9c660|26 trang, 871 link/resource, 0 lỗi|python qa_static.py|
|Frontend contracts|13/13 chạy lại offline|unittest discover -s tests|
|Monitor PR #1|14/14 chạy lại offline|unittest discover -s ops/control-hub/tests|
|Kiểm fixture mới|5/5 offline|python -m unittest discover -s qa/lab -q|
|Graph active Messenger|Bị chặn đúng kỳ vọng|CLI check_fixture.py trả 1 với metadata thật đã rút gọn|
|Commerce Catalog/Cart, core, extension|17/17, 22/22, 25/25|checkpoint 01 đọc assertion trên ba execution|
|Revenue mock|8/8|checkpoint 01, staging|
Bộ kiểm mới chỉ nhận fixture trơ (manualTrigger, noOp, stickyNote không tham số); không xác nhận an toàn cho graph Agent tùy ý, không chạy n8n. Để chấm bot cần mock chức năng và bộ đánh giá hội thoại riêng.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.