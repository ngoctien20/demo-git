# WS-A — Bảo mật DB và kiểm thử cô lập (V26)

Phạm vi độc quyền: `db/**`, `supabase/**`. Mọi script ở đây **chỉ chạy trên PostgreSQL cục bộ/dùng-một-lần**
(từ chối host khác `localhost`/`127.0.0.1`/socket và từ chối khi có biến môi trường hosted). CI: `.github/workflows/tien404-ws-a-db-security.yml` (postgres:17).

| Backlog | Script | Kết quả offline | Nhãn |
|---|---|---|---|
| B-P0-08 dựng lại DB từ repo | `rebuild-check.sh` | 30/30 hàm repo khớp từng byte với staging; 7 hàm + 14 bảng + 4 schema chỉ có trên hosted → xem `MIGRATION_HISTORY_AUDIT.md` | VERIFIED (gap ghi nhận) |
| B-P0-06 negative test RPC SECURITY DEFINER | `secdef-negative-suite.sh`, `mutation-selftest.sh` | 137 ca PASS; 3/3 lỗi cố ý bị bắt; 0 thay đổi dữ liệu và 0 audit sau toàn bộ ca bị từ chối | TESTED (offline) |
| B-P0-07 backup/restore | `restore-drill.sh` | dump → restore một transaction → fingerprint 77 dòng giống hệt, kiểm lại cô lập trên bản khôi phục | TESTED (offline); hosted: chờ lịch Chủ nhật 19:00 UTC |
| B-P1-05 Order Ownership Gateway | `../order-ownership/offline-uat.sh` | 56 ca PASS, rollback + áp lại | IMPLEMENTED (DRAFT, chưa áp) |
| B-P0-02 / #481 | `PR481_APPLY_PLAN.md` | đã áp trên staging 2026-11-22 21:06Z, hậu kiểm 22:38Z | VERIFIED |

Chạy cục bộ:

```bash
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres
bash db/ws-a/rebuild-check.sh
bash db/ws-a/secdef-negative-suite.sh
bash db/ws-a/mutation-selftest.sh
bash db/order-ownership/offline-uat.sh
bash db/ws-a/restore-drill.sh
```

SQL của V23 web và Config Core hiện ở PR #489/#496 (chưa vào `develop`). `lib.sh` tự đọc chúng từ commit
`886f1f2` cho tới khi các PR đó được merge; sau đó dùng bản trong cây làm việc.

## 17 RPC SECURITY DEFINER mà `authenticated` gọi được trên staging

`create_store`, `set_store_member`, `save_merchant_product`, `save_merchant_product_in_store`, `register_shop`,
`save_store_bot_settings`, `save_store_faq`, `delete_store_faq`, `set_customer_stage`, `set_product_stock`,
`create_assistant`, `save_assistant_draft`, `publish_assistant_config`, `rollback_assistant_config`,
`get_channel_menu`*, `submit_lead`*, `qa_owner_pairing`. (*cũng mở cho `anon`, có chủ đích.)
`qa_shop_b_zalo_claim` đã bị đóng cho anon (#481, áp 2026-11-22).

16/17 được tấn công offline. `qa_owner_pairing` chỉ rà tĩnh (định nghĩa hosted yêu cầu `auth.uid()` là owner
đang hoạt động của `p_shop` và `requester_user_id = auth.uid()`); test offline **BLOCKED** cho tới khi migration của nó vào repo (B-P0-08).

## Lớp tấn công đã phủ

anon; JWT thiếu `sub`; user không thuộc tenant nào; owner B → tenant A (cả gọi thẳng id của A lẫn "lén" id dòng của A qua store của B);
staff/manager leo quyền (tạo store, tự nâng owner, nâng người khác, hạ owner); manager store 1 → store 2 cùng tenant;
membership tenant đã tắt nhưng membership store còn bật; tenant không nằm trong allow-list; tenant tự đăng ký → tenant khác;
đọc chéo qua RLS (9 bảng × 2 tác nhân); RPC công khai không lộ id nội bộ; resolver chỉ cho `service_role`;
helper `app_private` không ai gọi được; mọi SECURITY DEFINER đều ghim `search_path=''`; không có grant ghi trực tiếp vào bảng.

## Phát hiện (không phải lỗ hổng chéo tenant)

| # | Mức | Phát hiện | Đề xuất |
|---|---|---|---|
| F1 | P2 | `public.tien404_tester_track_change()` là SECURITY DEFINER **không ghim `search_path`** (hosted-only; chỉ `service_role` EXECUTE, là trigger) | `ALTER FUNCTION … SET search_path = ''` (migration nhỏ, cần duyệt) |
| F2 | P2 | `save_store_faq`, `delete_store_faq`, `set_customer_stage` không ghi `audit_events` | thêm audit khi sửa V23 lần tới |
| F3 | Thiết kế | Owner của một Store (không phải owner tenant) có thể tắt membership Store của owner tenant hoặc thêm owner Store khác | chấp nhận được (owner tenant luôn khôi phục được), ghi vào threat model |
| F4 | Info | Trên hosted, `save_merchant_product` (v1) không cho `service_role` EXECUTE, khác các RPC còn lại | không cần sửa |
