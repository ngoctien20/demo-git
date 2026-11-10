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