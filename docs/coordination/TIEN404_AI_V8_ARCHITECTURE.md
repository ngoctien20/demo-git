# Kiến trúc đang chạy · 11/11/2026 JST

| Lớp | Đường dữ liệu và nguồn | Giới hạn |
|---|---|---|
| Public website | GitHub Pages, 6 mục điều hướng. Widget marketing dùng knowledge công khai, có đường dự phòng dùng model. | Login/demo trên Pages khác với Supabase merchant staging. |
| Merchant Auth | Render static → Supabase email/password → getUser → active membership → tenants. SDK có CDN dự phòng và timeout. Sau đổi danh tính giao diện xóa dữ liệu cũ. | Recovery qua email đang khóa. Owner/manager thấy 4 số đếm và có danh sách đơn. Staff chỉ có tổng sản phẩm. |
| Catalog/Orders | Account đọc PostgREST với publishable key và JWT, lọc tenant, kiểm lại tenant từng dòng. SKU/trạng thái bán, mã đơn/trạng thái đơn, mỗi lần tối đa 20 dòng. | Không công bố doanh thu, chi phí hoặc hoạt động AI khi thiếu định nghĩa và dữ liệu. |
| Data gateway | FastAPI Render, xác minh bearer tại Supabase, kiểm membership và chuyển JWT tới PostgREST. Orders dành cho owner/manager. | Gateway hiện chỉ đọc. HMAC cho n8n là cơ chế riêng, chống replay trong bộ nhớ của tiến trình. |
| PostgreSQL | Supabase staging ifxlvrhyjhbzbrkdsida. Public có tenants, tenant_memberships, products, orders, order_items, customers, conversations, messages. Private có audit, idempotency, channel secrets. RLS bật 11 bảng đã kiểm. | Client không có quyền trực tiếp thêm/sửa products hoặc sửa orders. Hai shop đều có 1 sản phẩm, 1 đơn. A có 1 membership active, B có 2. |
| Commerce candidate | Checkout/cancel phía server dùng transaction, membership, idempotency key và khóa hàng. RPC sản phẩm lấy actor từ auth.uid(), có version khi sửa và audit cùng giao dịch. | Code bên PR #5, thử trên DB dùng một lần. Chưa có route ghi trên gateway LIVE. Không cho frontend truyền actor. |
| Bots, AI Lab | Registry ở PR #6, 6 agent có model/version. 31 workflow gồm tool, agent, QA và hạ tầng. Lab có knowledge offline theo tenant/ngành, catalog cố định và agent QA dùng model thật. | Registry chưa có mapping bot cho từng shop. Model gpt-5-mini trong graph không chứng minh mọi lần chạy đều gọi model. |
| Super Admin/SaaS | PR #2 có dịch vụ MFA/RBAC và adapter trạng thái. Billing/checkout website ở mức minh họa. | Chưa có acceptance liên thông cấp shop, gói, quota, bot và phí. |

[Account source](https://github.com/ngoctien20/demo-git/blob/d25d683/assets/auth-account.js) · [Data source](https://github.com/ngoctien20/demo-git/tree/f4b465f/ops/data-platform) · [Registry](https://github.com/ngoctien20/demo-git/blob/0a65513/data/workflow-registry.v5.json) · [Kiến trúc V7.1](TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md).
