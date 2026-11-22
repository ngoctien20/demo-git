# B-00: Supabase staging backup + restore test — VERIFIED (2026-11-21)

## Kết quả
- **VERIFIED:** Bản backup của `tien404-staging` (ref `ifxlvrhyjhbzbrkdsida`) đã được khôi phục vào dự án riêng `tien404-restore-test` (ref `cunxxzxaboazbszsfneo`) và khớp hoàn toàn theo dấu vân tay.
- Run thành công: https://github.com/ngoctien20/demo-git/actions/runs/44904780877 (attempt 2), commit trên nhánh `claude/project-thread-geyx0t`.
- Thời gian: backup 12:38:32–12:39:58 UTC (~1,5 phút), restore 12:40:05–12:44:15 UTC (~4 phút). RTO thực đo ≈ 6 phút cho DB 14 MB.
- Artifact mã hóa (gpg AES-256, passphrase trong secret `BACKUP_PASSPHRASE`): `tien404-staging-backup-2026-11-21T1239Z`, 49 445 byte, hết hạn 2026-12-21.

## Đã so sánh (113 dòng dấu vân tay, khớp 113/113)
- 46 bảng ứng dụng trong 6 schema: số dòng, md5 toàn bộ dữ liệu, cột/kiểu, RLS bật/force, danh sách GRANT.
- 37 RLS policy (biểu thức USING/WITH CHECK, role, lệnh).
- 19 hàm: md5 `pg_get_functiondef`, SECURITY DEFINER, danh sách role có EXECUTE.
- 1 view, 4 trigger.
- Auth: 3 user (md5 id+email+password hash), 3 identity.
- 2 role QA `tien404_v175e1_actor_a/_b`.

## Phạm vi KHÔNG có trong backup
- Vault secret (mã hóa bằng khóa riêng của dự án) — phải tạo lại bằng tay.
- Cấu hình Auth (provider, redirect URL, email template), API key, Edge Functions.
- Storage: staging không có bucket/file; 9 bảng nội bộ storage bị bỏ qua khi restore.

## Bài học khi làm
- Dự án Supabase mới tự cấp quyền mặc định cho `anon/authenticated/service_role` khi tạo hàm/bảng → nếu chỉ chạy `supabase db dump` thì bản khôi phục **mở thêm quyền EXECUTE cho anon** trên các hàm SECURITY DEFINER. Đã xử lý bằng `ops/supabase-backup/export-grants.sql` (lưu quyền chính xác vào backup và áp lại sau restore).
- Repo public ⇒ log Actions public. Không bao giờ in nguyên văn lỗi của psql (một lần đã lộ một phần mật khẩu; log đã xóa, chủ dự án được khuyên đổi mật khẩu DB).

## Vận hành
- Workflow: `.github/workflows/supabase-backup-restore-test.yml` (push nhánh này, `workflow_dispatch`, cron Chủ nhật 19:00 UTC — chỉ chạy khi file có trên `main`).
- Secrets: `STAGING_DB_PASSWORD`, `RESTORE_DB_PASSWORD`, `BACKUP_PASSPHRASE`.
- An toàn: script dọn dự án thử từ chối chạy nếu thiếu bảng `restore_test_guard.marker` (staging không có). Staging chỉ bị đọc.
- Khôi phục thật khi sự cố: tải artifact, `gpg -d … | tar -xz`, rồi chạy `roles.sql`, `schema.sql`, `SET session_replication_role = replica` + `data.sql` (bỏ COPY storage), `grants.sql` vào **một dự án mới**, đối chiếu bằng `fingerprint.sql`, rồi trỏ Render/n8n/website sang dự án mới.

## Rollback
- Đóng PR / xóa nhánh. Dự án `tien404-restore-test` có thể xóa trên dashboard (không ảnh hưởng staging).

CHECKPOINT: B00_BACKUP_RESTORE_VERIFIED · RUN_44904780877 · FP_113_OF_113_MATCH · STAGING_READ_ONLY
