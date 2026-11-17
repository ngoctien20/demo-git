# TIEN404 AI V17.6 — Real Store Ownership × Current M0 Recovery × Store JWT-RLS Preflight

**2026-11-17 JST · Supabase staging `ifxlvrhyjhbzbrkdsida` · Source-only checkpoint · HOSTED_NO_GO**

## Continuation, without rebuilding

This is Phase 2 of [V17.5 Draft PR #251](https://github.com/ngoctien20/demo-git/pull/251). Preserve the 2-tab [Product-first QA Google Sheet](https://docs.google.com/spreadsheets/d/1xVCzUPVhyUJ0v0pYNpJQKwOKzlr-gNoOCEMkS7AEmKc/edit) and already-verified V17.4 n8n manual read-only execution `4348` 15/15. The original AI_SALES_DEMO and Messenger/Zalo Published remain separate. Google Sheets `store_id` is a synthetic QA **filter**, NEVER the authenticated authority.

**DO NOT clone RPC.12's private evidence collector or #247's six-surface migration gate.** Reuse [RPC.12 private operator runbook, DRAFT PR #244](https://github.com/ngoctien20/demo-git/pull/244), [Store six-surface gate #247](https://github.com/ngoctien20/demo-git/pull/247), and [privileged RPC audit #246](https://github.com/ngoctien20/demo-git/pull/246).

## Real hosted READ ONLY observations — VERIFIED only at Tenant scope

Direct Supabase SQL, 2026-11-17 JST. Aggregates/metadata only; no owner IDs, user emails, original row IDs, JWT, customer records or credentials extracted.

| Check | Actual value | Classification |
| --- | --- | --- |
| `public.tenants` | 2 | VERIFIED |
| `public.products`, `public.orders`, `public.customers` | 2, 2, 0 | VERIFIED |
| `public.tenant_memberships` | 3 active Owner memberships / 3 total memberships | VERIFIED Tenant Owner link only |
| Tenants each having exactly one Product, one Order, and an active Owner | 2 | VERIFIED aggregate, **not Store owner proof** |
| Current Supabase Auth users | 3 | Count only, not restored Auth proof |
| Current Storage buckets/objects | 0/0 | Count only, not Storage service restore proof |
| Canonical `public.stores`, `public.store_memberships` | BOTH ABSENT | P0 BLOCKED |
| Six Commerce surfaces with RLS and FORCE RLS | 6/6 | VERIFIED setting, not tested per real JWT |
| `store_id` present on 6 surfaces | 0/6 | P0 BLOCKED |
| Store-qualified policy count | 0/6; each table has 1 PERMISSIVE RLS policy | P0 BLOCKED |
| `anon` SELECT grants | denied 6/6 | METADATA PASS; not actual signed JWT test |
| `authenticated` SELECT grants | present 6/6 | METADATA ONLY; policy still Tenant-scoped |
| `authenticated` INSERT/UPDATE/DELETE grants on six tables | absent 6/6 | METADATA ONLY; SECURITY DEFINER RPCs separately reviewed |
| Private `tien404_r1_qa` Tenant–Store–Bot synthetic binding | 2 bots/2 owners/9 scoped FKs (V17.5) | QA schema integrity only |

The two actual hosted Tenants are separate, so the current fixture cannot test the critically required **Shop A/B within the SAME Tenant**. One Product + one Order per Tenant is not Store lineage. NO GUIDED default/backfill assigning these four original rows to arbitrary Store IDs.

### Security advisor checks

The read-only Supabase Security Advisor returned 1 `anon`-executable `SECURITY DEFINER` QA RPC (`qa_shop_b_zalo_claim`) and 2 `authenticated`-executable definer RPCs (`qa_owner_pairing`, `save_merchant_product`). A Vault/header guard on the first was observed in existing source audit; **this is a privileged-surface review, not a proven exploit**. No grants revoked and no RPC invoked.

Official advisor references:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## M0 RECOVERY classification — previous H11R accepted WITH LIMITATIONS, not erased

Prior H11R local application archive was accepted by Owner: local hash/size and 5/5 application TABLE DATA checks. That archive had **0 Auth and 0 Storage entries** (historical scope limitation); the operator-reported pgAdmin export configuration explains the missing Auth only as an owner statement. DO NOT rerun old archive verification or silently mark old acceptance as false. However, it was **not** an independently verified **CURRENT** full hosted recovery point covering 3 actual Auth users and service/configuration dependencies.

The current migration recovery choice remains `UNDECIDED`, until the owner chooses one of two separately verified approaches:
- `FULL_SERVICE` — a **new current** source-consistent backup and independently witnessed isolated restore of application, Auth and relevant Storage/service requirements.
- `APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN` — a **new current** restorable application backup AND separately independently tested current Auth recovery plus an explicit Storage/service recovery or not-applicable finding.

A local archive, a screenshot saying "backup successful", dashboard plan/free quota, or zero stored objects **cannot** certify an independently recoverable current hosted backup. No credentials, exports or restore started.

Existing RPC.12 private intake and operator-ledger must be used for any 4-row original proof. Actual identifying evidence remains **outside GitHub/ChatGPT/CI** on the authorized operator machine. Its local JSON packet cannot authenticate signers; separate Merchant, Independent Reviewer, Controller and DB Operator attestations remain mandatory. No current four-row ownership release is accepted in this turn.

## JWT-RLS acceptance design — NOT executed

Post-M1, strictly on an approved staged isolated environment with independently authenticated *two Store identities sharing the SAME Tenant*, run **both allow and deny** assertions, never just an empty result:

| Principal and operation | Expected |
| --- | --- |
| `anon` SELECT Products/Orders | deny |
| Store A Owner JWT — A Product/Order | allow |
| Store A Owner JWT — Store B Product/Order in same Tenant | deny |
| Store B Owner JWT — B Product/Order | allow |
| Store B Owner JWT — Store A Product/Order | deny |
| Unrelated Tenant Owner — Shop A/B | deny |
| Revoked member/JWT or mismatched Page/OA binding | deny |
| Shop A manager — authorized Catalog operation | allow only if explicit role policy |
| Client-supplied `store_id` overrides server-verified binding | deny |
| UPDATE to another `store_id`; INSERT foreign Store | deny by `USING` and `WITH CHECK` |
| `order_items`, `messages`, `conversations` parent-child cross-Store FK | reject |
| SECURITY DEFINER and service_role bypass path | independent privileged role/caller review |

Supabase official RLS documentation (2026-11): https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/postgres/testing-row-level-security . Use local pgTAP with `set local role` and a scoped JWT test fixture only after Store schema and separate staging approval. An injected `request.jwt.claim.sub` test helper is **simulation**, not actual provider-signed JWT authentication. Actual bearer tokens must never be stored in repo or ChatGPT.

## New V17.6 artifacts

- `qa/v175-products-store-rls/v176-m0-owner-jwt-readonly.sql` — re-runnable SQL, two read-only queries for aggregate owner and RLS/role grants; **actually executed separately** against live Supabase this turn.
- `qa/v175-products-store-rls/v176-evidence-gate.cjs` — deterministic snapshot classifier; intentionally **cannot authorize M1, backfill, RLS change, real order writing, privileged RPC privilege change or Publish** even if a user-supplied JSON claims all green.
- `qa/v175-products-store-rls/v176-evidence-gate.test.cjs` — 16 deterministic local Node tests incl. missing/changed data, no private output and forged/self-reported green. Node test `16/16 PASS` on local working environment on 2026-11-17; NOT a hosted JWT test. Source script pinned to this day's actual hosted aggregate; if counts change or day changes refresh verified snapshot and do not blindly reuse.

No legacy source refactor, no new n8n workflow or credentials, no Supabase hosted DML/DDL, no migration, no Auth changes, no private backup re-export, no provider sends or model costs. Rollback: close Draft PR #251; all additions are source-only and no production rollback is necessary.

## Remaining gates and next safe work

**VERIFIED:** Tenant-level owner membership, hosted RLS setting/grant/policy metadata, Auth/Storage record counts.  
**IMPLEMENTED:** V17.6 source-only SQL and fail-closed classifier with tests.  
**TESTED:** direct read-only SQL and local 16/16 source tests; **NOT** JWT/restore.  
**BLOCKED:** original 4-row Store owner authority, current recovery scope choice, current independently witnessed recoverable backup, same-Tenant Store JWT acceptance, phased M1/M3/M2-M4 approvals.  
**PROPOSED:** Owner-reviewed recovery scope and private operator intake using existing RPC.12; future additive Store schema and transactional order candidate after all approvals.  
**CHECKPOINT:** [PR #251](https://github.com/ngoctien20/demo-git/pull/251) remains DRAFT, no merge or CI claim unless exact-head independently inspected.
