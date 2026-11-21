# FEATURE_ACCEPTANCE_MATRIX — TIEN404 V21.0

Trạng thái: PASS / FAIL / BLOCKED / NOT_IMPLEMENTED / NOT_TESTED. Mức: OFFLINE, STAGING, HOSTED UAT, PRODUCTION.
Bằng chứng `E-xx` tra trong `EVIDENCE_MANIFEST.md`. Không ô nào là PASS nếu chưa có kết quả kiểm chứng.

## 1. Bảng tổng hợp A–M

| Module | Implemented | Offline QA | Integration QA | Hosted UAT | Security | Release Gate |
|---|---|---|---|---|---|---|
| A. Website & SaaS frontend | Một phần: 26 trang tĩnh; register/dashboard/billing/checkout/invoice là **mô phỏng** (sessionStorage, không gọi API) [E-01] | PASS static 26 trang/795 link 0 lỗi; PASS nav 24 trang; contract test 14/14 sau khi sửa test lỗi thời (Round 2b) [E-02] | NOT_TESTED | BLOCKED (proxy chặn pages.dev/github.io/onrender) [E-20] | Login chuyển sang Render; source Render không nằm trong `develop` [E-03] | BLOCKED |
| B. Supabase & multi-tenant | Một phần: RLS mức tenant, FORCE RLS 6+ bảng; **không có Store** [E-10] | PASS #482 64/64 (thread khác, không chạy lại) | NOT_TESTED trong phiên này | BLOCKED (chưa có restore-test, chưa có Owner A/B JWT thật) | 1 anon SECDEF, 2 authenticated SECDEF, leaked-password off [E-11] | **FAIL** (P0-01, P0-02) |
| C. AI SALES Commerce core | Hai hệ song song: (1) Google Sheet DEMO **đang chạy thật** qua Messenger; (2) Supabase Commerce chỉ đọc + 1 RPC ghi sản phẩm cho tenant QA; tạo đơn trên Supabase NOT_IMPLEMENTED [E-12][E-13] | **FAIL** bản Published của Create Order nhận giá dạng chữ sai (vd `1.2tr` → 1,2 đ) nếu chủ shop nhập giá dạng chữ trong Sheet; giá không đến từ khách/AI [E-14] | NOT_TESTED | Sheet DEMO: đơn được tạo thật 17/11 (E-15) nhưng không phải Commerce production | Không trừ kho, không khóa đồng thời, idempotency chỉ là cửa sổ 30 phút [E-13] | **FAIL** |
| D. n8n automation | 174 wf / 23 active [E-16] | PASS inventory; **FAIL** 5 workflow Draft≠Published [E-17] | NOT_TESTED | n/a | 3 workflow mô tả "inactive" nhưng active; node gửi live có ghi chú "DISABLED" [E-18] | BLOCKED |
| E. Messenger agent | Có: 1 Page hard-code, HMAC timing-safe, lọc echo, dedup MID, AI reply gửi thật [E-15] | PASS #468 181/181 (không nằm trong develop); PASS m1–m5 offline 191 test [E-04] | NOT_TESTED | **STAGING-LIVE trên Page của chủ**; Page installation/OAuth cho merchant NOT_IMPLEMENTED | PII lưu nguyên trong execution n8n; verify token hard-code [E-19] | BLOCKED |
| F. Zalo Bot & OA | Receipt-only + shadow; mapping Bot→Store chỉ ở QA; Zalo OA NOT_IMPLEMENTED | PASS V19.8.x offline (19 file, xem E-04) | NOT_TESTED | BLOCKED (deep link/QR UNVERIFIED; #481 chờ duyệt) | anon SECDEF `qa_shop_b_zalo_claim` (P1) | BLOCKED |
| G. Website AI & shared core | Website consultant chạy thật, chỉ đọc, KB router v1.1, quota 30/ngày; shared core chỉ shadow NO SEND | PASS v143/v144/v185/v1851–v1855 offline [E-04]; 2 browser test cần server cục bộ = BLOCKED môi trường | NOT_TESTED | NOT_TESTED (chưa gọi webhook public trong phiên này) | Webhook public không auth; CORS không phải kiểm soát server | BLOCKED |
| H. Subscription & billing | **NOT_IMPLEMENTED** backend (không bảng plan/subscription/payment) [E-10]; UI checkout/billing/invoice mô phỏng | n/a | n/a | n/a | n/a | NOT_IMPLEMENTED |
| I. Notification engine | Chỉ có Gmail báo cáo doanh thu hằng ngày (bản Published lỗi parse); thông báo đơn mới cho chủ shop NOT_IMPLEMENTED trên luồng live; outbox chỉ trong schema QA | **FAIL** Revenue Report Published đếm sai doanh thu [E-14] | NOT_TESTED | NOT_TESTED | n/a | FAIL |
| J. Infra/DevOps/Security | Repo public, không branch protection, Dependabot tắt; Supabase Free không backup | PASS CI 46 check trên develop [E-05] | n/a | BLOCKED Render/Cloudflare | Xem SECURITY_FINDINGS | **FAIL** (P0-01) |
| K. Control Hub & admin | Code trên `ops/super-admin-v4-staging-20261110` (Python) và tester portal trên checkpoint Render; không nằm trong develop. Bảng tester: 137 case, 2 run [E-06] | Tester/merchant portal 35/38 (3 cần build) [E-07]; Super Admin 68/68 + Control Hub 14/14 offline, backend SQLite staging, chưa nối live [E-22] | NOT_TESTED | BLOCKED | Super Admin: session cookie httponly/secure/samesite strict, CSRF, re-auth TOTP cho thao tác nhạy cảm (đọc code) | BLOCKED |
| L. AI SALES & agent eval | Prompt + rule có; bộ CSV `AI_SALES_QA_CASES`, `…96_SINGLE_TURN`, `…36_MULTI_TURN` **không tìm thấy** trong 502 nhánh và Google Drive [E-08] | NOT_TESTED (chưa có bộ case) | NOT_TESTED | NOT_TESTED | Prompt-injection chỉ dựa vào system prompt | BLOCKED |
| M. UX & commercial | Onboarding tự phục vụ NOT_IMPLEMENTED (tạo shop qua workflow nội bộ cần admin) | n/a | n/a | n/a | n/a | NOT READY |

## 2. Năm luồng kinh doanh xuyên hệ thống

| # | Luồng | Chạy được | Chưa chạy được và lý do |
|---|---|---|---|
| 1 | Chủ shop đăng ký → tạo Store → nhập sản phẩm → mở bán | Đăng nhập Supabase Auth trên Render (theo checkpoint, chưa kiểm lại hôm nay); `save_merchant_product` ghi sản phẩm cho tenant QA trong allow-list | Đăng ký tự phục vụ chỉ mô phỏng; không có bảng Store; tạo tenant chỉ qua workflow onboarding nội bộ; không kết nối kênh tự phục vụ → **FAIL** |
| 2 | Khách nhắn → AI tư vấn → kiểm tồn → tạo đơn | Messenger trên 1 Page của chủ: tư vấn, tra Sheet, xác nhận, tạo đơn vào Google Sheet (exec 4498) | Không đi qua Supabase/tenant; giá parse sai ở bản Published; không giữ/trừ kho; Zalo và website không tạo đơn → **PASS chỉ ở mức DEMO-LIVE, FAIL ở mức Commerce** |
| 3 | Đơn thành công → lưu → báo chủ shop | Đơn lưu vào Sheet | Không có thông báo đơn mới cho chủ shop; chỉ có email tổng hợp 21:00 (bản Published đếm sai) → **FAIL** |
| 4 | Chủ shop quản lý đơn → doanh thu → tồn kho | Đổi địa chỉ qua chat; báo cáo doanh thu email; **sửa đơn qua chat hỏng khi Sheet có ≥2 đơn (S-18)** | Không có dashboard đơn thật (dashboard.html mô phỏng); không trừ kho; doanh thu Published sai → **FAIL** |
| 5 | Subscription hết hạn → giới hạn → gia hạn | — | **NOT_IMPLEMENTED** |
