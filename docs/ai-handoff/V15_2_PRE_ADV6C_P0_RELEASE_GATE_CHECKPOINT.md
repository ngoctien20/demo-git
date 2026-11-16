# TIEN404 AI — V15.2 PRE-ADV.6C: SECURITY P0 RELEASE GATE
Date: 2026-11-16 JST
Stage: **DRAFT / SOURCE-ONLY / NO-SEND / NO HOSTED WRITE / NO MERGE**
Base: PRE-ADV.6C P0/P1 Audit PR #171 pinned at `26253c185f711eeed39989b99b01a9a17d247a4f`.

## 1. VERIFIED — Actual environment inspection
Read-only inspection of Supabase project `ifxlvrhyjhbzbrkdsida`:
- `public.products/orders/customers/tenant_memberships/tenants` have RLS enabled and forced for main Commerce; there are no `public.stores` or `public.store_memberships`. The data model is tenant-scoped, and Shop A versus Shop B within **the same** tenant is NOT independently certified.
- Public `qa_shop_b_zalo_claim(uuid,text,text,text)` is SECURITY DEFINER with EXECUTE to `anon`. Existing source includes a Vault shared-secret header check and synthetic QA claim; this is NOT evidence of exploitation. Replacing the caller with trusted webhook HMAC + durable replay MUST precede privilege revoke. Two other public SECURITY DEFINER RPC (`qa_owner_pairing` and `save_merchant_product`) can be executed by `authenticated` and need permission and store-scope review. A fourth is not callable directly by anon/authenticated.
- Supabase security advisor WARN 1 anon definer, 2 authenticated definer, leaked-password protection not enabled, INFO private/QA RLS tables with no policy. No rights or Auth settings were changed.
- n8n Published: Messenger `Z7FdV7uDvApfbURQ`, version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, still has DEMO order tools; Create Order `KrSn4DNR9ALX5ng4` published `4740251a-cd01-4f7f-b8e1-e300a8393151`; Manage Order `fDB9dvs1qPPVt9Sp` published `137d5689-40c5-4147-9bbc-b22809ad5908`; Update Order `BkAi6TVUKAjCnI7v` published `93cf227a-ab8a-42c6-9185-7ec44f7aeb00`.
- Source-only prior PRE-ADV.6C PR #171 implemented trusted Store boundary, atomic quota adapters, signed webhook replay contract and 22 negative QA cases. No live wiring to production.
- Hosted backup + independent JWT Owner A/B + production role approval evidence were **not available in reviewed context**. This is a missing-proof blocker, not proof those actions never happened elsewhere.

## 2. IMPLEMENTED — Six fail-closed release gates
Source: `qa/v152-pre6c-security/p0-release-gate.cjs`, exact audited snapshot `p0-release-baseline.readonly.json`.

| Code | Must verify independently | Current |
|---|---|---|
| P0_RPC_DEFINER_EXPOSURE | No unaudited anonymous definer; caller replacement tested; anon negative access; rollback | BLOCKED |
| P0_HOSTED_JWT_RLS_STORE_ISOLATION | Canonical Store memberships, Store IDs on Commerce, two real owners, same-tenant cross-store denial | BLOCKED |
| P0_COMMERCE_WRITER_AUTH_CONFIRM_IDEMPOTENCY | Legacy writer isolated, real identity & customer binding, trusted confirmation, atomic idempotent Commerce transaction, Published canary | BLOCKED |
| P0_AI_SQL_AND_SERVICE_ROLE_EXCLUSION | No LLM arbitrary SQL, no shared service_role, dedicated least-privilege DB role, agent→writer checks | BLOCKED |
| P0_BACKUP_RECOVERY_AND_INDEPENDENT_APPROVAL | Authorized backup receipt, independent restore, Controller/Security proof and rollback drill | BLOCKED |
| P0_RELEASE_PIPELINE_ENFORCEMENT | Explicit independent release approval, reviewed branch protection, deployment job wiring, separate promotion approval | BLOCKED |

- `evaluateRelease(snapshot)` is pure data validation and returns **NO_GO** on current evidence, with per-gate error codes.
- If ALL fields are manually set to true, it returns **PENDING_INDEPENDENT_ATTESTATION**, NEVER ALLOW. The metadata is untrusted and cannot certify real JWTs, backup or role rights.
- `assertReleaseAllowed()` ALWAYS throws `P0_RELEASE_GATED_NO_GO_EXTERNAL_SIGNED_AUTHORITY_REQUIRED`; **no code path** here can publish/merge/write/send.
- P1 remains explicit advisory: hosted per-Store rate + AI budget, exact Cloudflare protected entry route, provider webhook replay and secret rotation plan: all `NOT_VERIFIED`.
- Current snapshot is point-in-time and contains no JWT, secret, customer record, request headers or provider token.

## 3. TESTED — CI and negative regression
- 16 newly-authored P0 release-gate tests including P0 denial, forged all-green JSON, missing JWT cross-store proof, missing Store FK, legacy published write, no actual backup restore, missing protected deploy path, stale project metadata, P1 warnings and non-bypassable decision.
- Inherited PRE-ADV.6C P0/P1 negative 22 tests, ADV.6 verified identity 14, HMAC action 13, Owner Evidence 9, channel adapters 12, presentation 18.
- Workflow `v152-pre6c-p0-release-gate.yml` contains:
  - `p0-policy-contract-qa` — should be **SUCCESS** when tests and static NO-SEND checks pass.
  - `p0-release-eligibility` — intentionally returns **FAILURE** because current production release is NO-GO; THIS IS A POLICY DENIAL, **NOT** a failing unit test.
- **Neither job is currently a verified mandatory gate for deployment**. GitHub branch rules / production CI are not changed. A red release-eligibility job alone does not prove actual GitHub Pages, n8n or Supabase deployment is impossible.
- Report CLI: `node qa/v152-pre6c-security/p0-release-gate-cli.cjs --report` produces blocker codes; `--require-release` exits code 3 and cannot auto-promote.
- Mark PASS only after checking exact commit SHA / GitHub Actions run. Future unverified metadata cannot retroactively change this checkpoint.

## 4. SECURITY PRIORITY and operational recommendations
- P0: confirm caller inventory of `qa_shop_b_zalo_claim`, add verified provider webhook relay and durable replay, then change RPC rights with independent approval + canary; avoid breaking Zalo.
- P0: introduce Store-level data model / RLS in staging with verified tenant/store mapping and signed Owner A/B JWT proofs in private environment; never use service_role for RLS certification. No fake Store A/B records in customer DB.
- P0: isolate n8n legacy DEMO writers from Commerce live, introduce canonical writer with per-Store customer auth, explicit confirmation, price+stock authoritative lookups and single-DB-transaction idempotency; verify without changing Published.
- P0: prevent LLM arbitrary SQL and shared service_role; cap capabilities via independent server action allowlist, audited dedicated runtime roles, redacted events.
- P1: read-only inventory of exact Cloudflare route, token scopes, credential rotation; stage backend per-Store atomic quota and alerting before enabling paid model/tool actions.
- P0: stage approved encrypted backup and **independent restore test**, explicit security reviewer and Controller authorization with bounded scope, TTL and revocation; do NOT interpret checklist ticks as approval.

## 5. BLOCKED and approvals
NOT YET VERIFIED: actual Shop A/B hosted JWT+RLS tests, actual cleanup of RPC EXECUTE, n8n legacy tool isolation in Published, PG hosted atomic Commerce order+nonce transaction, production protection and release-policy wiring.
Requires separate explicit user/controller approval before: real backup export, database role/GRANT/RLS or SQL migrations, changes in n8n Published, Cloudflare WAF/rate rules, secret/credential rotation, billing, actual Meta/Zalo sends, merge or production deployment.

## 6. Rollback
Close the child Draft PR or revert branch commits. No hosted data changes or production deploy occurred; therefore no live database restore is needed. Only the external approved migration operator may run DB rollback after backups/recovery proof.

## 7. Checkpoint
Version: `V15.2-PRE-ADV6C-P0GATE-DRAFT`
Approved stage: **NONE**
CI stage: **offline test only; release eligibility NO-GO as designed**
Security ownership proof: **BLOCKED**
Commercial release: **BLOCKED**

## 8. Next action
**ADV.6C Authorized Private Evidence Intake**: independently collect and verify the missing proofs (no raw JWT/backup in conversation), reconcile each gate, request explicit approval for one operation at a time. Do not promote a Draft source-only policy to production until the controller, independent security reviewer and deployment owner approve and the gate is wired and tested on the relevant deployment paths.
