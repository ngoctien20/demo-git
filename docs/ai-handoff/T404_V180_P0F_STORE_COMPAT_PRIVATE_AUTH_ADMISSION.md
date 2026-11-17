# TIEN404 V18.0-P0F — Canonical Store Migration Compatibility × Private Auth A/B Admission

**Checkpoint:** 2026-11-18 JST · `VERIFIED_READ_ONLY / IMPLEMENTED_SOURCE_ONLY / TESTED_OFFLINE 30/30 / HOSTED_NO_GO`
**Repository lineage:** continue existing Draft PR #385 (based on #362); read-only staging ref `ifxlvrhyjhbzbrkdsida` (PostgreSQL 17.11).
**Authority:** production NO-GO. Founder has explicitly deferred M0 backup proof **only for read-only/source-only/disposable QA**, not hosted writes, grants, RLS, credentials, customer data or release.

## 1. Observed actual data contracts (READ-ONLY)

| Surface | Actual verified shape / caller | Migration compatibility risk | Required scoped, separately approved change |
|---|---|---|---|
| `public.tenants` | Root UUID tenant identifier | One tenant can own multiple Stores | Retain tenant PK; introduce trusted `stores(tenant_id,store_id)` registry, no default Store guessing |
| `public.tenant_memberships` | `(tenant_id,user_id)` PK, owner/manager/staff, RLS self-read, no Store | Tenant role is not independent Shop A/B ownership | Add `store_memberships` with owner attestation, role/revocation/authority version, never infer from tenant role alone |
| `public.products` | UUID, tenant UUID, SKU, bigint price, stock; `UNIQUE(tenant_id,sku)`, tenant-member SELECT, NO `store_id` | Identical SKU in Stores A/B conflicts; existing privileged product RPC is tenant-only | Nullable Store UUID, proof-bound backfill, scoped `(tenant,store,id)/(tenant,store,sku)` constraints; versioned writer before retiring old uniqueness |
| `public.customers` | PII columns, tenant manager read, no Store | Customer identity/consent and cross-channel assumptions | Store UUID, ownership & consent proof; do not derive from name/phone/provider username |
| `public.orders` | tenant UUID, nullable customer FK `(tenant,customer)`, order_source/status enums; no Store | Cross-Store customer/order misbinding | Store UUID, same-scope composite FK, independent order owner proof, policy revision |
| `public.order_items` | tenant-only order/product FKs, quantity, bigint unit_price, nullable total | Cross-Store product could be attached to order | Store UUID plus `(tenant,store,order)` and `(tenant,store,product)` composite FKs, money validation |
| `public.conversations` | channel/external_reference, tenant manager read; no Store | Provider installation and sender ID not Store authority | Store UUID and immutable verified installation binding; avoid leaking conversations |
| `public.messages` | sender/body, tenant/conversation FK; no Store | Messenger/Zalo chat cross-Store leakage | Store UUID and same-store conversation FK, least-privilege access |
| `public.tenant_agent_configs` | tenant/channel/bot/prompt/workflow versions, no Store | Agent config can be mixed across Stores | Add Store-scoped installation/config contract; version API and prompt before cutover |
| R1 QA tenant_identity_map/shop_bots | Text store_key and auth_tenant_id, 2 QA mappings | Text store_key **not** canonical UUID Store proof | Trusted mapping registry with verified owner & provider installation, do not cast client keys |
| V17.5 QA channel_identity/order_ownership | Text Store key, QA ownership metadata | QA proof != actual licensed provider signature or canonical Order owner | Keep as QA; independently validate Auth, actor, OTP, order scope before new canonical binding |
| `public.save_merchant_product` | SECURITY DEFINER, authenticated tenant owner/manager, no Store guard | BOLA across same-tenant Stores when/if Store data is added | Explicit store parameter + trusted server Store membership check, audit + optimistic lock, deny old incompatible writer until contract upgrade |
| `public.qa_owner_pairing` and `qa_shop_b_zalo_claim` | QA owner/claim RPCs, latter anon shared Vault header | QA challenge/header do not prove real Store owner or native Zalo signature | Keep QA-only, verify trusted provider signed ingress upstream; never promote to production authority |

**Observed protected public grants:** All seven inspected Commerce/tenant membership tables have ENABLE and FORCE RLS, authenticated SELECT, no direct anon SELECT, and no direct authenticated INSERT/UPDATE. RLS SELECT is tenant-level or self-active membership, **not Store-aware**. Simply adding a permissive store-scoped policy next to the existing permissive tenant policy can leave an OR-based authorization bypass. Existing owner/manager `SECURITY DEFINER` RPC needs review because it may bypass RLS.

**Aggregated read-only observations, not private admission:** Real Supabase Auth user/session records and active tenant membership exist. One tenant has >=2 distinct active tenant members; this is *not* proof of two Store owners or two independently verified currently usable JWT sessions. Existing private QA pairing mappings/challenges/claims exist but no canonical Store membership was detected; QA-only ownership isn't trusted Store ownership. Public Commerce currently contains small numbers of product/order rows with no independently proven Store owner. No real customer details or tokens were retrieved.

**n8n published boundary checks:** Messenger `Z7FdV7uDvApfbURQ` active version `1064b1b3-d3f1-4a6b-a367-2414ba691522` retains DEMO order tools; Zalo `yIJk8LvJoLF40Z62` active version `2d912cb0-007f-452f-9536-b92ba12a03e6` calls shadow/private router; Zalo private router `sIPs6egzIwOY1GNv` active version `8d91d23c-cd87-462f-a112-9cca2340bec8`; shadow `OgDZNSAvKEvhnAvn` version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`. Presence/active state != same-Store Commerce end-to-end acceptance.

## 2. Compatibility and migration readiness decisions

**M-C0 Read-only audit:** Current source/DB versions, source caller graph, unique constraints, composite FKs, published tool contracts and policies must be pinned. `VERIFIED` for the inventoried surfaces only.
**M-C1 Additive schema:** Future approved `stores` and `store_memberships`, nullable Store on Commerce tables; no public Data API grants; use fail-closed default. `PROPOSED ONLY`, no migration.
**M-C2 Owner-bound backfill:** For every existing record, accept only one external independently verified `(tenant,store,resource,owner)` proof. If ambiguous, expired, absent, wrong tenant or conflicting FKs -> quarantine; do not guess Store from tenant membership, SKU, phone or Zalo sender. Current P0E disposable preview passed this on synthetic fixtures only.
**M-C3 Data integrity:** Product SKU uniqueness per Store, composite FKs order-item-product/customer/message and immutable Store ownership, correct price VND/stock semantics, no temporary unauthorized read.
**M-C4 RLS/RPC cutover:** Remove/restrict tenant-only permissive policies atomically when Store policies are added; owner/manager/scoped support roles and write APIs require both USING and WITH CHECK where appropriate. Audit all SECURITY DEFINER paths, n8n caller versions and any service_role bypass.
**M-C5 Provider & notification:** Provider installation -> exact Store registry; inbound signature validation; server-side tenant resolver; strict no-send until policy, event idempotency, recipient ownership and merchant authorization are proven.
**M-C6 Release gate:** Verified backup/restore evidence, concrete rollback, explicit founder approval, real signed Supabase Auth A/B negative UAT, provider-native ingress, and human-reviewed evidence. NO-GO now.

## 3. Private real Auth owner pairing admission READINESS

1. Require two **consenting** distinct QA actors for Store A and Store B under same tenant, plus an independent reviewer. Existing count of Auth users/memberships is not proof.
2. Verify private identity and active sessions under supported Supabase Auth APIs. Validate token signature, issuer, audience, expiry, session_id and current session status **without pasting raw JWT, refresh tokens, OAuth secrets, service_role or private user identifiers into GitHub/chat**.
3. Require a **server-owned canonical Store registry** with verified owner proof and active membership. Text QA store_key and n8n bot mapping are not authority, and current public schema does not provide this.
4. Stage read-only no-send calls using regular authenticated scope (not service_role) and trusted Store resolution. Test positive A→A/B→B, same-tenant A→B/B→A denials, outsider/wrong tenant, revoked/expired session, user_metadata spoof, invalid provider signature, cross-store order/product/identity link.
5. Record only redacted aggregate receipts, independent timestamps, revision fingerprints and SHA256 evidence references in a protected intake. Do not mark PASS based on declared booleans or fabricated logs.
6. Before changing hosted schema/RLS/grants or customers, seek separate precise approval and an independently tested recovery procedure (M0 waiver does not apply).

### Test scope
Source-only `qa/v180-p0f/store-auth-compat-preflight.mjs` + tests check that baseline drift and unsafe/missing admission proof always remain NO-GO. An apparently complete metadata manifest never grants release or establishes an actual real JWT. The 31 private UAT scenarios are **specifications** and every actual is `NOT_RUN`, not PASS. The code performs no requests, has no token parsing, and cannot change Supabase or send provider messages.

## 4. Checkpoint & next gate

**Status:** P0F read-only compatibility **VERIFIED**; source gate **IMPLEMENTED**; offline CI **TESTED 30/30**; real JWT UAT **NOT RUN**; hosted Store A/B **BLOCKED**; M0 **DEFERRED FOR DISPOSABLE ONLY**; production **NO-GO**.
**Independent CI receipt:** P0F push run https://github.com/ngoctien20/demo-git/actions/runs/44127063516 PASS, and PR run https://github.com/ngoctien20/demo-git/actions/runs/44127080917 PASS at pre-report source HEAD `f841985d0763627ee8cc6f26880841b9b24692b0`. Logs show 30/30 tests PASS, 31 UAT cases remain NOT_RUN, and source matrix status TENANT_ONLY_BASELINE_VERIFIED / HOSTED NO-GO. Later documentation commit requires its own CI check; no claim of passed tests before checking that commit.
**Rollback:** only Draft source changes, no runtime rollback. Future migration cutover requires tested rollback and M0 evidence.
**Next:** P0G — Canonical Store Owner Evidence Intake × Zero-Write Real Auth Private Operator Handshake Readiness × Migration Change Set Review, without running hosted DDL.