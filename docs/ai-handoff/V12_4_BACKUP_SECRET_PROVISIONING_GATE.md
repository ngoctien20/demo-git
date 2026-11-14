# TIEN404 AI V12.4 — Backup & Secret Provisioning Gate

Ngày checkpoint: 15/11/2026 (JST). Môi trường: Supabase tien404-staging, project ifxlvrhyjhbzbrkdsida. Mức phát hành: EXPERIMENTAL. KHÔNG có secret mới được tạo.

## 1. VERIFIED — Backup status

- Kết nối Supabase trả về organization plan = free, tier = tier_free. Đây là thông tin tài khoản thực tế.
- Theo Supabase Docs, gói Free KHÔNG có backup PostgreSQL tự động. Nguồn chính thức: https://supabase.com/docs/guides/platform/backups và https://supabase.com/kb/faqs/platform/free-plan-backups (tra cứu ngày 15/11/2026).
- Supabase MCP đang kết nối không cung cấp action để list/download/restore backup. Chưa có Supabase backup dashboard trong các tab Browser có thể đọc.
- V12.3 có checkpoint dữ liệu và rollback cho schema mới, nhưng đó không phải một bản sao lưu toàn database. Chưa có bằng chứng pg_dump được tạo hoặc phục hồi.

Do vậy BACKUP GATE = BLOCKED. Người dùng đã phê duyệt quyền nghiên cứu và triển khai sau bước backup; không được suy diễn rằng bản backup đã tồn tại.

## 2. Bước tạo backup thủ công an toàn (không đưa bí mật vào ChatGPT)

- Chỉ thao tác với Supabase tien404-staging. Mở Supabase Dashboard > Project > Connect để kiểm tra thông tin PostgreSQL direct hoặc pooler SESSION, không dùng port 6543 transaction pooler.
- Sử dụng máy riêng do chủ dự án kiểm soát với PostgreSQL client >= 17, age, khóa giải mã được giữ offline và file PGPASSFILE permission 0600. KHÔNG dán database password, HMAC key, Zalo token hay private key trong chat, GitHub, Sheets hay frontend.
- Script đã soạn: qa/zalo/v124-manual-encrypted-backup.sh. Bắt buộc host/project đúng và explicit consent flag. Script sử dụng pg_dump dạng custom, mã hóa qua age trước khi lưu file và kiểm tra pg_restore TOC; tuyệt đối không commit bản dump.
- Cần THỬ KHÔI PHỤC trên một PostgreSQL 17 độc lập trước khi kết luận backup recoverable. Kiểm tra schema, row counts, owner và RLS. Nếu cần tạo một Supabase project mới có phí, PHẢI xin phê duyệt chi phí riêng; có thể dùng Postgres 17 local cô lập nếu đủ khả năng.
- Chỉ báo cho kỹ thuật trạng thái PASS/FAIL, timestamp, SHA-256 của tệp đã mã hóa (tùy chọn chỉ tiền tố) và kết quả restore. Không gửi private backup, đường dẫn nhạy cảm hay credential.

## 3. TESTED — Transaction race trên database độc lập

GitHub Actions run 43612747401, ephemeral PostgreSQL 17:
- Hai backend PID khác nhau tranh chấp FOR UPDATE thực: waiter chờ 6.936 giây, PASS.
- Hai kết nối đồng thời cùng INSERT một receipt: waiter chờ 6.927 giây, đúng 1 receipt, PASS.
- Combined Node conversation/security QA 148/148 PASS.
- Đó là PostgreSQL thật nhưng database CI tạm thời, KHÔNG phải Supabase staging với RLS thực tế. Không dùng để tuyên bố connector Supabase đã qua QA.

## 4. Định hướng secret và role cho lần kế tiếp (PROPOSED)

Sau khi chứng minh được backup/restore:
- Tạo role đọc/ghi phiên QA riêng, NO BYPASSRLS, NO SUPERUSER, NO CREATEDB, NO CREATEROLE.
- Chỉ grant private schema Shop B cùng RLS theo tenant; các bảng Owner binding/catalog có RLS hiện hữu nên phải thiết kế policy SELECT giới hạn Store B, không dùng generic SECURITY DEFINER hoặc mở SELECT trên toàn bộ schema.
- Credential đăng nhập Postgres mới và khóa HMAC độc lập phải được sinh bằng CSPRNG và lưu trong secret manager backend an toàn, không dùng lại credential cũ; không để JS/frontend thấy secret.
- Cổng Zalo V1 phải xác thực webhook provider trước khi ký envelope nội bộ. Chỉ service backend đã xác thực mới có quyền ký; không tin flag từ client.
- Trước khi bật bridge, chạy 2 physical connections trên Supabase staging, xác minh RLS, ACL, rollback, duplicate receipt và TTL.
- KHÔNG gọi commit_order_qa; KHÔNG gửi Zalo; KHÔNG đụng Commerce production hoặc các workflow Published.

## 5. Checkpoint an toàn

- Supabase tien404_dialogue_private.shop_b_sessions = 0; shop_b_receipts = 0; Shop B Orders = 2 và outbox = 2 ở lần đối soát trước.
- PR #41 ở trạng thái OPEN/DRAFT, không merge.
- Giao diện bật/tắt Zalo: Cloudflare ZALO_SEND_ENABLED=false, không đổi.
- Tiếp tục sửa lỗi QA/cấu trúc code độc lập; dừng mọi mutation credential, grant hoặc Supabase DDL sau khi biết backup chưa được xác minh.

Trạng thái nghiệp vụ: VERIFIED (plan Free, thiếu backup tự động); IMPLEMENTED (test CI, backup helper); TESTED (PostgreSQL CI và Node QA); BLOCKED (manual encrypted backup + restore, Supabase-specific DB session QA, backend secret/role); APPROVAL REQUIRED (chi phí nếu cần add-on/hosting, Orders writes, outbound sends).
