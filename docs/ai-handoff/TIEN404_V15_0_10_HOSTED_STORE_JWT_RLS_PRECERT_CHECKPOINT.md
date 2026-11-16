# TIEN404 AI — V15.0-10 Hosted Store Ownership & JWT/RLS Pre-Certification

Checkpoint: **2026-11-16 (JST)**  
Base: Draft PR #137 at b216643287de81c0e71bfdc7b00de5bfe0d0fa9a  
Scope: **READ-ONLY HOSTED AUDIT → ADDITIVE DRAFT SOURCE → OFFLINE SYNTHETIC TESTS**  
Release: **PRODUCTION NO-GO**. No live JWT certificate or real owner/provider signoff.

## 1. VERIFIED current Supabase staging (connector read-only)

- Project tien404-staging / ifxlvrhyjhbzbrkdsida, ACTIVE_HEALTHY, PostgreSQL 17.11, ap-southeast-1.
- 3 Auth users, 2 Tenants, 3 active Tenant Memberships, 2 Products, 2 Orders.
- Canonical public.stores and public.store_memberships: **ABSENT**.
- Products, Orders, OrderItems, Conversations and Messages have tenant_id, **NO store_id**.
- Existing Products / Orders SELECT policies are permissive TENANT-scoped. RLS+FORCE RLS true and anon SELECT false does not prove same-Tenant Store A/B isolation.
- Existing OrderItems composite FKs pin Tenant+Order/Product but **NOT Store**. Products currently UNIQUE(tenant_id,sku), not store-scoped.
- 14 migrations exist, zero development branches. These DO NOT prove an encrypted hosted backup or successful independent restore.
- QA Owner bindings 2; QA pairing claims 4: synthetic QA evidence, NOT genuine independently certified merchant G2.3 provider consent.
- Security Advisor WARN: anon-executable SECURITY DEFINER public.qa_shop_b_zalo_claim; two authenticated SECURITY DEFINER functions, leaked-password-protection warning. Findings are NOT proof of exploit; no GRANT/RPC change.

## 2. Existing V15 code retained

- PR #137 Messenger→Zalo synthetic continuity remains OPEN DRAFT. This branch is a new child; not merged.
- PR #131 disposable Postgres17 RLS and Commerce preview bridge are reused unchanged.
- PR #132 and #135 are separate Owner evidence / backup authorization draft ancestry. **No real owner consent or backup approval can be inferred from their synthetic signatures**.
- Do not move DEMO orders/products or credentials to Commerce.

## 3. New source-only implementation

1. hosted-gate.cjs: fail-closed metadata review of Store tables, Store scopes, restrictive SELECT policies and triple-key OrderItem FKs. Even passing schema returns SCHEMA_REVIEW_ONLY_NOT_CERTIFIED.
2. hosted-readonly-preflight.sql: catalog-only SELECT metadata. NO writes, SET ROLE, simulated auth.uid, customer data, or signed-JWT claim.
3. jwt-readonly-matrix.cjs: three independent A/B/C private actors, same-Tenant A/B and cross-Tenant C persisted QA Order IDs; positive Auth.getUser checks then nine positive and negative Store Order read comparisons. No automatic certification even when all 12 checks pass.
4. supabase-get-transport.cjs: optional read-only operator interface with injected HTTP transport. Only exact staging origin, Auth /user GET and Orders GET, minimal fields, same actor bearer; rejects service-role, secret keys, foreign origins, other verbs, arbitrary columns, invalid ID and non-2xx results. No network calls from source-only CI.
5. Node22 contract tests and CI with no secrets, no provider send and no hosted operations.

## 4. Evidence levels and acceptance

| Evidence | Current state | Limitation |
|---|---|---|
| Hosted schema/policy introspection | VERIFIED | Proves absence of Store scope; not a JWT authorization test |
| Unit fake transport matrix | TESTED OFFLINE | Synthetic callbacks cannot prove Supabase Auth JWT |
| PR #131/#137 disposable PG17 | PREVIOUSLY TESTED | Throwaway DB; mock claims, not hosted JWT |
| Hosted signed Auth JWT A/B/C | BLOCKED / NOT RUN | No approved genuine Owner/Store evidence and no Store schema |
| Hosted encrypted backup and isolated restore | BLOCKED / NOT RUN | Require independent scope, storage and operator approvals |
| Real Meta/Zalo provider Owner proof | BLOCKED / NOT RUN | G2.3 consent/provider verification missing |
| Messenger to Zalo LIVE | BLOCKED / NOT RUN | Must wait for hosted security + authorized Commerce writer |

## 5. Approval gates and sequence

**G0a: Independent Owner evidence.** Privately verify at least four ownership records linking merchant/controller, Tenant, Store, authorized membership, channel provider and real consent. Obtain independently verified G2.3 provider consent. Never identify Owner by matching phone/name or QA pairing fixture.

**G0b: Real staging backup authorization.** Separate data-controller and security-review approval for ONE encrypted staging logical export, private offsite custody, privacy minimization, checksum and retention. Real export and isolated restore each require separate operator authorization. PR #135 synthetic signatures are NOT actual human approvals.

**G1: Reviewed schema migration (NOT AUTHORIZED).** Reuse existing disposable PG17 blueprint. Introduce canonical Stores/Store Memberships and store_id for scoped Commerce. Attribute legacy Products/Orders only with independent ownership evidence; quarantine unknown records. Add composite Tenant+Store FKs and Store-scoped SKU uniqueness, restrictive RLS, proper USING/WITH CHECK, FORCE RLS, reviewed GRANT. Keep migration reversible; do not apply before hosted backup+restore evidence.

**G2: Genuine signed JWT proof (NOT RUN).** Authorized QA actor A sees own A, B sees own B, C sees own C; A cannot see B/C, B cannot see A/C, C cannot see A/B. Auth GET /user MUST validate each issued token, followed by PostgREST GET with the SAME token, no service role, fake SQL session or token copying to GitHub/ChatGPT. Add anon, revoked membership and paused Store negative tests after those cases exist and are approved. Require independent review of blinded receipts.

**G3: Real Order/Channel E2E (NOT RUN).** After G2, verify approved Commerce writer, order idempotency/Outbox and verified Messenger/Zalo provider-scoped identities, then run limited LIVE UAT only with separately approved QA accounts.

## 6. Security, rollback and operator approval

- No Supabase hosted DDL/DML/Auth/RLS/GRANT/RPC changes; no real snapshot, restore, credential reads, n8n Published changes, provider sends or paid model calls.
- Rollback this stage: close Draft PR/revert additive files. No hosted rollback required because hosted was not changed.
- For real certification, Owner must separately approve G0 private evidence, staging backup, isolated restore, reviewed migration and genuinely signed Auth JWT read-only proof. A single instruction to continue is **not** approval for these higher-risk operations.

Final state: **VERIFIED HOSTED READ-ONLY + IMPLEMENTED DRAFT + TESTED OFFLINE + BLOCKED REAL JWT CERTIFICATION. PRODUCTION NO-GO.**
