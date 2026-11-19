# TIEN404 AI — V18.6.14 | Disposable PostgreSQL 17 Backup/Restore Proof × Free-Plan Owner Gate

**Ngày:** 19/11/2026 (JST). **Phân loại:** CANDIDATE / SYNTHETIC VALIDATION ONLY.  
**Kế thừa:** Draft PR #447, Issue #450, Canonical Store PR #417, disposable pgTAP #421.  
**KHÔNG** chạy backup/restore trên Supabase thật; **KHÔNG** nâng gói Free; **KHÔNG** cấp quyền thực hiện migration hay Production.

## 1. Tình trạng thực tế và giới hạn

- Supabase staging `ifxlvrhyjhbzbrkdsida` đang chạy PostgreSQL 17.11, thuộc tổ chức có `plan=free` (đã xác minh qua connector). Dữ liệu metadata hiện tại: 0/2 bảng Store, 0/6 cột `store_id` Commerce, 0 restrictive Store policies; 2 sản phẩm và 2 đơn hàng ở 2 Tenant khác nhau, 1 Tenant có 2 Owner Active (chỉ thống kê, không đọc danh tính). `UNIQUE(tenant_id,sku)` và privileged RPC `save_merchant_product` tenant-only vẫn tồn tại.
- Free không được mặc định có daily backup/PITR. Chưa có backup thật, checksum, đơn vị lưu trữ, thời điểm backup, thử restore độc lập, thời lượng RPO/RTO hoặc biên bản review. **Gate B-00 = BLOCKED**.
- Bằng chứng GitHub Actions dưới đây chỉ khôi phục dữ liệu tổng hợp giả lập giữa **hai database khác nhau trong cùng một PostgreSQL 17 container/cluster tạm**. Không phải backup Supabase, không phải thử restore độc lập trên tài nguyên riêng, không bao gồm Auth/Storage/Vault, không chứng minh Owner A/B hay Production.

## 2. Phạm vi thử nghiệm tự động — QA-only

Mã: `qa/store-authority-v18614/pg17-synthetic-backup-restore.cjs` và `pg17-synthetic-backup-restore.test.cjs`.

- Trước khi chạy: assert `CI=true`, `GITHUB_ACTIONS=true`, `V1863_DISPOSABLE_POSTGRES=true`, `V18614_DISPOSABLE_RESTORE=true`, đúng `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGUSER=postgres`, `PGDATABASE=tien404_v1863_qa` và **mật khẩu chỉ dành cho fixture giả lập**. Từ chối các biến môi trường có thể chứa credential Supabase thật, và không chấp nhận URL ngoài. Script dùng một tag Docker cố định `postgres:17`.
- Trong PostgreSQL 17 tạm: tạo role **NOLOGIN**, database `t404_v18614_source` và `t404_v18614_restore`; không chạm `tien404_v1863_qa` ngoài xác minh môi trường.
- Dữ liệu giả: một Tenant, hai Store A/B, cùng SKU `SKU-001` nhưng khác giá (159000/189000) và tồn (11/9), hai đơn hàng và dòng đơn riêng Store. Composite FKs `(tenant_id,store_id,...)` phải chặn tham chiếu đơn hàng/sản phẩm giữa Store.
- Áp dụng restrictive + permissive RLS giả lập trên sản phẩm. Chạy `pg_dump` định dạng custom, xuất role-only (`pg_dumpall --roles-only`) **chỉ trong disposable cluster**, tính SHA256 và độ dài bản dump. `pg_restore --no-owner --exit-on-error` sang database đích **khác**.
- Đối chiếu digest dữ liệu và cấu trúc, FK/check constraints, bảng, chính sách RLS, `FORCE ROW LEVEL SECURITY`, function. Thử `SET LOCAL ROLE` để Owner giả lập chỉ thấy giá riêng Store A/B. Thử insert cross-Store sai khóa ngoại và bắt buộc `foreign_key_violation`. Tự xóa database/role và các tệp tạm khi kết thúc, không upload artifact có dữ liệu.
- Tất cả thao tác trên fixture có mật khẩu giả, không có network tới `*.supabase.co`, Render, n8n hoặc Meta. GitHub logs chỉ được in metadata thử nghiệm và digest của dữ liệu tổng hợp.

**Các kết luận được phép khi CI PASS:** `DISPOSABLE_PG17_RESTORE_PASSED`, bản dump source/restore cùng dữ liệu và constraint/RLS theo bài kiểm tra giả lập. **Không được kết luận:** `REAL_BACKUP_PASSED`, `REAL_RESTORE_PASSED`, `PRODUCTION_GO` hoặc Store A/B RLS trên hosted Supabase.

## 3. Free-plan backup thực tế — quy trình riêng tư, CHỜ PHÊ DUYỆT

**Nguồn chính thức hiện hành:**

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups): Pro/Team/Enterprise có scheduled daily backups; Free nên chủ động xuất data bằng CLI và lưu off-site. Database snapshot không chứa byte của tệp Supabase Storage.
- [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): hướng dẫn `supabase db dump --role-only`, dump schema, dump data với `--use-copy`; restore qua `psql` trong một transaction với `ON_ERROR_STOP`. Auth/Storage schema custom, Vault key, migration history, replication/publications, SQL owner/grant và role password có ngoại lệ, cần kiểm tra độc lập.

**Bước owner thực hiện trên máy riêng sau khi phê duyệt:**

1. Mở Supabase Dashboard dự án đúng `tien404-staging`, kiểm tra Database → Backups. Xác minh plan Free, snapshot hiện có hay không; không gửi tệp/credential vào ChatGPT/GitHub.
2. Chuẩn bị thiết bị riêng có mã hóa ổ đĩa và Docker + Supabase CLI/psql được kiểm tra phiên bản. Quản lý mật khẩu/chuỗi kết nối qua phương pháp kín; tránh để trong shell history, process arguments hiển thị cho người khác, screenshot/log, clipboard/cloud-synced notes. Không dùng GitHub Actions để dump database thật.
3. Sử dụng **đúng** hướng dẫn CLI chính thức để xuất `roles.sql`, `schema.sql`, `data.sql` (và phạm vi khác nếu cần). Lưu encrypted off-site có kiểm soát quyền, kiểm tra file không rỗng, có checksum SHA256 và thời gian UTC; ghi hồ sơ không nhạy cảm. Luôn xem lại phạm vi Auth, Storage object bytes, Vault encryption key, RPC, RLS, Edge Functions, trigger, migrations và external notification context.
4. Trong một cluster/database **tách biệt và được chủ dự án phê duyệt**, xác minh **destination identity khác source**, rồi mới restore. Không sử dụng `restore_project` với staging thật như bài thử. Lưu aggregate record counts/schema fingerprints, RLS/grant/FK inventory, migration history, test timestamps, độ trễ RTO/RPO, reviewer/rollback owner. Nếu việc khôi phục liên quan Supabase branch/dự án mới hoặc dịch vụ trả phí: phê duyệt ngân sách **trước**.
5. Khi restore thất bại hoặc không thể xác minh độc lập: Gate B-00 **NO-GO**, không chạy migration. Backup file không được push lên repo, DataTables, n8n, Slack hoặc chat.

## 4. Quyết định còn thiếu và nguyên tắc rollback

| Cổng | Điều kiện | Trạng thái |
|---|---|---|
| B-00 | Backup thật + checksum + restore độc lập thành công, reviewer | BLOCKED |
| D-02 | Owner chọn Store-local SKU hoặc Tenant-global SKU | NOT APPROVED |
| ROLE-01 | Owner phê duyệt phân tách Tenant `owner` và Store `store_owner` | NOT APPROVED |
| W-01 | Chuyển RPC `save_merchant_product` và frontend sang Store-aware, hết đường ghi tenant-only | BLOCKED |
| A/B | Hai session thật cùng Tenant, Store memberships, RLS A↔B fail-closed | BLOCKED |
| PROD | Độ tin cậy Render, backup, regression, approvals đầy đủ | NO-GO |

- Hướng được đề xuất: SKU theo Store, vì các cửa hàng độc lập có thể trùng mã nhưng khác giá và tồn; **chưa được phê duyệt**. Không thực hiện `DROP CONSTRAINT products_tenant_id_sku_key` cho tới khi đã thay toàn bộ caller theo Tenant+Store và đã nghiệm thu.
- Owner cấp Tenant không tự có quyền đọc dữ liệu Store; cần Store membership explicit. Không tự tạo Store từ Tenant hoặc SKU.
- Rollback thật phải **giữ restrictive Store RLS**, chặn writes, dùng restore đã duyệt; không phục hồi Tenant-wide read rộng. Với CI giả lập, tệp và database tạm bị xóa sau mỗi run.

## 5. Checkpoint và bằng chứng

Sau khi CI, ghi **riêng**: commit SHA, link Push/PR run, tổng local unit tests, kết quả thực tế bước `pg_dump`/`pg_restore`, SHA256 **chỉ của fixture giả** và phép kiểm tra RLS/FK. Không biến số lượng bài test tăng thành bằng chứng backup Supabase thành công.

`V18.6.14 | SYNTHETIC_PG17_BACKUP_RESTORE_CANDIDATE | LIVE_SUPABASE_BACKUP_NOT_DONE | LIVE_RESTORE_NOT_DONE | D02_PENDING | ROLE01_PENDING | PRODUCTION_NO_GO`
