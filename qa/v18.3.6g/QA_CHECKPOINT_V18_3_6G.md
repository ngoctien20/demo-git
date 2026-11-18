# TIEN404 AI — V18.3.6G QA Checkpoint

**Checkpoint:** `V18.3.6G-ED25519-44294243499`  
**Date:** 2026-11-18 JST  
**Status:** `OFFLINE CRYPTO TESTED / AUTOMATED SECURITY REVIEW PASS / INDEPENDENT HUMAN REVIEW BLOCKED / REAL AUTH A/B BLOCKED`

## Predecessor

- V18.3.6F Draft PR #425, head `daee41076c02d16c7ff902db600a407e8e44f429`.
- F PostgreSQL 17.12: 61/61 regression + 87/87 F pgTAP + two concurrent checks SUCCESS, final run #44283163973.
- G Draft PR #431, branch `qa/v1836g-private-signed-authority-preflight-20261118`, base V18.3.6F branch.

## Verified QA evidence before checkpoint commit

- GitHub Actions run [44294243499](https://github.com/ngoctien20/demo-git/actions/runs/44294243499) / job `134767008374` — SUCCESS.
- Node.js 22.23.4, native crypto only, no package installation.
- `test-signed-authority.mjs`: **60/60 PASS**, actual ephemeral Ed25519 sign/verify, strict kid/alg/typ, issuer/audience, session HMAC binding, Store/capability, membership revision, TTL, bad signature, revoked/expired membership, nonce replay and concurrent double redemption.
- `test-real-auth-ab-preflight.mjs`: **15/15 PASS**, redacted evidence checklist including different reviewer/implementer evidence hashes. Actual staging metadata results in BLOCKED; a synthetic fully populated checklist returns READY_FOR_PRIVATE_REVIEW only, not ADMITTED.
- `test-independent-structural-review.mjs`: **18/18 PASS**, deterministic second-pass static review of actual predecessor F and new G code. It identifies F BYPASSRLS and synthetic attestation as live blockers, not evidence of their resolution.
- Runtime-module secret scan PASS; no private keys, static service-role key or credentials in issuer/preflight code.
- The first G CI run #44293811377 passed all 92 initial tests but failed the scanning step because the scan included the test suite's own literal detection regexes. Scanner restricted to runtime modules; second run #44293946883 passed all steps.
- A further reviewer/implementer independence guard and fifteenth preflight test were added and run #44294243499 passed all steps.

## Connected live system read-only recheck

Supabase staging `ifxlvrhyjhbzbrkdsida`:
- PostgreSQL 17.11.
- Canonical `stores` and `store_memberships` tables: 0.
- Commerce `store_id` columns across six business tables: 0.
- Public restrictive policies: 0.
- Public Products: 2; Orders: 2.

n8n Published versions remain unchanged:
- Messenger workflow `Z7FdV7uDvApfbURQ`: `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62`: `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR`: Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`, Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.

No real Auth session or JWT was accessed, and no Supabase DDL/DML, customer-data read, workflow mutation, webhook or provider send took place.

## Findings and blockers

- 16 evidence-based security findings recorded in `SECURITY_REVIEW_FINDINGS.md`; critical P0 blockers include absent real Auth session verification, direct BYPASSRLS path, synthetic boolean consent/attestation and missing canonical Store authority.
- New issuer uses actual cryptographic Ed25519 test signatures but synthetic callbacks, ephemeral private keys and local in-memory nonce fixture. No actual protected Auth adapter, real issuer deployment or durable nonce store exists.
- G does not implement actual server API nor provider installation verification and is read-only. No order write, inventory change or provider send exists in G.
- Automated second-pass source review is not an independent human security audit. Independent reviewer approval, identities/consent, tenant/Store and live session evidence remain missing.
- A new Store grant cannot be inferred from the two synthetic R1 QA bots mapped to different Tenants.
- No cross-Tenant or same-Tenant real Auth A/B UAT has been performed.

## Gate decisions

| Gate | Decision |
|---|---|
| G offline Ed25519 sign/verify | IMPLEMENTED / TESTED |
| G negative crypto/replay suite | 60/60 PASS |
| G redacted real Auth A/B preflight unit suite | 15/15 PASS |
| G automated structural review | 18/18 PASS |
| G private real session verification | BLOCKED |
| G independent human security approval | BLOCKED |
| G real provider/Store signed issuer | BLOCKED |
| G durable production nonce / service-role gateway | BLOCKED |
| G staging DDL, legacy backfill, production writer, provider send | NO-GO |

## Release and rollback

- Draft PR #431 must remain OPEN DRAFT and not be merged as migration/release authorization.
- No connected production/staging system was changed. Rollback = close draft PR; no database rollback necessary.
- Before considering private real Auth A/B UAT: obtain explicit approval for additive Store schema and backup/restore, independent real Owners, private server Auth adapters, reviewer sign-off, protected issuer, durable nonce and same-Tenant cross-Store negative evidence.

**Caveat:** This checkpoint describes the preceding verified run. If this checkpoint file itself triggers a newer GitHub Actions run, the final commit must be checked again before reporting CI PASS on that commit.
