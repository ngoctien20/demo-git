# TIEN404 AI — V18.3.6Q QA Checkpoint

**Checkpoint:** `V18.3.6Q-APPROVAL-GOTRUE-RPC-44515306558`  
**Date:** 2026-11-19 JST  
**Status:** `PRIVATE APPROVAL INTAKE + LOCAL GOTRUE PLAN IMPLEMENTED / DISPOSABLE PG17 SIGNED RPC QA TESTED / REAL OWNER, AUTH AND PROD RPC BLOCKED`.

## Baseline

- Parent V18.3.6P [Draft PR #457](https://github.com/ngoctien20/demo-git/pull/457), final HEAD `f8404ca771244592db4fcb795b27c4deae5d496e`, GitHub Actions #44512981812 SUCCESS (515/515 Node tests + 70/70 actual disposable PG17 assertions).
- V18.3.6Q [Draft PR #461](https://github.com/ngoctien20/demo-git/pull/461), branch `qa/v1836q-approval-gotrue-rpc-trust-20261119`, base P QA branch. OPEN DRAFT, not merged, not deployed.
- No Supabase/n8n/Cloudflare production or staging write; no actual `auth.sessions` row, customer data, JWT, credential, function body, production signer or provider send.

## Deliverables IMPLEMENTED

1. `private-approval-intake.mjs`: acceptance checks for *request metadata* only; exact staging project ref, actual 40-hex Git SHA, SHA256 scope/evidence digests, owner/reviewer/operator separation, four SECDEF identities, <=1h approval window, confidential redaction and no Auth/secret/GRANT/DDL. Even all green returns `COMPLETE_REQUEST_AWAITING_EXTERNAL_OWNER_HUMAN_VERIFICATION`; never real approval.
2. `gotrue-runtime-admission.mjs`: local stack preflight only, with version/image digest/egress/loopback, synthetic local users, no production token/staging volumes, same-PG transaction prerequisites, cleanup and separate resource/reviewer approvals. Actual `localGoTrueStarted=false`, `mayStartRuntime=false` for all outcomes. No GoTrue process launched.
3. `rpc-proof-fixture.mjs`: Node HMAC-SHA256 deterministic UTF-8 canonical signing for 13 bounded fields: Q1, synthetic issuer/audience/kid, session/user/tenant/store, membership revision, item, capability, nonce JTI, expiry. Key is **COMMITTED PUBLIC 32-byte ASCII Q** fixture, not a secret and NEVER deployable in production.
4. `01_DISPOSABLE_PG17_SIGNED_RPC.sql`: restricted to database name `tien404_v1836m_disposable` and PostgreSQL 17; creates private schema, QA-only role `tien404_q_rpc_caller NOLOGIN NOBYPASSRLS`, protected SECDEF RPC, private fixture key table. The caller may EXECUTE only this wrapper, cannot directly query Auth/member/catalog/nonce/fixture key; wrapper checks MAC and TTL, then calls existing M synthetic session/Store/nonce logic within one PostgreSQL transaction. Underlying fixture owner is privileged — this is an intentional trust-risk demonstration, **not production-safe**.
5. `02_DISPOSABLE_PG17_ACL_PGTAP.sql`: 30 pgTAP assertions for direct privilege denial, EXECUTE restriction, fixed search_path, fixture RLS, role properties and database isolation.
6. `generate-disposable-pg17-vectors.mjs`: 22 actual PostgreSQL 17 cross-runtime HMAC vectors signed by Node, covering positive own Store read, wrong MAC, tampered scope, cross Store, wrong session/user, deleted session, expiry, duplicate JTI and no nonce on denial.
7. `generate-concurrent-signed-call.mjs`: two independent concurrent PostgreSQL connections with exactly the same Node-signed JTI; expect one ALLOW, one REPLAY, ledger count=1. Integration evidence must be checked on final CI (not included in numbered pgTAP counts).
8. `test-q-security.mjs`: 84 offline Node negative tests for approval-intake, GoTrue admission, and HMAC proof canonicalization/tampering.
9. `PRIVATE_SECURITY_APPROVAL_INTAKE.md`, `GOTRUE_LOCAL_RUNTIME_ADMISSION.md`, `TRANSACTION_BOUND_RPC_TRUST_CLOSURE_MATRIX.md`, `README.md`, dedicated GitHub Actions CI and this checkpoint.

## Verified initial CI before final checkpoint

[GitHub Actions #44515306558](https://github.com/ngoctien20/demo-git/actions/runs/44515306558), both jobs SUCCESS:
- `V18_3_6Q_PREDECESSOR_515_PASS`: inherited G–P Node **515/515**.
- `V18_3_6Q_SECURITY_84_PASS`: Q offline Node **84/84**.
- `V18_3_6Q_SOURCE_SCOPE_AUDIT_PASS`: no real Auth/function source access, SQL schema changes outside disposable, production credential or network call in Q runtime modules.
- `V18_3_6Q_M_PG17_53_PASS`: actual PostgreSQL 17.12 synthetic M pgTAP **53/53**.
- `V18_3_6Q_P_PG17_17_PASS`: actual PostgreSQL 17.12 P pgTAP **17/17**.
- `V18_3_6Q_PRIVATE_RPC_ACL_30_PASS`: Q private role/ACL pgTAP **30/30**.
- `V18_3_6Q_NODE_PG17_HMAC_22_PASS`: Q Node-signed PostgreSQL HMAC pgTAP **22/22**.
- Total **599/599 Node + 122/122 real disposable PG17 = 721/721 numbered assertions PASS**; no Node failures, no SQL errors or failed pgTAP assertions in initial successful logs.
- CI synthetic PG17 container uses `--network none`, no published port, cleanup on success/failure; HMAC key committed deliberately as a public fixture.

**Pending added concurrency evidence:** Signed simultaneous JTI negative case was appended after initial run. Its successful execution and all 721 assertions must be checked against the **final checkpoint HEAD** before final-HEAD acceptance; do not claim it tested based only on this checkpoint document.

## Read-only connected baseline after Q implementation

Supabase staging `ifxlvrhyjhbzbrkdsida`, PG17.11:
- 8 functions in `public`; 4 SECURITY DEFINER; effective EXECUTE role exposure `anon`=1, `authenticated`=2, `service_role`=1 (O manifest has exact function identities).
- `auth.sessions` direct SELECT is false for authenticated and service_role, and was previously verified false for anon. **No actual session IDs or row data read.**
- `public.stores` + `public.store_memberships` absent, `store_id` in six Commerce tables absent.
- No real Body ACL review: source code/function definitions/actual Data API routes remain unreviewed. The public SECDEF grant observations are risk indicators, not proof of exploit.

n8n metadata rechecked, Published versions unchanged:
- Messenger `Z7FdV7uDvApfbURQ` Published `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62` Published `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR` Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`, separate Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.

## Acceptance and blockers

| Gate | Status |
|---|---|
| Scope-limited owner/reviewer approval request | IMPLEMENTED / TESTED OFFLINE; **NOT ACTUAL CONSENT** |
| Four SECDEF function body inspections | BLOCKED — explicit independent real owner approval required |
| GoTrue local runtime creation and real `signOut` | BLOCKED — plan only, separate resource approval |
| Synthetic signed Node→PG17 RPC canonicalization | TESTED initial cross-runtime |
| Private PostgreSQL ACL / nonce / Store negative QA | TESTED in disposable PG17 |
| Signed simultaneous JTI replay | ADDED; final-run CI required |
| Real Auth/Store session and external revocation | BLOCKED |
| Actual Store schema, real A/B membership, secure production SQL signer/caller identity | BLOCKED |
| Real KMS custody / independent human security review | BLOCKED |
| Production writer/notification/provider send | **NO-GO** |

## Risk and rollback

This QA fixture contains an intentionally PUBLIC synthetic HMAC key; running it in production would be insecure. Its SQL deliberately uses SECURITY DEFINER with a privileged fixture owner, and signature comparison is NOT independently reviewed as constant-time verification. There is no production credential/KMS access and no release authorization. If a private caller can be forged with a known key, a cryptographically valid fixture token cannot close Store/RLS P0s.

All changes limited to QA and a standalone GitHub Actions workflow. Closing the unmerged Draft PR rolls back code; the CI container self-destructs. No Supabase/n8n environment rollback needed.

**Suggested next safe stage:** `V18.3.6R — Independent Private SECDEF Review Evidence Intake × Real GoTrue UAT Authorization Boundary × Managed RPC Key-Custody/Caller Threat Review`, with separate owner/reviewer/resource approvals for any real experiments.
