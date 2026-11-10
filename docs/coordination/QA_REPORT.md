# Kết quả phiên CTO V2
Chạy lại 13 test frontend, 14 test monitor, 5 test kiểm fixture; 0 lỗi link trên 26 trang. Metadata graph active Messenger bị từ chối như thiết kế. Commerce 64/64 và Revenue mock 8/8 là kết quả lần trước có execution ID; không chạy lại trong phiên này. Chưa test auth/tenant/billing live, chat E2E, consent tracking hoặc email delivery.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.

### Kiểm tra bổ sung ngày 10/11/2026 (JST)
- Đã đối chiếu 9 kết nối qua thao tác đọc. Calendar trả danh sách lịch; Contacts trả 0 kết quả cho TIEN404. PostHog chỉ có Default project và ingested_event=false. Ba automation QA đang bật.
- Bốn CSV trong Project. Hai bản single-turn giống từng byte (96 ca, chưa có output). Tệp lịch sử 97 dòng, 96 định nghĩa khớp baseline, QA01 lặp. Tệp 36 kịch bản có 27 kịch bản từ hai lượt và 9 kịch bản một lượt; cả 36 mang trạng thái NOT_RUN.
- Hai execution thủ công Revenue 934/936 dừng vì tổng tiền đơn paid không hợp lệ ở dòng 2. Fixture độc lập cho thấy bản published cộng 159 cho chuỗi `159.000` và 0 cho `159.000đ`; bản draft cho 159000 trong cả hai ca. Không suy ra giá trị tại dòng dữ liệu thật. Published đạt 3/9, draft 9/9 theo contract offline dưới đây. Chưa phê duyệt publish.
- Kết quả n8n đọc trực tiếp từ node assert: Catalog/Cart 17/17 (1473), V3 22/22 (1474), Extension 25/25 (1479), Revenue mock 8/8 (1604).
- Phiên này chạy lại kiểm tra tĩnh 26 trang, 871 liên kết/tài nguyên, 0 lỗi và 14/14 test monitor. Frontend unittest local thiếu bs4, staging local thiếu pytest. [CI trình duyệt trên đúng SHA](https://github.com/ngoctien20/demo-git/actions/runs/42789167087) và [CI Super Admin trên đúng SHA](https://github.com/ngoctien20/demo-git/actions/runs/42802197626) đều success.
- Chạy `python qa/lab/check_sales_corpus.py HISTORY MULTI SINGLE COPY`. Contract JS xuất `checkRevenue(calculate)`, nhận hàm tính đồng bộ từ bản code node đã được review, với đầu vào là danh sách order fixture và đầu ra là object tổng hợp. Hai file kiểm tra chỉ dùng dữ liệu offline.
