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
