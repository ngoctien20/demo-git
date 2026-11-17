# TIEN404 AI — V18.0-P0J Private Real Auth Session Evidence × Canonical Store Owner Binding Readiness

**Date:** 2026-11-18 JST. **Status:** VERIFIED_AGGREGATE_READ_ONLY / USER_ATTESTED_TWO_DIFFERENT_ACCOUNTS / BROWSER_LOCAL_PROBE_IMPLEMENTED_SOURCE_ONLY / SERVER_REAL_AUTH_AB_NOT_RUN / STORE_AUTH_NO_GO.
**Source:** Continue existing Draft PR #385 and checkpoint Issue #368. No new PR, credentials, hosted Auth changes, customer data or provider messages.

## 1. Verified source/tenant Auth facts

Read-only Supabase staging project `ifxlvrhyjhbzbrkdsida` confirms one tenant with 2 eligible confirmed owner accounts. **Both** have registered email identities and configured password credentials. **Only 1/2** currently has an `auth.sessions` row, while 1/2 has a recent sign-in marker. The `auth.audit_log_entries` table contains zero rows and cannot corroborate the second sign-in. None of these facts exposes accounts, users, email, passwords, session IDs, IPs or tokens.

The founder has specifically confirmed that there are **two different accounts**. Treat this as `USER_CONFIRMED_DISTINCT_ACCOUNTS`; do not ask the founder to re-check whether accounts differ. It is **not yet independently verified** that both authenticated browser sessions correspond to the two eligible owner identities under the *same intended tenant*. Do not call either party wrong, and do not invent a cause for the session-record mismatch.

Deployed Render Auth commit `b14501a0ebf04d991302cb32b5d548a68d6b39bd` already provides `/assets/auth-client.js` exporting `getAuthClient()`, `auth.getUser()`, and UI lookup of tenant-scoped `tenant_memberships`. Supabase JS version 2.119.0 supports `auth.getClaims()`, but the **currently deployed account page does not call it**. P0H source helper was not deployed. The P0J diagnostic runs only in the user's private authenticated browser: it **does not require a Render deploy**.

**Canonical Store Authority remains absent:** no public `stores` or `store_memberships`, and zero `store_id` across seven checked Commerce tables. Do not infer Store A/B binding from `tenant_memberships` owner role.

## 2. One-time browser-local operator verification (minimal private evidence)

**Scope:** The founder already confirmed two separate accounts. Continue in those two existing, independently controlled browser profiles only; do not create more accounts, reset passwords or generate new permissions. Do not use customer data or click Products/Orders/pairing or send messages.

1. Open `https://tien404-auth-staging.onrender.com/account.html` in Profile A, which is already signed in. In Chrome, press `Ctrl+Shift+J` to open the page's Developer Console. Review the exact source in your own repository `qa/v180-p0j/private-browser-auth-owner-probe.js` before executing it. Copy the script and paste it into this **trusted Render origin's** console only. The script will refuse other origins or login page.
2. Confirm the on-screen explicit private QA consent prompt. In the nonce prompt, leave blank **only in Profile A**; it creates a one-time random UUID. It checks Auth server identity with official `getUser`, verified claims with official `getClaims`, and performs a **single subject-filtered SELECT** on `tenant_memberships` under existing RLS. It will print status `LOCAL_AUTH_AND_TENANT_OWNER_READ_OK` or `BLOCKED` and only cryptographic HMAC fingerprints; no raw ID/email/JWT/session/token.
3. In Profile B, open the same `account.html`, review/reuse the same source script in Developer Console. Give private consent and **paste the one-time nonce from A** into the prompt in B. This makes ephemeral pseudonymous fingerprints locally comparable. Do not paste the nonce or fingerprints into ChatGPT, GitHub, logs or public channels.
4. Privately compare the two outputs: `status=LOCAL_AUTH_AND_TENANT_OWNER_READ_OK` in both; `actorFingerprint` **must differ**; `tenantOwnerFingerprints` must share at least one common fingerprint. This establishes a **local-browser indication** of two different subjects holding owner membership in at least one same tenant for the same one-time nonce. It is still NOT an independently signed backend attestation.
5. Return only the non-identifying summary: `A_AUTH_OK / B_AUTH_OK / SAME_TENANT_OWNER=YES / DIFFERENT_SUBJECT=YES` (or `BLOCKED` for the failed item). No screenshot with PII, token, nonce or fingerprint required. If the two results disagree, stop and do **not** try service_role, token copying, account resets, role changes, new registrations or database writes.

### Why the probe is bounded

- `qa/v180-p0j/private-browser-auth-owner-probe.js` hard-pins the Render origin and `/account.html` route. The only operations it calls are existing `getAuthClient`, `auth.getUser`, `auth.getClaims` and a scoped `tenant_memberships` SELECT.
- Client-side `getClaims` verifies signature/claims per the Supabase SDK behavior, and `getUser` consults Auth server; **this is not a direct independently audited session revocation guarantee**. The script does not itself query `auth.sessions` or prove the consent for either account.
- A fresh random nonce keys HMAC-SHA256 derivation of only the authenticated UUID subject and tenant UUIDs; no unhashed identifiers or session ID leave the browser. Never treat the browser-computed fingerprints as owner authority, a server-signed receipt or a substitute for canonical Store Registry.
- `canMigrate=false`, `canSend=false`, `canPublish=false` are hard-coded. No real signed Meta/Zalo provider UAT or Store A/B negative tests execute here.

## 3. Trusted Store Owner Binding readiness

| Gate | Requirement | P0J conclusion |
|---|---|---|
| QA-1 | Two authorized QA accounts controlled independently | Founder confirmed two different accounts; private consent records still incomplete |
| QA-2 | Two live `getUser/getClaims` sessions from correct staging project | Local operator probe ready but **NOT RUN** |
| QA-3 | Distinct Auth subjects, same tenant active owner role | Can be locally checked via one-time HMAC, independent server validation still NOT RUN |
| QA-4 | Actual canonical `(tenant UUID,store UUID)` registry | **ABSENT** in hosted staging |
| QA-5 | Independent verified user-to-Store A/B ownership and revocation | **NOT ATTESTED** |
| QA-6 | Non-bypassable Store-scoped RLS/RPC and same-Store FKs | Disposable P0D candidate tested, hosted **NOT DEPLOYED** |
| QA-7 | Verified backup and restore + independent approval for hosted changes | M0 proof DEFERRED **only for source-only/disposable** |
| QA-8 | Real Store A/B signed JWT negative UAT; no sends | 31 planned cases remain **NOT_RUN** |

## 4. Evidence, QA and rollback

`qa/v180-p0j/verified-readonly-session-compatibility.json` records aggregate evidence and explicit NOT_RUN flags. `qa/v180-p0j/private-browser-auth-owner-probe.js` is an operator-run read-only script, **not deployed**. Its synthetic regression tests only verify safety, fail-closed behavior and ephemeral fingerprints; they do NOT simulate being actual authenticated users on Supabase. GitHub CI must verify the source and mark its environment SOURCE_ONLY.

**No runtime changes:** No production/release migration, Supabase Auth account/role/session mutation, new Store rows, Render deploy, n8n workflow change, provider message, paid service, or customer data access. Draft PR revert is the source rollback; no live rollback is necessary.

**Next meaningful dependency:** real, private browser-local actor A/B Auth observations from the two existing profiles. Only after independently verified same-tenant owner binding and a separately approved canonical Store Registry design can private no-send hosted Store A/B UAT be considered. No repeating already accepted user confirmation.