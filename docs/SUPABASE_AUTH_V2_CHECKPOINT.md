# TIEN404 AI — Supabase Auth V2 checkpoint

Date: 2026-11-10. Status: DRAFT PR #7, not published.

## Verified Supabase staging
- Project tien404-staging is active.
- One Supabase Auth user exists and has confirmed email.
- One valid, active owner membership exists for TIEN404 QA Shop A; tenant B remains isolated.
- Screenshot shows Site URL https://ngoctien20.github.io/demo-git/ and exact redirect URLs /login.html and /account.html.
- Database row security and tenant memberships are present; there has not yet been an authenticated end-to-end browser session test.

## Work completed in branch
- Fixed V1 login success bug: an attempted assignment to a const variable could prevent redirect after successful sign-in.
- Added sign-in UX with visible status, existing-session continuation, forgot-password request and update-password form. Password recovery returns generic responses to avoid disclosing account existence and uses the allowlisted login.html redirect. Actual recovery email flow is not yet tested.
- Updated account page to fail closed: private content remains hidden until Supabase getUser, membership and tenant lookups are verified. On any failure, hide tenant cards. New manual refresh action and logout.
- Added independently testable authorization-display helper logic. Unit tests check denial of wrong user, inactive roles, duplicate memberships and extraneous tenant rows.
- Added mobile/dark mode styles, hidden form CSS override and cache-busting.
- CI: https://github.com/ngoctien20/demo-git/actions/runs/42838594352 completed SUCCESS including syntax, static security and helper tests.

## Remaining release gates
1. No hosted staging preview exists. Browser E2E login, invalid password, session expiry, multi-tab, email recovery callback, Android dark-mode and logout are UNVERIFIED.
2. Add separate approved test user for Shop B and run real two-tenant RLS isolation tests; do not query production orders.
3. Supabase Auth security advisor warns "Leaked Password Protection Disabled." Consider enabling in Auth password settings. Details: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
4. Three informational RLS lint records concern intentionally private app_private tables; do not add public policies without authorization.
5. Confirm Render workspace before deploying a preview. No Render resources modified.
6. Align merchant login with Super Admin PR #2 and Tenant Platform PR #5; do not assume custom SQLite admin and Supabase Auth UUIDs are already integrated.
7. Do not merge to gh-pages until owner approval after E2E and security checks. The current public login remains demo.

Rollback: close the draft PR or revert feature-branch commits. No customer data, live n8n workflow or actual Supabase Auth user was mutated here.

## V6 · 2026-11-11 00:38 JST · Render Auth staging

LIVE_VERIFIED với tài khoản QA hiện hữu trên Render deployment `dep-dbpjiv1srm7s73aur350`, commit `7d0c5754be97a69c41a4c69cdb6f4c5d0975b3a3`. Cloud Browser: khách ẩn danh mở account thấy link đăng nhập; sau đăng nhập email/mật khẩu thật chỉ hiện Shop A và owner; refresh và kiểm tra lại quyền giữ Shop A; logout rồi mở lại account không hiện shop. Truy vấn tổng hợp Auth sau QA: một tài khoản, một tài khoản đã đăng nhập. Không lưu định danh riêng, mật khẩu hoặc session.

PR #7 sửa vô hiệu hóa hiển thị quyền cũ khi đổi danh tính và thông báo recovery khi build preview. Chín unit/build test đạt. Chromium fixture ở 360px/dark đạt login lỗi/hợp lệ, refresh, đổi A→B, sự kiện hết phiên và logout trong [CI 42845544780](https://github.com/ngoctien20/demo-git/actions/runs/42845544780). Lần chạy 42845132399 thất bại vì fixture đặt sẵn trạng thái đã đăng nhập khi kiểm form; đã sửa trong 7d0c5754. Chưa kiểm thiết bị Android vật lý, JWT hết hạn thực hoặc cưỡng chế thu hồi. Chưa có tài khoản B độc lập. Hai Render callback chưa đọc được do Dashboard yêu cầu phiên quản trị; recovery tiếp tục khóa. Production changed: NO. Rollback staging về deploy `dep-dbpj5rbbc2fs73abm09g` nếu cần.

## V7 · 2026-11-11 JST · Merchant catalog

Base 20eaa229 (PR #7), previous Render dep-dbpjiv1srm7s73aur350. V7 adds on-demand active SKU/name/price/stock for a verified membership through authenticated PostgREST with the existing products RLS. Up to 20 rows displayed; no order/customer or subscription operations. Discard late responses after session changes; refuse mixed-tenant responses. Anonymous account gate rechecked on Render before deployment. Supabase count: one user, two tenants, one membership. Browser fixture includes a scoped catalog and a mixed-scope rejection. Build + unit/artifact 9/9 pass locally. See Actions on this commit for browser result. Real two-user acceptance and callback remain open; the release gate is NOT READY. Rollback: redeploy prior Render artifact; no DB changes.

## 2026-11-11 JST · PR #7 · Tiếp tục sau bước chờ đăng nhập Work

Cloud Browser hiển thị biểu mẫu đăng nhập sẵn sàng trên deployment dep-dbpo69u1egvs7390iv80 (404b63b). Thẻ Work đang chờ xác nhận phiên. Kiểm tra mã phát hiện có thể gửi biểu mẫu HTML trước khi hoàn tất getUser. Khóa nút từ HTML, dùng method=dialog để vô hiệu gửi qua mạng mặc định và chỉ mở nút khi hoàn tất khởi tạo. Static QA và 13/13 unit/build PASS. Thêm Chromium regression không JavaScript/Enter, chạy trong Actions. Đăng nhập và xem danh mục trên bản mới bằng tài khoản thật, cùng kiểm thử hai tài khoản độc lập, còn mở. Rollback staging bằng deployment trên. Production changed: NO.
