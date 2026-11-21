# TIEN404 V20 — Store Authority (expand phase)

**Trạng thái:** PROPOSED / TESTED offline. **Chưa áp lên bất kỳ project hosted nào.**
Tiếp nối V19.8.17 (#472 drill), V19.8.18 (RLS fixture), V19.8.19 (#475 audit).

## Khác gì so với drill #472

Drill V19.8.17/18 chạy trên schema **giả** (`t404_v19817`). Bản này viết theo **schema hosted thật** của staging
`ifxlvrhyjhbzbrkdsida`, lấy bằng SELECT catalog ngày 21/11/2026 (cột, constraint, index, policy, grant, thân hàm).
Khi đọc schema thật phát hiện:

| Phát hiện (VERIFIED) | Hệ quả nếu áp drill #472 nguyên trạng | Cách bản V20 xử lý |
|---|---|---|
| `save_merchant_product` (SECURITY DEFINER, authenticated EXECUTE) INSERT `products` **không có** `store_id` | Writer đang dùng sẽ lỗi `not_null_violation` | Trigger `t404_store_scope_guard` tự điền store mặc định của tenant |
| Hàm đó UPDATE theo `(tenant_id, sku)` | Bỏ `UNIQUE(tenant_id,sku)` làm UPDATE chạm nhiều dòng | Giữ unique theo tenant ở pha expand; SKU theo store để pha contract |
| Default privileges của Supabase cấp **ALL** cho `anon`/`authenticated` trên bảng mới trong `public` | `stores`/`store_memberships` mới sẽ ghi được qua Data API | REVOKE rõ ràng, chỉ GRANT SELECT cho authenticated; hậu kiểm trong migration |
| RLS hiện tại là policy *permissive* mức tenant | Thêm policy store mà không xoá policy cũ thì **không cô lập được gì** (OR) | DROP 6 policy tenant, tạo 6 policy store; rollback tạo lại nguyên văn |
| `orders.customer_id` nullable | — | FK cùng-store vẫn đúng (đơn không có khách không bị chặn) |

## File

| File | Vai trò |
|---|---|
| `00_hosted_baseline_replica.sql` | Bản sao schema hosted (dữ liệu synthetic) — chỉ local |
| `10_store_authority_expand.sql` | Migration đề xuất: precheck → stores/store_memberships → backfill → trigger → FK → RLS → hậu kiểm |
| `20_store_aware_writer.sql` | Bước 2: `save_merchant_product` kiểm quyền theo Store (owner/manager của đúng store chứa sản phẩm), ghim `store_id` khi tạo/sửa, ghi `store_id` vào audit |
| `80_store_aware_writer_rollback.sql` | Khôi phục thân hàm gốc nguyên văn (kiểm md5) |
| `90_store_authority_rollback.sql` | Rollback; **từ chối** nếu tenant đã có >1 store (tránh mất gán store) |
| `offline-pg-uat.sh` | 64 kiểm tra trên PostgreSQL local, so fingerprint schema sau rollback = baseline |
| `ci-local-gotrue-uat.mjs` | Owner A/B + chi nhánh với **JWT thật do GoTrue local** cấp, qua PostgREST |

Chạy local: `PGHOST=/path/socket PGPORT=5432 bash qa/v20-store-authority/offline-pg-uat.sh`

## Phạm vi kiểm thử offline (TESTED, không phải nghiệm thu hosted)

- Không mất quyền khi cutover: owner hiện tại vẫn đọc đúng dữ liệu tenant mình.
- Store chi nhánh trong cùng tenant: owner store chính **không** thấy chi nhánh và ngược lại, cả 6 bảng.
- Thành viên tenant không có quyền store: 0 dòng ở cả 6 bảng. Staff: thấy sản phẩm, không thấy đơn.
- anon bị từ chối; authenticated không tự cấp membership / tạo store được.
- FK chặn: item lấy sản phẩm store khác, đơn dùng khách store khác, tin nhắn khác store, store của tenant khác, chuyển dòng sang store khác.
- Writer cũ `save_merchant_product`: tạo + sửa + audit vẫn chạy, dòng mới vào store mặc định.
- Tenant mới tự có store mặc định.
- Thu hồi membership store / tenant / tắt store có hiệu lực ngay với **cùng JWT**.
- Rollback: từ chối khi có đa store; sau khi dọn, rollback xong và fingerprint schema khớp baseline.
- Mutation test: bỏ điều kiện `store_id` khỏi policy → test FAIL đúng chỗ.

## Hosted (restore-test)

- 21/11 12:57 UTC: expand migration 49/49 PASS với JWT GoTrue hosted, rollback/áp lại khớp fingerprint (run 44906328409).
- Thứ tự rollback đầy đủ: `80` → `90`. Thứ tự áp: `10` → `20`.

## Chưa chứng minh (BLOCKED / UNVERIFIED)

- Chưa chạy trên Supabase hosted, chưa có JWT của GoTrue hosted, chưa kiểm writer n8n thật (các node n8n ghi qua service_role vẫn được trigger điền store mặc định, nhưng chưa thử trên workflow thật).
- `merchant_revenue_v3` / `merchant_paid_orders_daily` là SECURITY INVOKER nên sẽ tự lọc theo store — cần UAT hosted xác nhận số liệu.
- Xoá hẳn `tenant_memberships` của người còn `store_memberships` sẽ bị RESTRICT (cố ý); quy trình gỡ thành viên phải tắt store membership trước.

## Runbook hosted (mỗi bước cần chủ dự án duyệt riêng)

1. **B-00:** chủ dự án chạy `backup.ps1` (staging) + `restore-test.ps1` vào `tien404-restore-test` (`cunxxzxaboazbszsfneo`). Claude kiểm bằng SELECT: 46 bảng app, 37 policy, 19 hàm, 21 migration.
2. **Áp migration lên restore-test** (không phải staging): `10_store_authority_expand.sql` bằng `apply_migration` tên `v20_store_authority_expand`.
3. **UAT hosted trên restore-test:** tạo 4 user synthetic (`@qa.invalid`) bằng GoTrue hosted, gán membership bằng SQL, đọc 6 bảng qua PostgREST bằng JWT thật; thử writer `save_merchant_product`; thử rollback rồi áp lại.
4. Chỉ khi 1–3 PASS mới đề xuất áp lên staging, kèm backup ngay trước đó và kiểm workflow n8n ghi Commerce.

Side effects của PR này: `HOSTED_MIGRATIONS=0 HOSTED_WRITES=0 N8N_CHANGES=0 PROVIDER_SENDS=0`.

## Staging apply (owner-approved 2026-11-21 13:13 UTC)
`.github/workflows/tien404-v20-store-apply-staging.yml`: guard (staging fp must equal the
restore-test pre-migration fp `5b63ac1c…` and the original writer md5) → encrypted pre-apply
backup artifact (90 days) → read-only member visibility snapshot (`staging/snapshot.sh`) →
apply 10 → 20 → fp must equal restore-test post fp `996aac15…` → snapshot must be identical →
writer smoke (`staging/writer-smoke.sh`, every call rolled back). Any failure after apply runs
80 → 90 automatically. No auth users are created on staging.

## Step 3 — Store admin RPCs (APPLIED on restore-test + staging 2026-11-21, run 44923989992, hosted UAT 37/37)
`30_store_admin_rpcs.sql` / rollback `70_…`: `create_store` (tenant owner only, caller becomes Store
owner), `set_store_member` (tenant owner or Store owner; target must be an active tenant member; no
self-edit; last active Store owner protected), `save_merchant_product_in_store` (explicit Store,
owner/manager of that Store). Same QA allow-list as the live writer; `authenticated` still has no
direct INSERT on stores/store_memberships. Offline PG16: `offline-admin-uat.sh` 48/48 PASS; a
mutation that drops the role check is caught (FAIL_STAFF_WRITE). Not applied anywhere hosted.
Staging history: V20 steps 10 and 20 were recorded in `supabase_migrations.schema_migrations`
(versions 20261121131841 / 20261121131843) on 2026-11-21 with pointers to the source files.

## Step 4 — SKU contract (PROPOSED, offline only)
`40_store_sku_contract.sql` / rollback `60_store_sku_contract_rollback.sql`. Drops
`UNIQUE(tenant_id,sku)`; `UNIQUE(tenant_id,store_id,sku)` stays, so the same SKU can live in
several Stores with its own name/price/stock. The legacy writer `save_merchant_product` keeps its
signature, ACL, validation and error codes but is pinned to the tenant's **default** Store (a
(tenant,SKU) lookup is no longer unique). `save_merchant_product_in_store` is unchanged; its
`sku_taken` now means "taken in this Store". 60 refuses while any tenant has a SKU in more than
one Store, then restores the key and the step-2 writer body verbatim; 90 now refuses until 60 ran.

Behaviour change to accept: v1 can no longer edit a branch product (PT409); v1 create of a SKU that
only exists in a branch now creates a separate default-Store row. `merchant_revenue_v3.top_skus`
groups by SKU, so an owner who sees several Stores gets one line per SKU across Stores.

Offline PG16: `offline-contract-uat.sh` 32/32 PASS (fp after 60 = fp after 30, writer md5 after
60 = step-2 md5). Full order: apply 10 → 20 → 30 → 40, roll back 60 → 70 → 80 → 90.
