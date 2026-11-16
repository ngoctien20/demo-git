# TIEN404 AI — V15.2-ADV.6B HOSTED EVIDENCE × ROLE APPROVAL × REPLAY CERTIFICATION
Ngày kiểm tra: 16/11/2026 (JST)
Cấp: **EXPERIMENTAL / DRAFT / NO-SEND / NO HOSTED MUTATION**
Phạm vi: Advanced Custom Bot Studio add-on, KHÔNG đưa vào Sales Lite mặc định.

## 1. VERIFIED — Kiểm toán trực tiếp
- Dự án Supabase staging: `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.
- `public.tenants`, `public.tenant_memberships`, `public.orders` hiện tồn tại; các bảng này bật và FORCE RLS. `tenant_memberships` có `tenant_id`, `user_id`, `role`, `active` nhưng **không có `store_id`**.
- **KHÔNG** thấy `public.stores`, `public.store_memberships`, `tien404_action_private.action_nonce_claims`, hoặc role `t404_action_server` tại thời điểm đọc.
- `public.orders` có `tenant_id` và không có `store_id`; chưa chứng minh Store-level shared order lookup.
- `tien404_r1_qa.owner_bindings`, `owner_pairing_claims_v3` có tồn tại và bật RLS nhưng là **fixture/QA**, không phải bằng chứng hai JWT Owner độc lập.
- Role `postgres` và `service_role` có BYPASSRLS; `anon`/`authenticated` không có BYPASSRLS. Không được dùng `service_role` làm chứng cứ chứng nhận RLS Shop A/B.
- `app_private` và `tien404_r1_qa`: schema USAGE bị từ chối với `anon`, `authenticated` và `service_role` theo truy vấn chỉ-đọc.
- Cảnh báo bảo mật thực: `public.qa_shop_b_zalo_claim` là SECURITY DEFINER, có EXECUTE cho `anon`; `public.qa_owner_pairing` và `public.save_merchant_product` có EXECUTE cho `authenticated`. Chưa kiểm toán hoàn tất logic từng RPC; KHÔNG thay đổi quyền.
- PR #163 (ADV.6) OPEN DRAFT, HEAD `0edae15bb9e8256858e5b5db3f516d63cb5dfa75`; 2/2 workflow SUCCESS. PR #157 (ADV.3R) riêng, OPEN DRAFT; không merge/rebase tự động.
- Không có chứng cứ **private real export receipt + independent restore** hoặc hai JWT Owner A/B được xác thực trong dữ liệu đã kiểm tra. Không khẳng định chúng không tồn tại bên ngoài phạm vi kiểm toán.

## 2. Independent Owner Evidence — REQUIRED, currently BLOCKED
Hồ sơ riêng tư cần:
- Hai Owner **khác nhau**, hai Store A/B đã được xác lập qua hệ thống Merchant Ownership, hai JWT thật với đúng issuer/audience/session_id và bằng chứng session còn hoạt động; ghi checksum/digest, KHÔNG công bố JWT, PII, bearer token.
- Positive: Owner A xem dữ liệu đúng Shop A, Owner B xem đúng Shop B qua cùng backend API/RLS và role xác thực phù hợp (không BYPASSRLS).
- Negative: Owner A truy cập Shop B bị từ chối, Owner B truy cập Shop A bị từ chối; JWT thiếu/hết hạn/đã thu hồi bị từ chối; quyền quản lý khác nhau không thể thực hiện thay đổi ngoài scope.
- Trích evidence reference (test run ID, SQL/RLS version, commit SHA, tester độc lập, UTC/JST timestamp) trong hệ thống chứng cứ riêng tư được kiểm soát.
- `tenant_memberships`/Shop A-B fixture không đủ; không dùng bảng synthetic để cấp quyền.
- **Không lấy token thật từ người dùng qua chat**; chỉ xác thực trong backend QA có cơ chế bảo vệ đã được phê duyệt.

## 3. Backup & One-Time Operator Approval — REQUIRED, currently BLOCKED
Cần bằng chứng độc lập:
- Owner/Controller phê duyệt riêng một lần cho phạm vi **xuất dữ liệu**; không tự suy rộng thành phê duyệt sửa RLS/GRANT/migration.
- Operator được ủy quyền, backup/export thật ở nơi riêng tư, SHA-256 checksum, dấu thời gian, nguồn/đích, kiểm thử restore trên môi trường cách ly và so khớp checksum dữ liệu phục hồi.
- Chứng nhận backup thực tế thuộc quyền Controller; việc GitHub Actions CI trên DB tổng hợp **không thay thế** bước này.
- Không đưa credential, token, data dump, email/phone hoặc bản sao raw DB vào public GitHub.
- Không ghi nhận backup PASS nếu chỉ tồn tại thiết kế, nhắc việc hoặc một export chưa restore.

## 4. Private DB Role Approval Matrix — DESIGN ONLY
Role dự kiến `t404_action_claim_runtime` (KHÔNG tạo hosted):
- Kết nối **backend riêng**, không chia sẻ với `service_role`, `anon`, `authenticated`; không BYPASSRLS/CREATEROLE/SUPERUSER.
- Schema `tien404_action_private` không exposed Data API. **REVOKE** USAGE schema và table cho PUBLIC/anon/authenticated/service_role khi migration được duyệt.
- Quyền tối thiểu đề xuất: USAGE schema, INSERT trên `action_nonce_claims`, SELECT chỉ với cột hash `nonce_key_hash` để RETURNING; không UPDATE/DELETE/DDL/EXECUTE tùy ý.
- RLS policy cụ thể cho role nội bộ; kiểm thử bằng credential role hạn chế (không phải owner superuser). Chú ý `SECURITY DEFINER` tránh mở RPC public.
- Key custody: secret manager/managed connection, rotation plan, audit log hash, revoke & expiry. Không commit secret vào repo.
- Cần phê duyệt *cả* Controller/DB operator và Security Reviewer độc lập trước GRANT/role tạo thực; ghi số phiếu, phạm vi, người ký, rollback.
- Không được sử dụng `CREATE ROLE` hoặc `GRANT` trong hosted từ checkpoint này.

## 5. Durable Replay — real PG17 isolated CI, NOT hosted certification
- Source: `qa/v152-advanced-actions/pg17-durable-replay.integration.test.cjs`.
- CI dùng container PostgreSQL 17 tạm thời riêng `t404_adv6b_ci` với host bắt buộc localhost và flag `T404_PG_CI_ONLY=1`. **Script chủ động từ chối kết nối hosted**.
- SQL draft DO NOT APPLY của ADV.6 được áp dụng **chỉ trong container CI tạm thời** để kiểm tra đúng các câu lệnh. Role QA `t404_action_claim_ci` được tạo chỉ trong DB tạm, không có mặt trên Supabase.
- Kiểm thử: schema không cho anon/authenticated/service role; RLS bật; role QA chỉ INSERT + SELECT hash, không DELETE/UPDATE; 32 claim đồng thời giữa hai pool chỉ một thành công; mở lại kết nối cũ không cho claim lại; DB clock từ chối nonce hết hạn; cấm anon insert; dữ liệu bảng nonce không chứa PII.
- Bằng chứng GitHub Actions phải ghi **run ID + exact commit SHA**, không dùng kết quả run từ SHA khác.
- CI trên PG17 thực không chứng minh durability khi DB hosted crash/failover, replica lag, PITR/restore, multi-region retry hoặc atomic commerce write. Cần kiểm thử và approval riêng ở hosted sau khi đạt Owner/Backup gate.

## 6. Gate vận hành và QA
Hợp đồng: `T404_ADV6B_EVIDENCE_REVIEW_V1` trong `qa/v152-advanced-actions/owner-evidence-gate.cjs`.
- Thiếu chứng cứ → `BLOCKED`.
- Đủ metadata/evidence references → `PENDING_INDEPENDENT_REVIEW`, **KHÔNG tự chứng nhận**.
- Không có cách nhập `verified:true` để cấp quyền.
- Không cho schema migration, private role change, provider sends, customer data hoặc release từ bộ gate này.
- CI phải chạy negative: giả Owner, cùng JWT cho A/B, sai hash/restore, DB role BYPASSRLS, thiếu hosted test, và no-go dù đủ reference.

## 7. P0/P1 và Approvals
P0: JWT Owner A/B thực và độc lập, Store-level RLS, backup thật + restore evidence, RPC DEFINER review.
P0: Controller/Security phê duyệt riêng mới được chạy migration/GRANT/credential ở hosted.
P1: PG17 hosted nonce benchmark + failover/restart + atomic Commerce order idempotency, webhook signature provider thực và custom action capabilities.
P1: Đối chiếu nhánh ADV.3R/#157, ADV.5/#152, ADV.6/#163 và channel registry khác trước release.
Thông tin nguồn về Supabase RLS/API grants: https://supabase.com/docs/guides/api/securing-your-api
Cảnh báo RPC: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

## 8. Rollback/Checkpoint/Next
Rollback: đóng Draft PR ADV.6B, không rollback hosted vì chưa có ghi, migration hoặc deploy. Cấu trúc CI disposable tự bị hủy sau job.
Mốc sau đề xuất: **V15.2-ADV.6C — Authorized Private Evidence Intake × Hosted Negative JWT/RLS Proof × One-Time Backup Approval Decision**; chỉ khi Chủ dự án cung cấp chứng cứ từ quy trình private, không yêu cầu gửi JWT/token trong chat.
