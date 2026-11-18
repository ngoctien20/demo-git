# TIEN404 AI — V17.2C.40H S3 Consent-Path Guard × V21/V24 Candidate Integration QA

**Date:** 2026-11-18 JST  
**Parent:** V17.2C.40G  
**Draft PR:** #392  
**Tested code commit:** 1d52ae16d80cff2518a5a322e9baa2cc191e24f0  
**Status:** IMPLEMENTED / 20-TEST PASS / S3 DENY ENFORCED IN CANDIDATE WRAPPER / NOT DEPLOYED.

## 1. Purpose

S3 is the explicit current project decision. V40H adds a small source-only guard in front of the existing V17.2C.21 protected consent backend and V17.2C.24 HTTPS handler candidate.

The guard is intentionally deny-only while S3 is active. It does not unlock, create an owner consent, call the existing backend, issue a challenge, admit a reviewer, grant a Store or enable any route.

## 2. IMPLEMENTED candidate

Files:
- `qa/v172c-rpc-closure/v172c40h-s3-consent-path-guard.cjs`
- `qa/v172c-rpc-closure/v172c40h-s3-consent-path-guard.test.cjs`

Behavior:
- Requires a trusted server-side `getCurrentDecision` adapter and the candidate backend methods at construction.
- Accepts only the expected current S3 decision reference/version and exact locked, no-authority state.
- If S3 is valid, both `intake` and `reviewPair` return `DENY / OWNER_DECISION_S3_LOCKED`.
- If the decision snapshot is missing, mutated, stale, unlocked or unavailable, it returns DENY.
- Caller-supplied S1/S2, owner, role, Tenant, Store, session, provider or authority fields are ignored.
- Response contains only a generic status and reason.
- The wrapper object is frozen.
- The existing V21/V24 candidate files are not modified. The guard is not wired into a hosted route or production service.

## 3. Integration QA — no bypass through old candidate paths

The 20-test suite includes two integration-shaped tests:
1. Instantiates the existing V17.2C.21 dependency-injected backend with instrumented synthetic adapters, wraps it with the S3 guard and verifies that consent intake is denied before any trusted adapter is called.
2. Instantiates the existing V17.2C.24 Request/Response handler in memory with the S3 guard as its backend. A synthetic request to the old QA intake route receives a redacted HTTP 403; the V21 adapters are not called.

These tests prove the wrapper's source behavior only. They do not deploy V21/V24, register a webhook, open an HTTPS endpoint, use a real JWT or establish that a hosted route is guarded.

## 4. TESTED evidence

At tested code commit `1d52ae16d80cff2518a5a322e9baa2cc191e24f0`:
- V40H Node 22 suite: **20/20 PASS**.
- All 3 PR checks SUCCESS:
  - [Protected consent + V40H source tests](https://github.com/ngoctien20/demo-git/actions/runs/44267850431/job/134676720548)
  - [No-send source contract](https://github.com/ngoctien20/demo-git/actions/runs/44267850538/job/134676720408)
  - [Disposable PostgreSQL 17 + V40D/E/F/G regression](https://github.com/ngoctien20/demo-git/actions/runs/44267850563/job/134676720260)
- One initial V40H test syntax issue (unparenthesized async arrow fallback) was corrected; the rerun completed 20/20 PASS.

## 5. Current status and limitations

- **VERIFIED:** S3 remains the selected project decision; the current guard denies both owner consent and reviewer paths on the S3 snapshot.
- **IMPLEMENTED:** source-only S3 guard and V21/V24 in-memory integration-shaped tests.
- **TESTED:** 20/20 V40H tests PASS; all 3 PR checks SUCCESS.
- **NOT IMPLEMENTED:** real decision snapshot service, private HTTPS deployment, trusted Auth adapter, private session store, or live owner evidence.
- **NO-GO:** actual S1/S2 transition, Store grant, canonical alias resolution, real Auth A/B, Supabase DDL/RLS, n8n Published changes, Order writer, provider dispatch and production release.

The guard is not a cryptographic lock or runtime enforcement until it is integrated into a protected server and its decision source is verified. S3 remains protected by the project policy and Draft source review; no hosted deployment has been made.

## 6. Rollback

Revert the V40H guard, tests and workflow changes from Draft PR #392. No hosted runtime rollback is required. No Supabase schema/data/policy, credential, n8n Published workflow, webhook, customer record or provider message was changed.

## 7. Next checkpoint

**V17.2C.40I — S3 Governance & Change-Control Matrix × Guard Coverage Audit × Release/Revocation Decision Table.**

Before any future S1/S2 transition, map every path that can issue consent, approve a reviewer, resolve a Store, read/write an Order or dispatch a provider message to a server-side S3 gate. Preserve current S3 as default deny; no production activation until the private owner authority service, real owner evidence and independent release approval exist.
