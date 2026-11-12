# PostgreSQL · phương án migration, chưa áp dụng
0. Không có Supabase project nhìn thấy. Mô hình sau là đề xuất; yêu cầu duyệt trước khi cấp hạ tầng có phí/production.
1. Identity: auth.users → users/memberships → tenants/stores. Unique membership (tenant_id,user_id). RLS default deny; policy đọc/ghi dựa trên membership và role; backend không nhận tenant từ prompt.
2. Catalog: products, product_variants, price_lists; unique (tenant_id,sku); cùng tenant cho các FK. Giá tiền VND integer, quantity/unit chuẩn hóa.
3. Commerce: customers, orders, order_items, inventory, notifications/outbox. Unique (tenant_id,idempotency_key); cập nhật tồn + đơn + outbox trong một transaction, retry không ghi kép; index tenant/store/status/created_at.
4. Subscriptions, payments và channel_connections. Unique provider/event ID theo provider/account. Secret chỉ lưu ref. bot_versions, bot_assignments, agent_evaluations, audit_logs tách scope và policy.
5. Migration trên staging với fixture hai shop, import dry-run, đếm và đối soát tiền/tồn, thử các FK và RLS, retry đồng thời, backup và restore vào DB tách; ghi RPO/RTO đo được. Cutover từng shop sau duyệt, rollback chuyển đọc về nguồn đã snapshot, reconcile mọi sự kiện sau cutover. Không đánh giá RLS/backup trước khi có DB thực.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.