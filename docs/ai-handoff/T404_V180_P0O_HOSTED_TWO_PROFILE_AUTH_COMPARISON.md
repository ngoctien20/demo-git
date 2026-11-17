# TIEN404 AI — V18.0-P0O Two-Profile Auth Owner Local Comparison — Staging Acceptance

**Date:** 2026-11-18 JST. **State:** IMPLEMENTED/STAGING LIVE; SOURCE TESTED; HOSTED CHROMIUM TESTED SYNTHETIC; REAL AUTH JWT A/B NOT RUN; CANONICAL STORE AUTH NO-GO.

## 1. Deployed scope and provenance

- Authorized Render staging `tien404-auth-staging` `srv-dbpj4irm8hqs73e2h2rg` branch `work/supabase-auth-staging-v1`, autoDeploy OFF.
- Previous verified live P0M runtime: `dep-dbu9u4tbedkc7397p880`, commit `58be5940d18aa5e8fe213a524383bf4bf628421f`.
- Current **LIVE** Render deploy: `dep-dbubajafngtc73c8thdg`, commit `e993a23e3cb6b3abbea89ee13878162cfaf4e716`.
- Current Auth staging **source/test HEAD** after postdeploy QA-only edits: `f834a81c9c81de65e3062c4b9c2183f0140816e9`; because autoDeploy OFF, current runtime remains `e993a23...`. These are intentionally different and no redeployment is needed for QA-only source/test commits.
- Changes from earlier P0N source checkpoint `42e7afc5dadbcc649fa7311b83588c75a54d3a4f`: only `auth-evidence.html`, `assets/private-auth-evidence-core.mjs`, `assets/private-auth-evidence-ui.mjs`, unit tests and GitHub Actions. Login/account/auth-client/merchant portal unchanged. No Supabase or n8n changes.

## 2. What P0O added

- The two existing QA actors can perform `getUser()` / `getClaims()` / subject-scoped tenant-owner RLS SELECT independently in their own authenticated browser profiles.
- The app produces a short-lived **user-copyable pseudonymous JSON receipt**, containing only a random one-time comparison nonce, an HMAC-encoded actor fingerprint, HMAC-encoded owner tenant identifiers and creation time. No raw email/user ID/tenant UUID/session ID/JWT and no client key or credentials are exported.
- Actor B copies the local receipt and pastes it into the comparison field in Actor A's browser. A clicks **Đối chiếu hai tài khoản**. Local check requires distinct actor fingerprints, a shared owner-tenant fingerprint, the same nonce, valid schema and timestamp age <= 30 minutes.
- `SAME_ACTOR_FINGERPRINT`, `NO_COMMON_OWNER_TENANT`, invalid nonce/JSON, stale or oversized receipts all fail closed. Output is explicitly an **UNSIGNED LOCAL INDICATION**, never official server/session revocation or Store A/B proof.
- Clipboard is accessed only on an explicit click, using `navigator.clipboard.writeText` with manual selection fallback. No collection endpoint, persistence, provider send or data mutation.

## 3. Independent QA

- Source CI [#44166765670](https://github.com/ngoctien20/demo-git/actions/runs/44166765670) **SUCCESS**, **18/18 PASS**, code scan and Render static preview build PASS. Prior source CI failed due to regex escaping in CI; repaired before deployment with commit `e993a23...`.
- After Render deployment, real HTTPS Chromium test [#44167411280](https://github.com/ngoctien20/demo-git/actions/runs/44167411280) **SUCCESS**. Ran actual deployed UI at desktop and mobile viewport with separately isolated **synthetic Auth client modules**. Positive local comparison for two separate subjects/same tenant; negative comparisons for same actor, different tenant and malformed JSON; no raw identifiers on screen, no HTTP write requests, no real JWT or login. First browser CI attempt had an incorrect malformed-fixture length; test fixture corrected and rerun to PASS.
- Actual Render deployment status verified independently LIVE. Read-only Supabase staging metadata still shows **zero canonical public `stores` and `store_memberships` tables, zero Store columns on seven Commerce tables**.

## 4. Real operator flow — next external gate

1. **Only authorized QA owners** in two existing separately authenticated browser profiles visit `https://tien404-auth-staging.onrender.com/auth-evidence.html`. Owner A leaves nonce blank and clicks the read-only check after consent; the app generates a one-time code.
2. Owner B enters the same code, explicitly consents and runs their own read-only check. On success, B clicks **Sao chép biên nhận**; it contains pseudonyms only, not real identities or tokens.
3. In Profile A paste B's receipt into **Dán biên nhận từ hồ sơ trình duyệt còn lại**, click **Đối chiếu hai tài khoản**. Local expected message: **ĐỐI CHIẾU CỤC BỘ ĐẠT**. If blocked, share only the reason code, not receipts, fingerprints, nonce, passwords, JWTs or personal screenshots.
4. The founder previously confirmed the accounts are different. Do not repeat that question; the requested new evidence is distinct verified Auth subjects with shared owner-tenant membership, not account labels.

## 5. Security, rollback and next gates

- Page is a **public static shell** on Render with universal IP allowlist. `noindex` is not access control; user Auth and Supabase RLS gate data. HMAC receipt is not cryptographically authenticated to an independent server and is **not** sufficient for privileged actions.
- Canonical public Store Registry and memberships are not yet deployed, real signed JWT dual-owner server correlation and 31 hosted Store A/B negative UAT scenarios **NOT RUN**. Production, actual order write/send, native Meta/Zalo notifications, Store grants and host RLS migration NO-GO.
- Changes confined to authorized staging; no Auth account creation, password reset, credential access, Supabase DDL/DML, customer data access, n8n publish or production merge. M0 backup/restore evidence deferral continues for source-only/read-only/disposable; hosted DB changes would require separate explicit consent and rollback verification.
- **Rollback:** previous LIVE staging deploy `dep-dbu9u4tbedkc7397p880` is the safe post-P0M baseline; revert only isolated P0O changes in Auth staging branch, rerun CI and trigger exactly one Render deployment with autoDeploy OFF if rollback is required. No force push; no DB rollback needed now.

**Checkpoint:** `P0O_RENDER_LIVE / 18_OF_18_SOURCE_UNIT_PASS / DESKTOP_MOBILE_HOSTED_SYNTHETIC_PASS / PRIVATE_REAL_ACTOR_AB_PENDING / CANONICAL_STORE_NO_GO / PRODUCTION_NO_GO`.
