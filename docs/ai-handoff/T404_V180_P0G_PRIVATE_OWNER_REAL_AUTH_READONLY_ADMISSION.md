# TIEN404 AI — V18.0-P0G Private QA Owner Consent × Real Auth Read-only Verification × Trusted Store Admission

**Date:** 2026-11-18 JST. **Status:** VERIFIED_AGGREGATES / IMPLEMENTED_SOURCE_ONLY / REAL_JWT_NOT_RUN / STORE_AUTH_NO_GO.
**Source chain:** existing Draft PR #385, parent #362; canonical release checkpoint Issue #368. Supabase staging `ifxlvrhyjhbzbrkdsida` (PostgreSQL 17.11).

## 1. Actual read-only cohort evidence (PRIVATE, aggregate-only)

Queries joined public.tenant_memberships, auth.users and auth.sessions using authorized Supabase connector, with **aggregate-only output**. No user identifiers, emails, phone numbers, IPs, raw tokens, refresh secrets or credentials were selected.

| Verified aggregate | Observed | Interpretation |
|---|---:|---|
| Active tenant memberships | 3 | Three tenant-role memberships, not three separate Store owners |
| Active tenant owner memberships | 3 | Owners at tenant scope only |
| Confirmed, non-banned, active-membership users | 3 | Eligible user state, not possession of current token |
| Active members with a session row not past not_after | 2 | Historical/current DB session record only, not signature or revocation check |
| Tenants with two eligible owners AND session records | **0** | Cannot pair two currently eligible real Auth owners under same tenant |
| Tenants with two eligible members AND session records | **0** | Even the weaker member pairing criterion does not hold |
| Legacy QA pairing challenges | 19 | QA records, never equate to consent |
| Unexpired & unused QA challenges | **0** | Old challenges cannot be admitted as a fresh proof |
| Legacy QA claims | 4 | No proof of consent or real provider sender binding |
| Confirmed legacy QA claims | **0** | No confirmed pairing proof |
| Non-revoked V17.5 channel identities | **0** | No reusable verified cross-channel identity |
| Verified V17.5 order-ownership rows | **0** | No reusable order owner receipt |
| Canonical public Store registry tables | **0** | No independent Store Authority DB |
| Canonical public Store membership tables | **0** | Tenant owner != Store owner |
| Public core Commerce store_id columns | **0** | Seven core tables remain tenant-scoped |
| Existing product RPCs with Store-specific guard | **0** | save_merchant_product still tenant-authorized |

**Security significance:** an `auth.sessions` row with unexpired `not_after` does not itself prove that a caller holds a valid access JWT; a JWT must have trusted signature/issuer/audience/expiry and be tied to an actual current server-side session. Checking `auth.sessions` alone can never verify provider signatures or Store ownership.
Reference: https://supabase.com/docs/guides/auth/sessions and https://supabase.com/docs/guides/auth/jwts .

## 2. Consent and independent evidence protocol — PRIVATE OPERATIONS ONLY

**Scope:** the founder authorized read-only investigation. There is **no blanket consent to impersonate** or create/change owner accounts, reset passwords, register Stores, bind bot ownership, send messages or use another person's identity.

**Step A — Consent ownership precondition.** The operator selects only two test identities they are allowed to control, or collects separately recorded approval from both authorized QA owners. A single founder may control two dedicated QA accounts, but this must be proven via separate authenticated sessions; a tenant role alone is not consent.

**Step B — Private receipt registry.** For each consenting QA actor, privately store consent, permitted QA tenant/store, allowed read-only operations, recorded time, expiry/revocation, operator and reviewer attestation. Issue a **random opaque receipt reference**, not SHA256 of user ID/email/phone. Keep this registry out of GitHub, ChatGPT, public PR logs and customer databases.

**Step C — Real Auth handshake in private secure QA page.** Open two independent browser profiles or isolated QA sessions. Via official Supabase Auth API in each session, call `getUser()` to establish authenticated identity and `getClaims()` where supported to verify signature/issuer/audience/expiry. Do not paste/access/log any raw JWT or refresh token; do not trust `getSession()` local storage alone as server-verified identity. Independently correlate token `session_id` to an active Auth session in a server-side private verifier; avoid exposing session_id in public outputs.

**Step D — Current blocker.** Zero same-tenant paired eligible owner session-record groups, zero fresh QA challenge and zero canonical Store membership tables mean this system **cannot yet verify Store A/B ownership**. Do not mark PRIVATE_OWNER_ADMITTED or perform hosted Store A/B UAT. Fixing this would require separate approved QA identities/consent and Store Authority provisioning after a schema/recovery plan is accepted.

**Step E — Trusted Store registry admission (not implemented).** Only an independently verified server registry maps tenant UUID + Store UUID + active Auth actor + role + provider installation. R1 QA text store_key, displayed name, phone number, bot key, sender ID and a claimed JSON field must not be auto-promoted to Store authority.

**Step F — No-send negative testing after future admission.** With real verified A/B sessions and canonical Store ownership, use least-privilege Auth clients (not service_role) to test same-Store read, A→B/B→A denies, outsider/wrong tenant, expired/revoked session, fake app/user metadata, dual-member transfer, native signed provider ingress and cross-channel identity/Order link. No customer data or real provider sends. The 31 previously authored P0F scenarios remain **NOT_RUN** now.

## 3. Precise P0G implementation

`qa/v180-p0g/read-only-auth-owner-aggregate.json` contains only the directly observed aggregated counts and explicit false/NOT_RUN states, without personally identifying information.
`qa/v180-p0g/private-read-only-auth-cohort.sql` is a SELECT-only, `BEGIN TRANSACTION READ ONLY ... COMMIT` repeatable operator audit. Run only privately on the authorized staging project.
`qa/v180-p0g/private-owner-consent-admission.mjs` is a pure fail-closed checker that consumes aggregate records and synthetic consent/handshake metadata. It never authenticates JWTs or calls external systems, and always sets `canRunHostedAB=false`, `canChangeHostedSchema=false`, `canPublish=false`, `canSendProvider=false`.
`qa/v180-p0g/private-owner-consent-admission.test.mjs` tests current blockers, data drift, forged consent, recycled opaque receipts, token leaks, false provider claims and inherited 31 `NOT_RUN` UAT scenarios.
`qa/v180-p0g/` is source-only; CI must not use credentials, Auth tokens, Supabase APIs, provider calls or migrations.

## 4. Risk and gate matrix

| Gate | Result | Consequence |
|---|---|---|
| Supabase private aggregate cohort inspection | VERIFIED READ-ONLY | Counts support diagnosis, not Auth acceptance |
| Two eligible independent same-tenant owner sessions | NOT PROVEN (0 candidate groups) | No A/B admission |
| Human/private QA consent receipts | NOT COLLECTED | Cannot assume consent for second account |
| Trusted canonical Store membership registry | NOT DEPLOYED | Cannot bind owner to Store |
| Real JWT signature / session check | NOT RUN | No token accepted |
| Native Messenger/Zalo provider proof | NOT RUN | No cross-channel UAT |
| Existing P0F 31-case Store A/B UAT matrix | 31 NOT_RUN | No fake PASS |
| M0 backup recovery | DEFERRED FOR SOURCE/DISPOSABLE | Mandatory before any hosted migration/RLS/grant/data mutation |
| Production or hosted migration | NO-GO | Explicit approval and evidence required |

**Rollback:** only source files and Draft PR commits; no runtime rollback required. No Supabase write, Auth account creation, session modification, credential interaction, bot send, GitHub merge, or paid service invoked.

**Next safe gate:** V18.0-P0H — Independently Authorized QA Actor A/B Pairing Plan × Private Session-Check Operator Review × Disposable Canonical Store Registry Upgrade Candidate. The immediate operational dependency is separately proven authorization of two QA identities inside one tenant; without this and a trusted Store registry, hosted JWT A/B acceptance cannot be established. No more synthetic PASS reports should substitute for these proofs.