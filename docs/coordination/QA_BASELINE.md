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

### Bộ ca bổ sung
- Bốn CSV trong Project. Hai bản single-turn giống từng byte (96 ca, chưa có output). Tệp lịch sử 97 dòng, 96 định nghĩa khớp baseline, QA01 lặp. Tệp 36 kịch bản có 27 kịch bản từ hai lượt và 9 kịch bản một lượt; cả 36 mang trạng thái NOT_RUN.
- Hai execution thủ công Revenue 934/936 dừng vì tổng tiền đơn paid không hợp lệ ở dòng 2. Fixture độc lập cho thấy bản published cộng 159 cho chuỗi `159.000` và 0 cho `159.000đ`; bản draft cho 159000 trong cả hai ca. Không suy ra giá trị tại dòng dữ liệu thật. Published đạt 3/9, draft 9/9 theo contract offline dưới đây. Chưa phê duyệt publish.
- Kết quả n8n đọc trực tiếp từ node assert: Catalog/Cart 17/17 (1473), V3 22/22 (1474), Extension 25/25 (1479), Revenue mock 8/8 (1604).
