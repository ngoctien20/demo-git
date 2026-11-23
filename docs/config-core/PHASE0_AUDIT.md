# Phase 0 — Audit & Architecture Baseline (2026-11-22 06:30–07:30 UTC)

Read-only audit. Nothing hosted was changed: no n8n publish/edit, no Supabase migration or write,
no Meta/credential change. Labels: VERIFIED (checked with a tool, evidence below), PROPOSED, BLOCKED.

## 1. Git / PRs

| Item | Status | Evidence |
|---|---|---|
| `develop` HEAD = `0e12f4c` (merge #486), contains V20 Store Authority (#482), #483, #486 | VERIFIED | `git log origin/develop` |
| No `AGENTS.md` / `CLAUDE.md` on `develop` or `main` | VERIFIED | `git ls-tree origin/develop` — rules come from project memory (owner rules) |
| Open PRs touching this area: #488 (V24 shared bot core + adapters, base `main`), #487 (V23 owner App + store bot settings SQL, base `develop`), #477 (develop→main, DO NOT MERGE) | VERIFIED | GitHub API list_pull_requests |
| No existing assistant / menu / template / action-registry code or table in repo or staging | VERIFIED | repo grep, staging `list_tables` → no duplication risk |

## 2. Messenger live workflow `Z7FdV7uDvApfbURQ`

| Item | Status | Evidence |
|---|---|---|
| `active=true`, `versionId = activeVersionId = d1ec9147-c878-445f-bc72-20d87035bfd1` (saved 2026-11-22 04:46Z "Automatically label confirmed handoffs"). The handoff checkpoint **is** the version running now. | VERIFIED | n8n `get_workflow_details` + `get_workflow_history` |
| 51 nodes; one Page allow-listed in code (`allowedPage` in "Extract Messenger Text") | VERIFIED | node dump |
| Postback payloads in use: `TIEN404:START`, `TIEN404:VIEW:<SKU>`, `TIEN404:ASK:{catalog,ao,quan,order,human}`; quick replies `TIEN404:QR:<n>` (text is used, payload ignored); `m.me ?ref=<SKU>` referral | VERIFIED | code of "Extract Messenger Text", "Prepare Messenger Reply" |
| Human handoff = text regex ("gặp nhân viên…", also reached by `TIEN404:ASK:human`) → pass thread control to Page Inbox → ack → record → Inbox label only after success | VERIFIED | nodes "Classify explicit human request" … "Apply waiting staff Inbox label" |
| **F-CC-01: live d1ec9147 has NO voice branch.** No call to VOICE `F7EhVGWIALKWg8Y6`; audio gets the "chưa phân tích được" prompt. Voice was published in `b2245495` (01:44Z) but V25.1 `0d956a1f` was built from `8f7dcb4f`, so later versions dropped it. | VERIFIED (regression between threads) | node list; only executeWorkflow calls are `dw1JOxWOEY8csTnm`, `iyfGUiEsZlNTBWOR` |
| Messenger profile (persistent menu / ice breakers) as configured at Meta | BLOCKED | needs a Graph API read with the Page token; not done (credential use on a live Page) |

## 3. Supabase staging `ifxlvrhyjhbzbrkdsida` (read-only catalog)

| Item | Status | Evidence |
|---|---|---|
| Tenancy tables: `tenants`(2), `tenant_memberships`(3), `stores`(2), `store_memberships`(3); RLS on all | VERIFIED | `list_tables` |
| V23 objects present (`store_bot_settings`, `store_faqs`, `register_shop`, `save_store_bot_settings`, `app_private.self_serve_tenants`) but **not** recorded in `supabase_migrations` (applied by psql) | VERIFIED | `schema_migrations` lists 25 rows, last `20261122003621 v20_store_sku_contract` |
| `app_private.t404_qa_tenant_allowed` = QA Shop A/B **or** self-serve tenants | VERIFIED | `pg_get_functiondef` |
| `tenant_agent_configs` (1 row, channel `pilot_lab`, lifecycle `paused`): older per-tenant agent pointer (workflow/prompt/model). Not a menu/config store; left as is. | VERIFIED | SELECT |
| `conversations` / `messages` exist but 0 rows; live bots log to Google Sheet + n8n Data Tables → no DB event source yet for Phase 4 | VERIFIED | `list_tables` |
| `qa_shop_b_zalo_claim` still EXECUTE-able by `anon` (known P0, PR #476/#481 pending) | VERIFIED | `has_function_privilege` |

## 4. Reused (not rebuilt)

* V20 Store Authority: `stores`, `store_memberships`, RLS pattern, `t404_qa_tenant_allowed`, `app_private.audit_events`.
* V23 pattern: owner/manager check via store membership, optimistic concurrency, PT409.
* V20/V23 offline harness (`00_hosted_baseline_replica.sql`, simulated JWT roles).
* PR #488 channel contract (CoreRequest, `detectSku`, 1–3 message rule) — Config Core sits *before* it (which menu/action), it does not replace the AI core.
* Live Messenger payloads are kept as **legacy** and mapped, never re-defined.

## 5. Regression risks identified

1. Messenger live has no config reader → Phase 1 cannot change customer behaviour. Wiring it is Phase 2 and needs a published n8n change (approval).
2. Existing `TIEN404:*` buttons sit in customers' threads; any new menu must keep them working (legacy map + test).
3. Parallel threads publish Z7Fd (F-CC-01 shows a feature was lost). Phase 2 must start from the live version and diff before publishing.
4. Config Core uses `t404_qa_tenant_allowed` → only QA/self-serve tenants can use it until the allow-list is retired.
5. `CHECK` constraints that call a function reading another table break `pg_dump` restore order → avoided (validation in RPCs).

## 6. Minimal change list (ordered)

1. **Phase 1 (this PR):** Config Core schema + RPCs + JS validator/renderer, offline only.
2. Owner approval → apply `10_config_core.sql` to restore-test, then staging (same flow as V20).
3. Phase 2: App screen "AI của tôi → Menu" (V23 App), Messenger adapter reads published config **in a copy of Z7Fd**, then a separate approval to publish.
