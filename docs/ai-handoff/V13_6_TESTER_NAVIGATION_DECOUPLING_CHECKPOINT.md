# TIEN404 V13.6 — Tách Tester khỏi cổng khách hàng

**Ngày checkpoint:** 2026-11-15 (JST). **Phạm vi:** mã staging Draft, không deploy.  
**Đầu vào:** chủ dự án cho phép loại bỏ mục Tester nếu cần để tránh làm hệ thống rối.  
**Nhánh gốc:** PR #81, SHA `22286631df01214e328703e821af45531ced3eee`.  
**Nhánh mới:** `work/v136-customer-portal-hide-tester-staging-20261115`.

## Kiểm toán trước thay đổi — VERIFIED
- `account.html` cũ đã đổi sang chuyển hướng nội bộ `merchant-portal.html`, nhưng vẫn hiển thị hai liên kết `tester.html` và `tester-request.html` cho khách hàng.
- `merchant-portal.html` hiện là Customer Portal chỉ có Tổng quan/Đơn hàng/Tài khoản/Gói/Thanh toán/Hỗ trợ, không có tab Tester.
- `login.html` không có liên kết Tester trong đường dẫn đăng nhập khách hàng đã được kiểm toán.
- `tester.html`, `tester-admin.html`, `tester-request.html`, `assets/tester-*.mjs/js`, các workflow CI và bộ QA vẫn nằm trong whitelist build Auth staging; Tester đã có luồng xác thực/phân quyền riêng và là nền thử nghiệm cho Messenger/Zalo.
- Render `tien404-auth-staging` đang deploy từ `work/supabase-auth-staging-v1`, auto-deploy off. Chưa có V13.5R.1 trên Render, nên thay đổi trong PR này chưa xuất hiện trên website đang chạy.

## IMPLEMENTED — chỉ Draft
1. **Ẩn Tester khỏi Customer Account entry:** gỡ liên kết `Trung tâm thử nghiệm` và `Đăng ký quyền Tester` khỏi `account.html` trên nhánh Draft.
2. **Không phá phụ thuộc:** giữ nguyên `tester.html`, `tester-admin.html`, `tester-request.html`, asset, bảng QA, Tester/RLS, credentials, n8n workflows và hệ thống thu thập QA. Đường dẫn trực tiếp dành cho Tester đã có quyền vẫn có thể được sử dụng sau khi triển khai bản build tương ứng.
3. **Kiểm thử tự động:** sửa bộ QA `tests/account-canonical-entry.test.mjs` để yêu cầu *không quảng bá Tester trong tài khoản khách*, và bổ sung đối chiếu `account.html` / `login.html` / `merchant-portal.html`, xác nhận trang Tester và script vẫn có trong source/build phục vụ QA.
4. Đây là thay đổi điều hướng/giao diện, **không phải thay đổi quyền truy cập**: người có URL trực tiếp vẫn phải chịu guard hiện tại; chỉ gỡ liên kết không thay cho bảo vệ server.

## Release và rủi ro
- Không xóa tài khoản Tester, assignment, bảng dữ liệu QA, workflow n8n hoặc mã code; không thay đổi RLS, ACL, token, Billing hay production.
- Sau khi source QA đạt và kiểm tra branch composition, cần phê duyệt riêng trước khi thay Render staging; tự động deploy vẫn OFF.
- **Bất kỳ đề xuất xóa hoàn toàn Tester** phải trải qua kiểm kê dependency/caller/CI, snapshot/rollback, bảo đảm các testcase và dữ liệu QA vẫn chạy trong môi trường nội bộ khác. Không tự xóa dựa trên việc link biến mất.

## QA/checkpoint
- Cần xác nhận GitHub Actions PASS theo **HEAD cuối** của Draft trước khi đánh dấu TESTED. Không xem screenshot từ bản Render cũ là bằng chứng UI mới đã deploy.
- QA Hosted Auth/RLS từ hai phiên trước đó: Shop A và Shop B tách biệt khi đọc `orders` và `tenant_memberships`, anonymous nhận 401; thử thu hồi membership với JWT còn hạn vẫn chưa chạy.

## Rollback
Đóng/revert Draft PR này hoặc khôi phục `account.html` và `tests/account-canonical-entry.test.mjs` từ SHA gốc `22286631df01214e328703e821af45531ced3eee`. Không cần khôi phục database hay Render vì chưa có thay đổi runtime.

## Bước tiếp theo
Kiểm tra CI và hoàn thiện bảng release gate. Ưu tiên nghiệm thu Customer Portal trên Render staging sau khi có bản sao lưu cấu hình, phương án rollback và phê duyệt triển khai cụ thể; sau đó mới làm Staff/Admin Console và chuyển công cụ Tester còn cần dùng vào không gian kỹ thuật nội bộ.
