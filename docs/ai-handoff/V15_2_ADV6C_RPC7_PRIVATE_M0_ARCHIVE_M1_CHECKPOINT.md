# TIEN404 AI — V15.2 ADV.6C-RPC.7
## Private M0 Recovery Acceptance × Store Ownership Evidence Resolution × M1 Migration Readiness

**Ngày:** 16/11/2026 JST  
**Lifecycle:** DRAFT / SOURCE-ONLY / NO EXPORT / NO HOSTED WRITE / NO-SEND  
**Parent:** RPC.6 Draft PR #192 HEAD `d8a713290ec2d31fb56446028f17171f4ff8d2ea`  
**Supabase staging:** `ifxlvrhyjhbzbrkdsida`.

## 1. VERIFIED — hosted aggregate recheck (chỉ đọc)
- Trên Supabase hiện có **2 Tenants, 2 Products, 2 Orders, 0 Customers**. Mỗi Tenant có đúng **1 Product + 1 Order**, và cả hai đều có active Tenant Owner.
- Không tồn tại `public.stores`, `public.store_memberships`; Owner cấp Tenant không tự xác nhận Owner của Shop A/B cùng Tenant.
- `public.qa_shop_b_zalo_claim(uuid,text,text,text)` vẫn có `anon EXECUTE`; đường gọi cũ đã được ghi tại RPC.2–RPC.6. Không có phê duyệt thu hồi quyền.
- Chưa có bốn chứng cứ gốc xác minh từng Product/Order thuộc Store nào. Các kết quả count-only không phải chứng nhận theo Store.
- Chưa có bằng chứng độc lập về archive hiện tại đã được khôi phục trên hạ tầng riêng hoặc được phép thay thế Auth/Storage.

## 2. Reconcile H11R — classify, do not redo or fabricate
Theo checkpoint H11R ở các phiên trước, người vận hành từng kiểm tra archive local `TIEN404_V142_PRE_RLS.backup` trong môi trường Windows/Docker và đối chiếu schema/application data + RLS. **Đó là chứng cứ khôi phục ứng dụng một phần**: checkpoint cho biết archive chưa bao gồm `TABLE DATA auth.users` và chưa xác minh phạm vi Storage object bytes, Auth session/customer login, current hosted snapshot, operator signing hay independent off-host restore.

Các bằng chứng trước đây không bị loại bỏ: giữ nguyên checksum/restore receipt trong vùng private hiện có, không chạy lại export nếu chưa có nhu cầu/ủy quyền. M0 chỉ yêu cầu **xác minh phạm vi/nguồn gốc, độ mới và khả năng khôi phục** của archive tương ứng với trạng thái migration.

Không gắn nhãn `FULL HOSTED RESTORE` cho archive một phần; không gắn nhãn `INDEPENDENT RESTORE` cho hai database nằm trong cùng dịch vụ CI.

## 3. IMPLEMENTED — Existing archive coverage inspector

File `qa/v152-rpc7/local-archive-coverage.cjs` nhận nội dung mục lục `pg_restore --list` đã có. Không đọc bản ghi hoặc dump SQL, không kết nối hosted hoặc thực thi restore, không đưa đường dẫn/archive lên CI.

Ba nhóm kiểm tra:
- **Application TABLE DATA**: `public.tenants`, `tenant_memberships`, `products`, `orders`, `customers`.
- **Auth TABLE DATA**: `auth.users`, `auth.identities`, `auth.sessions`.
- **Storage TABLE DATA**: `storage.objects`, `storage.buckets`.

Bộ phân loại trả:
- `APP_RECOVERY_COVERAGE_INCOMPLETE` nếu thiếu dữ liệu application trong TOC;
- `PARTIAL_APP_ARCHIVE_NOT_FULL_SERVICE_RECOVERY` khi đủ entry application nhưng thiếu Auth/Storage;
- `STRUCTURAL_TOC_COVERAGE_CANDIDATE_UNVERIFIED` khi mục lục có tất cả entry, nhưng **vẫn không chứng minh có row thật, backup mới nhất, quyền truy cập, restore độc lập, dữ liệu Storage object bytes hoặc khả năng đăng nhập**.

**Lưu ý:** Supabase Database Backups không chứa file nhị phân trong Storage API, chỉ có metadata DB; phải có kế hoạch riêng cho object bytes nếu TIEN404 sử dụng Storage. Việc yêu cầu tên Auth tables trong TOC là kiểm tra **khả năng khôi phục đầy đủ dịch vụ** của archive chứ không bắt buộc cho một chiến lược application-only restore đã được giới hạn và chấp thuận. Không đánh đồng hai scope.

`local-archive-coverage-cli.cjs`: một CLI đọc **chỉ STDIN** từ mục lục, in JSON nhóm bảng và trạng thái. Không cần cấp credential để chạy.

### Cách kiểm tra riêng tư trên Windows (chỉ đọc)

Thực hiện trên **máy riêng** đã có file, Node.js và `pg_restore`, tại thư mục repo đã clone:
1. Lấy đúng bản Draft branch RPC.7 về máy (chỉ đọc/check out); không chạy SQL nào trên hosted.
2. Trong PowerShell, khai báo `$archive = "ĐƯỜNG_DẪN_THẬT_TRÊN_MÁY\TIEN404_V142_PRE_RLS.backup"` (sửa theo đường dẫn local, **không chép đường dẫn thật vào chat**).
3. Thực hiện `pg_restore --list "$archive" | node .\qa\v152-rpc7\local-archive-coverage-cli.cjs`.
4. Chỉ lưu **phân loại** `classification` và ba nhóm `tableDataCoverage` trong kho evidence private. Không đưa raw TOC, archive, JWT, Owner ID hoặc email vào PR.
5. Nếu máy chưa có `pg_restore`, có thể chạy qua Docker Postgres 17 với bind mount **read-only** một thư mục archive local theo chính sách máy; không gửi file lên cloud/public repo. Không tự dùng production connection string.
6. Nếu archive PARTIAL, giữ nguyên kết quả H11R, xây riêng phương án bổ sung recovery trước M1 sau khi được duyệt; không tự khôi phục/hợp nhất Auth thật.

**Bộ kiểm tra không xác minh source timestamp/chữ ký**: operator phải tự đối chiếu bản archive với nguồn Supabase authorized và receipt private. M0 tiếp tục BLOCKED khi thiếu.

## 4. IMPLEMENTED — M0 primary-evidence gate and M1 readiness

`qa/v152-rpc7/private-m0-evidence-resolution.cjs`:
- Tái sử dụng `checkHostedCounts` của RPC.6 và kết quả linter V14.4.3; tránh xây lại identity/backup code.
- Phân biệt old archive structure, source project+freshness, immutable SHA, bốn Owner ledger rows được kiểm tra riêng tư, hồ sơ restore độc lập bao gồm Auth/Storage, và ba vai trò Controller/Security Reviewer/Backup Operator.
- **Không cho phép** một bản archive dùng được ở phạm vi application tự động chuyển thành full service recovery.
- `reviewM0Evidence`: ngay cả all-green self-reported JSON chỉ được `CLAIMED_M0_READY_FOR_EXTERNAL_ATTESTATION`, cờ quyền vẫn false.
- `reviewM1Readiness`: tiếp tục **M1 NO-GO**, chỉ cho phép xem hồ sơ mở rộng schema `M1_EXPAND_SCHEMA_ONLY`; không được tự nâng sang M2 backfill/M4 RLS, không sửa Published và không thu hồi RPC.
- Các hàm `executeM1` và `exportHosted` luôn throw. Không có database connector hay quyền đọc JWT trong mã Draft.

**Quan trọng:** các kiểm tra chữ ký Ed25519 tổng hợp trong RPC.3/4 là kiểm tra kỹ thuật, không thay thế chứng cứ gốc. RPC.7 không tạo thêm một bộ khóa ký giả.

## 5. Real M0 acceptance — hiện chưa đủ chứng cứ

Bảng phân loại thực tế hiện có:

| Class | Verified | Missing |
|---|---|---|
| Hosted aggregate 4-row count / Tenant membership | VERIFIED | Store owner per-row |
| Existing local H11R recovery | Prior local PARTIAL receipt | Current exact archive provenance, Auth/Storage, independent off-host restore |
| Approved one-time real data export | NO | Owner consent, Controller+Reviewer, Backup Operator, destination, retention, budget, nonce |
| Independent restored environment | NO | Real authorized archive restored and reviewed outside CI |
| Store Ownership ledger | NO | Four row IDs mapped privately to canonical Store, with two independent attestations |
| M1 schema-only migration | NO | Real M0 evidence + distinct M1 change authorization |

Do NOT claim the four hosted legacy rows are Shop A/B within the same tenant. They currently belong to **two separate tenants**. To test same-tenant Shop A/B security, create synthetic QA Store objects only in disposable DB or, in future, after separately authorized staging migration.

## 6. Operation-specific acceptance order (PROPOSED)
1. Verify prior H11R backup privately with the new `pg_restore --list` tool, no export.
2. Independently review four-row Store ownership evidence in existing private store; if Store mapping is unproven, leave unresolved.
3. Controller chooses explicit recovery *scope* (application-only vs full Auth/Storage-dependent service), recovery point, retention, cost cap, encryption key custody and off-host restore method. Security Reviewer reviews separately.
4. **Only if old archive insufficient for chosen scope**, seek separate one-time real backup export approval; do not use this Draft as blanket permission.
5. Restore the approved archive in a truly independent isolated environment, compare actual data and schema/RLS/grants, and explicitly cover Auth sessions and Storage bytes as required. Document source and reviewer independently.
6. Build standalone M1 Expand-only plan bound to exact hosted schema, version, approved backup and rollback; then request **a different M1 authorization**. No M2/M3/M4 or n8n Published change under M1.
7. Keep RPC `anon EXECUTE` unchanged until callers moved to approved private gateway and canary passed.

## 7. QA and checkpoint
- New source test suite checks full/partial/schema-only archive classification, tamper/metadata drift, missing Owner, no self-approval, restored scope and M1 phase restrictions.
- Inherited RPC.6 owner/backup and V14.4.3 private ledger unit tests reused; no new hosted migration or real database export.
- CI hosted M0/M1 authorization job deliberately returns NO-GO while actual proof is absent.
- **VERIFIED:** hosted aggregate and missing Store schema.
- **IMPLEMENTED:** offline local archive TOC inspector, M0 evidence classification and M1 read-only readiness rules.
- **BLOCKED:** actual archive inspection, real Owner Store mapping, real user approval and independent full restore.
- **ROLLBACK:** close Draft PR; no real hosted change to restore.


## 8. RPC.7 continued review — Recovery scope mismatch remediated (16/11/2026 JST)

**New source-only finding:** The earlier RPC.7 `reviewM0Evidence` required Auth/Storage `TABLE DATA` even when the operator might explicitly choose *application-data recovery with an independently tested external Auth/Storage recovery plan*. This conflicted with the checkpoint's separation of the two scopes and could produce unnecessary pressure to create a new hosted backup.

**Safe fix within the same PR:**
- `FULL_SERVICE` (default) still requires application + Auth + Storage table data coverage and full-dependency recovery claims. TOC presence alone never certifies archive integrity or full service restore; Storage object bytes are not inside the database archive.
- `APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN` accepts application TOC coverage only **for initial evidence classification**, but additionally requires independent external Auth restoration, Storage metadata and object-byte recovery plans, evidence that the external plan was tested, and *explicit* Controller/Security Reviewer approval of the limited scope and residual dependency risk.
- In both scopes, actual archive/source digest, source freshness, exact Store Owner ledger, private operator and independent restore attestations remain separate blockers. Even a forged all-green JSON returns only **CLAIMED_M0_READY_FOR_EXTERNAL_ATTESTATION**, and `backupExportAuthorized` / `m1MigrationAuthorized` remain false. **No new real authorization is granted**.
- Added six regression cases covering missing Auth, missing external recovery plan, missing scope signoff, false full-service claims, missing independent restore and malicious scope.
- Existing local archive has **not** been re-opened or exported by this work. Historical H11R partial application restore is reused as context, not certified as current hosted independent full recovery.
- Checkpoint and rollback remain the same child Draft PR; no Supabase, n8n or credential mutations.

**Approval still required:** Operator must select the actual recovery scope privately and verify provenance plus current Recovery Point Objective (RPO), Auth/Storage dependency recovery and independent restore; M1 requires a **different operation-specific authorization**. No current M0/M1 approval is implied.


## 9. RPC.7 operator-ready archive inspection (source-only implementation)

### Delivered
- `qa/v152-rpc7/Inspect-TIEN404-RPC7-M0.ps1`: read-only Windows/PowerShell operator wrapper for an **existing** archive. It checks file presence, `Get-FileHash SHA256`, optional prior SHA/byte receipt, `pg_restore --list` in metadata-only mode, then a strictly redacted Node receipt validator. The archive is NOT copied, exported, restored, uploaded, modified or connected to a remote database.
- `qa/v152-rpc7/local-m0-archive-receipt.cjs` / `local-m0-archive-receipt-cli.cjs`: reject unexpected keys or raw PII, validate coverage counts and SHA reference, and always return `m0Approved=false` / `m1Authorized=false` / `independentRestoreCertified=false`.
- `qa/v152-rpc7/private-fourrow-ledger-cli.cjs`: local-only STDIN wrapper around V14.4.3 and RPC.6, emits generic Owner/Store lint status without returning raw UUIDs or records. It does **NOT** verify signatures or authorize hosted backfill.

### Private Windows usage — no connection to hosted

Run in a trusted PowerShell terminal where the archive exists, after obtaining this Draft branch locally:

```powershell
$archive = Read-Host 'Existing archive path'
$pgRestore = Read-Host 'pg_restore.exe full path'
& .\qa\v152-rpc7\Inspect-TIEN404-RPC7-M0.ps1 `
  -ArchivePath $archive `
  -RecoveryScope APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN `
  -PgRestoreExe $pgRestore
```

For a known prior SHA and byte-count receipt, the operator may also pass `-ExpectedSha256` and `-ExpectedBytes`. Those must be taken from the **existing independently controlled private H11R receipt**, not copied from unreviewed conversation claims. If prior hash/bytes differ, the script reports `LOCAL_ARCHIVE_BASELINE_MISMATCH` and exits nonzero. This script is read-only and does **not** require a PostgreSQL connection string.

The sanitized local receipt is saved by default under `$env:LOCALAPPDATA\TIEN404\private-evidence`, outside the Git repository. It includes SHA/size **locally**; never upload the receipt, raw archive, TOC, tenant/owner IDs, JWT, passwords or customer data to public GitHub or CI. The terminal prints only coverage counts, comparison booleans and the mandatory M0/M1 DENY.

If an existing private Owner-to-Store four-row JSON ledger has been separately authorized and prepared offline, the operator can run:

```powershell
Get-Content -LiteralPath '<PRIVATE_LEDGER_PATH>' -Raw |
  node .\qa\v152-rpc7\private-fourrow-ledger-cli.cjs
```

The output is only generic lint status. **Never create Store ownership by guessing from Tenant owner counts, SKU, chatbot messages or model output.**

### CI acceptance and scope

- Existing RPC.7 28 cases, new local SHA/TOC receipt 14 cases, reused RPC.6 24 + V14.4.3 36 + ADV.6C backup 6 + RPC.5 preflight 18 = **126/126 Node PASS**.
- GitHub CI also ran a **PowerShell end-to-end synthetic test** with a fake local archive and a fake `pg_restore --list` executable. It generated a local-only JSON receipt and asserted `m0Approved=false`, `m1Authorized=false`. No real archive or hosted DB was accessed by this CI.
- The hosted M0/M1 eligibility job remains intentionally RED `NO_GO`. This is a policy denial, **not** evidence that a real backup or Store Owner mapping has been verified.
- QA on Ubuntu PowerShell 7 does **not** claim full compatibility with every Windows PowerShell 5.1 environment; final local Windows operator run remains outstanding.
- Since the real archive is not mounted in this session, **actual M0 recovery acceptance remains BLOCKED**.
- No change to Supabase hosted permissions, RLS, database, n8n Published, Cloudflare, production credentials or Zalo sends.

**Checkpoint remains OPEN DRAFT / SOURCE-ONLY TESTED / HOSTED M0-M1 NO-GO.**
