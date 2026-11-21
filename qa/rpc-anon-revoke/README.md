# Thu hồi quyền anon trên `public.qa_shop_b_zalo_claim`

Trạng thái live (đọc catalog chỉ-đọc 2026-11-21): `SECURITY DEFINER`, owner `postgres`,
`search_path=""`, ACL `{postgres=X/postgres,anon=X/postgres}`. Hàm tự chặn bằng header
`x-tien404-pairing` so với secret trong Vault, nhưng vẫn là điểm vào ẩn danh qua PostgREST
(Supabase advisor lint 0028).

Caller duy nhất đã biết: n8n `TIEN404_ZALO_V2_SHADOW_STAGING` (`OgDZNSAvKEvhnAvn`), node
`Submit pending claim for Shop B`, gửi `apikey` = publishable key (role anon) + credential header
`TIEN404_QA_SHOP_B_ZALO_PAIRING`.

## Thay đổi
- `supabase/migrations/20261121100000_revoke_anon_qa_shop_b_zalo_claim.sql`:
  REVOKE EXECUTE khỏi PUBLIC/anon/authenticated, GRANT cho `service_role`.
  Có guard dừng nếu hàm đã bị đổi (không còn SECURITY DEFINER hoặc mất search_path), và kiểm tra hậu điều kiện.
  Không đổi thân hàm; cổng header vẫn giữ (phòng thủ 2 lớp).
- `rollback.sql`: trả ACL về đúng giá trị live.

## Phương án thay thế cho n8n
Node HTTP gọi bằng **secret key (service_role)** lưu trong credential n8n, không để key trong tham số node:
1. Tạo secret key riêng trong Supabase (API Keys → Secret key, đặt tên vd. `n8n-zalo-shadow`).
2. Thêm credential n8n kiểu Header Auth (`apikey: <secret key>`), hoặc gộp vào credential hiện có
   (cần 2 header: `apikey` và `x-tien404-pairing`; có thể dùng Custom Auth).
3. Bỏ header `apikey` publishable đang ghi cứng trong node.
Secret key không bao giờ dùng ở trình duyệt/Pages.

## Thứ tự triển khai (cần chủ dự án duyệt)
1. Cập nhật credential/node n8n sang secret key (service_role vẫn gọi được hàm hiện tại? **Chưa**:
   service_role hiện không có EXECUTE, nên bước 1 và 2 phải làm liền nhau, hoặc chạy trước
   `GRANT EXECUTE ... TO service_role;` riêng rồi mới đổi n8n).
2. Áp dụng migration.
3. Gửi 1 lệnh `GHÉP` QA thử, xác nhận `claimResult=true`; gọi bằng publishable key phải nhận 401/42501.
4. Nếu lỗi: chạy `rollback.sql` và trả node n8n về bản cũ.

## Test offline
`bash qa/rpc-anon-revoke/run-offline-test.sh` (Postgres cục bộ, chạy bằng user không phải root).
Fixture `fixture.sql` dựng lại đúng định nghĩa + ACL live với secret giả. Kết quả 2026-11-21: 14/14 PASS.
Giới hạn: không có PostgREST thật; mô phỏng bằng `SET ROLE` + `request.headers`.
