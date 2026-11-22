# Phương án áp PR #481 — đóng `anon` EXECUTE trên `qa_shop_b_zalo_claim` (B-P0-02)

**Trạng thái: PROPOSED — CHƯA ÁP. Cần chủ dự án duyệt rõ ràng (qua coordinator) trước mọi bước có tác động.**
Nguồn: Draft PR #481 (nhánh `claude/project-thread-8f5ck4`, head `a7f6261`), migration
`supabase/migrations/20261121120000_revoke_anon_only_qa_shop_b_zalo_claim.sql`, rollback
`qa/rpc-anon-revoke-option-a/rollback.sql`. Không lặp lại nội dung PR #481, chỉ ghi điều kiện áp đã kiểm lại.

## 1. Điều kiện tiên quyết đã kiểm lại (read-only, 2026-11-22 ~16:30 UTC) — VERIFIED

| Kiểm tra | Giá trị hosted `ifxlvrhyjhbzbrkdsida` | Guard trong migration #481 |
|---|---|---|
| Hàm tồn tại `public.qa_shop_b_zalo_claim(uuid,text,text,text)` | có | khớp |
| `prosecdef` | `true` | khớp |
| `proconfig` | `search_path=""` | khớp |
| `service_role` EXECUTE | `false` | khớp (guard sẽ dừng nếu đã có) |
| ACL | `{postgres=X/postgres,anon=X/postgres}` | REVOKE PUBLIC/anon/authenticated |
| md5 định nghĩa | `37f127c1475378b2810197961398d945` | (để đối chiếu sau khi áp: không đổi) |
| n8n `OgDZNSAvKEvhnAvn` (Shadow) | `active=true`, version `6277dd87…`, callerPolicy chỉ `yIJk8LvJoLF40Z62`; lần chạy cuối 2026-11-22 00:56Z | — |

n8n Cloud đang hết hạn dùng thử (memory `n8n-trial-expired`), nên hiện **không có caller nào chạy**: đây là cửa sổ an toàn để áp, vì không có luồng ghép Shop B nào bị cắt giữa chừng.

## 2. Các bước khi được duyệt (theo đúng Phương án A chủ dự án đã chọn 21/11)

1. Chủ dự án duyệt: "áp #481" (một câu là đủ, bao gồm cả bước 2 và 3).
2. n8n: unpublish `OgDZNSAvKEvhnAvn` (dọn dẹp; **REVOKE mới là kiểm soát bảo mật**, vì sub-workflow gọi qua Execute Workflow có thể vẫn chạy khi unpublished). Nếu n8n vẫn bị khóa do hết hạn, bỏ qua bước này và ghi lại; REVOKE vẫn đủ.
3. Áp migration bằng Supabase `apply_migration` với tên `revoke_anon_only_qa_shop_b_zalo_claim` (để có bản ghi trong `supabase_migrations`, đúng B-P0-08). Guard trong file sẽ tự dừng nếu hình dạng hàm đã lệch.
4. Hậu kiểm (read-only):
   - `has_function_privilege('anon', 'public.qa_shop_b_zalo_claim(uuid,text,text,text)', 'EXECUTE') = false`, `authenticated` và `service_role` cũng `false`.
   - `get_advisors(security)` không còn finding `anon_security_definer_function_executable` cho hàm này.
   - md5 định nghĩa vẫn là `37f127c1…` (chỉ ACL đổi).
   - Cập nhật `db/ws-a/staging-function-fingerprint-*.txt` (cột anon của hàm này thành `false`) và chạy lại `rebuild-check.sh`.
5. Ghi bằng chứng vào PR #481 + checkpoint V26.

## 3. Tác động

- Luồng QA "GHÉP" Shop B qua Zalo Shadow ngừng hoạt động — **đúng chủ đích** của Phương án A.
- Không đổi credential n8n, không cấp `service_role` (theo quy tắc chủ dự án).
- Không ảnh hưởng Messenger Z7Fd, Config Core, Store Authority.

## 4. Rollback (≤ 1 phút)

```sql
BEGIN; GRANT EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) TO anon; COMMIT;
```
(= `qa/rpc-anon-revoke-option-a/rollback.sql` trên #481), rồi publish lại `OgDZNSAvKEvhnAvn` nếu đã unpublish. Rollback cũng cần duyệt vì mở lại quyền anon.
