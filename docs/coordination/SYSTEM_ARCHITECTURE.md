# Kiến trúc hiện tại và đích
Hiện tại: GitHub Pages → mã tĩnh và dữ liệu mẫu trong trình duyệt. demo.html → n8n marketing QA. Sales Lab → mô phỏng cục bộ. Messenger → Agent → công cụ AI SALES_DEMO/Sheets → Send API. Commerce sandbox → tenant resolver → catalog/cart/rules. Sites Control Hub + D1 độc lập với Pages và monitor staging.

PROPOSED: web/kênh → backend xác thực và ánh xạ shop → kiểm entitlement → công cụ n8n → giao dịch PostgreSQL → outbox → adapter kênh. Chỉ server nắm secret. Chỉ chuyển từng module sau khi migration và rollback trên staging đạt.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].

