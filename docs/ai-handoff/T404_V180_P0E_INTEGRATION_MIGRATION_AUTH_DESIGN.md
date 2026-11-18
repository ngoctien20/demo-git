# TIEN404 AI V18.0-P0E — RPC10 Lineage × Store Migration PREVIEW × Real Auth A/B Admission

**Date:** 2026-11-18 JST. **Status:** SOURCE-ONLY / DISPOSABLE / HOSTED NO-GO.
**Checkpoint:** GitHub Issue #368, reused Draft PR #385, based on PR #362.
**M0:** Backup evidence waived by founder for READ-ONLY + SOURCE-ONLY + DISPOSABLE only, NOT hosted migration/RLS/grants/data writes.

## 1. RPC10 source lineage — VERIFIED

- Parent RPC10 PR #247 HEAD e25d8e203143e5079f6204ccacdefd44caafe604.
- Repaired RPC10.1 Draft PR #328 HEAD f33086ac7f5c3a98c825c4c35944d719b561910c, independent CI success #44079319453.
- V18 Draft PR #385 branch and RPC10.1 fix branch diverged at common ancestor e25d8e203143e5079f6204ccacdefd44caafe604 (149 vs 4 commits at comparison). Do not wholesale merge.
- Broken GitHub workflow blob 825ce7daeb388f9132831a3ae4dec16d3bbbd73d had truncated Python assertion, orphan run block and repeated PG17 jobs. 0-job failure is YAML parsing, not PG17 run failing.
- Ported exact fixed workflow blob ecb165cc369a0409eda065d2cfe7ef715d5e876f and integrity test blob e7886d53971cb8a63ebb8d5d49fcf35f1d5dabfc from PR #328 to PR #385; no changes to RPC10 fix logic.
- Integrated CI verified success: RPC10 https://github.com/ngoctien20/demo-git/actions/runs/44121740982 ; P0C https://github.com/ngoctien20/demo-git/actions/runs/44121740633 ; P0D https://github.com/ngoctien20/demo-git/actions/runs/44121740501.
- This port does not merge or close PR #328. Reconcile final ancestry/redundant patch before integration; no force push.

## 2. Current hosted schema — read-only VERIFIED

Staging ifxlvrhyjhbzbrkdsida has zero store_id columns across public.products, orders, order_items, customers, conversations, messages and tenant_memberships. Existing RLS reads are by tenant or tenant role, not same-tenant Store A/B. Current products UNIQUE(tenant_id,sku), order_items FKs include tenant but not Store. Production Store isolation is NOT established.

## 3. Canonical Store Migration Preview — NOT FOR HOSTED EXECUTION

PHASE A / INVENTORY: Verify existing callers, migrations, RLS, grants, live owner provenance and exact Store authority. Unknown rows are quarantined, never guessed from tenant, product SKU, phone, sender identifier or user-supplied data.
PHASE B / ADDITIVE: After separate approval, introduce canonical stores and store_memberships with composite UUID keys, add nullable store_id to six Commerce surfaces, register channel installations and immutable scope. Do not assign default Store or alter existing production policies yet.
PHASE C / BACKFILL: Only independently verified exactly-one Store evidence may assign a row. Orders also require same-Store customer, order item, product and actor bindings. Unmapped, ambiguous, expired or cross-Store records stay quarantined. Dual-Store owner cannot arbitrarily move old rows.
PHASE D / CUTOVER: After independent acceptance, add/completely validate composite FKs and Store uniqueness; update published callers, order write tools and inventory; atomically retire tenant-only permissive RLS policies. Adding another permissive Store policy without removing tenant-only policy may leave an OR-based bypass. Implement USING and WITH CHECK for updates. Never use NOT VALID with UNIQUE constraints.
PHASE E / COMPLETE: Only if quarantine is resolved, outbox and Store ID compatibility are proven and hosted QA passes, consider NOT NULL, dual-write cutover and provider/production release separately.

### Executable DISPOSABLE preview

qa/v180-p0e/canonical-migration-preview-disposable.sql is guarded to t404_v180_p0e_ci on PostgreSQL17 postgres role only. It simulates six Products and five Orders with fabricated owner proofs, predicts assigning three Products and two Orders and quarantining the other six rows (unmapped/ambiguous/expired/scope mismatch). It rejects cross-tenant evidence by composite FK and rejects premature NOT NULL. All simulated SQL is inside BEGIN / ROLLBACK, with final no-schema residue assertion. This proves only preview classification on synthetic data; it does not apply a migration.

## 4. Real Supabase Auth Store A/B admission — DESIGN ONLY

- Two separately authorized, distinct real Auth QA identities, distinct Stores A/B within one tenant; independent evidence of active Store membership.
- Private verifier must validate both JWT signatures using project signing keys, issuer, audience, expiry, current session_id and revoke status; never copy JWT/access token/refresh token into public CI, logs or ChatGPT.
- Test positive A reads A and B reads B; cross Store A→B and B→A denied, outside tenant denied, outsider/anon denied, revoked/expired session denied, dual-store reassignment denied, cross-Store FK and stale price/version denied.
- Server resolves tenant/store from verified authenticated binding / provider installation, never client-supplied sender ID or editable user_metadata.
- Use private NO-SEND session verification and aggregate/opaque evidence hashes only. Current public Commerce has no Store schema, therefore **real hosted JWT A/B UAT cannot be claimed successful**.
- The metadata-only Node admission gate can return INDEPENDENT_REVIEW_REQUIRED at best, with canMigrate/canSend/canGrantRoles/canPublish all false regardless of assertions.
- Separate approval, real backup/restore evidence and tested rollback required BEFORE any staging/production DDL, RLS or customer data changes.

## 5. Acceptance / rollback

Source integration: VERIFIED after fresh CI. Migration preview: must show PG17 SQL success and rollback. Auth admission logic: must pass Node negative tests; this is NOT live JWT acceptance. Hosted Store A/B: BLOCKED. Production NO-GO.
No actual Supabase write, n8n publish, provider send, credential handling, or production deploy. Source rollback by review/revert; runtime rollback not needed.

References: https://supabase.com/docs/guides/auth/sessions and https://supabase.com/docs/guides/database/postgres/row-level-security .