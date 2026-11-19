# TIEN404 AI — V18.3.6N QA Checkpoint

**Checkpoint ID:** `V18.3.6N-SECDEF-AUTH-CRYPTO-44507246728`  
**Date:** 2026-11-19 JST  
**State:** `OFFLINE DESIGN + SYNTHETIC SECURITY QA PASS / REAL REVIEW AUTH NOT GRANTED / PRODUCTION NO-GO`

## Parent / scope
- Parent V18.3.6M [Draft PR #449](https://github.com/ngoctien20/demo-git/pull/449), final HEAD `c322721a4ce40cc864ae220419230c322b5d7231`, GitHub Actions #44505388890 SUCCESS: 327/327 counted assertions + 4 separate PostgreSQL concurrency cases.
- V18.3.6N [Draft PR #451](https://github.com/ngoctien20/demo-git/pull/451), base `qa/v1836m-pg17-session-delete-grants-crypto-20261119`, branch `qa/v1836n-privileged-body-auth-crypto-contract-20261119`.
- Only QA and CI files created; not merged, not deployed. **No live Auth or SQL function body reviewed**.

## Implemented deliverables
1. `function-review-authorization.mjs`: metadata-only exact target scope, independent reviewer vs implementer, signed owner-approval reference, 1–4 function digests, staging-only and <=1h time-window preflight. It **cannot** verify owner signature, retrieve function bodies or permit a grant change.
2. `auth-service-delete-contract.mjs`: offline simulator of `global`, `local`, `others` Supabase signOut scope; denies missing JWT signature, expired JWT, missing/mismatched session, user-disable/time-box/inactivity/single-session policy uncertainty and expired `not_after`. 15-case real Auth service UAT admission matrix, all **BLOCKED** without isolated Auth environment/owner approval.
3. `crypto-trust-boundary.mjs`: **preferred offline architecture** is private Node Ed25519 verification of TIEN404 authority with independently verified Supabase JWT + same-PG-session/Store/nonce read. **Production RPC caller proof crypto is UNSELECTED pending review**; static QA HMAC and generic service-role proxy explicitly rejected.
4. `test-n-security-contracts.mjs`: **64** deterministic negative/authorization tests. Even synthetic packets with all review flags set cannot mark `productionAdmitted:true`.
5. `REVIEW_AUTHORIZATION_REQUEST.md`, `REAL_AUTH_DELETE_SEMANTICS_CONTRACT.md`, `CRYPTO_TRUST_BOUNDARY_DECISION.md`, `RISK_REGISTER_V18_3_6N.md`, `STAGING_SECURITY_ADVISOR_SNAPSHOT.md`, `README.md`.
6. Dedicated GitHub Actions `tien404-v1836n-auth-review-gate.yml`, no secrets/network access or external project mutation.

## Verified QA prior to checkpoint commit
[GitHub Actions #44507246728](https://github.com/ngoctien20/demo-git/actions/runs/44507246728) — SUCCESS:
- G–L inherited Node security regressions **245/245 PASS**.
- M crypto grant compatibility regressions **29/29 PASS**.
- N review authorization + Auth signOut scope + production crypto boundary **64/64 PASS**.
- **338/338 numbered tests PASS.**
- `V18_3_6N_PREDECESSOR_245_PASS`, `V18_3_6N_M_REGRESSION_29_PASS`, `V18_3_6N_SECURITY_CONTRACT_64_PASS`, `V18_3_6N_NO_LIVE_SCOPE_STATIC_AUDIT_PASS`: verified in job log.
- No failed Node test and no network/secret access in N source audit.
- These tests are **offline only**; M's real disposable PostgreSQL 17.12 DELETE races remain verified in M final-HEAD CI, and N makes no changes to M's SQL. Do not imply N reran live PostgreSQL or Auth service operations.

**FINAL-HEAD CONDITION:** this checkpoint is committed after successful CI #44507246728. Confirm and inspect new GitHub Actions run on the final checkpoint SHA before marking final-HEAD VERIFIED.

## Read-only staging audit evidence
Supabase staging project `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11:
- `public`: **8** functions; **4** SECURITY DEFINER.
- Effective SECDEF `EXECUTE`: `anon` **1**, `authenticated` **2**, `service_role` **1** (overlap possible; no function body retrieved, no exploit proven).
- Supabase Security Advisors: `anon_security_definer_function_executable` **WARN 1**, `authenticated_security_definer_function_executable` **WARN 2**, `auth_leaked_password_protection` **WARN 1**, `rls_enabled_no_policy` **INFO 23**. Do not infer that private tables with no policies are an authorization vulnerability; these may be intentionally deny-by-default.
- `auth.sessions` relation exists, but **ZERO Auth session rows/JWTs/user identities were accessed**.
- Public canonical `stores`/`store_memberships`: **0**; Store `store_id` across six Commerce tables: **0**.
- No Supabase DDL/DML/GRANT/REVOKE/auth settings changes.
- n8n Published workflows checked read-only: Messenger `1064b1b3-d3f1-4a6b-a367-2414ba691522`, Zalo Bot `2d912cb0-007f-452f-9536-b92ba12a03e6`, Commerce Core Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d` (separate Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`). No workflow execution, save or publish.

## Facts from current Supabase docs
- `signOut` scopes `global`, `local`, `others` have different per-user session effects; JavaScript defaults to `global`.
- Revoked access JWT may remain cryptographically valid to `exp`.
- Auth `session_id` maps to `auth.sessions`; deleted row can indicate logout, but timebox/inactivity eligibility can expire *before the row is asynchronously deleted*. **Presence alone does not prove active-session policy**.
- Docs: https://supabase.com/docs/guides/auth/signout and https://supabase.com/docs/guides/auth/sessions.

## Security gates and blockers
- **Function body access:** NOT AUTHORIZED. Need separate explicit owner consent bound to precise staging function signatures, independent human reviewer, read-only redaction, <=1h window, no secrets/PII and private evidence custody.
- **Real Auth signout tests:** NOT AUTHORIZED. Need isolated QA Auth identities/project and separate approval; real service DELETE/transaction ordering not verified.
- **Production crypto:** only design-layer preferred direction selected; actual private RPC verifier/identity, KMS key custody and supported DB crypto NOT SELECTED or TESTED as production. QA static HMAC key MUST NOT ship.
- **Canonical Store:** still absent, real same-Tenant Owner A/B, Store RLS and provider/merchant grants BLOCKED.
- **Security reviewer:** no independent human approval.
- **Production operations:** order writes, inventory, provider sends, billing, permission changes, staging migrations, real credential handling all NO-GO.

## Release status, rollback and next gate
| Gate | Status |
|---|---|
| N offline security contracts | IMPLEMENTED / TESTED 64/64 |
| G–M predecessor Node regressions | VERIFIED 274/274 |
| N security advisor metadata | VERIFIED / REVIEW REQUIRED |
| Privileged function body review | PROPOSED / NEEDS EXPLICIT OWNER APPROVAL |
| Real Supabase Auth delete semantics | SPECIFIED / REAL TEST BLOCKED |
| Private Node Ed25519 design direction | PROPOSED PREFERRED |
| Production private RPC trust mechanism | BLOCKED / UNSELECTED |
| Human security approval, Store A/B, release | NO-GO |

No linked environment changes to roll back. Close Draft PR #451 to abandon this candidate safely. Do not merge as a production release, migration or permission grant. **Final CI must be verified on HEAD after checkpoint commit.**

**Suggested next stage:** `V18.3.6O — Staging SECDEF Metadata-to-Review Manifest × Disposable GoTrue Auth UAT Plan × Gateway Cryptographic Proof Admissibility Matrix`, remaining read-only unless explicit independent approvals are supplied.
