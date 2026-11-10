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

