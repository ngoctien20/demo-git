# Lịch sử bằng chứng phát hành
|Tài sản|Mốc|Ý nghĩa|
|---|---|---|
|Website gh-pages|7bf9c660|Checkpoint Pages kiểm lại trong phiên|
|Monitor|PR #1, 385782af|Draft, chưa merge|
|Control Hub Sites|V1 publish succeeded; V2 đã lưu|Chưa có bằng chứng publish V2|
|Core Bot|UNKNOWN|Chưa có phê duyệt phát hành|
|CTO V2|Bộ docs và kiểm fixture|Bản review; không phải release runtime|
Mỗi release mới cần SHA/version, manifest, suite, approval, người thực hiện, thời điểm và rollback.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.