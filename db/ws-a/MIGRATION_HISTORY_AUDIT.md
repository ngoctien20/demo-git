# B-P0-08 — Lịch sử migration có đủ để dựng lại DB staging không?

Ngày: 2026-11-22. Nguồn hosted: `ifxlvrhyjhbzbrkdsida` (chỉ SELECT: `list_migrations`, `pg_proc`, `pg_class`,
`supabase_migrations.schema_migrations` — chỉ đọc độ dài/md5/cờ, không chép nội dung vào repo).
Công cụ: `db/ws-a/rebuild-check.sh` (chạy trong CI trên PostgreSQL 17).

## Kết luận: **CHƯA ĐỦ** — repo dựng lại được phần lõi Commerce/Store/V23/Config Core giống hệt, nhưng không dựng lại được toàn bộ DB.

### Phần dựng lại được — VERIFIED (giống từng byte)

Thứ tự: `qa/v20-store-authority/00` (replica) → V20 `10, 20, 30, 40` → `db/v23-web/10, 20, 30` → `db/config-core/10, 20`.

- **30/30 hàm** trong `public` + `app_private` mà repo tạo ra có `md5(pg_get_functiondef)`, cờ SECURITY DEFINER,
  quyền EXECUTE của `anon`/`authenticated` và `search_path` **trùng khớp 100%** với staging. Không có hàm "lệch" (drift = 0),
  không có hàm thừa.
- 17/29 bảng `public`, 3/5 bảng `app_private`.

### Phần KHÔNG dựng lại được từ repo

| Loại | Đối tượng | Nguồn trên hosted |
|---|---|---|
| Hàm (7) | `merchant_paid_orders_daily`, `merchant_revenue_v3`, `qa_owner_pairing`, `qa_shop_b_zalo_claim`, `tien404_qa_sandbox_order_guard`, `tien404_qa_sandbox_product_guard`, `tien404_tester_track_change` | 21 migration đầu (2026-11-10 → 11-17) chỉ nằm trong `supabase_migrations.statements`, chưa từng commit |
| Bảng `public` (12) | `tenant_agent_configs`, `tien404_qa_sandbox_orders/products`, 9 bảng `tien404_tester_*` | như trên |
| Bảng `app_private` (2) | `channel_secrets`, `order_idempotency` | **không có trong migration nào** (tạo ngoài luồng bằng psql) |
| Schema (4) | `factory_private` (5 bảng, 3 hàm), `tien404_r1_qa` (8 bảng, 8 hàm), `tien404_v175_qa` (8 bảng + 1 view, 6 policy), `tien404_dialogue_private` (2 bảng) | 21 migration đầu + ngoài luồng |
| Bản ghi migration | V23 web (10/20/30) và Config Core (10/20) **không có** dòng trong `supabase_migrations`; 4 dòng V20 chỉ là "pointer" (~200 ký tự) | áp bằng psql qua Actions |

Hệ quả: nếu mất staging, backup B-00 (pg_dump) là **nguồn duy nhất** để khôi phục 4 schema QA + 14 bảng + 7 hàm trên.
Vì vậy B-P0-07 (restore test trên trạng thái hiện tại) là bắt buộc, và lần chạy lịch Chủ nhật 19:00 UTC là bằng chứng quan trọng.

### 21 migration hosted-only (không có nội dung bí mật theo kiểm tra regex `vault.create_secret|password|secret_value`)

| version | name | len |
|---|---|---|
| 20261110133819 | tien404_staging_tenant_read_only_v1 | 10514 |
| 20261111085750 | v9_tenant_agent_preview_readonly | 1316 |
| 20261111090920 | v9_merchant_paid_order_value_by_creation_date | 1487 |
| 20261111095308 | v10_qa_two_shop_merchant_product_rpc | 2936 |
| 20261111221743 | tien404_factory_control_plane_v1 | 14322 |
| 20261111225128 | v11_qa_merchant_product_stale_conflict_pt409 | 3359 |
| 20261113034916 | v11_7_merchant_revenue_v3_readonly | 2769 |
| 20261114075323 | qa_private_owner_challenge_issuer | 1213 |
| 20261114075908 | qa_owner_pairing_dashboard_two_shops | 6320 |
| 20261114110953 | qa_shop_b_verified_zalo_inbound_claim | 1503 |
| 20261114124907 | tien404_v12_2_tester_requests_staging | 3128 |
| 20261114144917 | v12_3_shop_b_private_session_qa | 3446 |
| 20261114162214 | tien404_v12_4_isolated_tester_sandbox | 9101 |
| 20261114170717 | tien404_v12_4_1_tester_private_google_sheet_binding | 1580 |
| 20261117044536 | v175_qa_private_order_ownership_registry | 3866 |
| 20261117050830 | v175b_qa_durable_nonce_replay_claims | 782 |
| 20261117052251 | v175d_private_qa_otp_and_handover_states | 3633 |
| 20261117052400 | v175d_qa_exact_order_customer_integrity | 443 |
| 20261117062152 | v175e1_private_qa_two_actor_nologin_rls | 2547 |
| 20261117062253 | v175e1_private_qa_postgres_role_switch_test_only | 167 |
| 20261117074559 | v175e2b_private_auth_customer_binding_intake_no_grants | 1792 |

## Đề xuất (PROPOSED — cần chủ dự án quyết)

1. **Xuất 21 migration vào `supabase/migrations/`** bằng nội dung `statements` hosted (đúng thứ tự version).
   Cần duyệt vì repo `demo-git` là **public**: nội dung là logic QA/bảo mật (tên secret Vault, cơ chế ghép owner), không có giá trị bí mật.
   Phương án thay thế: lưu trong kho riêng tư hoặc artifact mã hóa như backup B-00.
2. **Chụp DDL của `app_private.channel_secrets` và `app_private.order_idempotency`** (schema-only, không dữ liệu) thành một migration "baseline".
3. **Ghi dòng pointer** cho V23 web 10/20/30 và Config Core 10/20 vào `supabase_migrations` (ghi hosted → cần duyệt, rollback = xóa dòng).
4. Sau 1–3, mở rộng `rebuild-check.sh`: danh sách `KNOWN_GAP` phải về 0 và thêm so khớp bảng/policy.
5. Từ nay mọi thay đổi hosted đi qua `apply_migration` (có bản ghi) thay vì psql trực tiếp.
