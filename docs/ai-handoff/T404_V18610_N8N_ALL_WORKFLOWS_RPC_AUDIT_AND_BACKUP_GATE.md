# TIEN404 AI — V18.6.10 Complete Current n8n RPC Literal Scan × Backup/Restore Admission

**Date:** 2026-11-19 JST. **Parent:** V18.6.9 [Draft PR #441](https://github.com/ngoctien20/demo-git/pull/441), HEAD `ce6b2cd4d0d3225dad3b2763754a3a348f29a4da`.

**Status:** `VERIFIED_N8N_CURRENT_LIST_STATIC | VERIFIED_SUPABASE_METADATA | BACKUP_UNVERIFIED | SOURCE_ONLY_TESTED | MIGRATION_NO_GO | PRODUCTION_NO_GO`.

This checkpoint continues the existing PR stack; **no new Store schema is designed**. No production/staging live changes, no customer/order data accessed, no credential/token values read, no webhook/automation execution, no RPC call or revoke, no Provider send and no cost-generating action.

## 1. Current n8n RPC caller survey — VERIFIED only within its stated scope

`search_workflows(limit=200, sortBy=name:asc)` returned **171 workflows**: **22 active and 149 inactive**. All 171 completed read-only `get_workflow_details(detailLevel=full)` successfully, in ten bounded cohorts (9 × 18 plus 1 × 9). For every workflow, node parameters were inspected for the exact strings `save_merchant_product`, `qa_shop_b_zalo_claim`, `qa_owner_pairing`, `/rpc/`, `/rest/v1` in the **published graph** and also in the Draft when the published/draft versions differ.

The result is **one direct literal RPC reference**:

- **Child workflow:** `OgDZNSAvKEvhnAvn` / `TIEN404_ZALO_V2_SHADOW_STAGING`, active and published.
- **Node:** `Submit pending claim for Shop B`, enabled HTTP Request POST to `qa_shop_b_zalo_claim`.
- **Parent:** `yIJk8LvJoLF40Z62` / `TIEN404_ZALO_BOT_LAB_V1_STAGING`, active, published, enabled Execute Workflow edge to the child, established at V18.6.9.
- **No literal reference found** to `save_merchant_product` or `qa_owner_pairing` in inspected n8n node parameters. This is NOT proof these RPCs have zero callers.
- The observed execution metadata from the prior checkpoint contained manual executions only; **no successful real RPC execution was established**. This phase did not execute workflows.

**Limitations:** The scan is bounded to the workflow list returned at one point in time. It does not inspect browser-rendered code outside n8n, Render live deployment, Cloudflare Workers deployed source, Supabase Edge Functions, SQL-internal callers, connectors that construct RPC names dynamically, encrypted credential content, older removed workflows, or provider runtime traffic. Static string matches cannot establish a request was sent, that webhook verification passed or that Zalo pairing actually succeeded. Newly added workflows after the snapshot require a new scan.

**P1 safety finding:** The currently published Zalo branch has a dependency on `qa_shop_b_zalo_claim`. **Do not revoke anonymous EXECUTE, rotate secrets, change the RPC signature or disable the branch without a separately approved compatible replacement, tested on staging.** `anon EXECUTE` is a review item, not evidence of exploitability. The RPC source includes an application header/Vault check; it is not proof of authentic provider events.

## 2. Supabase live staging — read-only recheck

Project `tien404-staging`, PostgreSQL 17.11, was ACTIVE_HEALTHY. Read-only schema inspection again found:

| Item | Observed |
| --- | --- |
| `public.stores`, `public.store_memberships` | 0 of 2 present |
| Commerce `store_id` on six business tables | 0 of 6 present |
| `public` RESTRICTIVE policies | 0 |
| `public.products` SKU uniqueness | `UNIQUE (tenant_id, sku)` |
| `public.qa_shop_b_zalo_claim` | `SECURITY DEFINER`; anon EXECUTE, authenticated denied |
| `public.qa_owner_pairing` | `SECURITY DEFINER`; authenticated EXECUTE |
| `public.save_merchant_product` | `SECURITY DEFINER`; authenticated EXECUTE; tenant-scoped writer, NOT Store-scoped |

No data row values were queried in this phase. No Store-A/B real JWT/RLS UAT was performed. Existing new-staging migrations remain absent; migration is **not permitted** by this file.

## 3. Backup / PITR evidence — BLOCKED, not assumed

Official Supabase documentation: [Database Backups](https://supabase.com/docs/guides/platform/backups). Documentation describes scheduled backups for qualifying paid plans, PITR as an add-on when eligible, and export/dump for Free projects. These are **general platform capabilities**, not evidence that the TIEN404 project has a backup. To review backup availability, inspect **Supabase Dashboard → select `tien404-staging` → Database → Backups**, then view scheduled backup and PITR state. The current connected Supabase tools do not expose a read-only list-backups action; **no actual backup list, billing tier, latest successful backup, PITR entitlement or restore drill has been verified**. Do not send authentication tokens or backup files to a chat/PR.

Admission record required prior to *any* hosted migration:

1. Project-ref match, confirmed by a private operator (not inferred from docs or a public link).
2. Evidence that a backup/export covering the relevant schema/data exists, with capture time and retention; redact IDs and private metadata in PR.
3. **Separately isolated restore drill** using authorized access to a disposable environment, verified schema/row-count checksums and a defined rollback time budget; never restore over the current staging project merely as a test.
4. Approved rollback procedure and freeze/maintenance policy. A backup existing in the Dashboard **does not equal a tested restore**.
5. Owner + independent reviewer signed-off proof kept in a protected system, not a client-editable JSON document. If any step is unknown, `NO_GO`.

## 4. Canonical Store choices requiring owner approval

**Use existing design only:** [Draft PR #417](https://github.com/ngoctien20/demo-git/pull/417) is the canonical design candidate. [Draft PR #421](https://github.com/ngoctien20/demo-git/pull/421) carries disposable PostgreSQL 17 full DML/RLS pgTAP, 61/61 PASS at its recorded CI. The V18.6.3–9 stack is supplementary safety/contract QA, NOT a third source of schema truth.

| Decision | Recommended design | Still blocked until |
| --- | --- | --- |
| D-02 — SKU | Store-local `tenant_id + store_id + sku`, allowing two Stores under one Tenant to reuse a SKU independently | Owner explicitly confirms impact on current `UNIQUE(tenant_id,sku)`, catalog APIs, imports, order writers and price/stock lookups |
| Store owner role | `store_owner` for Store membership, distinct from tenant `owner`; no implicit Commerce cross-Store access | Owner approves role/permission matrix, last-active-owner invariant, revocation tests |
| Legacy mapping | Historical rows with NULL Store remain inaccessible/quarantined until exact owner evidence and private manifest | Verified Store mapping of all impacted data, isolation rollback, no guessed default Store |
| RPC cutover | Replace Store-unaware product RPC only after proving all callers and validated replacement | Render/other-app inventory, QA owner A/B auth proof, backup, independent review |
| Zalo RPC ACL | Preserve current published path until a compatible authenticated replacement is actually verified | Feature-level test and explicit, separately approved ACL change |

**One tenant–one Store pilot:** may simplify a first commercial rollout but is ONLY a proposal. It is not proof of same-tenant multi-store isolation, and does not automatically authorize migration.

## 5. Current engineering blockers and next actionable steps

- **V18.6.11 candidate**: obtain user selection of Render workspace for read-only inspection of the *deployed* service; do not select implicitly or infer deployed source from a PR.
- Use GitHub and Supabase read-only metadata to inventory browser and Edge Function callers. The GitHub default-branch search here returned no literal exact RPC references; the search does not scan Draft branches, deployed Render code, generated bundles or source outside the repo.
- Owner decision: D-02 Store-local SKU recommendation and Store role contract, recorded by owner in a real approval system. Code can prepare the mapping, but an offline JSON flag cannot approve a release.
- Backup/restore proof, including actual restore rehearsal in a disposable environment. No hosted DDL until proof, review and approved change window.
- Revisit protected Cloudflare Access × Supabase Auth Owner A/B only after explicit two independent real Store A/B principals are available, membership and live Store RLS exist and approved private-host UAT is possible. Do NOT put JWTs or session IDs into GitHub, workflow logs or chat.

## 6. QA, checkpoint and rollback

Source-only tests: `node --test qa/store-authority-v18610/decision-gate.test.cjs` (40 local PASS). Extends the **same** isolated PostgreSQL 17 CI (274 parent tests + 40 = 314 planned). The source-only gate returns `NO_GO` on every input, including a forged all-green backup report or owner approvals. It never invokes databases, RPCs, service APIs or providers.

**Checkpoint:** `V18.6.10 | CURRENT_N8N_LIST_171_OF_171_STATIC_VERIFIED | ONLY_ZALO_DIRECT_RPC | CROSS_APP_CALLERS_UNVERIFIED | BACKUP_RESTORE_UNKNOWN | D02_UNAPPROVED | REAL_AUTH_AB_BLOCKED | NO_SEND | NO_WRITE | PRODUCTION_NO_GO`.

**Rollback:** close the new Draft PR or revert the single Git commit; since no running system was altered, no live runtime or database rollback is necessary.
