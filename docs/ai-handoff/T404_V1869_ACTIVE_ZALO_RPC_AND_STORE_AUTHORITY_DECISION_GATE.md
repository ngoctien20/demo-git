# TIEN404 AI — V18.6.9 Active Zalo RPC Caller × Store Authority Decision Gate

**Date:** 2026-11-18 (JST)  
**State:** CANDIDATE / READ-ONLY EVIDENCE / SOURCE-ONLY QA / OPEN DRAFT / PRODUCTION NO-GO.  
**Parent:** V18.6.8 Draft PR #437, HEAD `d0646162b9c1b27dd49dfb1a35846d304f03199a`.  
**Boundary:** no deploy, no Supabase DDL/DML, no RPC permission changes, no execution or mutation of n8n workflows, no tokens/JWT/cookies, no real personal data read, no provider sends or real order writes.

## 1. New P1 finding: an actual published n8n caller of `qa_shop_b_zalo_claim`

Read-only inspection of all **22/22 active n8n workflow graphs** from a total listing of **170** workflows (22 active + 148 inactive) found a direct named RPC call:

1. **Parent** `TIEN404_ZALO_BOT_LAB_V1_STAGING`, ID `yIJk8LvJoLF40Z62`, **Active** and **Published**, published graph version `2d912cb0-007f-452f-9536-b92ba12a03e6`.
2. Its connections include `Zalo Bot Webhook (Protected)` → `Validate & Normalize Event (Read Only)` → `Ack Zalo (No Message Sent)` → `Zalo V2 Shadow (Owner Gate Only)` (enabled Execute Workflow node). The child reference targets `OgDZNSAvKEvhnAvn` exactly. Parallel routes from the normalization node exist; the presence of a graph edge is not proof every incoming event follows the route.
3. **Child** `TIEN404_ZALO_V2_SHADOW_STAGING`, ID `OgDZNSAvKEvhnAvn`, **Active** and **Published**, version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`. Its **enabled** node `Submit pending claim for Shop B` is reached from `Recognize Shop B pairing command (staging)` and makes an HTTP **POST** to Supabase REST RPC **`qa_shop_b_zalo_claim`**, using a server-side n8n generic credential configuration. **No credential values were inspected or exported.**
4. Supabase `public.qa_shop_b_zalo_claim` is currently a **SECURITY DEFINER** routine with `EXECUTE` granted to `anon`, guarded in its source by an application header checked against a Vault-backed key. Header comparison is not itself provider webhook proof. Removing `anon` EXECUTE now could break the existing staging Shop B pairing path. **P1: do not blindly REVOKE or alter the header/credential.** This is a dependency-risk finding, **not evidence that the RPC is exploitable**.

**Observed execution metadata, without node inputs/outputs:** the child has one recorded **manual** execution (#2858) dated 2026-11-13 UTC; the parent has 11 returned **manual** executions (#2829–2839) dated 2026-11-13 UTC. No webhook execution was evidenced by these results; this does **not** prove it has never occurred or that the RPC node ran. We did not invoke a webhook or execute a workflow.

**Coverage limitation:** 22 active graphs were read. The 148 inactive workflows were **not** exhaustively scanned; dynamic URLs, credentials, alternate services, code-generated HTTP calls and hosted Render/Worker callers may be outside this literal-name scan. `public.save_merchant_product` and `public.qa_owner_pairing` still require end-to-end caller tracing. `pg_depend` is not a complete dynamic caller inventory.

## 2. Migration and business decisions still unapproved

The single candidate canonical design remains [V18.3.6D PR #417](https://github.com/ngoctien20/demo-git/pull/417), with the independent disposable full-DML pgTAP reference [PR #421](https://github.com/ngoctien20/demo-git/pull/421) (61/61 synthetic PASS). Keep PR #416 and V18.6.3–V18.6.8 as secondary evidence; don't create another Store schema.

| Decision | Recommended design for review | Status | Production impact |
|---|---|---|---|
| D-02 — SKU namespace | **Store-local** `UNIQUE(tenant_id, store_id, sku)` when Store model is fully enforced, preserving legacy isolation until mapped | **PROPOSED, owner has not approved** | Existing `UNIQUE(tenant_id,sku)` and API/RPC lookup need compatibility migration. Do not change now. |
| ROLE-01 | Keep existing Tenant `owner`/`manager` distinct from canonical Store `store_owner`/`manager`/`staff` | **PROPOSED** | Tenant Owner is not implicitly Store Owner; explicit Store membership for Commerce. Never silently translate `owner` from old fixtures into `store_owner` on the live DB. |
| ROLE-02 | At least one active `store_owner` for an active Store; approve transactional last-owner protection | **PROPOSED** | Prevent orphaned stores; test lock/concurrency, expiry and revocation in PG17 and Auth UAT first. |
| D-07 | Exactly one active provider Page/OA installation per canonical Store | **PROPOSED** | Verified provider origin, scoped installation, consent/approval, revocation and audit. |
| Legacy | Keep `store_id IS NULL` legacy rows inaccessible to Store actors; never infer from Tenant, Page, SKU, phone, or bot | **PROPOSED** | Require audited per-row mapping manifest, owner approval, conflict review and rollback. |
| Pilot | One Tenant = one Store for first merchants **only if separately approved** | **OPTIONAL** | This would simplify rollout but would **not** certify same-Tenant Store A/B RLS. |

**Business-facing recommendation:** Store-local SKU because TIEN404 targets independent shops, wholesaler/retailer catalogs and separate stock and pricing; this recommendation does not authorize dropping the current uniqueness constraint.

## 3. Supabase and backup/restore gate

Read-only Supabase staging inspection still shows **0/2** canonical `stores` / `store_memberships`, **0/6** Commerce `store_id` columns, **0** public restrictive RLS policies; PostgreSQL **17.11**, latest listed migration `20261117074559 v175e2b_private_auth_customer_binding_intake_no_grants`.

Existing `public.save_merchant_product` is callable by `authenticated`, SECURITY DEFINER with tenant owner/manager checks and writes **INSERT/UPDATE public.products** plus a private audit record. It is not Store-aware; this caller and the Zalo QA claim have **different** purposes and require separate, scoped cutover plans. Existing Messenger DEMO has three active Published Google Sheets order writers which must remain DEMO, not migrated automatically to Supabase Commerce.

Official background: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups) and [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project). Backup existence, paid PITR entitlement, retention, restore point availability, and tested restore procedure for this specific Supabase project are **NOT VERIFIED**; a migration may **not** proceed on this evidence. Verify backup and an isolated restore **before** staging DDL, then separately approve costs and any actual restore. Restoring a database in place may overwrite changes; never perform it as a blind rollback.

Required pre-change evidence:
- Exact database schema, policy, ACL, functions, migration head and installed legacy writer contract snapshot.
- Approved backup location/retention plus **successful disposable restore drill** with hash/row-count checks, no customer PII in public logs.
- Verified D-02 SKU namespace, ROLE-01/ROLE-02 owner model and authenticated per-Store membership.
- Exact caller inventory for `save_merchant_product`, `qa_owner_pairing`, `qa_shop_b_zalo_claim`, including the new published Zalo chain. Review real deployed Render source once user selects the authorized workspace.
- Independently reviewed, **not-yet-run** migration in a separate PR; PG17 negative tests and explicit rollback/maintenance plan.
- Independent private Auth A/B UAT after canonical Store schema exists; no token/JWT/user data in chat/GitHub.

## 4. Proposed order of work — no mutation in V18.6.9

**S0 Audit:** retain the existing Published graphs; collect a dated read-only source manifest for each external writer. Audit signatures, parameters and access scopes without logging secrets. For n8n mark draft vs published separately.

**S1 Design approval:** owner chooses SKU D-02 and Store Owner role model; approve the canonical PR #417 design as a *design*, not automatically a migration. Reconcile PR #421 PG17 fixtures and role semantics.

**S2 Restore proof:** verify Supabase backup/PITR eligibility and test restoring to disposable infrastructure. Do not claim success from `list_migrations` or from a zip of SQL metadata.

**S3 Staged compatibility:** prepare a separate change to migrate `save_merchant_product` to a narrow Store-aware command; preserve its two QA tenant use cases and optimistic concurrency behavior. Do not alter Zalo `qa_shop_b_zalo_claim` or n8n credentials until direct replacement and regression evidence exist. Keep existing Google Sheets DEMO separate.

**S4 Protected same-Tenant Store A/B:** after independently approved schema and RLS cutover, verify two real independently authenticated sessions on a private worker/gateway with a canonical Store registry. Verify same-tenant cross-Store negative SELECT/UPDATE and privileged caller paths, not just Tenant A vs Tenant B isolation.

**S5 Business cutover:** separate release approval for actual multi-channel Store-aware order writers, Messenger/Zalo provider sends, credentials and production rollout; none of this is admitted by the V18.6.9 source QA.

## 5. Code and test contract

- `qa/store-authority-v1869/caller-evidence.json`: bounded, no-PII read-only graph and metadata evidence. Explicit `inactiveWorkflowsNotExhaustivelyInspected: true`, `newWebhookExecutionVerified: false`, `doesNotProveRpcRan: true`.
- `qa/store-authority-v1869/revocation-admission.cjs`: pure Node.js risk gate. No network, Supabase, n8n, Auth, secrets or write actions. It returns `NO_GO` and refuses RPC grant revocation, migration, writer publication and real Auth UAT, even if someone edits every approval flag in the fixture.
- `qa/store-authority-v1869/revocation-admission.test.cjs`: 42 local Node.js checks (including invalid/fabricated evidence and explicit P1 RPC retention) and existing CI suite extension.
- No Supabase schema, Auth rules, cloud Worker, Render, n8n workflows, GitHub production branches or Page provider code changed.

**Rollback:** close this Draft PR and discard source-only QA changes; no live state rollback necessary.

**Checkpoint:** `V18.6.9 | ACTIVE_ZALO_RPC_CALLER_DISCOVERED | RPC_REVOKE_NO_GO | SKU_D02_PENDING | STORE_ROLE_PENDING | BACKUP_RESTORE_BLOCKED | LIVE_STORE_RLS_BLOCKED | NO_DB_WRITE | NO_PROVIDER_SEND | PRODUCTION_NO_GO`.
