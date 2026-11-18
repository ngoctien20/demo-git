# TIEN404 AI — V18.3.6H QA Checkpoint

**Checkpoint:** `V18.3.6H-PG17-NONCE-44296552716`  
**Date:** 2026-11-18 JST  
**Status:** `DISPOSABLE PG17 TESTED / OFFLINE TRUST CONTRACT TESTED / REAL AUTH A/B + HUMAN SECURITY REVIEW BLOCKED`

## Parent verified checkpoint

- V18.3.6G Draft PR #431, HEAD `425ec533e3b4777b4a9e81c2b1140d218c396694`.
- G CI run #44294471585 — 93/93 Node offline security tests PASS.
- V18.3.6H Draft PR #435 is based on the V18.3.6G branch.

## CI evidence before this checkpoint file

- [Run 44296552716](https://github.com/ngoctien20/demo-git/actions/runs/44296552716)
- Offline job `134774970199` — SUCCESS.
- Disposable PostgreSQL job `134774970496` — SUCCESS.
- Runtime Node 22; PostgreSQL 17.12, actual pgTAP extension.
- G regression: **93/93** PASS.
- H Trusted Session Adapter: **27/27** PASS.
- H independent signed-review evidence contract: **20/20** PASS.
- PostgreSQL 17 private durable nonce pgTAP: **34/34** PASS.
- Two simultaneous independent SQL connections using same JTI: exactly one ACCEPTED and one REPLAY; persisted row count exactly one — PASS.
- PostgreSQL **process/container restart**: consumed JTI persisted and remained REPLAY — PASS.
- Runtime module secret scan PASS.
- Combined assertions: **174/174 PASS**, plus 2 additional integration checks (concurrency and process restart).
- Verified job log markers:
  - `V18_3_6H_G_REGRESSION_93_PASS`
  - `V18_3_6H_TRUSTED_SESSION_ADAPTER_27_PASS`
  - `V18_3_6H_SIGNED_REVIEW_EVIDENCE_20_PASS`
  - `V18_3_6H_PG17_NONCE_34_PASS`
  - `V18_3_6H_CROSS_CONNECTION_ATOMIC_REPLAY_PASS`
  - `V18_3_6H_RESTART_PERSISTENCE_REPLAY_PASS`
  - `V18_3_6H_SOURCE_SECRET_SCAN_PASS`

## Implementation

- `trusted-session-adapter.mjs`: server-side callback contract for JWT signature/issuer/audience, Auth user, active private session and exact Store membership. No real Supabase Auth client or real signed JWT ever used.
- `test-trusted-session-adapter.mjs`: 27 synthetic tests including integration with G ephemeral Ed25519 issuer. Uses `OFFLINE-NOT-JWT` markers, not access tokens.
- `01_NONCE_PG17_DISPOSABLE.sql`: real PostgreSQL 17 ledger with `PRIMARY KEY(issuer,jti)`, privileged narrow function, `ON CONFLICT DO NOTHING`, private schema and zero direct table rights to caller.
- `02_PGTAP_NONCE.sql`: 34 actual PostgreSQL pgTAP checks.
- `independent-security-gate.mjs` and test: 20 negative tests for signed review evidence, reviewer!=implementer, P0 closure, expiry, real Auth and staging schema prerequisites. It **never** returns production admitted.
- 3 design/security guides plus README and dedicated workflow.

## Real connected-system read-only inventory

Supabase staging `ifxlvrhyjhbzbrkdsida` remains PostgreSQL **17.11**, with:
- 0 canonical `stores`/`store_memberships` tables.
- 0 `store_id` columns across six Commerce tables.
- 0 restrictive public Store policies.
- Previously verified public Products 2 and Orders 2.

n8n Published versions unchanged:
- Messenger `Z7FdV7uDvApfbURQ`: `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62`: `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR`: Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`, distinct Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.

## Independent review findings and blockers

- The session adapter delegates cryptographic JWT verification to an injected trusted server callback and DOES NOT itself connect to Supabase. No real session ID or access token was read or validated.
- Source G contains a synthetic `.invalid` Supabase Auth issuer; H unit integration uses it intentionally and does not authorize deployment as a live issuer.
- PostgreSQL nonce function only stores a verified JTI and digests; it DOES NOT check Ed25519 itself and has no integrated real private issuer. Calling it without a signature-verified gateway would be unsafe.
- G's current nonce callback only passes JTI/expiry; binding H's full signed claim context still requires a separately reviewed trusted adapter.
- Token/issuer key management, actual Supabase session revocation lookups, real Store membership grants, owner/media/provider consent, distributed availability, nonce retention/cleanup, managed backup/PITR and production privileged gateway are not proven.
- Review-signature tests use ephemeral reviewer keys. A cryptographically valid test signature is NOT a real independent human reviewer. There is no independent human signoff.
- PostgreSQL process restart persistence is proven inside the disposable container; multi-zone disaster recovery and real hosted database persistence are NOT proven.
- No schema or workflow mutations in Supabase/n8n/Cloudflare, no customer PII/Auth token/credential, no provider message or real Commerce write.

## Gate decision

| Gate | Status |
|---|---|
| G offline regression | VERIFIED 93/93 |
| H trusted session adapter contract | IMPLEMENTED / TESTED 27/27 synthetic |
| H offline independent-review evidence gate | IMPLEMENTED / TESTED 20/20 |
| H PostgreSQL 17 durable nonce | IMPLEMENTED / TESTED 34/34 |
| H concurrent nonce and PG process restart | TESTED / PASS |
| Real Supabase Auth JWT and session verification | BLOCKED |
| Same-Tenant real Owner A/B | BLOCKED |
| Real independent human security review | BLOCKED |
| Real key issuer / distributed nonce / production gateway | BLOCKED |
| Staging DDL / backfill / live Commerce writer / provider send / release | NO-GO |

## Rollback and next gate

Container `tien404-v1836h-pg17` was removed by CI; rollback on linked systems is unnecessary since they were not modified. Closing the Draft PR and archiving QA evidence is the safe candidate rollback. Next work should focus on a protected, no-host real-session verifier design, backend key custody and independent reviewer preflight, without production access.

**Caution:** this file was committed after the first successful run; re-check the newest CI run on the final commit before declaring a final-HEAD PASS.
