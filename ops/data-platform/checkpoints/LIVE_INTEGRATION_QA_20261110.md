# TIEN404 staging — live authorization, persistence, Super Admin and n8n acceptance (2026-11-10)

**Environment:** Supabase project `ifxlvrhyjhbzbrkdsida`, Render Free service `srv-dbphtas9v7es73bursrg`, staging n8n. Draft PR #5 only; production is NOT approved.

## Directly verified — PostgreSQL and RLS
- Current staging inventory (read-only snapshot): 1 Supabase Auth user, 2 tenants, 1 active membership, 2 products and 2 orders before isolated QA record. The Auth user has confirmed email but `last_sign_in_at IS NULL`.
- Transaction with `SET LOCAL ROLE authenticated` and `request.jwt.claim.sub` for the existing active member: sees **1 membership, 1 tenant, 1 product, 1 order**. Against two tenants, own product/order count **1/1**; foreign count **0/0**.
- Transaction using random non-member UUID: sees **0 memberships, 0 tenants, 0 products, 0 orders**.
- Transaction temporarily changing member role to `staff`: sees **1 product, 0 orders, 0 customer records**; transaction rolled back. Subsequent independent check proved existing `owner` membership restored.
- These are direct database **RLS claim-impersonation tests**. They are not proof of successful real Auth password login or of two distinct signed-in users.

## Write → fresh connection read → cleanup
- Inserted exactly one identifiable, disabled, zero-price, zero-stock synthetic product `QA-PERSIST-20261110-PT7` in the member-owned staging tenant.
- Fresh independent SQL tool call returned the same product UUID, SKU, name, price, stock and inactive flag.
- Deleted exactly that isolated QA product with restrictive predicate; no other product, customer, or order rows modified.
- This verifies persistence **across separate database requests**. It does not verify browser refresh with a real signed-in session.

## n8n signed staging HMAC gateway — live traffic evidence
- Existing workflow `fWp1fBImX6K8ihOa` remains INACTIVE and isolated from orders.
- Execution **1639** SUCCESS: POST to Render staging `/api/v1/internal/n8n/handshake` returned `STAGING_N8N_VERIFIED`, `writes_enabled=false`, `tenant_access=false`, `orders_access=false`.
- Execution **1641** ERROR by design: bad signature rejected with HTTP **401 INVALID_SIGNATURE**. This is a negative security test, not evidence of business failure.
- HMAC nonce replay unit tests exist in `ops/data-platform/tests/test_signed_n8n.py`. Server replay cache is process-local, therefore **NOT** a production-grade distributed replay defense. Secrets must remain server-side and in private n8n credentials; never embed a secret in workflow source/QA pinData.
- Existing n8n read-only Render staging health QA `E3He3Kr602j2B0wC`, execution **1638**, success. No production bot / Orders / Sheets changes.

## Super Admin staging bridge
- `ops/super-admin/app/data_platform_status.py` implements a **read-only**, fail-closed status adapter against the fixed HTTPS Render staging origin. It rejects an untrusted production claim; it never exchanges Super Admin local MFA/SQLite session for a Supabase JWT.
- Tests in `ops/super-admin/tests/test_data_platform_status.py` passed in inherited staging CI on commit `9745dd181...` (GitHub Actions run `42832721781` SUCCESS).
- This is **source-level staging integration**, not deployment of the Sites Control Hub or a fully unified account system.

## Live login and post-refresh acceptance — NOT RUN
- Supabase staging has **only one existing Auth user** and no recorded completed sign-in. No test passwords or two separately controlled QA users were accessible. Do not invent token, create users through unsupported direct inserts into `auth.users`, expose passwords, or misstate that login was tested.
- Added opt-in `ops/data-platform/scripts/live_auth_acceptance.py`: it requires two existing QA Auth identities and their separate tenant memberships via secret environment variables. It tests real Supabase password login, token refresh, own/foreign products and orders, and identical data reads with the refreshed access tokens. It performs **no writes** and prints no credentials/JWTs.
- Run only after provisioning two staging-only test accounts securely and entering the required variables via a private terminal or protected CI secrets. Do not use production customer accounts.

## Release gates
1. Complete actual Auth login (A/B), token refresh, cross-tenant isolation and browser reload using approved QA accounts.
2. Verify Super Admin identity mapping and RBAC with explicit separate staging accounts. No implicit cookie ↔ JWT equivalence.
3. Replace process-local HMAC replay cache with a durable shared atomic nonce store and channel-scope authorization for any production use.
4. Test signed Messenger/Zalo provenance separately; never trust tenant_id from chatbot messages.
5. Run restore test, key rotation, dependency/security scans, order idempotency and stock transactions before customer pilots.

## 2026-11-11 00:38 JST · Đối chiếu V6
Supabase Singapore ACTIVE_HEALTHY; migration 20261110133819. Truy vấn tổng hợp: 1 tài khoản đã xác nhận, 2 tenant, 1 owner active ở Shop A, 2 sản phẩm và 2 đơn. 11 bảng bật RLS, 0 table grant trực tiếp ở app_private cho anon/authenticated/PUBLIC. Advisor vẫn có ba INFO no-policy ở private và cảnh báo leaked-password protection. Chưa thực hiện restore hoặc đo tác động của grants gián tiếp.
Render backend LIVE tại `9745dd18` / `dep-dbpifqbbc2fs73aa1ab0`; /health trả CONFIGURED_NOT_VERIFIED, /api/v1/tenants không phiên trả 401. Bài A/B qua backend còn BLOCKED vì chỉ có một Auth user. [PR #7](https://github.com/ngoctien20/demo-git/pull/7) có bằng chứng E2E riêng cho Shop A, refresh và logout. HMAC đọc lại assertion của 1639 và lỗi 401 của 1641; chưa replay. Adapter Super Admin hiện chỉ đọc status. Không có thay đổi schema, quyền hoặc dữ liệu nghiệp vụ.
