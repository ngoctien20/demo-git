# TIEN404 AI — V15.2-ADV.6C-RPC.6
## Four-Row Ownership Verification × Independent Backup/Restore Gate × Hosted Store Migration Authorization

**Ngày:** 16/11/2026 JST
**Trạng thái:** VERIFIED READ-ONLY / IMPLEMENTED DRAFT / CI QA PENDING / NO HOSTED WRITE
**Dự án:** Supabase staging `ifxlvrhyjhbzbrkdsida`
**Parent:** RPC.5 Draft PR #189, HEAD `33b3c85013f4fc034261de8eb114537bf8e6c368`

## 1. VERIFIED — four-row aggregate reconciliation (không xem hàng khách hàng)

Các truy vấn SQL chỉ đọc trực tiếp trên Supabase hosted trả về:
- 2 tenants, 3 tenant_memberships, 2 products, 2 orders, 0 customers.
- Chính xác **2/2 Tenants**, mỗi Tenant có **1 Product và 1 Order**.
- **2/2 Tenants có ít nhất một `active owner`**. Không có Tenant nào thiếu active owner trong scope này.
- 0/2 Order có `customer_id` khác NULL.
- `public.stores` / `public.store_memberships` không có; không có cột `store_id` trên Products/Orders/Customers.
- FORCE RLS được bật ở Products/Orders/Customers nhưng RLS cũ dựa vào Tenant, không xác nhận quyền Store.
- RPC `public.qa_shop_b_zalo_claim(uuid,text,text,text)` vẫn `anon EXECUTE=true`, `track_functions=none`.

**Điều đã được chứng minh:** Bốn bản ghi hiện tại có phân bố Tenant nhất quán, mỗi Tenant có Owner hoạt động.
**Điều KHÔNG được chứng minh:** ID Store chuẩn, ánh xạ của từng bản ghi sang Store, Owner JWT thực hoặc quyền Store trong cùng một Tenant. Không được suy ra hai Tenant hiện tại chính là hai Store A/B thuộc *cùng một Tenant*. Với schema hiện hành, không tồn tại chứng cứ để xác nhận đó là mô hình chính thức.

Không ghi row ID, Tenant ID, tên khách, số điện thoại hoặc token vào repo hoặc checkpoint. Nếu Operator cần xem bốn row ID để chứng nhận, chỉ làm trong môi trường riêng được ủy quyền; không đưa chúng vào GitHub, CI logs hoặc ChatGPT.

## 2. VERIFIED — Caller và trạng thái recovery gate cũ

- n8n Zalo V1 `yIJk8LvJoLF40Z62` Published `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` và V2 Shadow `OgDZNSAvKEvhnAvn` Published `f00ba506-c52a-4340-9a0c-809fd9c6ea9a` vẫn Active, các node gọi tiếp/tới RPC vẫn enabled.
- Nhóm caller bên ngoài/dynamic và log PostgREST trực tiếp chưa được chứng nhận toàn bộ.
- Kiểm tra module kế thừa `qa/v152-advanced-actions/adv6c-backup-decision.cjs`: quyết định hiện tại **DENY_ONE_TIME_REAL_BACKUP_EXPORT**, vì không có Controller/Security Reviewer thực, vùng lưu private, quyền Operator, one-time nonce, chứng cứ hosted Store Owner và khôi phục thực được xác nhận.
- Các bài PostgreSQL 17 tại RPC.2–RPC.5 đều dùng data tổng hợp/throwaway; chúng không thể được coi là backup thật hoặc restore độc lập từ Supabase hosted.
- Có thể tồn tại ghi chú người dùng về thử restore tại máy Windows/Docker; việc đó chưa được đối chiếu trực tiếp với bản sao backup hosted được phê duyệt và thẩm định độc lập. Không chấp nhận làm chứng nhận.

## 3. DESIGN FINDING P0 — vòng phụ thuộc backup/JWT và cách tách an toàn

**Vấn đề:** M1 tạo schema Store và Store Membership để Owner A/B cùng Tenant có thể kiểm thử JWT/RLS. Nhưng cổng ADV.6C trước đó đòi Hosted Store JWT proof trước khi cho phép backup. Đồng thời M1 phải có recovery backup + restore trước khi thực hiện thay đổi dữ liệu/DDL. Nếu không phân biệt mục đích backup, hệ thống vướng vòng phụ thuộc.

**RPC.6 PROPOSED resolution:**
- Định nghĩa **Pre-M1 Recovery Backup** như một yêu cầu **tách biệt** khỏi chứng nhận phát hành Commerce. Quy trình này không cần sự tồn tại của Store JWT proof vì Store chưa được tạo.
- Điều này **không nới quyền**: export dữ liệu thật vẫn đòi phê duyệt một lần của Controller, Security Reviewer độc lập, Backup Operator có quyền, encrypted private vault, phạm vi bảng, chi phí, thời hạn lưu, chính sách xử lý thông tin và nonce. Không có các chứng cứ này → DENY.
- **Schema-only rehearsal** được phép chuẩn bị dưới dạng kế hoạch nhưng không được coi là đủ backup để chuyển Commerce Data. Một schema-only dump không khôi phục bản ghi Product/Order.
- Một lần **independent isolated restore** phải lấy đúng archive có biên bản xuất được duyệt, kiểm tra checksum, schema/ACL, row counts, Foreign Key/Policy và report bởi người duyệt độc lập. Restore trong *cùng PostgreSQL CI service* chỉ chứng minh cơ chế, không chứng minh cô lập thật.
- **M1 schema expand** cần hồ sơ phê duyệt riêng sau backup/restore; **M2 backfill, M3 FKs/SKU và M4 atomic RLS** cần phê duyệt **mới từng giai đoạn**. JWT/RLS hosted thật chỉ có thể nghiệm thu đầy đủ sau khi schema và dữ liệu QA theo Store được chuẩn bị và xác minh.
- Không bao giờ cho phép backup authorization biến thành quyền thay đổi credential, table, role, Published workflow hoặc legacy RPC.

Phát hiện trên là thiết kế kiến trúc và đề xuất thay đổi điều kiện phê duyệt; **KHÔNG** sửa trực tiếp cơ chế backup đang dùng ở hosted hoặc tự cấp quyền.

## 4. IMPLEMENTED — Reuse private owner evidence linter

Source-only: `qa/v152-rpc6/fourrow-recovery-migration-gate.cjs`.
- Hàm `checkHostedCounts`: xác minh phân bố 2 Tenants/2 Products/2 Orders và hiện trạng không có Store. Drift → chặn.
- Hàm `reviewPrivateFourRow` trực tiếp gọi **`qa/security-definer-v1443/four-row-owner-evidence.cjs`**, không viết lại parser. Chỉ dành cho Operator chạy riêng tư, nếu có dữ liệu gốc được phép đọc. Kiểm tra 4 row, 2 tenant, owner/reviewer khác người, mỗi row 3 nhóm chứng cứ, checksum và ràng buộc Tenant/Store.
- Kể cả cú pháp ledger hợp lệ, kết quả luôn **PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW**, không tạo chứng nhận Store Owner, không ghi dữ liệu.
- Source-only không in/serialize ID bản ghi hoặc dữ liệu gốc; CI dùng UUID **tổng hợp**.
- `reviewPreMigrationBackup`: kiểm tra phạm vi, TTL ≤15 phút, nonce digest, encrypted destination, retention ≤90 ngày và cost cap do Controller điền; luôn `canExportBackup=false`.
- `reviewRestoreReceipt`: kiểm tra hình thức digest archive, báo cáo restore, row count và schema/grants; luôn `canApplyMigration=false`.
- `reviewM1Authorization`: chỉ kiểm tra hồ sơ **M1 expand schema**, không cấp quyền cho M2–M4; kể cả metadata tự khai green, `canApplyM1=false`.
- Các hàm `runHostedMigration` và `exportRealBackup` đều throw.

## 5. TESTED — Phương án QA và rollback

- `qa/v152-rpc6/fourrow-recovery-migration-gate.test.cjs`: 24 ca phủ positive/negative synthetic, sai tenant shape, Owner/Reviewer tự ký, tái dùng Store ID qua Tenant, PII injection, scope/TTL/chi phí/backup, archive hash mismatch, fake restore, fake approval, phase mismatch.
- Regressions reuse V14.4.3 `four-row-owner-evidence`, ADV.6C `adv6c-backup-decision`, RPC.5 `hosted-store-remediation-preflight`, V14.4.2 hosted JWT GET-only offline.
- `qa/v152-rpc6/ci-disposable-restore-drill.sh`: chạy `pg_dump --schema=qa_v1441` trên dữ liệu synthetic PG17 đã có; `pg_restore` sang database khác trong *chính cùng CI PostgreSQL service*; xác minh 3 Products/2 Orders/3 **synthetic** Customers, composite FK, FORCE RLS, không còn old permissive Tenant policy, quyền DB synthetic không BYPASSRLS.
- Đây là **restore mechanics only**. Nó không chứng minh hosted real backup, không dùng file của người dùng, không lưu archive sau job, không liên quan dữ liệu thật.
- CI có một job NO-GO luôn cố ý FAILED để bảo đảm không biến chứng cứ tổng hợp thành migration approval.
- Nghiệm thu TESTED chỉ sau khi xem log CI exact HEAD; nếu CI đỏ ngoài gate chủ đích, sửa trong Draft và chạy lại.
- Rollback source-only: đóng Draft PR. Vì chưa thay hosted nên không có database rollback thực tế.

## 6. Private Operator SOP — cần hoàn thành ngoài môi trường ChatGPT trước phê duyệt

1. **Chủ sở hữu/Controller:** xác nhận hai Tenant, số bản ghi và quyền xem thông tin theo từng record. Đừng tự chọn Store ID dựa trên SKU hoặc trạng thái Owner Tenant.
2. **Operator và independent Security Reviewer:** lưu private ledger 4 hàng theo V14.4.3; từng hàng có 3 loại chứng cứ. Không chuyển nội dung gốc, ID, ảnh giấy tờ, số điện thoại hoặc JWT vào ChatGPT hay public GitHub.
3. **Backup-only approval:** Controller chọn đích mã hóa, phạm vi dữ liệu, thời gian lưu, ngưỡng chi phí và thời điểm; Security Reviewer và Backup Operator xác minh độc lập. Quyết định **một lần** được lưu trong ledger nội bộ có tiêu thụ nonce atomically. Phạm vi được ký không cho phép M1.
4. **Chạy backup/restore sau phê duyệt:** Operator được ủy quyền tạo archive thật theo chính sách; người khác kiểm tra restore ở môi trường cách ly. So sánh hash, PG major, schema, ACL, row counts, integrity và rủi ro PII.
5. **M1 migration approval:** riêng Controller+Reviewer+DB Operator xác nhận preflight, version, rollback, môi trường staging, permissions. Chỉ duyệt M1 nếu mã đã review, test dữ liệu thật theo quyền, và backup đã được nghiệm thu; không tự làm M2/M3/M4.
6. **M2–M4 tiếp theo:** Owner mapping cho Store; không gán hàng thiếu chứng cứ; sau đó composite FKs, SKU uniqueness, atomic RLS policy replacement. M5 JWT/RLS real proof và Canary thuộc quy trình phê duyệt riêng.

### 7. STOP CONDITIONS / trạng thái hiện tại

**VERIFIED:** count-only hosted shape; Owner hoạt động theo Tenant; Published n8n still active; tenant-only FORCE RLS; missing Store schema; legacy RPC anon still callable.

**IMPLEMENTED:** source-only read-only baseline, private ledger re-use, split recovery and migration preflight, synthetic archive/restore test and test plan.

**BLOCKED:** row-level Store Owner attribution; primary private reviews, actual hosted backup approval; independently verified real restore; exact M1 authorization; Store migration, JWT/RLS, canary, RPC revoke.

**NO-GO:** any real backup export, Supabase hosted migration, customer row backfill, Published edit, provider send or revoke. No secrets or customer data were changed.

**Next:** once independently verified private evidence and per-operation real authorization are available, prepare operator-side M0 intake; no real change is implied by this source-only PR.
