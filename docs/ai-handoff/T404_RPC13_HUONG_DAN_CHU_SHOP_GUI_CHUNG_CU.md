# TIEN404 — Hướng dẫn chủ shop cung cấp chứng cứ quyền sở hữu

**TRẠNG THÁI: CHƯA GỬI / CHƯA KÍCH HOẠT CỔNG**. Tài liệu chỉ dùng sau khi đội vận hành cấp URL bảo mật chính thức và xác minh quyền Merchant.

Chủ cửa hàng sẽ được mời đăng nhập bằng tài khoản được TIEN404 phê duyệt. Không gửi mật khẩu, OTP, token, ảnh căn cước, dữ liệu khách hàng hoặc hồ sơ qua Messenger/chat công khai, GitHub, hay email không được xác nhận.

Đối với một bản ghi sản phẩm hoặc đơn hàng cần đối chiếu, chủ shop chuẩn bị **chứng cứ nguồn gốc** như file danh mục đã sử dụng khi nhập hệ thống, hợp đồng/phiếu xác nhận cửa hàng, hóa đơn chứng minh doanh nghiệp hoặc xuất dữ liệu gốc của chính cửa hàng. Chỉ cung cấp phần thật sự cần thiết; che dữ liệu người mua hoặc cá nhân không liên quan. Không gửi liên kết đến website không rõ nguồn gốc; chỉ tải tệp PDF, JPEG hoặc PNG sau khi cổng được phê duyệt và hoạt động.

Quy trình dự kiến: (1) TIEN404 cấp một lời mời riêng cho từng hồ sơ P1, P2, O1, O2; (2) chủ shop đăng nhập qua Cloudflare Access và Supabase Auth; (3) gửi tệp gốc vào kho cách ly; (4) hệ thống quét mã độc; (5) chủ shop xác nhận bằng chứng; (6) nhân sự kiểm tra độc lập xác nhận đúng cửa hàng và ký biên bản; (7) chỉ sau khi đủ bốn hồ sơ và điều kiện khôi phục dữ liệu mới xem xét nâng cấp cơ sở dữ liệu. Việc gửi tệp **không tự động** trao quyền truy cập Store.

Nếu không có chứng cứ nguồn gốc rõ ràng, TIEN404 cần đối soát trực tiếp qua người có thẩm quyền trước khi gán cửa hàng. Bằng chứng “mã Tenant” hoặc hai tài khoản cùng Tenant không đủ để cấp quyền.

**Nhân sự TIEN404** phải xác nhận mục đích, thời hạn lưu giữ, cách xóa hồ sơ, người được quyền xem, cách khiếu nại sai sót và tình trạng xác thực trước khi gửi lời mời cho Merchant. Không dùng cổng staging hiện hành như kho hồ sơ mặc định.