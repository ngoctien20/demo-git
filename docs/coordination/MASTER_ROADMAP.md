# Roadmap và thứ tự nhận việc
Trạng thái động ở Linear. Các link bên dưới là danh mục tham chiếu theo thứ tự bắt đầu, không phải backlog ghi song song.

1. [NGO-5](https://linear.app/ngoctien20/issue/NGO-5/messenger-lab-co-lap-lab-messenger-va-chung-minh-khong-co-djuong) [MESSENGER_LAB] Cô lập Lab Messenger và chứng minh không có đường ghi/gửi thật
2. [NGO-6](https://linear.app/ngoctien20/issue/NGO-6/saas-infrastructure-chot-contract-tenant-va-thiet-ke-migration) [SAAS_INFRASTRUCTURE] Chốt contract tenant và thiết kế migration PostgreSQL
3. [NGO-7](https://linear.app/ngoctien20/issue/NGO-7/n8n-commerce-djoi-chieu-bon-draftlive-va-tai-hien-loi-revenue) [N8N_COMMERCE] Đối chiếu bốn draft/live và tái hiện lỗi Revenue
4. [NGO-8](https://linear.app/ngoctien20/issue/NGO-8/security-qa-hop-nhat-bang-chung-qa-va-chan-sua-trung-giua-cac-phien) [SECURITY_QA] Hợp nhất bằng chứng QA và chặn sửa trùng giữa các phiên
5. [NGO-9](https://linear.app/ngoctien20/issue/NGO-9/messenger-lab-cham-hoi-thoai-messenger-va-handoff) [MESSENGER_LAB] Chấm hội thoại Messenger và handoff
6. [NGO-10](https://linear.app/ngoctien20/issue/NGO-10/website-v4-hoan-thien-tu-van-web-dua-tren-consultant-hien-tai) [WEBSITE_V4] Hoàn thiện tư vấn web dựa trên consultant hiện tại
7. [NGO-11](https://linear.app/ngoctien20/issue/NGO-11/super-admin-quan-ly-shop-va-entitlement-tai-backend) [SUPER_ADMIN] Quản lý shop và entitlement tại backend
8. [NGO-12](https://linear.app/ngoctien20/issue/NGO-12/saas-infrastructure-kiem-vong-djoi-thue-bao-trong-sandbox) [SAAS_INFRASTRUCTURE] Kiểm vòng đời thuê bao trong sandbox
9. [NGO-13](https://linear.app/ngoctien20/issue/NGO-13/core-bot-chuan-bi-candidate-va-rollback-cho-core-bot) [CORE_BOT] Chuẩn bị candidate và rollback cho Core Bot
10. [NGO-14](https://linear.app/ngoctien20/issue/NGO-14/industry-bots-djong-goi-pilot-mot-djen-ba-cua-hang) [INDUSTRY_BOTS] Đóng gói pilot một đến ba cửa hàng

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.

### Điều chỉnh thứ tự theo kết quả QA
NGO-7 và NGO-5 cùng ưu tiên trước pilot. NGO-7 đã có bằng chứng sai doanh thu với hai cách ghi giá VND. NGO-8/9 dùng 96 định nghĩa single-turn duy nhất và phân loại chín kịch bản một lượt trước khi chấm độ liên tục hội thoại.

## Giai đoạn 1 · Messenger Bot V1 cho một shop
Mười việc dưới đây là phạm vi nghiệm thu của các issue đang mở. Linear giữ trạng thái. P0 chặn việc chạy Lab an toàn hoặc làm lẫn dữ liệu; P1 chặn bàn giao pilot. Thứ tự này thay thế thứ tự bắt đầu tổng quát ở trên cho giai đoạn 1.

| # | Mức | Issue và owner Work | Mục tiêu và tiêu chí hoàn thành | Phụ thuộc |
|---|---|---|---|---|
| 1 | P0 | [NGO-5](https://linear.app/ngoctien20/issue/NGO-5) · Messenger Lab | Cô lập đầu ra. Chặn toàn bộ đường đến Meta, Sheets thật và workflow ghi dùng chung. Một lượt đặt hàng fixture chỉ tạo bản ghi mock, số lần gửi/ghi ra bên ngoài bằng 0. | Bắt đầu ngay |
| 2 | P0 | [NGO-6](https://linear.app/ngoctien20/issue/NGO-6) · Integration | Ràng buộc danh tính shop. Ánh xạ Page đã xác thực → tenant/store trên server. Hai shop fixture có SKU trùng đọc đúng giá của mình; mapping thiếu hoặc xung đột bị từ chối trước khi gọi tool. | Bắt đầu ngay |
| 3 | P0 | [NGO-5](https://linear.app/ngoctien20/issue/NGO-5) · Messenger Lab | Chống xử lý trùng. Phát lại cùng MID, kể cả đồng thời, chỉ tạo tối đa một phản hồi và một ý định đặt hàng mock. Hai tin liên tiếp của cùng người gửi giữ đúng thứ tự. | Sau 1 và 2 |
| 4 | P1 | [NGO-7](https://linear.app/ngoctien20/issue/NGO-7) · n8n Commerce | Chuẩn hóa doanh thu VND. Đối chiếu draft/live và caller; chín fixture có expected/actual, giá định dạng VN được tính đúng và dữ liệu paid bất hợp lệ báo lỗi. Gắn version và rollback để review. | Bắt đầu ngay |
| 5 | P1 | [NGO-7](https://linear.app/ngoctien20/issue/NGO-7) · n8n Commerce | Kiểm giá, tồn và xác nhận đơn. Catalog fixture là nguồn giá. Từ chối SKU thiếu, lượng vượt tồn và giá chưa xác định. Trước xác nhận của chủ shop, hệ thống chỉ lưu đề nghị đơn trong fixture. | Sau 1 và 2 |
| 6 | P1 | [NGO-11](https://linear.app/ngoctien20/issue/NGO-11) · Super Admin | Tạm nghỉ đúng cửa hàng. Trên PR #2 staging, tạm nghỉ shop A chặn hành động của A, shop B vẫn hoạt động. Có audit, kiểm quyền và khôi phục trạng thái A. | Sau 2 |
| 7 | P1 | [NGO-9](https://linear.app/ngoctien20/issue/NGO-9) · Messenger Lab | Chuyển người xử lý. Ca cần tư vấn người thật tạo yêu cầu đến hộp nhận mock; bot dừng trả lời, chỉ tiếp tục khi có thao tác resume hợp lệ. Có bằng chứng cho cả hai trạng thái. | Sau 1 và 2 |
| 8 | P1 | [NGO-8](https://linear.app/ngoctien20/issue/NGO-8) · QA | Chạy hồi quy V1 theo phiên bản. Chạy 96 định nghĩa single-turn duy nhất và 36 kịch bản theo mode trên Lab đã cô lập. Tách 27 kịch bản nhiều lượt, ghi skipped kèm lý do. Mọi ca trọng yếu về giá, đơn, tenant, gửi trùng và handoff phải đạt trước pilot. | Sau 3, 5, 6 và 7 |
| 9 | P1 | [NGO-10](https://linear.app/ngoctien20/issue/NGO-10) · Website | Đối chiếu lời hứa trên web. Trên staging/mobile, kiểm đường demo và FAQ so với chức năng V1 đã nghiệm thu. Consultant chuyển người phụ trách khi gặp giá gói chưa duyệt. Bàn giao danh sách các cam kết cần sửa trước khi mời shop. | Đối chiếu ngay; chốt sau 8 |
| 10 | P1 | [NGO-14](https://linear.app/ngoctien20/issue/NGO-14) · CTO và vận hành | Diễn tập pilot một shop. Dùng fixture diễn tập onboarding, một yêu cầu đơn, chủ shop duyệt, tạm dừng và rollback. Lưu thời gian, số lỗi, người trực, chi phí quan sát được hoặc UNKNOWN. Trình chủ dự án duyệt shop/kênh trước kết nối thật. | Sau 4, 6, 8 và 9 |

**Cổng A — Lab:** QA xác nhận mock transport, kho fixture, mapping hai tenant và xử lý MID. **Cổng B — nghiệp vụ:** đối chiếu giá/tồn, doanh thu, handoff, pause và regression. **Cổng C — pilot:** một shop, một Page, một người trực; chủ shop duyệt từng đơn. Dừng pilot nếu gửi trùng, sai giá, ghi sai shop hoặc mất khả năng handoff. Khôi phục bằng tạm nghỉ entitlement của riêng shop và đưa hội thoại về người trực. Mỗi cổng lưu SHA, workflow version, suite/run, expected/actual, owner và bằng chứng rollback. NGO-12 và NGO-13 tiếp tục trong backlog; billing thật và phát hành Core cần quyết định riêng.
