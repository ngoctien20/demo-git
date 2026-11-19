# TIEN404 AI — V18.3.6L QA Checkpoint

**Checkpoint:** `V18.3.6L-AUTH-KEY-THREAT-44501379042`  
**Date:** 2026-11-19 JST  
**Status:** `OFFLINE SECURITY DESIGN IMPLEMENTED/TESTED; HUMAN SECURITY REVIEW & REAL AUTH ADMISSION BLOCKED; PRODUCTION NO-GO`.

## Baseline
- Previous K Draft PR #442 OPEN DRAFT, HEAD `24d76901081bf6f56f1c353339cceac935d81322`; GitHub Actions run #44497091023 SUCCESS, 289/289 assertions + HMAC digest cross-runtime.
- New L Draft PR #444, branch `qa/v1836l-auth-revocation-key-custody-20261119`, base K branch.
- No merge, deploy, Auth credential change, billing action, message send or production transition.

## Verified connected-system baseline — strictly metadata only

Supabase staging `ifxlvrhyjhbzbrkdsida`, PG17.11:
- `auth.sessions` relation is present, PostgreSQL ordinary table (relkind=r), RLS enabled.
- Column **names only** confirmed: `id`, `user_id`, `not_after`, `created_at`, `refreshed_at`. **Zero session rows, identifiers or access tokens were read.**
- Public canonical `stores`/`store_memberships`: 0.
- `store_id` on six Commerce business tables: 0.
- Restrictive public Store policies: 0.

n8n published workflow metadata rechecked unchanged:
- Messenger `Z7FdV7uDvApfbURQ`: Published `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62`: Published `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR`: Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`; distinct Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.

## L implemented deliverables

1. `AUTH_REVOCATION_ARCHITECTURE_ADR.md`: compares live `auth.sessions` same-PG transaction, `getUser()` preflight, asynchronous event mirror, short leases, and a blocked gate. **Preferred candidate** is private **same-PostgreSQL-transaction** session + Store authority + nonce + scoped operation; no real proof/privileges/locks have been tested. RLS and named columns alone do not demonstrate correct session deletion/expiry semantics.
2. `PRODUCTION_KEY_CUSTODY_ADR.md`: Supabase Auth verifier and TIEN404 Ed25519 issuer vs K RPC signer; non-exportable managed signing key if actually supported by verified provider; DB public-key verification candidate vs separately approved protected DB HMAC; rotation and compromise recovery. **No KMS/HSM key created or touched.**
3. `GATEWAY_THREAT_MODEL_AND_CLOSURE.md`: 6 P0 OPEN, 3 P1 OPEN, exact negative cases and private evidence required before a *human* can close them.
4. `revocation-architecture.mjs`: synthetic timeline evaluator for before-check revocation, between-check-and-DB race, after-commit, stale/unknown state, Store revision and outage; outputs `productionAdmitted:false` and never authorizes a read/write/send.
5. `key-custody-proposal.mjs`: QA-only key-custody metadata validator, with strict segregation and no production signer, even for fully populated candidate package.
6. `gateway-threat-gate.mjs`: auditable P0/P1 evidence hash index, not a human security signoff; `verifiedThreatClosures:0`.
7. `test-security-architecture.mjs`: **51** offline tests and dedicated GitHub Actions CI; no runtime HTTP connections or provider secrets.

## Initial QA verified before this checkpoint commit

[GitHub Actions #44501379042](https://github.com/ngoctien20/demo-git/actions/runs/44501379042) / job `135481769980`: SUCCESS; log markers:
- `V18_3_6L_GHI_REGRESSION_164_PASS` — 164/164 inherited offline Node tests.
- `V18_3_6L_K_REGRESSION_30_PASS` — 30/30 K offline signed caller fail-closed.
- `V18_3_6L_ARCHITECTURE_SECURITY_51_PASS` — 51/51 new revocation, key custody and threat model tests.
- `V18_3_6L_STATIC_SCOPE_AUDIT_PASS` — documents and runtime code scope/secret/network scan.
- **245/245 numbered assertions PASS.** No failed test observed in job logs.

**This checkpoint file is added after the initial passing run. The FINAL HEAD needs its own passing CI before declaring final acceptance.**

## Unresolved critical findings — do NOT confuse design with implementation

- **L-P0-01:** Real Auth signout/revocation semantics and DB row-lock linearization unverified; `getUser()` before separate RPC or cache TTL does not ensure instant revocation.
- **L-P0-02:** Canonical Store authority and real same-Tenant independent Owner A/B absent.
- **L-P0-03:** Privileged gateway SQL caller ACL/SECDEF and anti-forgery unreviewed in actual Supabase; service-role bypass remains a risk.
- **L-P0-04:** K shared HMAC key is a public, synthetic CI fixture; production key custody/rotation and supported asymmetric verification unverified.
- **L-P0-05:** No independent second human reviewer signed security findings.
- **L-P0-06:** Provider installation, owner consent and media rights not verified.
- Three P1: ledger HA/PITR/retention, legacy RPC/function exposure, actual sensitive operation transaction binding.

Even a complete synthetic reviewer evidence packet may only return `READY_FOR_INDEPENDENT_REVIEW`, **not** P0 closed, live Auth verified, provider send permitted or production admitted.

## Gate decisions

| Gate | Decision |
|---|---|
| G/H/I and K offline regressions | VERIFIED 194/194 |
| L architecture safety review code | IMPLEMENTED / TESTED 51/51 |
| L Docs/threat register static audit | TESTED |
| Same-Postgres `auth.sessions` metadata presence | VERIFIED |
| Real transactional Auth signout/DB race | BLOCKED |
| Actual signer KMS/HSM key custody / key rotation | BLOCKED |
| Real privileged RPC ACL and Auth/Store A/B | BLOCKED |
| Independent human security approval | BLOCKED |
| Staging migration / real owner sessions / Commerce writer / provider send | NO-GO |
| Production deployment, merge as release | NO-GO |

## Risk, rollback, and next checkpoint

Risk of these QA-only changes is limited to Draft PR and offline CI. No linked runtime/DB modification, so no database rollback necessary; closing PR #444 safely abandons this candidate. No cost-incurring infrastructure was requested.

**Next proposed isolated step (separate approval if setting up hosted resources):**
`V18.3.6M — Disposable Auth Session DELETE Lock Rehearsal × Privileged SQL Grant Inventory × Crypto Verifier Compatibility Assessment`.
Use only a separate disposable PostgreSQL 17/Auth fixture. No real user session, credentials, service-role elevation, or production publish.
