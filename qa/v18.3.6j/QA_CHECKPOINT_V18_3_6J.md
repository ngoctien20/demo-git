# TIEN404 AI — V18.3.6J QA Checkpoint

**Checkpoint:** `V18.3.6J-TXN-READ-PG17-20261118`  
**Date:** 2026-11-18 JST  
**State:** `CANDIDATE / PG17 TRANSACTIONAL READ TESTED / REAL AUTH ADMISSION BLOCKED`

## Parent checkpoint
- V18.3.6I Draft PR #438, head `d8536cac0426752436b33ce0959593b7d603ff07`.
- Parent I CI run #44315063550 SUCCESS: 206/206 combined assertions and 5 integration races.
- J Draft PR #439, base `qa/v1836i-issuer-nonce-race-admission-20261118`.

## Files implemented
- `01_PG17_TRANSACTION_READ.sql`: private PG17 same-transaction synthetic read; locks catalog resource, session row and Store membership; verifies Store/capability, expiry, revision and consumes JTI before return of catalog data. SQL does NOT verify Ed25519, and remote Auth revocation is not atomic with local registry.
- `02_PGTAP_READ_RPC.sql`: 50 PostgreSQL 17 pgTAP assertions for role grants, same-Tenant Store A/B, wrong tenant, revoked/stale/missing session and membership, wrong capability, nonce replay and demonstrable external Auth event propagation lag.
- `EXTERNAL_AUTH_REVOCATION_REVIEW.md`: external Auth stale/local inconsistency P0.
- `PRIVILEGED_RPC_ISOLATION_REVIEW.md`: SECURITY DEFINER grant boundary, same-transaction read and limitations.
- `README.md` and GitHub Actions workflow `tien404-v1836j-txn-read.yml`.
- Two inherited QA tests in `qa/v18.3.6g/test-signed-authority.mjs` and `qa/v18.3.6h/test-independent-security-gate.mjs` modified solely to make signature tampering deterministic; runtime implementation unchanged.

## Verified CI evidence before checkpoint file

- Run #44317092544: offline G/H/I regression 164/164 PASS; PostgreSQL schema failed at `GRANT EXECUTE` due to incorrect function signature (fixed).
- Run #44317290847: PostgreSQL pgTAP 49/50 PASS; missing session had imprecise `DENY_SESSION_PROOF_STALE` classification (fixed).
- Run #44317526650: offline regression 164/164 PASS; PostgreSQL pgTAP 50/50 PASS and three read/revocation transaction checks passed; parallel read race exposed a lock-upgrade deadlock possibility from J `FOR SHARE` followed by I `FOR UPDATE` (fixed by taking `FOR UPDATE` on session from the beginning).
- Run #44317821585: PostgreSQL job **SUCCESS**: 50/50 pgTAP PASS and all four integration acceptance steps PASS. Offline regression 162/164 due to pre-existing random test tampering that sometimes left signature unchanged (fixed with deterministic first-character mutation in test code).
- Final GitHub Actions on the **last commit** must be checked separately before declaring combined 214/214 PASS.

## Reviewed PostgreSQL test markers
- `V18_3_6J_PG17_READ_RLS_50_PASS`
- `V18_3_6J_SESSION_REVOKE_FIRST_READ_DENIED`
- `V18_3_6J_MEMBERSHIP_REVOKE_FIRST_READ_DENIED`
- `V18_3_6J_READ_FIRST_REVOKE_SECOND_ORDERED`
- `V18_3_6J_CONCURRENT_CATALOG_SINGLE_USE_PASS`

## Verified production/staging read-only inventory
- Supabase staging project `ifxlvrhyjhbzbrkdsida` PostgreSQL 17.11.
- `public.stores` and `public.store_memberships`: 0.
- `store_id` across six Commerce tables: 0.
- Restrictive Store RLS policies: 0.
- Products: 2; Orders: 2 (aggregate-only, no row PII).
- Messenger Published: `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot Published: `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core Published: `456862c9-e5ee-4bfa-9931-47dbc39ab73d`; separate Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.
- No connected system writes, order/stock/customer data reads, JWT/session inspection, provider sends, credential operations or production deployments.

## Security findings and explicit NO-GO

**P0: External Supabase Auth revocation consistency not solved.** A fixture inserts an external sign-out event without updating the local session registry; RPC still returns a catalog item. This test PASS demonstrates a critical **remaining hazard**, not safe live behavior.

**P0: RPC does not verify Ed25519 itself.** An executor with EXECUTE can forge hash-shaped arguments when local fixture member/session match. The credential and secure issuer boundary must be built and independently reviewed for real integration.

- SECURITY DEFINER function owner can bypass RLS on its owned data. RLS on catalog table is not enough; explicit Store filters, narrow function grants and private schema remain mandatory.
- All sessions, memberships, catalog items and provider contexts in J are synthetic.
- No independent human security reviewer has signed or approved these changes.
- No hosted private issuer, real session verifier, canonical Store staging schema, privileged real gateway, protected read of customer records or atomic Commerce writer is implemented.
- Owner/Media/Provider consent and same-Tenant real Owner A/B proofs remain BLOCKED.
- Database process restart/persistence was proven in predecessor H/I, but no new J restart test was run.
- Two inherited QA test-only fixes do NOT promote G/H runtime code.

## Gates
| Gate | Status |
|---|---|
| J transaction-bound synthetic catalog read | IMPLEMENTED / PG17 TESTED |
| J pgTAP 50 negative/positive tests | VERIFIED PASS on run #44317821585 |
| J four PostgreSQL concurrent acceptance tests | VERIFIED PASS on run #44317821585 |
| G/H/I inherited unit regression | PASS in earlier runs; deterministic correction pending final CI |
| External real Supabase Auth revocation consistency | BLOCKED |
| Real signed private issuer and protected RPC caller | BLOCKED |
| Independent human security review | BLOCKED |
| Staging migration, real Auth A/B, production read/write, provider send | NO-GO |

## Rollback
Test Docker container removed in CI. No Supabase/n8n/Cloudflare production/staging changes, so no connected-system rollback. Close Draft PR #439 to discard this candidate safely.

**Final-step requirement:** After adding this file, verify the newest PR HEAD and its own GitHub Actions run. A passing earlier SHA does not prove the final checkpoint commit passed.
