# TIEN404 AI — V18.6.7 Legacy Writer Cutover × Canonical Store Decisions

**Date:** 2026-11-18 JST. **Environment:** staging plus live n8n DEMO inventory, read-only inspection. **Classification:** CANDIDATE / NO DATABASE CHANGE / NO PUBLISHED WORKFLOW CHANGE / NO PRODUCTION APPROVAL.

**Parent:** V18.6.6 Draft PR #433, HEAD `8441c6668fc30db7066d09a7989e90cb726937db`. Existing CI before this phase: 187/187 synthetic and disposable PostgreSQL tests. This checkpoint adds *source evidence and a narrow integrity gate*, not another Store schema or a deployment.

## 1. Audit results — verified vs unverified

1. **Supabase staging** (read-only `information_schema`, `pg_proc`, grants): `public.products`, `customers`, `orders`, `order_items`, `conversations`, `messages` have `tenant_id` but no `store_id` (0/6). The six tables have RLS enabled. `anon` and `authenticated` do **not** have direct INSERT/UPDATE/DELETE privileges on these public Commerce tables. **This does not prove writes are impossible.** `public.save_merchant_product` runs `SECURITY DEFINER`, callable by `authenticated`, checks tenant owner/manager and may INSERT or UPDATE `public.products` and insert a private audit event; it is not Store-aware. The caller graph is not exhaustively known. Never blindly revoke it.
2. **n8n Published** (read-only `get_workflow_details`, published node parameters, no credentials): Messenger `Z7FdV7uDvApfbURQ` active, tool workflows `create_order` → `KrSn4DNR9ALX5ng4`, `manage_order` → `fDB9dvs1qPPVt9Sp`, `update_order_address` → `BkAi6TVUKAjCnI7v`. Those three child workflows are active and contain **published** Google Sheets `append` or `update` operations. All three published graph version IDs differ from their current draft version IDs. Do **not** assume a Draft-only change alters live behavior. Existing AI_SALES_DEMO main agent `v6PBwcqSapVzACMW` also points to the same 3 tools. No workflow was invoked, modified or published here.
3. **Commerce Core** `iyfGUiEsZlNTBWOR`: active n8n sandbox; draft/published differ. It is not evidence of a production-grade, Store-isolated order writer. Zalo Bot and private customer router were read for bounded reference checks only.
4. **Cloudflare**: protected Worker `tien404-widget-gateway-v144-staging` and Access app exist, current observable Worker bindings include `T404_ACCESS_AUD`, `T404_QA_OPERATOR_EMAIL`. A real Supabase Auth verifier/session integration into that protected Worker was **not verified**; no deployment or Access policy edit.
5. **Render**: connected tool required user selection of workspace. One available workspace was listed but never selected; no Render source/deploy was read, so the full hosted writer inventory is still **BLOCKED**. The existing GitHub PRs about Render source are historical proposals, not fresh deployed evidence.

The evidence is recorded in `qa/store-authority-v1867/writer-path-inventory.json` with `completeness: PARTIAL`. It does not claim no other writers.

## 2. Single candidate Store Authority, not a third schema

- **Design source candidate:** [PR #417](https://github.com/ngoctien20/demo-git/pull/417) / V18.3.6D canonical Store Authority. Contains schema contract, manifest, migration and restrictive RLS decision table; remains **OPEN DRAFT / NOT APPROVED**.
- **Full DML/RLS test reference:** [PR #421](https://github.com/ngoctien20/demo-git/pull/421) / V18.3.6E disposable PostgreSQL 17 pgTAP **61/61 PASS**, not real Supabase proof.
- **Secondary tests:** PR #416 separate PG17 Store replacement, and stacked PRs #420 → #424 → #427 → #433 synthetic/metadata QA; retain their evidence without promoting their competing role names or schemas into canonical production data.
- Do not promote or merge across PR bases in an automated step: these are different Draft branches. An integration PR must first compare exact files and resolve conflicts, then undergo independent review and test.

### Decisions awaiting owner approval

| ID | Candidate recommendation | State / why blocked |
| --- | --- | --- |
| D-01 / D-06 | Tenant owner needs explicit Store membership to read Store Commerce records | PROPOSED; prevents automatic cross-Store read |
| D-02 | **Store-local SKU** (`tenant_id`, `store_id`, `sku`), with explicit migration check for legacy `UNIQUE(tenant_id, sku)` | **OWNER DECISION REQUIRED**; alternative is Tenant-global SKU |
| D-03 | Customers are Store-scoped; no automatic phone/email deduplication | PROPOSED |
| D-04 | Multiple active Store owners allowed; cannot revoke last active owner of active Store | PROPOSED |
| D-05 | Staff modifies orders only through narrow approved transactional commands | PROPOSED |
| D-07 | One active Page/OA installation belongs to exactly one Store | PROPOSED |
| D-08 | Unmapped legacy rows remain NULL/quarantined; no default Store assumption | PROPOSED |
| D-09 | No unrestricted service-role writer exposed to channel workflows | PROPOSED |
| D-10 | Shared catalogs and cross-Store reporting deferred | PROPOSED |
| ROLE-01 | Canonical role is `store_owner`, while V18.6.3 secondary fixture uses `owner` | **RECONCILIATION REQUIRED**; never silently map these role strings in real auth |

A temporary **one-Tenant–one-Store pilot** could lower first-release risk, but it would be a separately approved feature/policy, not proof that same-Tenant Store A/B is safe. Do not silently enable it from this document.

## 3. Legacy writer risk matrix

| Writer | Current true target | Risk if new Store RLS/check is applied immediately | Required disposition |
| --- | --- | --- | --- |
| `public.save_merchant_product` RPC | Supabase staging `public.products` + audit | New `store_id IS NOT NULL` check can reject legacy create; tenant-only guard is not a Store guard | Inventory *all* callers; design Store-aware replacement; verify rollback, preserve function until transition is proven; review existing grants and privilege boundaries |
| Messenger `create_order` → Create Order Tool | Google Sheets DEMO Orders | Risk of dual write / wrong backend if reconnected to Commerce | **Do not repoint**; separately version Store-aware order adapter behind approved release flag |
| Messenger `manage_order` | Google Sheets DEMO Orders UPDATE | Existing Published differs from Draft; inadvertent apply can mutate DEMO orders | Keep unchanged, regression snapshot and no fallback to Commerce without proof |
| Messenger `update_order_address` | Google Sheets DEMO Orders UPDATE | Same mismatch and stale order update risk | Keep unchanged, test address/SĐT and confirmation flow before any candidate cutover |

The DEMO Google Sheets store is *not* canonical multi-tenant Commerce. Preserve its behavior and segregate its credentials and data. No data migration from DEMO to Commerce is assumed.

## 4. Required cutover sequence — gated, not executable

**G0 — inventory and decisions (this PR):** approve one canonical contract (#417 candidate), settle D-02 and role vocabulary, map RPC callers including Render source and historical deployment, record existing Graph Published vs Draft versions, choose no-write QA pilot. **No deployment**.

**G1 — backup/security admission (requires separate approval):** verify Supabase staging backup/PITR and restore rehearsal, full legacy manifest, tenant/store ownership evidence, rollback owner and review window; inventory service-role callers and direct backend writes; confirm that no existing published writer will produce `store_id IS NULL` after guarded schema change.

**G2 — disposable schema/rehearsal:** reuse PR #421 full-DML pgTAP matrix and SQL fixture; cover role and SKU decisions, composite FK and Store RLS, exact tenant/store collision and legacy NULL behavior; do not create a competing schema. **No actual staging DDL until explicitly approved**.

**G3 — approved staging additive schema/RLS:** only after backup and owner approval, install canonical Store registry, memberships, additive nullable `store_id`, composite FKs, restrictive RLS and scoped narrow RPC. Maintain fail-closed isolation; do not remove broad policy alone or re-enable tenant-wide order access on rollback.

**G4 — private Owner A/B real UAT:** two truly independently authenticated Supabase accounts under the *same Tenant*, different Store memberships, verified Cloudflare Access+Supabase Auth server-side and database Store RLS negative/positive cases. Never send JWT, emails, IDs, tokens, session or private order rows to chat. Owner operates test browsers privately; only safe `ALLOW/DENY` and non-sensitive diagnostics are retained. CI synthetic tests and two distinct tenants are insufficient.

**G5 — writer admission (independent approval):** after real Auth/RLS acceptance, stage a narrow Store-aware product writer and then channel order writer with zero dual-write, idempotency, price/stock enforcement, notification outbox and rollback. Messenger published workflow switching needs separate explicit approval and exact publish version comparison; retain old DEMO as separate product.

**G6 — release:** provider permissions, billing, subscription and live Messenger/Zalo ownership must pass independent QA; **PRODUCTION NO-GO** remains until signed owner approval.

## 5. Safe rollback

- **Current phase:** close Draft PR; no hosted changes exist to roll back.
- **After additive Store schema:** turn off new writer, leave restrictive Store isolation in place; do not remove RLS to recover availability or autoassign orphaned records. Use maintenance mode and reviewed Store-aware policy version.
- **After approved writer cutover:** restore *exact prior Published workflow version* only after checking new writes/outbox/retry handling, and prevent replay or double writes. Do not blindly roll Draft → Published or point DEMO to Commerce.

## 6. QA and checkpoints

- Test file `qa/store-authority-v1867/writer-path-inventory.test.cjs` protects the *metadata classification* and cross-system writer segregation; it is not a live integration test.
- Existing V18.6.3–6 workflow should be extended once with the 13 assertions and rerun existing 187 tests. Do not claim verification until CI completes.
- Persistent **NO-GO**: canonical Stores missing; 0/6 Store ID Commerce; no real Owner A/B same-Tenant RLS evidence; RPC caller inventory incomplete; Render workspace not selected; D-02 unresolved; no owner-approved migration or backup/restore; Published Messenger DEMO still active.
- Status: `V18.6.7 | LEGACY_WRITERS_AUDITED_PARTIAL | CANONICAL_417_CANDIDATE | PGTAP_421_REFERENCE | REAL_STORE_RLS_BLOCKED | REAL_AUTH_AB_BLOCKED | NO_SEND_TRIGGERED | NO_DB_WRITE | PRODUCTION_NO_GO`.
