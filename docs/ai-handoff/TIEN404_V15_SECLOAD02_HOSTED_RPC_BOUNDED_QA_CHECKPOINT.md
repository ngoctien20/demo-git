# TIEN404 AI — V15-SECLOAD-02
## Hosted Store/RLS Authority × Privileged RPC Security Review × Bounded n8n Staging Manual QA

**Ngày:** 2026-11-17 JST.  
**Parent checkpoint:** [V15-SECLOAD-01 Draft PR #245](https://github.com/ngoctien20/demo-git/pull/245), HEAD `2358a0b218ec54b0ba0134d87a63ac5197a94006`.  
**Classification:** Real hosted **READ ONLY**; real separate n8n Personal QA **MANUAL, INACTIVE, NO SEND**; new source QA + Draft PR only. **NO hosted migration, no rate flood, no customer data, no production cutover.**

### 1. Direct read-only hosted authority audit

Target Supabase staging: `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11.

**Observed pg_catalog / information_schema facts**:
- `public.stores` **absent**, `public.store_memberships` **absent**; no `store_id` in `products/orders/customers/messages/conversations/tenant_agent_configs` and no Store-qualified policies in these public Commerce tables.
- 20/20 public data tables have RLS enabled. Among core eight checked tables `products`, `orders`, `customers`, `messages`, `conversations`, `tenant_agent_configs`, `tenants`, `tenant_memberships`, **all eight have RLS and FORCE RLS**, 1 policy each referring to `auth.uid()`; **zero** of these policies refer to `store_id`. The data tables use `tenant_id` scope (plus `customer_id` for Orders).
- This is **tenant-level protection**, not same-tenant Shop A/B ownership. Do NOT infer an actual cross-shop leak has already occurred; DO NOT certify Store separation or deploy multi-store Commerce until canonical Store relationship, protected memberships, composite FKs, Store JWT/RLS and independent read/write negative tests are complete.
- Advisor had 18 RLS-without-policy notices in mostly private/QA schemas; those may intentionally be deny-all and do not justify granting access without a security review.

**P0-SECSTORE:** `BLOCKED` for hosted Store-level isolation and multi-store release. Real Store A/B/C JWT impersonation or customer row tests **NOT RUN**; avoid production/customer access.

### 2. Privileged RPC review from sanitized read-only source

Queried `pg_proc` ownership, `has_function_privilege`, function `search_path`, SHA-256 of exact source and the function body after **all single-quoted literals were redacted**. Raw credentials, Vault values, PSIDs and customer records were not exported.

| RPC | Capability and observed protection | Review state |
|---|---|---|
| `public.qa_shop_b_zalo_claim` | `SECURITY DEFINER` owned by `postgres`, `anon` callable. Uses `request.headers` value, looks up Vault decrypted secret, rejects missing/short/mismatched secret using digest comparison, validates challenge/code/sender/event lengths and derives HMAC identifiers before invoking a **synthetic QA claim helper**. Configured `search_path`, no dynamic SQL indicator. | **P1 review:** shared header secret is a bearer control; cannot infer native Meta/Zalo signature, rate limiting or leak resistance from function body alone. Current external callers need negative tests in disposable environments. No exploit proven. |
| `public.qa_owner_pairing` | `authenticated` callable, `SECURITY DEFINER` as `postgres`. Uses `auth.uid()`, active tenant membership/owner role, bounded QA bot mapping, challenge expiry and `failed_attempts<5`; private issue/confirm helpers. Configured `search_path`. | **P1 review:** guards are present but inner helper/RLS bypass and same-tenant Store scope need independent review; no unauthorized access proven. |
| `public.save_merchant_product` | `authenticated` callable, `SECURITY DEFINER` as `postgres`. Checks `auth.uid()`, tenant membership and owner/manager role in an explicit two-tenant allowlist; validates SKU, name, price, stock; optimistic timestamp check for UPDATE; writes audit event. **Uses only `tenant_id`, not `store_id` for products.** | **P0 Commerce Store release blocker**, not a proven exploit in current tenant-only design. Do not grant new Store access until `store_id`/RLS/transaction contracts exist. |

No RPC business function was invoked. No change to GRANT/REVOKE/RLS/JWT/credential or audit table. Function source SHA is recorded in `qa/v15-secload02/hosted-store-rls-privrpc-readonly-ledger.json`; these SHA identifiers allow later drift review without leaking function bodies.

**Priority remediation (PROPOSED, not executed):**
1. Preserve baseline source SHA, private backup and current provider integrations.
2. Define canonical `stores` and `store_memberships` owner-of-record schema and composite FK migration; use disposable staging and fixed synthetic Shop A/B/C.
3. Refactor product mutation to server-trusted `tenant_id+store_id`, enforce `auth.uid()` membership role **and** Store-scope in authoritative SQL, including insert/update and audit. Require exact prepared price/stock tests.
4. Review two pairing functions' inner helpers and `SECURITY DEFINER` privilege surface; for anonymous QA Zalo claim, assess why public callable, Vault/header and signature validation, replay, audit/rate limits and narrow scoped role. Consider revoke or move to private adapter **only after impact analysis and owner authorization**, not automatic.
5. Test with disposable signed JWT fixtures and separate roles before hosted DDL approval. Never use live customer data or bypass RLS to simulate acceptance.

### 3. Real n8n bounded QA: 4/4 PASS, actual concurrent execution **NOT DEMONSTRATED**

- New Personal QA folder `90_QA - DIAGNOSTICS` workflow **`ZHJmhlRwAiNEtujb`**, named `TIEN404 SECLOAD02 Manual QA 1-3-5 — INACTIVE NO SEND`.
- **Exactly two nodes**: Manual Trigger → 80 ms Code synthetic wait; 0 credentials, webhook, HTTP, AI Agent, business tools, Commerce/Sheets, Meta/Zalo Send. **INACTIVE, no Published version**. Validated with n8n Workflow SDK before creation. No actual customer request data.
- Safe bounded schedule: 1 baseline manual execution, then up to 3 execute calls submitted in one batch; **stop if failure, external effects, quota or actual concurrency unproven**. We intentionally stopped after four total instead of escalating to five.
- Real connected n8n runtime logs:

| Execution | UTC start → end | Wall-clock | Code wait | Status |
|---|---|---:|---:|---|
| #4200 | 2026-11-16 22:15:59.358 → 22:16:01.167 | 1,809 ms | 80 ms | PASS |
| #4201 | 2026-11-16 22:16:29.866 → 22:16:31.613 | 1,747 ms | 80 ms | PASS |
| #4202 | 2026-11-16 22:16:39.064 → 22:16:39.187 | 123 ms | 80 ms | PASS |
| #4203 | 2026-11-16 22:16:48.401 → 22:16:48.521 | 120 ms | 80 ms | PASS |

- **Zero pairwise overlap; maximum actual running executions = 1** by timestamps, despite 3 requests submitted via `Promise.all`. We do **NOT** know whether tool connector, scheduler, queue or environment serialized these calls; no claim about n8n's actual concurrency limit. The two long wall-clock executions may include scheduling/startup effects; cannot infer p95 at load from N=4 mixed start behavior.
- **0 real Meta/Zalo sends, 0 paid models, 0 Orders, 0 webhooks, 0 Supabase writes, 0 customer access**.
- This is an **isolated manual execution smoke/latency observation**, not an actual multi-request webhook or full AI load test. **No RPS, stable chat throughput, 429/5xx rate-limit effect, queue depth or 50–100 user capacity measured**.
- Source QA file `qa/v15-secload02/real-inactive-n8n-bounded-manual-4200-4203.json` contains no Page/PSID, token or customer data.

**For a genuine future staging concurrency test (PROPOSED):** a separate externally reachable **QA-only** endpoint with a server-side allowlist, no consumer webhooks, no provider credentials or Commerce tools, hard cap of **max 5 simultaneous** requests and **max 15 total**, fixed 80ms synthetic work, max test window 60 seconds, HTTP timeout 5 seconds, stop on any 429/5xx or unplanned resource charge, monitoring and isolated request ID correlation. An independent permitted client driver (such as k6 with a static token available only to the private operator) must actually produce overlapping execution timestamps. This is **not executed** until quota and exact target authorizations are verified; do not publish a test webhook on a public route or call existing Messenger/Zalo endpoints.

### 4. Source QA and review gates

- `qa/v15-secload02/hosted-rls-privrpc-READ_ONLY_PREFLIGHT.sql`: catalog-only SQL, `BEGIN TRANSACTION READ ONLY`, no business RPC invocation, DDL, DML or customer row.
- `qa/v15-secload02/hosted-store-rls-privrpc-readonly-ledger.json`: sanitized positive/negative authority facts + function SHA.
- `qa/v15-secload02/real-inactive-n8n-bounded-manual-4200-4203.json`: real safe manual runtime receipt, timestamps & strict no-overlap indicator.
- `qa/v15-secload02/hosted-auth-staging-load-gate.mjs` and tests: re-check canonical Store missing, tenant-only eight-table RLS, privileged guard flags, four QA PASS, actual max execution overlap **1**, fail closed on evidence drift or fabricated approval. Release verdict always `NO_GO`.
- `.github/workflows/v15-secload02-hosted-rls-rpc-bounded-qa-nosend.yml`: 21 new source contract tests + 328 previously achieved source/security regressions, no model/Meta/n8n/DB API call. CI PASS only after exact HEAD GitHub Actions evidence confirms.

### 5. Required approval / rollback / release

**VERIFIED:** actual Supabase metadata, code shape with literal redaction, role/ownership and exact source SHA; n8n four manual QA executions and active Messenger 27-node version.

**IMPLEMENTED:** GitHub Draft branch, four sanitized evidence artifacts, fail-closed source gate/test and CI; new inactive n8n QA 2-node manual workflow.

**TESTED:** real 4/4 manual n8n safe QA; source tests only after exact SHA CI green.

**BLOCKED:** real hosted Store JWT-RLS same-tenant Shop A/B acceptance, independent privileged RPC exploit/control validation, real concurrently overlapping staging load, production RPS/SLO, native Page/PSID, one-shot deployed in hosted, private full backup/restore and live one-recipient cutover.

**Change ledger:** 1 new **INACTIVE** Personal/`90_QA - DIAGNOSTICS` 2-node QA workflow, 4 manual executions, source-only GitHub Draft PR; zero Supabase DDL/DML, Meta sends, AI costs, customer writes, credential changes or Messenger Published modifications.

**Rollback:** closing Draft PR reverts source proposal; it does **not** delete inactive n8n QA workflow/executions. Keep Inactive pending separate retention/deletion approval. Production rollback not needed because no Published cutover or hosted migration occurred.

**Release decision:** `V15_SECLOAD02_HOSTED_MULTISTORE=NO_GO`, `V15_SECLOAD02_RPC_SOURCE_REVIEW=PARTIAL_GUARDS_OBSERVED`, `V15_SECLOAD02_MANUAL_STAGING_QA=4_OF_4_PASS`, `V15_SECLOAD02_CONCURRENT_LOAD=NOT_PROVEN`.

**Next milestone:** `V15-SECLOAD-03 — Authorized Disposable JWT Store Isolation × Security Definer Helper Review × Isolated QA Webhook Load Acceptance`. Keep separate approval for any hosted migration or provider send.
