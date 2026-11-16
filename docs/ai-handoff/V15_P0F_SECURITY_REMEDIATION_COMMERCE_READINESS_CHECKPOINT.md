# TIEN404 AI — V15 SALES LITE P0-F
## Security Remediation Candidate × Commerce Readiness

**Ngày:** 16/11/2026 JST  
**Nguồn:** PR #173 head `e4cef30bc843481d14bcb426e9bc20352c6c3fed`, live Supabase metadata/code read only, n8n workflow details read only.  
**Quyết định:** DRAFT / OFFLINE CANDIDATE, HOSTED MIGRATION **NO-GO**, MESSENGER/ZALO LIVE SEND **NO-GO**, REAL BACKUP EXPORT **NO-GO**.

### 1. Target product
Sales Lite MVP for one to three small Vietnamese shops:
1. Verified Store identity and channel ownership.
2. Exact product price/stock from authoritative Commerce, no fake Catalog.
3. Read-only quote, customer-confirmed order *request*; only later an approved atomic pending Order+Outbox.
4. Owner notification after transaction commit, pause bot and human handoff.

Advanced Dashboard, merchant premium-model selector, Enterprise multi-agent and comprehensive Bot Studio remain deferred.

### 2. VERIFIED read-only hosted Supabase evidence

Supabase project `ifxlvrhyjhbzbrkdsida`, Free, PostgreSQL 17.11:
- 3 Auth users, 2 Tenants, 3 active Tenant Memberships, 2 Products, 2 Orders; **no public.stores / store_memberships / seven Commerce core store_id columns**.
- Seven core SELECT RLS policies are PERMISSIVE and Tenant-scoped via auth.uid/tenant_memberships, not Store-aware. This is not proof of Store A/B (same Tenant) isolation.
- `public.qa_shop_b_zalo_claim`: SECURITY DEFINER owned by postgres; anon can EXECUTE; search_path pinned empty. Source checks a secret from Vault using request header and digest, then delegates to the **QA-only** `tien404_r1_qa.claim_owner_pairing_v3_synthetic`. The inner function checks challenge unconsumed, unexpired, failed_attempts < 5, locks challenge row, limits attempts and uses ON CONFLICT DO NOTHING for duplicate claims. **Not a demonstrated exploit**, and synthetic sender/event digest != actual native Zalo provider signature verification.
- `public.qa_owner_pairing`: SECURITY DEFINER for authenticated, verifies auth.uid + Tenant role and QA bot map, but no canonical Store ID. One-time challenge validation depends on the QA schema.
- `public.save_merchant_product`: SECURITY DEFINER for authenticated, uses auth.uid + active Tenant role owner/manager and validates SKU/price. Optimistic update uses tenant_id + sku + updated_at; no store_id. Writes Products and app_private.audit_events. **Do not use this as the Shop A/B same-Tenant merchant write path before a scoped migration and hosted JWT/RLS proof**.
- Security Advisor: one anon SECURITY DEFINER warning; two authenticated DEFINER warnings; Auth leaked-password protection warning; 18 no-policy informational findings not automatically exploitable.
- Supabase policy/API guidance: https://supabase.com/docs/guides/database/functions ; https://supabase.com/docs/guides/database/postgres/row-level-security

### 3. VERIFIED read-only n8n integration reality
- `TIEN404_MESSENGER_TEST` workflow ID `Z7FdV7uDvApfbURQ` active and Published. Uses legacy `create_order` → `KrSn4DNR9ALX5ng4`, `manage_order` → `fDB9dvs1qPPVt9Sp` and `update_order_address` → `BkAi6TVUKAjCnI7v`; reads AI_SALES_DEMO Google Sheets. **It is not real Commerce multi-tenant Order writer**. Do not repoint it or reuse DEMO Orders/credentials.
- `TIEN404_COMMERCE_AI_AGENT_SANDBOX` `iyfGUiEsZlNTBWOR` inactive; its tenant/catalog/cart tool flow is sandbox.
- `TIEN404_COMMERCE_SHOP_ONBOARDING` `splyaeQtV719OuAu` active, uses n8n Data Tables and inactive tenant/channel provisioning; it is not canonical Supabase Store onboarding.

### 4. Implemented in P0-F (only disposable/source)
1. `qa/v15-sales-lite-p0f/pg17-store-product-invoker-rehearsal.sql`: PostgreSQL17 disposable synthetic model of canonical Tenants/Stores/StoreMemberships/Products, composite FK, exact SKU per Store, RLS SELECT and UPDATE with WITH CHECK. Candidate product-price RPC is `SECURITY INVOKER` with empty search_path and least privilege column UPDATE, relies on auth.uid + tenant and Store role. Checks Store A/B same Tenant / Store C cross Tenant, stale updated_at, revoked role, paused Store, staff read-only, anon no execute, direct Store reassignment denied and stock preserved. Transaction **ROLLBACK** removes entire fixture. **This is neither a Supabase migration nor a production-ready function.** Test auth.uid uses synthetic PG setting, not genuine JWT validation.
2. `qa/v15-sales-lite-p0f/zalo-claim-threat-model.cjs` and tests: synthetic trust-and-replay threat matrix to ensure denial for no/weak/wrong gate, wrong Store/Bot, expired/used challenge, >=5 failed attempts, replay, malformed event and missing native provider proof. It NEVER authenticates real Zalo or changes the hosted RPC. Even a plausible synthetic fixture returns OFFLINE_REVIEW_ONLY, can_claim_live=false, can_send_provider=false.
3. CI: new PostgreSQL17 disposable QA and Node negative tests; inherited P0-E.2 one-time export NO-GO, earlier Store/Commerce source QA. No API key, hosted database connection or provider send.

### 5. Proposed production remediation plan — MUST BE SEPARATELY APPROVED
- **P0-F-01 Zalo:** Preserve the currently functioning QA challenge gate while evaluating Vault header secret custody, leak/replay risks, outbound n8n adapter proof, rate limits and native provider webhook verification. A random request header by itself is not Zalo signature proof. Do not revoke anonymous EXECUTE blindly; first review real call chain, negative cases and recovery/rollback.
- **P0-F-02 Product-write:** After owner evidence and backup/restore certification, expand canonical Stores/StoreMemberships and Store IDs; coordinate RLS/GRANT/rate limits and app code. Stage a new scoped `SECURITY INVOKER` or equally reviewed internal write route, not an unguarded new endpoint; never silently change existing `save_merchant_product` signature or drop tenant unique constraint.
- **P0-F-03 Quote:** Require server-verified Store identity, up-to-date authoritative Product/Stock/Price per Store and robust invalid/overflow VND handling; user-supplied Store or LLM-generated price cannot be authority.
- **P0-F-04 Order:** Keep draft/confirmation separate. Verify pending Order+Outbox atomicity and durable replay per actual channel and Store before any real writes; owner alert ONLY after save and genuine recipient verified.
- **P0-F-05 Backups/hosted JWT:** Waiting on independently verified whole-project Controller/reviewer/backup operator/private vault and real backup restore; no consent has been supplied to perform a hosted dump. Real JWT RLS positive/negative proof remains blocked until Store schema is approved.

### 6. Go/no-go and QA evidence classification

| Gate | Status |
|---|---|
| Read-only hosted RPC/RLS and n8n audit | VERIFIED |
| Synthetic Zalo threat tests | IMPLEMENTED; TESTED only after CI |
| Disposable PostgreSQL17 candidate Store write | IMPLEMENTED; TESTED only after CI |
| Real Meta/Zalo signed provider identity | BLOCKED |
| Canonical hosted Store ownership, JWT/RLS | BLOCKED |
| Real Supabase encrypted backup and independent restore | BLOCKED |
| New Store-aware RPC deployed and Orders/Outbox | NOT APPROVED |
| Messenger/Zalo pilot production | NO-GO |

Rollback for current Draft: close this child PR; all changes source-only. Future hosted changes require private tested backup, migration-specific rollback and explicit separate owner approval.

**Next checkpoint:** V15 Sales Lite P0-G — Verified Channel/Store Authority × Commerce Read-Only Pilot Contract (NO SEND), then actual hosted Store schema migration only after the separate backup+owner gates.
