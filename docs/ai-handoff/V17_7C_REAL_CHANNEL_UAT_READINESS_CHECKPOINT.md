# TIEN404 AI — V17.7C Real Channel UAT Readiness × Store RLS NO-SEND
2026-11-17 JST — SOURCE ONLY / HOSTED & REAL OWNER UAT: NO-GO

## Parent and scope

Parent: Draft PR #321 HEAD fa3b796b15df2154074c45e80d78bfa444a53b10.
SOURCE-07A: Draft PR #317 0208fff09405f6c78ab9d63db77a2194ca2d5701.
Previous Zalo OA SOURCE-04E PR #309 remains Draft and independent.
V17.7C prepares authenticated real-channel NO-SEND acceptance. It does NOT claim to run a real user, provider or Store UAT in CI. It does not grant authority to send, read live customer data, change Supabase RLS, activate Messenger/OA messaging or incur cost.

## Actual read-only verified inventory

- Zalo Bot LAB V1 staging, workflow yIJk8LvJoLF40Z62, active published version 2d912cb0-007f-452f-9536-b92ba12a03e6: 12 nodes, protected webhook header X-Bot-Api-Secret-Token, upsert to PII-free QA markers and a no-send core shadow. Do not invoke its live webhook during synthetic QA; running it can write QA markers.
- Messenger TEST, workflow Z7FdV7uDvApfbURQ, active published version 1064b1b3-d3f1-4a6b-a367-2414ba691522: 32 nodes, raw Messenger signature stage and an actual HTTP send reply node. Recent webhook executions show success status metadata; this alone does not prove real Page->Store authority, independent signature verification or a safely isolated end-to-end reply.
- Website DEMO/MARKETING AI, workflow wgkkmT7q4lm4HyuA, active published version c81929d4-ab55-4c24-8659-795842739e24: 9 nodes; demo-marketing, not a trusted Store customer session.
- Zalo + Website shared-core shadow 4ycmVzaNzVRulBjQ, active version 76bbb4e9-7ad2-45a6-8188-260523ced57a: intentionally no-send deny for unbound Store.
- Messenger Core shadow dw1JOxWOEY8csTnm, active version 450f2693-aad9-47d8-aaba-ac7a94abe644: intentionally fail closed for unbound authority.
- V17.1P store auth manual fixture workflow p5OsIaB0NkMDFMw7 inactive with latest manual 5018 success, 208/208 SYNTHETIC; cannot represent real Store A/B JWT admission.
- AI_SALES_DEMO Orders/Products, credentials and Messenger TEST API must remain segregated from Commerce product. No change to any published workflow, n8n Data Table or credential.

## Supabase hosted read-only metadata — current P1 Store isolation blocker

Project: tien404-staging, ref ifxlvrhyjhbzbrkdsida, PostgreSQL 17.
Exactly six public Commerce surfaces: products, orders, order_items, customers, conversations, messages:
- Six of six have RLS enabled, FORCE RLS, tenant_id UUID.
- Zero of six have a store_id column.
- Each has exactly one SELECT policy; five require an authenticated tenant owner/manager membership and products allows active authenticated tenant membership. The predicates contain **tenant membership checks**, not explicit Store-qualified restrictions.
- Private tien404_r1_qa.tenant_identity_map contains two tenant mappings; max distinct stores in a single Tenant is **one**; zero tenants currently have 2+ mapped Stores.
- Query from qa/v17-7a-oa-independent/v17-7c-hosted-readonly-store-preflight.sql was actually executed as read-only: commerce_public_surface_count=6, protected_surface_count=6, tenant_column_count=6, store_column_count=0, needs_manual_store_policy_review_count=0, qa_tenant_count=2, qa_max_stores_in_one_tenant=1, qa_tenants_with_two_stores=0.
- "needs_manual_store_policy_review_count=0" means zero existing policy texts even mention store_id/store_key; it does NOT mean Store isolation QA passed.
- No live Postgres rows, auth JWTs, passwords, customer details, orders or product values were inspected. No hosted RLS JWT A/B test ran. Tenant-only RLS does not imply store-level isolation.

### Blocker remediation plan — PROPOSED, NOT EXECUTED

Owner and Integration team must first choose canonical Store relationship design compatible with current public tables and existing QA/RPC/Recovery branches, e.g., an explicit store_id with composite FK or a trusted scope join, never just a client-supplied Store filter. Obtain schema owner review/backup, reversible staging migration, explicit Auth actor least-privilege, Store ownership proof and two disposable same-Tenant Store A/B Auth sessions; test both allowed own-Store and denied cross-Store read/modify before any real Core read permission. Do not update legacy tenant-only policies or deploy privileged RPCs without approved migration/rollback. Compare conflicting open work (#247/#246/#251) first.

## Implemented in this Draft branch

1. qa/v17-7a-oa-independent/v17-7c-hosted-uat-admission-offline.mjs:
   - Constant real UAT NO-GO flags; immutable per-channel minimal plan.
   - PII-free DB metadata inspector: refuse missing RLS/force RLS/tenant scope, lacking explicit Store predicate/verified join, absent same-Tenant two-Store QA fixture. Even hypothetical "PASS" is shape-only, not real JWT acceptance.
   - Redacted, short-lived, exact workflow-version-pinned minimal witness-shape preflight. Reject extra fields (token, customer/phone, raw body, store/price claims), time drift, self-declared native provider proof, unknown channels and live execution.
   - An explicit gate ignores even forged all-green owner/hosted evidence; independent authenticated reviewer and actual signed provider/JWT proof still required.
2. qa/v17-7a-oa-independent/v17-7c-hosted-uat-admission-offline.test.mjs:
   - Negative QA for current real Store model blockers, failing RLS metadata, spoofed/expired evidence, wrong versions, sensitive values, send-enabled modes, cross-channel/real OA requests.
3. qa/v17-7a-oa-independent/v17-7c-hosted-readonly-store-preflight.sql:
   - SELECT-only metadata audit executed on staging without PII/order rows, write statements or privileged escalation.
4. .github/workflows/v17-7c-real-channel-uat-readiness-offline.yml:
   - Inherit V17.7A/7B tests, source-only no-HTTP/no-send/no-Commerce-write and SQL guard. CI proof only after exact HEAD success.

## Proposed REAL UAT acceptance sequence — requires separately authorized human participation

A. Zalo Bot: QA-only user sends one explicitly labeled benign input to the authorized QA Bot after independent staging endpoint and Bot owner binding are confirmed. Capture platform update ID and only redacted audit digest. Verify Bot header independently, exact Bot→Tenant/Store installation binding, private no-send status, deterministic replay denial. Never borrow OA MAC for Bot.
B. Messenger: page owner/operator proves control of a dedicated Meta QA Page. Use an inert clone behind strict no-send gate, not production TEST with its active send node. Native raw Messenger HMAC and Page ID must be verified before a real Store resolver; customer may send one QA message to dedicated Page only with consent. No automatic sender link to Zalo Bot.
C. Website: two real authenticated Store-owner/manager QA sessions resolve to one Tenant/two independent Stores (only after Store schema remediation) and signed session identity. Verify right Store read works, cross-store read denied; no agent tool writes or customer data.
D. Shared Core: independent API contract versions, bot/profile, pricing reader and catalog RLS; deny unknown channel, cross-channel identity spoof, price injection, stale or replayed message. Passing source-only synthetic is not sufficient to release access.
E. Zalo OA: deferred; legitimate verified OA owner's OAuth and one-shot getoa readback, native signed no-send webhook, private token vault/revocation; no rented shared raw token.
F. Owner notifications: merchant outbox must use Commerce-owned channels/credentials, not DEMO. No send during this phase.
G. Independent QA: real external edge denial proof, log correlation, issuer/verifier separation, rollback and zero-order/stock/write audit from authoritative provider/DB logs, not a user-uploaded checkbox.

## No changes & rollback

No n8n workflow was created, updated, published, or executed, no Cloudflare Worker/Access mutation, no Supabase DDL/DML, no Zalo OA or Messenger outbound message, no new paid plan or customer data accessed.
Rollback: close this Draft PR. Because only source files were added, no hosted resources need reversal.

Status: VERIFIED (read-only actual workflow and RLS inventories + executed metadata SQL), IMPLEMENTED (source-only code/tests/checkpoint), TESTED (only once exact PR HEAD CI SUCCESS), BLOCKED (real provider, real same-Tenant Store A/B JWT-RLS, provider-authorized/no-send hosted UAT), PROPOSED (next private consent-backed UAT).
