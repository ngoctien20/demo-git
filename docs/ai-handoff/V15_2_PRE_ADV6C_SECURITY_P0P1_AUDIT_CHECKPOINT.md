# TIEN404 AI — PRE-ADV.6C SECURITY AUDIT P0/P1 CHECKPOINT
Ngày kiểm tra: 16/11/2026 (JST)
Lifecycle: **SOURCE-ONLY / EXPERIMENTAL / DRAFT / NO SEND / NO HOSTED DB WRITE**
Parent: PR #165 ADV.6B `3c7b64437bfc5f2d004591be395d20effb9cc912` OPEN DRAFT.
Phạm vi được chủ dự án chọn: 4 P0 + 3 P1; tránh xây lại và giữ nguyên n8n Published.

## 1. VERIFIED — Dữ liệu nguồn và hệ thống đã đọc
### Supabase staging
- Project `ifxlvrhyjhbzbrkdsida`. `public.products`, `public.orders`, `public.customers`, `public.tenants`, `public.tenant_memberships` tồn tại, RLS + FORCE RLS được bật trên nhóm này. `anon` không có SELECT trực tiếp trên các bảng chính.
- Policy `products_member_read` theo `tenant_id`, `tenant_memberships.user_id = auth.uid()`, `active`; `orders_manager_read` và `customers_manager_read` theo tenant và role owner/manager. Chưa có `store_id` ở các bảng này, chưa có `public.stores/store_memberships` để chứng minh Shop A/B cùng tenant được cô lập. `service_role` có BYPASSRLS: không dùng làm bằng chứng RLS.
- `public.qa_shop_b_zalo_claim(uuid,text,text,text)`: SECURITY DEFINER callable `anon`, dùng shared secret Vault/HTTP header và hash định danh event/sender trong hàm staging synthetic. Có lớp bảo vệ secret; **chưa chứng minh bị xâm nhập**. Shared header không bằng raw-body HMAC provider + replay/nonce.
- `public.qa_owner_pairing`, `public.save_merchant_product`: SECURITY DEFINER callable `authenticated`, logic có `auth.uid()`/tenant membership nhưng chưa chứng minh store-scope và permission invariants. `public.tien404_tester_track_change` definer không có quyền anon/auth trực tiếp theo kiểm toán.
- Security Advisor phát hiện một anon definer và hai authenticated definer được cấp quyền EXECUTE. Thông tin linter:
  - https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
  - https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- 18 bảng ở một số private/QA schema bật RLS mà không có policy (INFO); không tự kết luận rò rỉ khi schema USAGE và grants bị chặn. Cần rà từng bảng/role và Data API.
### n8n Published, nguồn metadata-only
- Messenger `Z7FdV7uDvApfbURQ` active, version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92` (27 nodes). Có kiểm chữ ký Meta và skip duplicate; AI Agent vẫn dùng workflow tools `create_order`, `manage_order`, `update_order_address`, `get_order_status`.
- Create Order `KrSn4DNR9ALX5ng4` Published version `4740251a-cd01-4f7f-b8e1-e300a8393151`, 8 nodes; dùng Google Sheets `Read Orders / Append Order`, `Validate Order`. Duplicate business check trong Code **không đủ** chứng minh atomic distributed idempotency, Store JWT/consent hay tool-level authorization.
- Manage Order `fDB9dvs1qPPVt9Sp` Published version `137d5689-40c5-4147-9bbc-b22809ad5908`; Update Order `BkAi6TVUKAjCnI7v` Published version `93cf227a-ab8a-42c6-9185-7ec44f7aeb00`. Draft và Published khác nhau; không sửa.
- Zalo `yIJk8LvJoLF40Z62` active version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`: ingress protected/no-send; không suy ra Commerce live.
- Credential inventory metadata-only: 9 credentials truy cập được bằng connector, 9 quyền có thao tác quản lý credential, không có global credential; các loại gồm HTTP Header, HTTP Bearer, Gmail OAuth, Google Sheets OAuth, Crypto, Telegram. Không đọc/lưu giá trị secret.
### Cloudflare/GitHub — chỉ đọc
- Một active zone `ngoctien20.io.vn`, đã thấy Managed WAF và DDoS L7; một Cloudflare Access app staging với một policy `allow`, không có policy `bypass` trong danh sách được trả về.
- Không tìm thấy ruleset entrypoint `http_ratelimit` ở zone/account được kiểm tra (HTTP 404), legacy rate API HTTP 410. **Không suy ra rằng toàn bộ Cloudflare/n8n/GitHub Pages đang được bảo vệ hoặc không được bảo vệ**; cần xác minh đúng hostname/route và giới hạn backend.
- Cloudflare account hiện một thành viên có vai trò Super Administrator. Chưa có bằng chứng audit MFA/token expirations hoặc IP restrictions.
- GitHub repo `ngoctien20/demo-git` là PUBLIC. GitHub App không có quyền xem branch protection (403), secret-scanning/dependabot và repo Action permission endpoints chưa đọc được qua fetch tool; trạng thái là **NOT VERIFIED**, không là PASS.
- Các website qua GitHub Pages hoặc n8n Cloud không tự được hưởng WAF của Cloudflare zone tùy chỉnh.

## 2. P0 RPC SECURITY DEFINER — STATUS
VERIFIED: `anon EXECUTE qa_shop_b_zalo_claim`. Đã đọc function body; có Vault shared gate và synthetic claim, không phải open direct unconditional bypass. Chưa có exploit test hoặc customer-data leak proof.
PROPOSED: Hạn chế direct anonymous RPC bằng relay xác minh provider raw HMAC; kiểm đủ event, nonce durable, canonical page/bot→tenant/store; replace caller path trước khi đề nghị REVOKE.
IMPLEMENTED: tài liệu chỉ-comment `V15_2_PRE_ADV6C_RPC_RLS_REMEDIATION_DO_NOT_APPLY.sql`; không chạy SQL/GRANT, không thay hosted.
P0 BLOCKED: không có owner-specific approval/backup/release testing để thay quyền và không được làm gián đoạn staging Zalo.

## 3. P0 JWT/RLS Store A/B — STATUS
VERIFIED: các policy hiện là tenant-level, không phải store-level.
PROPOSED: bổ sung canonical stores + store_memberships, Store scope ở products/orders/customers, foreign keys tenant+store, owner-verified mapping trước backfill, RLS/cross-store negative JWT proof; ưu tiên đọc/ghi minimal.
IMPLEMENTED: `qa/v152-pre6c-security/pre6c-zero-trust-tool-boundary.cjs` kiểm yêu cầu target tenant/store/channel khớp principal từ callback server; không tin store/role của model.
BLOCKED: hosted Store Ownership Proof, schema migration/backfill, two independent real JWTs, guest identity and permission revalidation.

## 4. P0 Order Tool / SQL / service_role — STATUS
VERIFIED: Messenger Published vẫn kết nối 4 tool đơn DEMO, Google Sheets là sink của create/update; chưa có bằng chứng server tool caller auth+consent+store scope đầy đủ cho live.
IMPLEMENTED source-only: boundary bắt buộc callback server authorize, current subscription, atomic quota, verify private order ownership, server-verified confirmation và receipt nonce; mọi `execute`, `sql`, `providerSend` chủ động throw; không chạy model/API/database.
PROPOSED live: Writer Gateway riêng, DB transaction kiểm tra stock/price, một idempotency record unique gắn liền bản ghi Order + store scope; tránh service_role hoặc raw SQL executor của AI. **Receipt nonce không đảm bảo once-only order nếu order writer ngoài transaction**.
BLOCKED: thay các tool đang Published phải có owner approval/canary/rollback, không xóa chức năng hiện hữu.

## 5. P1 Abuse, budget, webhook — STATUS
IMPLEMENTED source-only: `pre6c-abuse-webhook-guard.cjs`, kiểm chữ ký qua callback backend, xác nhận account→Store, timestamp, atomic event claim, quota theo tenant/store/channel/subject; chi phí ước lượng từ hàm trusted, không lấy model text.
PROPOSED: rate limit ở Cloudflare chỉ là vòng ngoài và chỉ áp dụng khi route thật đi qua zone/proxy phù hợp. Thực thi mức backend quota theo Store/day/subject, cảnh báo 429, 401/403, replay, nhiều token bất thường, gửi thông báo cho operator; log redacted, không PII.
BLOCKED: chưa có durable hosted quota store, thực hiện Cloudflare WAF rule, real provider HMAC live, kênh cấp quota, incident response vận hành.

## 6. TESTED — Negative tests
- `pre6c-zero-trust-security.test.cjs`: 22 bài test mới cho Shop A/B same tenant, giả SQL/service role/admin, prompt injection, token spoof, confirmation giả, order lookups, quota, event HMAC, replay và chặn xuất dữ liệu.
- CI `v152-pre6c-security-nosend.yml`: Node test mới, inherited ADV.6, ADV.5, Owner Evidence Gate và Advanced Presentation; static chặn network/model/send/SQL/credential.
- Không gọi Messenger/Meta/Zalo API thật, không gây duplicate order thật, không tạo Supabase migration.
- Chỉ đánh dấu TESTED/CI PASS sau khi workflow hoàn tất **đúng commit HEAD**.

## 7. Quyền và rollback
- Không tự REVOKE EXECUTE / thay SECURITY DEFINER, RLS/GRANT, sửa n8n Published, Cloudflare WAF, key/credential, billing hoặc đơn của shop.
- Phê duyệt riêng cho: private Owner/JWT proof, verified backup+restore, provider/caller replacement, canary test, DB role/migration change, rotation/revocation credentials, cost tiers.
- Code rollback: đóng Draft PR security. Hosted rollback: không cần vì chưa có thay đổi.

## 8. Checkpoint tiếp theo
**V15.2 PRE-ADV.6C Security P0 Review → ADV.6C** chỉ sau khi Security Reviewer và Owner cung cấp bằng chứng private:
1. Callback/n8n caller audit for `qa_shop_b_zalo_claim` and replacement verified relay before any revoke.
2. Hosted two independent real Owners Shop A/B, invalid/join/revoked JWT testing.
3. Real encrypted backup + restore evidence and one-time explicit approval per operation.
4. Deployable per-store quota backend and alert system with cost limits and policy versioning.
5. Canonical gateway/order tool isolation test in staging canary No-Send before any live.
