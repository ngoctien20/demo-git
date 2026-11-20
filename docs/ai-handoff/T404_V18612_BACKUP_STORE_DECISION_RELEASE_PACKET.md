# TIEN404 AI — V18.6.12 | Backup/Restore × D-02 SKU × Store Owner × Render Readiness

**Ngày kiểm toán:** 2026-11-19 JST. **Trạng thái:** DESIGN / DECISION PACKET ONLY / STAGING NO-GO.  
**Dự án:** Supabase staging `ifxlvrhyjhbzbrkdsida`, Render staging `My Workspace`, GitHub `ngoctien20/demo-git`.  
**Nguồn thiết kế:** Draft PR #417 (Store Authority) và #421 (disposable PG17 DML/RLS), Draft PR #447 (writer/RPC, hosted GET).  
**Quy tắc:** tài liệu này không phê duyệt migration, không phải backup, không cấp quyền chạy DDL/DML/GRANT/REVOKE, không mở Production.

## 1. Bằng chứng hiện tại — VERIFIED / đọc metadata, không đọc khách hàng

- Supabase PostgreSQL 17.11 `ACTIVE_HEALTHY`, 0/2 bảng `public.stores`/`public.store_memberships`, 0/6 cột `store_id` trên sáu bảng Commerce, 0 restrictive policy ở public. Tám bảng cốt lõi đã bật RLS nhưng các policy đọc Commerce đang PERMISSIVE và Tenant-scoped. Chưa có chứng cứ cách ly cùng Tenant / hai Store thật.
- `products`: `UNIQUE(tenant_id, sku)`; `tenant_memberships.role` có CHECK `owner|manager|staff`. `order_items` dùng FK `(tenant_id, product_id)` và `(tenant_id, order_id)`; nếu đưa Store vào, cần composite FK `(tenant_id,store_id,...)` để chống tham chiếu chéo Store.
- Chỉ số tổng hợp: 2 products / 2 tenants, 2 orders / 2 tenants; customers, order_items, conversations, messages = 0 tại thời điểm kiểm tra. Không sử dụng các số liệu này để tự quy kết Store Owner hoặc ánh xạ legacy rows.
- RPC quyền hiện tại: `save_merchant_product` = authenticated EXECUTE, SECURITY DEFINER, Tenant-only product INSERT/UPDATE; `qa_owner_pairing` = authenticated EXECUTE; `qa_shop_b_zalo_claim` = anon EXECUTE. Các caller trực tiếp đã phát hiện: Render static Auth product editor và owner pairing; n8n active Zalo claim. Không sửa hoặc REVOKE các RPC này bằng giả định.
- Render Data đang Live với commit `ab940a95dae8afdff426bc6ac71693833d5348ce`, `app.main:app` không truyền `commerce_connect`, nên bốn merchant order routes không được gắn vào app mặc định. HTTP anonymous GET sau startup: 11/11 PASS; trước startup từng có 503 (push 5/11, PR attempt 1 7/11); nguồn 330/330 PASS. Đây **không** phải QA Auth Owner A/B.
- Supabase organization metadata và connected tools KHÔNG xác nhận gói thuê bao, danh sách backup, thời điểm backup, PITR hay restore test. Không có quyền khẳng định có backup.

## 2. Gate B-00 — Backup, Restore và giới hạn bằng chứng

**BLOCKED** đến khi có bằng chứng PRIVATE, không chứa token/PII. Gói Free được Supabase khuyên dùng CLI `db dump` và lưu off-site; gói Pro/Team/Enterprise có daily backups, PITR là add-on. Không suy ra gói từ `ACTIVE_HEALTHY` hoặc PostgreSQL version. Supabase Backup chỉ chứa metadata của Storage objects, không khôi phục tệp Storage đã xóa; tách kế hoạch dữ liệu database và Storage.

Thứ tự tối thiểu trước bất kỳ thay đổi schema/grants trên staging:

1. **Owner kiểm tra Dashboard → Database → Backups**: ghi loại backup (daily/PITR/manual/offsite), trạng thái khả dụng, ngày giờ UTC, phạm vi giữ bản, khả năng tải xuống hoặc khôi phục. Không gửi credential hay tệp backup vào issue/PR/chat.
2. **Chọn phương án**: (A) backup có sẵn đã được kiểm chứng, hoặc (B) owner phê duyệt export riêng tư bằng công cụ chính thức (CLI/db dump) và lưu mã hóa, phân quyền giới hạn, kiểm tra checksum. Nếu không có cả hai, dừng tại Gate B-00.
3. **Khôi phục độc lập**: chỉ trong database/dự án tách biệt hoặc local disposable được phê duyệt; không restore đè `ifxlvrhyjhbzbrkdsida`. Kiểm tra schema, role, grants, RLS, functions, FK, indexes, migrations, tổng số bản ghi không chứa thông tin cá nhân, consistency/hash; kiểm tra các dependency ngoài DB (Auth, Edge, Storage) theo phạm vi.
4. **Bằng chứng nghiệm thu**: backup identifier (không nhạy cảm), timestamp/retention, checksum không chứa dữ liệu, lần restore thành công/thất bại, sai khác schema, RPO/RTO đo được, reviewer, rollback owner, thời điểm và checklist cleanup. Nếu cần dự án/dịch vụ trả phí, **phải phê duyệt chi phí trước**.
5. **No-Go** khi chưa có restore rehearsal thành công hoặc không chắc có thể khôi phục dữ liệu/permission. Không dùng câu lệnh `restore_project` trên staging hiện tại như một phép thử.

Nguồn chính thức: https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## 3. Quyết định D-02 — Phạm vi SKU

| Option | Bất biến | Ưu / Nhược | Trạng thái |
| --- | --- | --- | --- |
| **STORE_LOCAL** (đề xuất) | Một SKU duy nhất trong một `(tenant_id,store_id)`; Store A và B có thể cùng `A001` | Giá/tồn kho độc lập; phải chuyển đồng bộ UI, RPC, API, tìm kiếm, import và đơn hàng; buộc chỉ định Store verified | OWNER UNAPPROVED |
| TENANT_GLOBAL | Giữ `UNIQUE(tenant_id,sku)`, các Store không được trùng SKU | Tương thích nguồn cũ hơn nhưng hạn chế mô hình cửa hàng độc lập | OWNER UNAPPROVED |

**Tác động xác minh được:** Live `products_tenant_id_sku_key` đang ràng buộc Tenant-global. PR #417 đề xuất `UNIQUE NULLS NOT DISTINCT(tenant_id,store_id,sku)` cho giai đoạn nullable/legacy. PostgreSQL 17.11 hỗ trợ cú pháp này, nhưng phải kiểm thử dữ liệu NULL và khóa đồng thời trước khi áp dụng.

Trước STORE_LOCAL cutover, chuẩn bị **code+writer inventory**: `save_merchant_product(p_tenant,p_sku,...)` chưa có tham số Store; Render `assets/merchant-product.mjs` hiện đọc theo Tenant+SKU và editor đang tắt ở UI; n8n Commerce/Sandbox và bất kỳ API nhập SKU đều phải được đánh giá trước khi thêm unique mới. Không chỉ đổi constraint rồi giữ RPC/caller Tenant-only: sẽ gây ambiguity, update sai Store. Phải verify ownership bằng Store membership/server-side trusted resolver, không tin `store_id` người mua/agent tự gõ.

## 4. Quyết định ROLE-01 — Tenant Owner và Store Owner

**Đề xuất tách hai scope, chưa phê duyệt:**

- `tenant_memberships.role='owner'`: quản trị Tenant, Store registry và chỉ định Store Owner; **không tự động** xem dữ liệu Commerce mọi Store.
- `store_memberships.role='store_owner'`: quản lý Commerce Store chính xác nơi actor có membership active; `manager`/`staff` là quyền Store hạn chế.
- Tenant Owner muốn xem Store A/B cần explicit active Store membership tương ứng. Không map `owner` sang `store_owner` ngầm, kể cả khi Tenant mới chỉ có một Store.
- Bảo vệ Store cuối cùng: không được thu hồi/demote Store Owner active cuối cùng khi Store active; chuyển Owner phải atomic, audit được và có người thay thế được xác nhận.
- `store_memberships` là bảng mới; không bổ sung `store_owner` vào CHECK cũ của `tenant_memberships`.

Tham chiếu thiết kế: `qa/v18.3.6d/TENANT_STORE_MEMBERSHIP_CONTRACT.md`, `CANONICAL_STORE_AUTHORITY_DESIGN.md`, Draft PR #417. Phải đối chiếu vocab `owner` vs `store_owner` trong PG17 fixture PR #420 và PR #421 trước khi thúc đẩy migration.

## 5. Render Readiness — Free staging → service pilot

Render Free Web Service có thể ngủ sau 15 phút idle và khởi động lại khoảng một phút; tài liệu Render không khuyến nghị dùng Free cho Production: https://render.com/docs/free.

- **Hiện tại:** giữ Free cho staging (không tự nâng gói). Chấp nhận 503 lúc cold start là điều kiện môi trường, ghi rõ trong staging QA. Khi backend chưa sẵn sàng, frontend cần trạng thái `Đang khởi động dịch vụ` và **bounded retry chỉ cho GET/idempotent reads**, exponential backoff + jitter, giới hạn số lần/chờ, không che thất bại.
- **Tuyệt đối không tự retry POST đặt hàng, xác nhận đơn, đổi tồn kho hoặc thanh toán** khi không có idempotency key và chứng cứ transaction outcome; có thể làm trùng đơn hoặc trừ kho hai lần.
- **Trước pilot có khách thật:** lập SLO readiness và đo cold-start P95/P99, lỗi 503, timeouts, RPO/RTO, chi phí; xem phương án paid instance hoặc backend hosting khác, chọn sau phê duyệt ngân sách và UAT thực tế. Không dùng ping tự động như chứng cứ Production reliability.
- **Acceptance:** warm 11/11 GET PASS đã chứng minh; cold-start P1 **chưa khắc phục**. Không gọi đây là endpoint production-ready.

## 6. Đường triển khai (không chạy trong tài liệu này)

G0. Owner ký D-02 và ROLE-01 riêng; backup plan và budget rõ ràng.  
G1. B-00 thật: backup thành công + restore độc lập, người review và rollback plan.  
G2. Reconcile PR #417/#421 + writer + client inventory, static diff, dummy fixture PG17; không tạo migration song song khác canonical.  
G3. Owner phê duyệt riêng DDL trên staging sau full review; thêm registry/membership trước, rồi nullable Store scope, composite FK và restrictive RLS fail-closed.  
G4. Mapping legacy rows chỉ từ manifest có Store Owner ký duyệt, không suy Store từ tenant/SKU/channel.  
G5. Re-verify RPC/clients, Auth Owner A/B cùng Tenant, RLS Store cross-access 0, backup verification, failover and rollback.  
G6. CANDIDATE → APPROVED → RELEASED chỉ sau stage UAT, budget và security approval; **Production NO-GO ở mọi giai đoạn trước đó**.

**Rollback cốt lõi:** nếu Store boundary đã bật, không tháo restrictive RLS để khôi phục đọc Tenant-wide. Ưu tiên tắt writes và cách ly endpoint lỗi; chỉ phục hồi dữ liệu/permission bằng plan đã được phê duyệt và đã rehearsal. Giữ bản sao migration source và SHA; không xóa evidence.

## 7. Yêu cầu owner trước khi chuyển bước

- [ ] **D-02:** chọn STORE_LOCAL hoặc TENANT_GLOBAL SKU (không mặc định từ khuyến nghị).
- [ ] **ROLE-01:** chọn tách Store Owner và Tenant Owner explicit membership, hoặc ghi nhận phương án thay thế có security review.
- [ ] **B-00:** cung cấp *metadata không nhạy cảm* của backup trong Dashboard, và cho phép thực hiện isolated restore khi scope/cost được duyệt.
- [ ] **R-01:** xác định khi nào cần SLO production và trần ngân sách Render/hosting; không tự nâng gói.

**Checkpoint:** `V18.6.12 | CURRENT_SCHEMA_VERIFIED | SKU_D02_PENDING | STORE_ROLE_PENDING | BACKUP_UNKNOWN | RESTORE_NOT_TESTED | RENDER_COLDSTART_P1 | NO_DDL_DML | NO_DEPLOY | PRODUCTION_NO_GO`.