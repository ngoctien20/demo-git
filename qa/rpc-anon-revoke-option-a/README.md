# Phương án A: tắt Zalo Shadow rồi thu hồi quyền anon trên `qa_shop_b_zalo_claim`

Chủ dự án chọn phương án A ngày 21/11/2026. Phương án này thay cho cutover dùng `service_role` trong PR #476: **không cấp quyền cho vai trò API nào khác và không đổi credential n8n**.

Trạng thái: **PROPOSED / TESTED offline**. Chưa áp dụng lên hosted.

## Hiện trạng đã xác minh (chỉ đọc, 21/11/2026)

- Supabase `ifxlvrhyjhbzbrkdsida`: hàm `SECURITY DEFINER`, `search_path=""`, ACL `{postgres=X/postgres,anon=X/postgres}`.
  `has_function_privilege`: anon = true, authenticated = false, service_role = false.
- n8n:
  - `TIEN404_ZALO_BOT_LAB_V1_STAGING` (`yIJk8LvJoLF40Z62`) **active**. Webhook `/webhook/tien404-zalo-bot-lab-v1` được bảo vệ bằng header.
  - Node `Ack Zalo (No Message Sent)` trả lời webhook **trước**, sau đó node `Zalo V2 Shadow (Owner Gate Only)` mới gọi sub-workflow `OgDZNSAvKEvhnAvn` với `onError: continueRegularOutput`.
- `TIEN404_ZALO_V2_SHADOW_STAGING` (`OgDZNSAvKEvhnAvn`) **active**, `callerPolicy` chỉ cho Bot Lab gọi. Node `Submit pending claim for Shop B` là caller literal duy nhất đã biết (theo S2).
- Cả hai workflow không lưu execution, và `track_functions=none`. Không đo được lưu lượng thật.

**Hệ quả:** nếu Shadow lỗi hoặc bị tắt, webhook Bot Lab vẫn trả 200 và các nhánh khác vẫn chạy. Chỉ luồng ghép QA Shop B ngừng.

## Các bước áp dụng (cần chủ dự án duyệt từng lệnh)

1. **Unpublish** `TIEN404_ZALO_V2_SHADOW_STAGING` (`OgDZNSAvKEvhnAvn`). Không sửa nội dung workflow.
   - Ghi lại `activeVersionId` trước khi tắt (hiện là `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`).
   - **Bước này chỉ là dọn dẹp, không phải biện pháp bảo mật.** Sub-workflow được gọi qua Execute Workflow thường vẫn chạy dù đã unpublish, nên có thể Bot Lab vẫn gọi được Shadow. Điều này chưa được kiểm chứng.
   - Lời gọi RPC bị chặn là nhờ **bước 2**, ở tầng PostgreSQL, bất kể n8n làm gì. Sau bước 2, mỗi lần Shadow chạy, node `Submit pending claim for Shop B` sẽ nhận lỗi 401/42501. Bot Lab bỏ qua lỗi đó (`onError: continueRegularOutput`), và lỗi chỉ xảy ra sau khi webhook đã trả lời.
   - Muốn cắt hẳn lời gọi từ n8n thì cần sửa và publish lại Bot Lab `yIJk8LvJoLF40Z62`: tắt (disable) node `Zalo V2 Shadow (Owner Gate Only)`. Đây là thay đổi trên workflow webhook đang chạy, nên **không nằm trong phương án A**. Chỉ làm nếu chủ dự án yêu cầu riêng.
2. **Áp dụng migration** `supabase/migrations/20261121120000_revoke_anon_only_qa_shop_b_zalo_claim.sql`. Migration có guard: dừng nếu hàm hoặc ACL đã khác lúc kiểm toán.
3. **Kiểm tra** (chỉ đọc):
   - `SELECT proacl FROM pg_proc WHERE oid='public.qa_shop_b_zalo_claim(uuid,text,text,text)'::regprocedure` phải ra `{postgres=X/postgres}`.
   - `has_function_privilege` của anon, authenticated, service_role đều phải là `false`.
   - Gọi `POST /rest/v1/rpc/qa_shop_b_zalo_claim` bằng publishable key, **không** gửi header pairing. Trước migration lỗi là `insufficient_privilege` (do cổng trong hàm). Sau migration lỗi phải là `permission denied for function` (42501). Không gửi secret thật.
   - Workflow Bot Lab vẫn `active=true`.
4. **Rollback** (nếu cần): chạy `rollback.sql` rồi publish lại Shadow với đúng `activeVersionId` đã ghi ở bước 1.

## Test offline

`bash qa/rpc-anon-revoke-option-a/run-offline-test.sh`: dùng container `postgres:17` (`--network none`), fixture `fixture.sql` lấy từ PR #476 với secret giả.

Kết quả ngày 21/11/2026 trên PostgreSQL 17.12: **15/15 PASS** (xem `offline-test-result.txt`).

Giới hạn: không có PostgREST thật (mô phỏng bằng `SET ROLE` + `request.headers`), không có Vault thật. Đây là bằng chứng offline, không phải nghiệm thu hosted.

## Quan hệ với PR #476

PR #476 (cấp quyền cho `service_role` và đổi credential n8n) **không còn là phương án được chọn**. Nên đóng #476 sau khi PR này được duyệt.
