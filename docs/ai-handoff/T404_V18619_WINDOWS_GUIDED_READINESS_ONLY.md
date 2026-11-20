# TIEN404 AI — V18.6.19 | Windows guided readiness ONLY

**Tình trạng:** CANDIDATE, chỉ kiểm tra cục bộ; **không backup, không restore, không truy cập Supabase, không ghi dữ liệu**. Dành cho dự án staging `ifxlvrhyjhbzbrkdsida`.

## Cách sử dụng (trên Windows của chủ dự án)

1. Giải nén ZIP vào một thư mục riêng. Chạy `START_READINESS_WINDOWS.cmd` bằng cách nhấp đúp, hoặc kiểm tra mã nguồn trước rồi dùng lệnh:
   ```powershell
   node .\qa\store-authority-v18619\guided-readiness.cjs
   ```
2. Khi chương trình hỏi, chỉ nhập **hai đường dẫn thư mục**, không nhập mật khẩu/token/database URL:
   - `C:\TIEN404_LINKED_CLI`: thư mục Supabase CLI đã `supabase init`, `supabase login`, `supabase link --project-ref ifxlvrhyjhbzbrkdsida` từ trước. Việc liên kết do chủ dự án thực hiện riêng trên máy; wizard này **không thực hiện** login/link.
   - `D:\TIEN404_PRIVATE_BACKUPS\SNAPSHOT`: một thư mục **đã tồn tại, trống**, nằm ngoài thư mục Git, OneDrive/Dropbox/Downloads, trên ổ lưu trữ do bạn kiểm soát.
3. Kết quả chỉ chứa các mã kiểm tra, không hiển thị hai đường dẫn. Nếu nhận `GUIDED_READINESS_ONLY_PASS`, chỉ gửi **mã trạng thái** trong cuộc trò chuyện. Nếu bị chặn, có thể gửi **các chuỗi trong `codes`**, nhưng không gửi tên thư mục, email, token, password, file backup.

## Những gì thực sự được kiểm tra

- Đang chạy trên Windows, ngoài CI; Node >= 22.
- Có lệnh `supabase` và `docker` trong PATH (kiểm tra sự tồn tại của tệp lệnh **không chạy** các lệnh này).
- Có cấu hình và dấu mốc local `supabase/.temp/project-ref` trùng chính xác ID staging. **Dấu mốc trên máy không xác minh phiên đăng nhập/ủy quyền remote hiện còn hiệu lực.**
- Đích lưu dữ liệu ở ngoài project, là thư mục trống, không nằm trên cây Git, tránh một số thư mục cloud-sync/system thường gặp. **Không chứng minh ổ đĩa đã bật mã hóa, không phát hiện mọi sync agent, không xác minh quyền truy cập tệp.**

## Những gì tuyệt đối không thực hiện

Không kết nối mạng, không gọi Supabase API, không lấy Auth user/secret Vault, không chạy Supabase CLI/Docker, không tạo thư mục, không ghi file, không backup, không restore, không yêu cầu hoặc gửi credential. **Không có tham số `--execute`**; nếu truyền vào chương trình sẽ từ chối. `START_READINESS_WINDOWS.cmd` chỉ chạy chương trình kiểm tra này.

## Điều kiện khôi phục và Gate B-00 vẫn BLOCKED

Ngay cả khi nhận `GUIDED_READINESS_ONLY_PASS`, vẫn **chưa có backup/restore thật**. Hệ thống staging có dữ liệu trong Supabase Auth và Vault, trong khi `supabase db dump` loại trừ managed Auth/Storage schemas; khôi phục đầy đủ phải có phương án riêng đã được phê duyệt. **Đừng chạy export của bộ V18.6.15 nếu chưa có quyết định về phạm vi Auth/Vault, backup destination mã hóa và quyền thực hiện.**

Tài liệu chính thức: [Supabase CLI `db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump) · [Supabase `link`](https://supabase.com/docs/reference/cli/supabase-link) · [Supabase Backups](https://supabase.com/docs/guides/platform/backups).

**Checkpoint:** `V18.6.19 | GUIDED_READINESS_ONLY | AUTH_VAULT_B00_BLOCKED | NO_REMOTE_READ | NO_EXPORT | PRODUCTION_NO_GO`.
