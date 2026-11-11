# Kiến trúc triển khai

Public Pages phục vụ marketing và demo. PR4 cung cấp đường sang Auth staging. Render Auth dùng Supabase Auth, xác minh getUser, active membership, rồi truy vấn PostgREST với JWT của merchant. Dashboard hủy dữ liệu đã render khi đổi phiên. RLS phía DB giới hạn hàng và vai trò.

Supabase staging ifxlvrhyjhbzbrkdsida lưu tenant, membership, catalog, đơn và chi tiết, customer, conversation, message; các bảng riêng dành cho idempotency, audit và channel secrets. Bảng V9 tenant_agent_configs chỉ lưu metadata cho pilot_lab, ràng buộc bot và model, khóa (tenant_id, channel). Chỉ owner/manager đang active đọc được. QA Shop A có một cấu hình paused; Shop B chưa gán. Workflow lab NvQfIffOrZokPBPW phiên bản 4c2575de-5a92-41aa-88ab-c84f7e2e7e9f. Prompt và knowledge mang fingerprint SHA-256 của cấu hình node và công cụ fixture. Bảng không kích hoạt n8n.

Render Data kiểm bearer với Supabase, kiểm membership và chuyển JWT cho PostgREST. Các lệnh checkout/change/confirm/cancel của PR5 cần kết nối Commerce được cấp riêng. Entrypoint hiện dùng chế độ chỉ đọc. n8n dùng handshake riêng; AI_SALES_DEMO và Messenger tách khỏi Commerce sandbox. Admin dùng FastAPI/SQLite với MFA/RBAC và quota kiểm ở server. Chưa có cầu nối cấp shop/bot/gói end-to-end. [Chi tiết V8](../coordination/TIEN404_AI_V8_ARCHITECTURE.md).


RPC merchant_paid_orders_daily chạy SECURITY INVOKER với JWT hiện tại, kiểm owner/manager, RLS và khoảng 7/30 ngày. SQL cộng tiền VND bằng numeric và trả tổng dạng chuỗi; trình duyệt dùng BigInt. Chỉ đơn có trạng thái hiện tại paid được tính, nhóm theo ngày tạo ở Asia/Ho_Chi_Minh. Không có trường thời điểm thực nhận tiền. Giá trị, kỳ và dữ liệu rỗng được hiển thị trong phần tổng quan.

Form chỉnh catalog riêng chỉ có mặt khi bật cờ build; mặc định false. Khi sửa dùng updated_at chống ghi đè phiên bản và không đặt lại tồn. Việc thay quyền ghi ở Supabase cần quyết định riêng.
