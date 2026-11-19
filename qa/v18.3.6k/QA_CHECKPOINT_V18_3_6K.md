# TIEN404 AI — V18.3.6K QA Checkpoint

**Checkpoint:** `V18.3.6K-EXTERNAL-AUTH-SIGNED-RPC-44496366238`  
**Date:** 2026-11-19 JST  
**Status:** `OFFLINE + DISPOSABLE PG17 TESTED / LIVE AUTH A/B BLOCKED / PRODUCTION NO-GO`

## Baseline
- Predecessor V18.3.6J Draft PR #439, final HEAD `6a91050fdf268ec0efe3166edcd609a59eaf3987`, had no verified GitHub Actions run associated with its final commit. Earlier J PostgreSQL 50/50 and concurrency checks had passed on intermediate runs. K explicitly re-runs J 50/50.
- K [Draft PR #442](https://github.com/ngoctien20/demo-git/pull/442), base `qa/v1836j-transaction-read-rpc-20261118`; branch `qa/v1836k-external-auth-signed-rpc-20261119`. **Unmerged.**

## Verified CI — run on predecessor-to-checkpoint commit
- [GitHub Actions #44496366238](https://github.com/ngoctien20/demo-git/actions/runs/44496366238) completed **SUCCESS**.
- Offline job `135464441853` completed SUCCESS.
- PG17 job `135464442301` completed SUCCESS.
- **G/H/I** inherited Node regression **164/164 PASS**; two inherited signature-tampering tests were stabilized in J, no G/H runtime code changes in K.
- **K** fresh external Auth verdict and signed RPC caller Node.js **30/30 PASS**.
- **J** actual PostgreSQL 17.12 same-transaction catalog read regression **50/50 PASS**.
- **K** actual PostgreSQL 17.12 signed RPC, key-grant isolation, expiry and revocation tests **45/45 PASS**.
- **TOTAL 289/289 numbered assertions PASS**.
- Node-generated synthetic HMAC accepted by the actual PG17 K RPC **1/1 PASS**.
- Verified log markers: `K_GHI_164_PASS`, `K_OFFLINE_30_PASS`, `K_J_PG17_50_PASS`, `K_SIGNED_PG17_45_PASS`, `K_NODE_POSTGRES_MAC_BRIDGE_PASS`.
- No failed Node assertion, pgTAP `not ok`, pgTAP failure summary or SQL ERROR seen in successful job logs.
- Disposable PostgreSQL Docker container `tien404-v1836k-pg17` started with `--network none`, no exposed port and removed after CI.

## Implemented
- `fail-closed-signed-rpc.mjs` composes the offline G Ed25519 + I token/nonce verifier with a fresh, server-owned, synthetic external Auth session check. Fail closed on revoked, stale, malformed, wrong-scope, timeout, outage and missing proof. No RPC called when external proof fails.
- The verified nonce, subject/session/Store hashes and exact resource are HMAC-SHA256-bound into one read-only RPC proof. The `K1` message format is shared between Node and PostgreSQL; one CI test proves byte-level cross-language compatibility.
- `01_PG17_SIGNED_RPC.sql`: private disposable `qa_k_private` signer registry with synthetic test-only key, pgcrypto HMAC check inside SECDEF read-only function, fixed narrowly-scoped NOLOGIN `tien404_k_rpc` role with EXECUTE only, no direct table data grants. Closes predecessor I/J EXECUTE grants **only within disposable database**.
- `02_PGTAP_SIGNED_RPC.sql`: 45 actual pgTAP assertions covering caller grants, wrong Store/tenant/subject/session, revoked signer key, forged MAC, stale external proof, nonce replay, and two remaining P0 scenarios.
- `qa-cross-runtime-proof.mjs`: synthetic Node HMAC proof consumed by PG17.
- `AUTH_REVOCATION_PRODUCTION_GATE.md`: retained production security blockers.
- Dedicated CI workflow `tien404-v1836k-failclosed-signed-rpc.yml`.

## Read-only connected-system audit after successful CI

Supabase staging `ifxlvrhyjhbzbrkdsida`:
- PostgreSQL `17.11`.
- Public canonical `stores`/`store_memberships`: **0**.
- `store_id` across six Commerce tables: **0**.
- Public restrictive RLS policies: **0**.
- Aggregate Products **2**, Orders **2** (no row PII accessed).

n8n read-only Published versions unchanged:
- Messenger `Z7FdV7uDvApfbURQ`, Published `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62`, Published `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR`, Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`, separate Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.

No Supabase schema/data changes, Auth user/token/session reads, n8n workflow modifications, provider sends, credential edits, customer record reads or operational Commerce writes.

## Security limitations: DO NOT MISINTERPRET GREEN CI

1. **P0 — Real Supabase Auth revocation still unproven.** A fresh session check occurs before SQL RPC, but it cannot be in the same atomic transaction as external Auth logout. The K pgTAP fixture deliberately records a remote logout not propagated to the local session mirror and still observes `ALLOW_CATALOG`. It is a negative security finding, not successful real-world revocation protection.
2. **P0 — Signer trust anchor synthetic.** K SQL's HMAC key `repeat('K',64)` is a nonsecret fixture **committed for QA tests only**. It is unsafe to deploy. Live issuer signing-key custody and real authenticated transport have not been implemented.
3. **P0 — No live Auth / Owner A/B evidence.** The JS adapter consumes mocked trusted callbacks; no real Supabase Auth server, actual `auth.sessions`, independent Store Owner consent or same-Tenant A/B private session was verified.
4. **P0 — Staging canonical Store schema absent**, so there is no actual multi-Store Store-RLS admission.
5. **P0 — No independent human security reviewer** signed off.
6. SECURITY DEFINER is privileged. QA grants are narrow, but production ACL/default grants, exposed API schemas, service_role/BYPASSRLS and key rotation must be audited independently.
7. A 2–3-second freshness window only bounds the **age** of a decision. It does not guarantee immediate session revocation or prevent a logout after the check.
8. Postgres nonce and all Store authority rows are synthetic; no real Catalog/Orders/Customers/Inventory, provider installation or notification was queried.

## Gate decisions

| Gate | Result |
|---|---|
| G/H/I regression Node QA | TESTED 164/164 |
| J PG17 transactional-read regression | TESTED 50/50 |
| K offline Auth fail-closed/HMAC | IMPLEMENTED / TESTED 30/30 |
| K PG17 private signed RPC | IMPLEMENTED / TESTED 45/45 |
| K Node→PG17 MAC binding | TESTED PASS |
| Independent real human review | BLOCKED |
| Real Supabase Auth A/B | BLOCKED |
| Immediate external Auth revocation consistency | BLOCKED P0 |
| Production signing key and protected RPC caller | BLOCKED |
| Canonical Store migration / live order read-write / provider send | NO-GO |
| Release/merge | NO-GO |

## Rollback and next checkpoint

- PR remains DRAFT and unmerged. Rollback by closing PR #442; no linked environment rollback necessary.
- The disposable PostgreSQL container was removed by CI.
- Next safe gate: independent threat-model review of remote Auth source-of-truth semantics and real key custody proposal, **without** live session access; require separate authorization for staging schema migration or any real Auth A/B verification.

**Final-HEAD condition:** This checkpoint file is committed *after* CI run #44496366238. Before claiming the checkpoint SHA is CI-accepted, verify GitHub Actions run on the new final commit and repeat 289/289 + bridge checks.
