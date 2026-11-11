# Bàn giao cho phiên sau

Fetch các branch của PR #13–20 và ref staging, đối chiếu deployment LIVE trước khi sửa. PR #20 phụ trách cơ chế phối hợp agent, #14 là bàn giao sản phẩm. Release Auth đã chứa #16 và #17; kiểm ancestry trước khi hợp nhất.

**Control Hub:** Có thể ghi nhận bài kiểm Render ẩn danh, RLS PostgreSQL hai chiều, và regression Commerce sandbox ở cấp nhiệm vụ con. Chưa tích mục cô lập E2E, trừ/hoàn kho giao dịch hoặc hành trình demo → nghiệp vụ. Việc kiểm phiên bản workflow ghi nhận theo từng ID/version; bốn draft đang lệch.

**Pilot đề xuất**

| Quy mô | Điều kiện vào | Điều kiện mở rộng |
|---|---|---|
| 1 shop | Auth/RLS signed HTTP và restore đạt, cử đầu mối hỗ trợ, duyệt kênh và dữ liệu | Đối soát từng đơn/tồn kho, bàn giao nhân viên và chi phí; dừng nếu sai quyền hoặc lệch kho |
| 3 shop | Một shop đã đối soát, giới hạn tool/quota theo tenant | Phân biệt đúng dữ liệu, sự cố và chi phí từng shop; thử rollback một tenant |
| 5 shop | Có cảnh báo, kiểm tải đồng thời, ca trực hỗ trợ và quy trình sự cố | Đo độ trễ, tỷ lệ lỗi, chi phí/đơn trước khi quyết định mở rộng |

Ước chi phí mỗi shop từ số lượt chat × token vào/ra thực đo × đơn giá model đã chọn, cộng phần hạ tầng và hỗ trợ. Chưa có dữ liệu để báo con số tiền. Domain: chọn tên, kiểm khả dụng và báo giá Mắt Bão tại thời điểm quyết định, duyệt chi phí, sau đó mới cấu hình Cloudflare DNS và kiểm TLS/rollback.

Điểm chạy QA danh tính đã có sẵn tại ops/data-platform/scripts/live_auth_acceptance.py trên nhánh ops/tenant-data-platform-v1-staging-20261110. Chạy với hai tài khoản QA trong môi trường bí mật để xác minh gateway, PostgREST, refresh và local logout. Script hiện kiểm đọc; tiếp tục bộ test write-denial riêng trước khi bật chức năng ghi.
