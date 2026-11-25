# V28 Tài khoản — đăng ký/đăng nhập, Gói và thanh toán (DEMO), Quản trị nền tảng

Trạng thái: SQL **đã áp** restore-test rồi staging ngày 2026-11-25 (Tiến duyệt; sao lưu trước bằng run 45715148922; migration staging 20261125225107; hosted UAT `qa/v28-account/hosted/v28-uat.sql` 22/22, dữ liệu thử 0). App **chưa deploy** gh-pages, PR vẫn Draft.

## App chủ shop (apps/owner)
- `#/dang-nhap`, `#/dang-ky` (`?goi=lite|plus|pro` mang gói từ trang bảng giá), `#/quen-mat-khau`, `#/dat-lai-mat-khau`:
  hiện/ẩn mật khẩu, nhập lại mật khẩu + thanh độ mạnh, bắt buộc đồng ý điều khoản, họ tên + SĐT (chuẩn hoá 0xxxxxxxxx) lưu vào
  `user_metadata`, màn "Kiểm tra hộp thư" có gửi lại sau 60 giây, đăng nhập khi email chưa xác nhận có nút gửi lại thư,
  thông báo lỗi tiếng Việt (sai mật khẩu, bị khoá, gửi quá nhanh…).
- `#/tai-khoan?tab=ho-so|bao-mat|goi|workspace`: hồ sơ, đổi email (có thư xác nhận), đổi mật khẩu (kiểm mật khẩu hiện tại),
  đăng xuất thiết bị này / mọi thiết bị, Gói và thanh toán, danh sách workspace.
- `#/goi-dich-vu` = cùng mục Gói và thanh toán.
- `#/quan-tri`: chỉ hiện khi máy chủ trả `is_platform_admin() = true`.

## Gói và thanh toán — DEMO
- Không thu tiền, không lưu ngân hàng. Mã QR là **chữ thường** ("TIEN404 DEMO - KHONG CHUYEN KHOAN…"), không phải chuỗi VietQR,
  nên app ngân hàng không tạo được lệnh chuyển. Tài khoản nhận "NGÂN HÀNG DEMO / 0000 0000 DEMO" không có thật.
- Giá minh hoạ (Tiến chốt sau): LITE 99.000đ, PLUS 299.000đ, PRO 699.000đ / tháng; theo năm = 10 tháng.
  Giá nằm ở máy chủ (`app_private.billing_demo_price`) và trong `apps/owner/src/billing.ts` (phải giống nhau).
- Khi `db/v28-account` CHƯA áp: App tự lưu demo trong trình duyệt (localStorage theo cửa hàng) và ghi rõ điều đó.
- Khi chạy thật: thay nút "Mô phỏng: đã thanh toán" bằng đối soát ngân hàng (luồng "đơn chắc tiền" có `don-chac-tien/lib/vietqr.mjs`).

## Máy chủ — `db/v28-account/10_billing_demo_admin.sql` (APPLIED staging)
- Bảng `billing_demo_subscriptions`, `billing_demo_invoices` (CHECK `is_demo = true`), không cấp quyền đọc/ghi trực tiếp;
  chỉ qua RPC. Đọc: mọi thành viên cửa hàng. Đổi gói/xác nhận/huỷ: **chỉ chủ sở hữu**. Tối đa 20 hoá đơn/ngày/cửa hàng.
- Admin tách hẳn khỏi vai trò shop: `app_private.platform_admins` (anon/authenticated không đọc được). Chủ shop không bao giờ
  là admin. `admin_overview`, `admin_set_account_lock`, `admin_set_store_bot` đều kiểm lại admin ở máy chủ; menu ẩn chỉ là phụ.
- Khoá tài khoản = `auth.users.banned_until = 'infinity'` + ghi lý do + nhật ký. Không khoá được chính mình hay admin khác.
  Phiên đang mở hết hạn trong tối đa 1 giờ.
- Tắt bot = `store_bot_settings.bot_enabled`. **n8n hiện chưa đọc công tắc này.**
- Rollback: `90_billing_demo_admin_rollback.sql` (mở khoá mọi tài khoản đã khoá rồi xoá đối tượng V28).

### Sau khi được duyệt áp
1. Áp `10` lên restore-test → staging (như V23/V25).
2. Thêm admin bằng tay trong SQL Editor (thay email):
   `insert into app_private.platform_admins(user_id, note) select id, 'Tiến' from auth.users where email = '<email-admin>';`

## Kiểm thử
- `qa/v28-account/offline-pg-uat.sh` — PostgreSQL cục bộ, 60/60 PASS (giá do máy chủ tính, chặn nhân viên/shop khác/anon,
  chủ shop không tự thành admin, khoá/mở, rollback sạch, áp lại được).
- `qa/v28-account/account-ui.cjs` — trình duyệt, Supabase giả lập, máy tính 1280 + điện thoại 390: 66/66 PASS.
