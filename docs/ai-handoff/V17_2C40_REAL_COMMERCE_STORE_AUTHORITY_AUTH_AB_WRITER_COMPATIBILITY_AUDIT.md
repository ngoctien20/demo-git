# TIEN404 AI — V17.2C.40 Real Commerce Store Authority Closure × Protected Auth A/B Read-Only Admission × Production Writer Compatibility Gate

**As of:** 2026-11-18 JST. **Mode:** read-only audit of actual Supabase staging and n8n Published graphs; GitHub Draft-only artifacts. **Branch:** `work/v172c-rpc-security-closure-readonly-20261118`, PR #392 OPEN DRAFT; predecessor V17.2C.39 HEAD `e527af266ae84cb6faf6cd54b3fcfa6794696113`.

## 1. Scope / user intent
Stop adding mock notification tests. Audit **actual** Commerce tenant/store authorization and published order writers. No database schema/data writes, actual JWT/token extraction, n8n changes or executions, external message sends, new Supabase branch/Pro plan, billing/credential changes or production publish. Do **not** characterize the offline V17.2C.35–39 CI as real authenticated Store A/B access.

## 2. VERIFIED LIVE Supabase metadata (direct connector, SELECT-only)
Project `tien404-staging`, ref `ifxlvrhyjhbzbrkdsida`, Postgres 17, `ACTIVE_HEALTHY`, development branches **0**.

Read-only column inspection:
- `public.orders`: `id,tenant_id,customer_id,status,total_vnd,order_source,created_at,updated_at` — **no store_id**.
- `public.order_items`: `id,tenant_id,order_id,product_id,quantity,unit_price_vnd,line_total_vnd` — **no store_id**.
- `public.products`: `id,tenant_id,sku,name,price_vnd,stock_on_hand,is_active,created_at,updated_at` — **no store_id**.
- `public.customers`: tenant-scoped, contains PII fields; **no store_id** (NO customer records were queried).
- `public.tenant_memberships`: `tenant_id,user_id,role,active,created_at`; no Store membership.
- `public.stores` and `public.store_memberships`: **absent**. Do not replace them with isolated QA tables.
- `app_private.channel_secrets`: `tenant_id,platform,external_account_ref,secret_ref,created_at`, **no store_id**. No secret_ref value read.
- `app_private.order_idempotency`: `tenant_id,request_key,request_sha256,order_id,created_at`; **PK(tenant_id,request_key)**, no Store scope.
- `public.tenant_agent_configs`: tenant_id, channel, bot_id + prompt/knowledge/workflow versioning; no store_id.
- `public.products`: **UNIQUE(tenant_id,sku)**; cannot support identical per-Store SKU independently within same Tenant without approved schema change.
- `public.orders.status` CHECK only `pending,confirmed,paid,cancelled,refunded`, while V17.2C.36–39 synthetic reservation contract used `reserved,expired`. Must reconcile the business transition model before production.

**Live Auth metadata, counts ONLY (no IDs/emails/sessions/JWT):** 3 auth users; 3 active `owner` memberships by 3 distinct users spanning 2 tenants; **1 tenant has at least 2 active distinct owner accounts**; 0 inactive membership rows. `auth.sessions` table exists, but no actual session was inspected or replayed. This establishes potential A/B pairing, NOT approved Store A/B ownership nor authenticated browser/JWT UAT.

**Live RLS/GRANT:**
- `orders/order_items/products/customers/tenant_memberships` have RLS enabled and forced, authenticated SELECT granted and anon SELECT denied. Direct authenticated INSERT/UPDATE/DELETE on Orders are not granted.
- `orders_manager_read`, `order_items_manager_read`, `customers_manager_read` allow active tenant owner/manager, **not exact Store**; `products_member_read` allows active tenant membership, **not Store**; these are permissive SELECT policies.
- Old broad tenant permissive policy must be atomically replaced, not OR-combined with new Store SELECT policy.
- `public.merchant_paid_orders_daily` and `merchant_revenue_v3` are SECURITY INVOKER but tenant-based, not Store-based; the `p_shop` argument naming is NOT evidence of a Store-scoped implementation.
- `public.save_merchant_product` is authenticated-executable SECURITY DEFINER; metadata-only code patterns show `auth.uid()` + tenant_memberships check but no Store membership check. This is NOT a complete full-body security audit. Must review before promoting as multi-Store product writer.
- `public.qa_owner_pairing` authenticated-executable SECURITY DEFINER; `public.qa_shop_b_zalo_claim` anon-executable SECURITY DEFINER, no `auth.uid()` or tenant_memberships references in function body (anonymous flows might require distinct server-side proof). No exploit attempt was run.

**Live Supabase Security Advisor at 2026-11-18 06:19 UTC**: 23 INFORMATIONAL RLS-enabled/no-policy findings (many private/QA schemas, not automatically externally exposed); 1 WARNING anon-executable public SECURITY DEFINER (`qa_shop_b_zalo_claim`); 2 WARNINGS authenticated-executable public SECURITY DEFINER (`qa_owner_pairing`, `save_merchant_product`); 1 compromised-password protection warning. **These are advisories requiring independent intent/impact review, not proof of compromise.** Do not revoke grants without checking QA/production dependencies and obtaining approval. Advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable .

## 3. VERIFIED n8n Active/Published writer contract (read-only connector)
- `Z7FdV7uDvApfbURQ` TIEN404_MESSENGER_TEST: active, Published sameAsDraft. Attaches legacy Google Sheets create/manage/update/status tools. No trusted Store-scoped writer inputs in the attached tools.
- `KrSn4DNR9ALX5ng4` Create Order Tool: active, **Published** `4740251a-cd01-4f7f-b8e1-e300a8393151` ≠ **Draft** `af9ee686-2a9f-483e-9622-6e449500ac5e`. Published trigger fields: `customer_name,phone,address,sku,quantity`; sheet Append Order writes `order_id,customer_name,phone,address,sku,quantity,unit_price,total,status,created_at`. No tenant/store/verified provider installation.
- `fDB9dvs1qPPVt9Sp` Manage Order: active, Published `137d5689-40c5-4147-9bbc-b22809ad5908` ≠ Draft `2e8786fd-e5c5-410f-9d6c-655653c32278`; input `mode,order_id,phone,new_customer_name,new_phone,new_sku,new_quantity,expected_total`; Google Sheets order read/update, no Store authority.
- `BkAi6TVUKAjCnI7v` Update Order: active, Published `93cf227a-ab8a-42c6-9185-7ec44f7aeb00` ≠ Draft `3bd7043f-78e7-4a1c-93e5-2bc9d60ac767`; input `order_id,new_address,phone`; read/update sheets, no Store authority.
- `4DFFCk60exrzaIl6` Messenger Order Status: active, input `order_id,phone`, Google Sheets lookup, not independently signed Messenger↔Zalo identity proof.
- `5Eeh8hbpsoNhuiVo` Commerce Tenant Resolver: active, input `channelType,accountId`, looks up tenant only; not authoritative Store.
- `iyfGUiEsZlNTBWOR` Commerce Sandbox Core: active, **Published** `456862c9-e5ee-4bfa-9931-47dbc39ab73d` ≠ Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`; uses tenant resolver and read-only catalog/cart tools; not a verified production multi-Store Orders writer.
- `yIJk8LvJoLF40Z62` Zalo Bot staging: active, QA marker DataTable upserts and read-only customer-router/shadow. Not an authorized Commerce Orders writer.
- `sIPs6egzIwOY1GNv` Zalo private router: QA registry has Store information but used in read-only QA, not a live authoritative channel-to-Store writer.
- `p5OsIaB0NkMDFMw7` Trusted Auth Store Reader: **inactive**, test fixture uses synthetic authority; no actual Supabase JWT owner A/B read-only admission.
- `FqEcdmc8PRRMNUEb` Signed Channel Store QA: **inactive**, synthetic only. Not evidence of production provider receipt signing.
- No workflow executed, modified, published, activated or sent any message during this audit. Credential values were not accessed.

## 4. Real read-only release gate: EXECUTED on current live schema
Source committed to GitHub Draft:
`qa/v172c-rpc-closure/v172c40-live-store-authority-readonly-gates.sql`
- **16 independently named checks:** 3 `VERIFIED_PASS`; 8 `VERIFIED_BLOCKED`; 5 `NOT_TESTED`.
- PASS: at least one same-tenant pair of active owner candidates (A01), authenticated direct Orders writes denied (O02), anonymous direct Orders read denied (O03).
- BLOCKED: `stores/store_memberships` absent (S01), 4 Commerce tables lack store_id (S02), broad tenant RLS/no Store RLS (S03), channel installation mapping lacks Store (S04), idempotency not Store-scoped (S05), SKU uniqueness not Store-scoped (S06), reservation statuses absent in actual Orders (O01), anon-callable public SECURITY DEFINER remains subject to review (SEC01).
- NOT_TESTED: actual JWT Auth A/B sessions and consent (A02), backup/rollback/cost/reviewer approval (B01), provider-signed cross-channel consent (C01), actual writer promotion compatibility (W01), authorized privileged transaction writer UAT (W02). The SQL intentionally does not fake JWT or synthesize a session.
- The SQL gate's W01 status is `NOT_TESTED` **within Supabase metadata alone**, while independently inspected n8n Published tool input shows the **actual existing legacy lane is not Store-ready**. Different evidence domains must not be conflated.
- SQL is SELECT-only and reads metadata plus membership aggregates, with no customer/order row reads. It is a release eligibility audit, not a substitute for full security analysis or runtime tenant isolation.

## 5. CANDIDATE canonical closure strategy — PROPOSED, not applied
**Decision gate A (architecture and provenance):** approve Tenant = subscription/org; Store = isolated authorization/commerce boundary; define immutable signed `channel installation → tenant_id+store_id`, tenant membership and explicit Store-level owner/manager rights. Avoid inferring Store from account phone, sender-id, LLM text or tenant alone.

**Gate B (migration expand & compatibility):** only after independent backup/restore and explicit schema-change approval, expand with `stores` and `store_memberships`, nullable `store_id` for Orders/Items/Products/Customers/stock/idempotency, composite Store+Tenant FK and indexes. No guessed legacy backfill. Quarantine unknown Store provenance. Reconcile duplicate SKUs, order statuses/reservation TTL and legacy status mapping, revenue RPCs, notification outbox, client APIs, subscription edge cases.

**Gate C (atomic RLS cutover):** add Store-aware policy while atomically removing broad tenant permissive SELECT policies; test exact Store A/B and cross-tenant C under actual authenticated sessions; no public anonymous read of private Orders. Note privileged service_role/writers bypass normal RLS and therefore need trusted Store+actor server authorization **in the same atomic transaction**. For zero-downtime legacy business behavior, design a separately approved compatibility lane rather than silently exposing tenant-wide reads.

**Gate D (protected real Auth A/B admission, read-only only):** identify two distinct active owner accounts in the same tenant (candidate pair exists) and two separately authorized Store identities *after* canonical Store mapping. Use two independent sign-in sessions under each user's explicit consent, resolve and validate session_id server-side, read only pre-authorized synthetic/owner-provided non-customer test records scoped to each Store, and test A→A allowed, B→B allowed, A→B denied, B→A denied, revoked member denied, cross-tenant denied, guessed order ID denied. Do not paste JWT or sessions in ChatGPT, GitHub, n8n logs, documents or CI. Never fabricate `request.jwt.claim.sub` on hosted DB. If Store identities don't exist, this gate is BLOCKED, not a substitute PASS.

**Gate E (protected production writer compatibility):** freeze legacy Messenger Google Sheets tools as a separate single-Store DEMO; do not redirect their order_id+phone inputs into Commerce. Build a separately versioned protected Order Writer that admits only server-attested installation+Store+actor, exact quote/stock/confirmation, scoped idempotency and atomic transaction. Validate with real authorized A/B, notification/outbox no-send policy and independent reviewer before any production promotion. Do not merge Draft with Published without diff and version checkpoint.

**Gate F (independent security review):** investigate anon-executable `qa_shop_b_zalo_claim` and authenticated-executable `qa_owner_pairing`/`save_merchant_product`, verify intended anonymous OTP flows, replay/rate limits, PII and privileges. Review Supabase Auth password protection settings independently. No permission changes without owner approval.

## 6. Status, risk, rollback and next
- **VERIFIED:** direct live Supabase metadata, RLS/grants, membership aggregates, Security Advisors; actual n8n Published vs Draft configs; SQL gate executed and returned 3 PASS / 8 BLOCKED / 5 NOT_TESTED.
- **IMPLEMENTED:** source-only reusable **SELECT-only live audit SQL** and this checkpoint document on existing GitHub Draft PR #392; no mock workflow or notification dispatcher extended.
- **TESTED:** real metadata-only SELECT gate; **NOT** real user JWT/Store row access or Orders write.
- **PROPOSED:** canonical Store authority migration/backfill/cutover plan and protected real A/B admission test protocol.
- **BLOCKED:** live Store-scoped schema, actual JWT A/B with Store mapping, signed provider identity linking, protected writer, backup and independent review.
- **NO-GO:** production multi-Store, real order writes and Messenger↔Zalo cross-channel private Orders access.
- **Approvals needed:** separate architectural Store model and migration impact approval; backup/restore and authorization scope; real A/B UAT with private sessions; credential and publish changes; fee-bearing resource approval (none used here).
- **Rollback:** revert read-only SQL and doc from Draft PR #392 or close Draft. No Supabase or n8n rollback necessary.
- **Next:** when approved, prioritize safe canonical Store identity and source-provenance mapping on an isolated resource, then actual protected A/B session read-only UAT. Do not continue synthetic notification extensions as a proxy for real identity isolation.
