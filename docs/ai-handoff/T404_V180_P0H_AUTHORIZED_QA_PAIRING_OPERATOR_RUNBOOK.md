# TIEN404 AI — V18.0-P0H Authorized QA Actor A/B Pairing × Private Auth Session Verification × Canonical Store Owner Admission

**Checkpoint:** 2026-11-18 JST. **State:** VERIFIED_AGGREGATE_READ_ONLY / IMPLEMENTED_SOURCE_ONLY / PRIVATE_AUTH_NOT_RUN / STORE_AUTH_NO_GO.
**Release graph:** Continue existing OPEN DRAFT PR #385 (parent #362), checkpoint issue #368. No new overlapping PR, no production deployment.

## 1. Verified real Supabase staging owner cohort (read-only)

Project `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY PostgreSQL 17.11. Only aggregate counts were queried; no emails, auth IDs, session IDs, phone, IP, tokens or credentials selected.

| Cohort | Tenants | Eligible active tenant owner accounts | Owner accounts with qualifying unexpired session **record** | Owner accounts without such record |
|---|---:|---:|---:|---:|
| Candidate for A/B | 1 | 2 | 1 | 1 |
| Separate tenant | 1 | 1 | 1 | 0 |

`auth.sessions` row merely indicates a stored session entry. It is NOT proof that caller holds a current verified JWT; it is NOT consent; it is NOT canonical Store membership. No same-tenant pair with two session records existed at checkpoint. **Crucially: a same-tenant two-owner *account* pair exists, so do NOT create more accounts solely to obtain a pair.**

Other verified blockers retained from P0G: 0 unexpired unused QA pairing challenges; 0 confirmed QA claims; 0 active cross-channel identity/verified order ownership; no `public.stores` or `store_memberships`, zero `store_id` in seven core Commerce tables. `public.save_merchant_product` remains tenant-scoped.

## 2. Smallest operational path (PRIVATE, human-authorized, no hosted write)

**Actor A / Actor B consent:** Founder may independently operate two dedicated QA accounts if authorized to do so; otherwise obtain each owner's separate explicit consent. Do not use real customer identities. Consent needs to be documented in a protected private system, not in a public GitHub Issue, and scope must be `READ_ONLY_NO_SEND`. If an owner is not authorized, stop.

**Existing account reuse:** Locate privately which of the two eligible owners of the same tenant lacks a current session record (using authorized Supabase admin UI, no copying identifiers to repo). Ask that person or the authorized operator to **sign in normally** in a separate browser profile to the already trusted staging Auth login, without changing password or credentials. Do not create, impersonate or reset Auth accounts automatically. A login may create a new Auth session; this is an intentional actor-auth action and requires that actor's own consent.

**Session check through trusted app integration:** This Draft PR provides `qa/v180-p0h/private-browser-auth-readonly.mjs` as a **source-only helper**; it is NOT wired to the deployed website or a button. A developer should review integration into the existing authorized staging app first. Each actor uses their own already configured Supabase client in a separate authenticated browser profile. Only after explicit actor consent, call `checkBrowserActorReadOnly(client, {privateOperatorConsentConfirmed:true,environment:'STAGING_QA_PRIVATE',roleSlot:'A' or 'B',useRealCustomerData:false,noSend:true})`. It calls only **official** `supabase.auth.getUser()` and `supabase.auth.getClaims()` using existing in-browser session. The output is minimal status flags only, never copies credentials, user IDs, email, phone, session_id or JWT.

**Proof boundary:** `getClaims()` checks verified JWT claims (and can contact Auth if project uses symmetric keys); `getUser()` checks actual Auth server identity. The helper validates issuer, audience, expiry, subject match and presence of session claim. It does **not** independently verify server-side session revocation, distinct real actor identity across profiles, consent evidence or canonical Store ownership; result status is at most `LOCAL_AUTH_CLIENT_READ_ONLY_CHECKED`. `reviewTwoLocalPrechecks()` returns at most `PRIVATE_OPERATOR_REVIEW_REQUIRED`, always `canRunHostedAB=false`. Never present browser-generated status JSON as independent proof.

**Independent server-side verification:** Following explicit consent, an authorized trusted private verifier (separate from browser session, outside public GitHub) should confirm per-actor signature/issuer/audience/expiry, current session and revocation state, distinct canonical actors, and membership from authoritative Store Registry. No private JWT or session/user ID needs to be pasted in ChatGPT. Use only opaque randomly generated private evidence receipt IDs in a protected registry. This independent verifier and protected registry are not yet deployed.

**Canonical Store admission candidate (NOT CURRENT DATABASE):**

| Gate | Require | Current conclusion |
|---|---|---|
| OWNER-1 | Same tenant, distinct authorized Auth identities A/B | Accounts exist, consent + simultaneously valid Auth sessions unverified |
| OWNER-2 | Each owner independently authorizes scoped QA in private registry | NOT COLLECTED |
| OWNER-3 | Server-owned `(tenant_id UUID, store_id UUID)` Store A and Store B distinct | NOT DEPLOYED |
| OWNER-4 | Active DB Store memberships `(tenant,store,auth.user)` with policy version, no cross-store role | NOT DEPLOYED |
| OWNER-5 | Private session check correlated to actual Auth session and revocation | NOT TESTED |
| OWNER-6 | Provider native signed ingress/install mapped to exact Store | NOT TESTED |
| OWNER-7 | No-send positive A→A/B→B and negative A→B/B→A, outsider, revoked, expired | NOT RUN |
| OWNER-8 | Before hosted changes: exact authorized scope, M0 recovery provenance and tested rollback | DEFERRED for source-only, BLOCKED for hosted change |

Never infer Store ownership from `tenant_memberships`, QA `store_key` text, bot key, username, sender ID, order number or claims in editable `user_metadata`. Two separate Auth accounts under one tenant are a necessary prerequisite but not sufficient for multi-Store authorization.

## 3. Implementation & QA receipts

- `qa/v180-p0h/owner-cohort-readonly-evidence.json`: sanitized two-tenant eligibility aggregate only.
- `qa/v180-p0h/private-browser-auth-readonly.mjs`: official read-only client helper, always refuses server grants/Store UAT even after positive local precheck.
- `qa/v180-p0h/private-browser-auth-readonly.test.mjs`: mocked Auth getUser/getClaims positive/negative tests; real JWT never injected.
- `.github/workflows/v180-p0h-private-browser-auth-preflight.yml`: no credentials/no remote Auth calls in CI; static safety and Node tests.

**Limits:** Running local mocked Auth tests is NOT actual actor consent, real-session verification, trusted canonical Store admission or hosted JWT A/B UAT. Do not mark 31 P0F cases PASS or authorized until independent private server proof is produced.

## 4. Decision and rollback

Continue source-level operator preparation; no database DDL/RLS/grant or customer/merchant data mutation, no Auth sign-in done by assistant, no production publish, no Meta/Zalo send. M0 waived by founder solely for read-only/source-only/disposable; reopening M0 required when a hosted schema change is actually requested. Runtime rollback not applicable; source changes can be reverted on Draft PR #385.

**Next actionable dependency:** the authorized owner of the *second existing QA account in the same tenant* logs in through the trusted staging Auth app, and separately approves private read-only verification. We can only evaluate Store ownership once a canonical Store Registry and trusted operator evidence is available. Do not add new QA account or perform provider UAT as workaround.