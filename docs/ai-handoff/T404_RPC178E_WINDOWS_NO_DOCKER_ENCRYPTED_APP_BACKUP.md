# TIEN404 AI — RPC17.8E Windows không Docker: sao lưu ứng dụng có mã hóa

**2026-11-17 JST · SOURCE-ONLY · KHÔNG CHẠY BACKUP THẬT · KHÔNG MIGRATION SUPABASE**

## Tại sao chuyển hướng
- Ảnh Dashboard do Owner cung cấp xác nhận `tien404-staging` trên Supabase **FREE** và **Free Plan does not include project backups**. Không có scheduled backup tự động.
- RPC17.8D PR #372 có bộ đọc metadata backup nhưng không thể biến Free thành có daily backup. Chưa có bản dump thủ công hoặc restore thực.
- Chủ dự án đang dùng Windows, muốn tránh Docker vì RAM. Giải pháp **không Docker trên Windows**: PostgreSQL 17 **client tools** + Node.js 22+ + age CLI. Không cần cài service PostgreSQL hay Docker trên máy.
- Kiểm toán chỉ-đọc Supabase: 46 bảng ứng dụng trong 6 schema: `public` (20), `app_private` (3), `factory_private` (5), `tien404_dialogue_private` (2), `tien404_r1_qa` (8), `tien404_v175_qa` (8), RLS bật trên cả 46; **đây chỉ là inventory, không phải backup**.

## PHẠM VI VÀ GIỚI HẠN RÕ RÀNG
- Công cụ `qa/v152-rpc178e/stream-encrypted-app-backup.mjs` chỉ xuất **6 schema ứng dụng**, không chứa `auth`, `storage`, `vault`, dữ liệu Storage objects, Auth provider settings, database roles hoặc grants/ACL. Không phải full Supabase backup.
- Dùng `pg_dump -Fc --no-owner --no-acl` trực tiếp; Supabase cảnh báo bản dump PostgreSQL thô có thể gồm internal schemas và khó restore. Việc chọn lọc application schemas tránh nội bộ nhưng **có thể vẫn phụ thuộc vào extension/Supabase internals**, vì vậy không cam kết restore hoàn chỉnh.
- Trên máy Windows không có Docker: Node streaming giữa `pg_dump` và `age` để **không tạo file .dump plaintext**. Lưu đích `.age` mã hóa và `.manifest.json` chỉ chứa scope + SHA-256 + kích thước, tuyệt đối không chứa DB password/JWT/dữ liệu khách hàng.
- Kết quả `ENCRYPTED_BACKUP_CREATED_RESTORE_NOT_VERIFIED` và `ENCRYPTED_ARCHIVE_DECRYPT_HEADER_VERIFIED_NOT_RESTORED` **không** phải bằng chứng database có thể restore.

## Chuẩn bị Windows tiết kiệm tài nguyên
1. Cài **chỉ PostgreSQL 17 Command Line Tools** hoặc giải nén bản ZIP Windows chính thức để có `pg_dump.exe` (không bắt buộc cài PostgreSQL Server). https://www.postgresql.org/download/windows/
2. Node.js 22+ cho việc stream nhị phân. Không pipe file dump nhị phân bằng Windows PowerShell 5.1.
3. Cài `age.exe`, `age-keygen.exe` từ dự án chính thức https://github.com/FiloSottile/age/releases ; chọn bản Windows phù hợp. Tạo cặp khóa trên ổ USB ngoại tuyến và **chỉ dùng public recipient `age1...`** trên máy sao lưu; khóa private không lưu trong repo, ChatGPT, GitHub, hay cùng thư mục với backup.
4. Supabase → **Connect**: lấy **hostname và username** của chế độ Session pooler (port 5432) hoặc Direct (nếu máy có IPv6). Không chia sẻ chuỗi kết nối, mật khẩu hoặc access token.
5. Tải **CA certificate đáng tin cậy** phù hợp với endpoint từ hướng dẫn kết nối của Supabase/PostgreSQL, dùng `PGSSLMODE=verify-full`. Công cụ chặn nếu thiếu cert/không xác minh được TLS. Không chuyển xuống `disable` để làm nó chạy.
6. Chọn thư mục lưu tệp ở ổ/thiết bị được kiểm soát quyền truy cập, **ngoài** repository, không thuộc thư mục chia sẻ đồng bộ công cộng; cần đủ dung lượng.

## Thao tác PowerShell — mặc định KHÔNG liên hệ Supabase

Từ root của repo `demo-git`:

```powershell
# Kiểm tra đã có node, pg_dump và age (không kết nối DB):
.\qa\v152-rpc178e\windows-private-backup.ps1 -Action Preflight `
  -PgToolsFolder 'C:\Tools\PostgreSQL\17\bin' -AgeFolder 'C:\Tools\age'
```

Dùng hostname/user từ màn hình Supabase **Connect**. Public recipient không phải mật khẩu. Thay placeholder bằng thông tin trên máy bạn (không gửi lại cho ChatGPT):

```powershell
# Schema-only, không xuất các dòng dữ liệu khách hàng:
.\qa\v152-rpc178e\windows-private-backup.ps1 -Action SchemaBackup `
  -PgToolsFolder 'C:\Tools\PostgreSQL\17\bin' -AgeFolder 'C:\Tools\age' `
  -DbHost 'HOSTNAME_TU_SUPABASE_CONNECT' `
  -DbUser 'USERNAME_TU_SUPABASE_CONNECT' `
  -CaCertPath 'E:\TIEN404-PRIVATE\supabase-ca.crt' `
  -AgeRecipient 'age1_THAY_BANG_PUBLIC_RECIPIENT_THAT' `
  -OutputPath 'E:\TIEN404-PRIVATE\staging-application-schema.age'
```

Công cụ hỏi **database password dạng nhập kín** ở máy bạn; không truyền mật khẩu trong tham số và xóa môi trường tạm sau khi chạy. Không thay credential nếu chưa có kế hoạch riêng. Nếu không xác thực được hostname/SSL/secret hoặc thiếu công cụ, kết quả sẽ BLOCKED.

**Không chạy AppDataBackup trước khi đã đánh giá dữ liệu khách hàng và nơi lưu**. Chỉ khi người vận hành phê duyệt riêng, chế độ sau mới có thể xuất dữ liệu ứng dụng thật (vẫn mã hóa):

```powershell
# CHỈ SAU PHÊ DUYỆT DỮ LIỆU NHẠY CẢM:
# ... -Action AppDataBackup -ApproveSensitiveBackup -OutputPath 'E:\PRIVATE\app-data.age' ...
```

## Kiểm tra file không tạo plaintext dump
- Bản backup ra `.age` và `.age.manifest.json`. Manifest chứa hash SHA256, kích thước và phạm vi; không gửi archive, key, token, mật khẩu, hoặc file export SQL lên GitHub/ChatGPT.
- Có thể kiểm tra bằng `-Action Verify -OutputPath <file.age> -IdentityPath <khóa-private-trên-USB>`. Bộ xác minh chỉ stream giải mã vào bộ nhớ, so SHA và kiểm tra magic `PGDMP`; **không** thử phục hồi database, không chạm Supabase.
- Nếu khóa private không có trên máy thao tác, chạy verify trên máy riêng đáng tin cậy; tuyệt đối không tải khóa lên CI.
- SHA trong manifest giúp phát hiện thay đổi vô tình, không thay thế chữ ký độc lập hoặc sự xác nhận bản sao lưu không bị sửa toàn bộ.

## Sau khi có encrypted schema backup
1. Kiểm tra encrypted app-data backup (nếu được phê duyệt), ghi checksum và thời gian vào registry riêng tư.
2. Tổ chức **restore thử trên môi trường Supabase/PostgreSQL tương thích và cách ly**, có đầy đủ dependencies Auth/Storage/extensions nếu cần. Nếu thiếu, ghi rõ phạm vi chỉ app schemas.
3. So sánh RLS/policies/grants + integrity row counts + signed recovery evidence. Để được **FULL staging recovery GO** phải sao lưu và thử phục hồi đủ phạm vi thật, không chỉ archive ứng dụng.
4. Chỉ sau đó mới đưa migration `rpc178_qa` vào vòng xét duyệt có backup và rollback; không tự thực thi.

## Tham chiếu chính thức
- Supabase Free backup: https://supabase.com/docs/guides/platform/backups
- Supabase platform restore (cảnh báo raw pg_dump khác Supabase CLI): https://supabase.com/docs/guides/self-hosting/restore-from-platform
- PostgreSQL 17 pg_dump: https://www.postgresql.org/docs/17/app-pgdump.html
- PostgreSQL Windows client ZIP/installer: https://www.postgresql.org/download/windows/
- age CLI (public key streaming encryption): https://github.com/FiloSottile/age

**GATE: DISPOSABLE APP BACKUP TOOL SOURCE TESTED ONLY; ACTUAL STAGING BACKUP & RESTORE MISSING; MIGRATION NO-GO.**
