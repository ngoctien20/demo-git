# Kiến trúc đang vận hành

| Thành phần | Đường dữ liệu và ranh giới quyền |
|---|---|
| Marketing | GitHub Pages và Cloudflare Pages dùng gh-pages. Widget PR #19 thử trên URL preview bất biến. Webhook là đầu vào công khai, không mang quyền Merchant. |
| Merchant | Render tĩnh tải Supabase SDK. Auth xác minh user, membership và RLS kiểm tra truy vấn PostgREST/RPC. CSV được tạo từ các dòng tổng hợp đã kiểm scope. |
| Supabase staging | Chín bảng public gồm tenants, tenant_memberships, products, orders, order_items, customers, conversations, messages, tenant_agent_configs. RLS trên cả chín. Hai tenant QA, ba Auth user. RPC ghi thử sản phẩm có allowlist. |
| Data staging | Dịch vụ Render khác Auth. Health xác nhận cấu hình. Cần đo kết nối bằng request có danh tính thật. |
| Commerce và Messenger | Messenger có bản Published riêng. Ba suite Commerce dùng fixture. Bản chấm câu trả lời AI chạy ngoài luồng nhắn tin. |
| Super Admin | FastAPI/SQLite là prototype đã có QA. Chưa nghiệm thu liên kết danh tính SaaS/MFA trên host. |

Quản lý thuê bao, lập hóa đơn, theo dõi chi phí theo tenant và kênh Zalo còn trong backlog. Chưa có số liệu để quyết định tách thêm Sales, Support hoặc Reporting Agent.


## 12/11/2026 — Architectural clarification (no new production components)

- Merchant V10.1 QA-only `public.save_merchant_product` is a deliberate narrow **SECURITY DEFINER** write capability for exactly two test tenant UUID+slug pairs; its stale version error now uses terminal PostgREST `PT409` to avoid a retry storm. Direct product-table writes remain denied to authenticated sessions. It is not a general multi-tenant production write API.
- Cloudflare Pages canonical deployment uses `gh-pages` (one production SUCCESS); feature-branch preview events can be skipped when preview disabled. The latest event need not be the latest successful deployment.
- Render Auth (static) and Data (Python API) are distinct staging services; a LIVE health response is not proof of full Auth/RLS integration.
- New V11 read-only public smoke script checks four public service origins and two negative tenant gateway requests, without Auth tokens or write tools. This CI complements—not replaces—Work V11 browser tests and signed JWT E2E.

### 12/11 · phiên Merchant và đường ghi

Account đăng xuất bằng scope local; runner dùng profile Chromium riêng cho từng QA shop, giữ profile qua hai lần khởi động và xóa khi kết thúc. Backend hosted chỉ chạy gateway đọc và handshake. API giao dịch sử dụng kết nối DB riêng trong CI. Supabase RPC ghi catalog là một đường khác, có allowlist đúng hai shop QA. n8n có 33 workflow, 16 active; inbox Agent Factory chưa active.
