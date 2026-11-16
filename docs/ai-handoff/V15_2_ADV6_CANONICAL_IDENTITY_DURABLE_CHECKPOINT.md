# TIEN404 AI — V15.2-ADV.6 CHECKPOINT
Ngày: 2026-11-16 JST
Stage: **EXPERIMENTAL → DRAFT → SOURCE-ONLY / NO-SEND / NO EXECUTION**.
Sản phẩm: Advanced add-on. **KHÔNG** đưa vào Sales Lite mặc định.
Tài khoản/tenant trong test: fixture tổng hợp, không phải bản ghi khách hàng thật.

## 1. VERIFIED — Đã đọc và đối chiếu
- PR #152 (ADV.5 HMAC server receipts) OPEN DRAFT, HEAD base chính xác: `58cd3acd19982592d05fb41dbe5f829304c51934`.
- PR #157 (ADV.3R Ed25519 signed synthetic previews) OPEN DRAFT, HEAD `8755a8ae8d76c87d03a04ee011461ac65d6d13c7`. **KHÔNG MERGE hoặc tự động quy đổi token**.
- PR #145 (ADV.4 Studio) OPEN DRAFT, HEAD `5fd3298b2e7ff5b6bed74bb6af4484d96100542c`.
- PR #144 là capability registry nhánh song song chưa hợp nhất. Chưa xác nhận canonical Registry release.
- Supabase staging project `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17: hiện có public.tenants, tenant_memberships, orders; **chưa thấy** `stores`, `store_memberships`, `tien404_action_private.action_nonce_claims`. Vì vậy mọi hosted Store Ownership và durable replay chứng nhận vẫn BLOCKED.
- Chỉ kiểm tra schema và GitHub đọc; **không chạy DDL**, không Auth write, không tạo/cấp quyền, không gửi provider hoặc gọi model.

## 2. Canonical Action Gateway — quyết định PROPOSED, chưa được release
- Ứng viên server cho hành động: `T404_ACTION_V1` HMAC-SHA256 từ PR #152, dùng `keyRing/kid`, TTL tối đa 5 phút, bắt buộc `tenant_id/store_id/channel/subject_id/recipient_binding/jti`.
- `T404_ADV3_SIGNED_PREVIEW_V1` Ed25519 từ PR #157 là hợp đồng **ký ảnh chụp bản trình bày synthetic**. Không thay thế hoặc tự chuyển đổi thành HMAC receipt. Định dạng, audience, cấp quyền và use case không tương thích.
- `canonical-action-gateway.cjs`: cho phép `issuePreview` và `verifyPreview` trong chế độ `SYNTHETIC_NO_SEND`. Các hàm `send/execute/publish` chủ động throw. Action chỉ là `CATALOG/QUOTE/ORDER_REQUEST/ASK_STAFF/POLICY` với `ORDER_REQUEST` chưa tạo đơn.
- Chưa có live handler hay release candidate; **không công bố là server action đã được cấp quyền production**.

## 3. Durable Nonce — thiết kế PG, CHƯA ÁP DỤNG
- `pg-nonce-store.cjs` dùng SQL bind params `$1/$2`, `INSERT ... ON CONFLICT (nonce_key_hash) DO NOTHING RETURNING` cho một lần chiếm nonce. Bộ phát hành HMAC hiện đã hash scoped nonce key thành SHA-256 hex.
- Cần cột `nonce_key_hash bytea PRIMARY KEY`, `claimed_at` và `retain_until`; phải ở schema `tien404_action_private` không exposed.
- SQL draft: `docs/ai-handoff/V15_2_ADV6_PRIVATE_NONCE_SQL_DRAFT_DO_NOT_APPLY.sql`, cố ý **không** đặt trong migrations. Không GRANT cho anon/authenticated/PUBLIC/service_role, không tạo `SECURITY DEFINER` hay RPC.
- Adapter không tự tạo kết nối DB, không gửi SQL cho Supabase. Chỉ sử dụng khi server truyền vào `query` đã được bảo vệ.
- CI dùng fake PG query, kiểm tra cơ chế contract/no-dedupe; **KHÔNG** phải test concurrency thực trên Postgres, restart container hay PITR/restore.
- Retention cleanup, role owner/permission model, durable DB backup, sự kiện trùng, multi-region và transactional business execution đều cần QA/approval riêng. `ON CONFLICT` giải quyết chiếm nonce đơn lẻ; nó **không đảm bảo** business write đúng một lần nếu write thực hiện sau claim ở giao dịch khác.

## 4. Verified Identity — hợp đồng xác minh, CHƯA CHỨNG NHẬN HOSTED
- `verified-identity-connector.cjs` phụ thuộc các callback `verifyJwt`, `lookupActiveSession`, `lookupStoreMembership`, `verifyWebhook`, `lookupChannelBinding`, `lookupConsent`, `recheckConsent`. Thiếu callback ⇒ từ chối khởi tạo.
- OWNER_JWT: JWT phải được xác thực **chữ ký thực** bằng adapter server đã duyệt (không phải decode). Kiểm `iss, aud, exp, authenticated, is_anonymous=false, session_id`; đối chiếu session còn hiệu lực và member Store đúng tenant. **Không dùng user_metadata để quyết định vai trò.**
- CHANNEL_WEBHOOK: verifier nhà cung cấp phải kiểm đúng raw-body signature theo API cụ thể; webhook cần event còn thời hạn, account→Store mapping đã xác minh, consent chủ Shop, consent khách; xử lý inbound replay độc lập vẫn cần thêm.
- Trên cả ISSUE/CONSUME: tái kiểm membership hoặc consent thông qua `authorize`, không tin field `verified/role/admin` do UI hay model gửi.
- Test dùng Ed25519 JWT QA và HMAC webhook QA, **không phải Supabase Auth access token hoặc Meta/Zalo chữ ký thật**; chưa cấp chứng nhận Owner/JWT/RLS hosted.
- `subject_id` cho channel là pseudonym hash; token không chứa điện thoại/PSID hay secret provider. Khóa thực phải nằm trong server secret manager, không ở repo/browser.

## 5. QA — Bằng chứng, giới hạn và test matrix
- Unit: JWT signature tampering; anonymous/expired/wrong issuer; Shop A/B cùng tenant; session revoked; membership revoked; channel HMAC tampering; merchant binding sai; rút consent; stale event; SQL parameterization; fake DB failed; claim duplicate giữa hai instance mock; receipt không được tạo đơn/gửi.
- Inherited regression: ADV.5 Signed Registry và Safe Adapter, ADV.3 Evaluator, ADV.2 Registry, ADV.1 Policy.
- CI workflow: `v152-adv6-canonical-nonce-identity-nosend.yml`, node:test và static scan NO-SEND/private SQL draft.
- Mọi kết quả `TESTED` phải căn cứ commit/CI cụ thể, không dùng nhãn chưa xác minh. Đây chỉ là kiểm thử no-send với dữ liệu tổng hợp.
- **BLOCKED**: DB atomicity trên hosted, independent Shop A/B JWT owner identities, Order Lookup Commerce E2E, Meta/Zalo provider real event signature, handler production, expiry under load, backups và key custody.

## 6. Rủi ro/khả năng vận hành
- Không kích hoạt cổng action production, không bật feature flag live.
- Một nonce receipt xác nhận hợp lệ ≠ quyền gọi Commerce Tool. Write thật còn cần xác nhận khách, tenant isolation từ DB, idempotent order transaction, provider event replay/store, rate limiting và audit.
- Nếu DB unavailable, không có fallback sang in-memory nonce; phải từ chối.
- Tách Advanced khỏi Sales Lite, không can thiệp widget, order bot Published.
- Trước hosted migration: độc lập xác minh backup free-tier (export + restore test), quyền Owner/store, rollback và phê duyệt controller; không tự apply theo lời nhắc chung.

## 7. Phê duyệt/rollback
- ADV.6 chỉ thêm mã nguồn QA và SQL **draft**. Không phát sinh phí API, không chạm dữ liệu khách hàng.
- **Phê duyệt riêng**: tạo bảng/role/GRANT/RLS, dùng private signing key thật, liên kết danh tính khách hàng thật, cloud deploy, provider sends, order writes hoặc phát sinh chi phí.
- Rollback hiện tại: đóng Draft PR mới, không merge. Hosted không có gì để rollback; SQL chưa chạy.

## 8. Mốc tiếp theo
**V15.2-ADV.6B — Independent Hosted Store Ownership Proof × Private DB Role Approval × PostgreSQL Durable Replay Certification**.
Trước khi sang ADV.7 release candidate: có bằng chứng Shop A/B JWT thật, export/restore backup đã duyệt, nonce store DB atomicity trên staging, verify provider eligibility và signed action UAT qua hội thoại thử không gửi.
