# V17.2C.21 — Protected Consent Backend × Independent Auth A/B Intake × Disposable Supabase Approval

Date: 2026-11-18 JST. Draft PR #392; base checkpoint V17.2C.20 `b13ff09ad2da8375818459030d23cfef9b9b595e`.

## Actual verification
- Previous V17.2C.20 source workflow `44179372726` SUCCESS and ephemeral PostgreSQL workflow `44179372735` SUCCESS.
- Before edits, PR #392 remained OPEN DRAFT; Supabase `tien404-staging` `ifxlvrhyjhbzbrkdsida` has **no development branches**.
- Protected Backend synthetic CI `44225585150` job `synthetic-private-auth-contract` completed SUCCESS at source commit `3fef662f32fcbe2e8d796d22078e55d18981fc48`.
- Separate source and PostgreSQL CI for same SHA must be checked before marking them PASS.

## Implemented in DRAFT source, NOT deployed

- `qa/v172c-rpc-closure/v172c21-protected-consent-backend.cjs`: dependency-injected private intake adapter. Requires a protected server to supply six independent trusted capabilities: real session verification, server-owned Store authority resolution, single-use consent challenge verification, private receipt recording, trusted authority read, private evidence and signed receipt reads.
- `intake`: validates bearer syntax and exact no-send/read-only scope; requires an explicit `consentAction='accept'` and an opaque challenge. Session must be active, verified and have server-verified session evidence, still unexpired. Store binding must come from a trusted resolver, not caller-submitted store or tenant.
- `verifyConsentChallenge`: must atomically consume a previously issued single-use challenge bound to actual verified Auth session, Store, tenant and scope and verify explicit consent intent. A server-side adapter must implement this; it does **not** exist on hosted infrastructure yet.
- `recordExplicitConsent`: only called after verified challenge and store authority. It must verify persistence and provenance, not just return user-supplied flags. Never log or return token or subject identifiers to the public client.
- `reviewPair`: reads private authority/evidence/signed receipts and runs V17.2C.20 fail-closed preflight. At most returns `REVIEW_REQUIRED_NOT_JWT_GO`; it never calls `consume_pair`, executes PostgREST requests, authorizes production, or migrates a DB.
- `qa/v172c-rpc-closure/v172c21-protected-consent-backend.test.cjs`: synthetic denial tests for missing/incorrect bearer, unsupported scope, missing explicit action and challenge, inactive/expired/unchecked sessions, invalid store ownership, false challenge, replayed challenge, failed persistence, missing server evidence, client Store override.
- `.github/workflows/v172c21-protected-consent-qa.yml`: independent Node 22 synthetic CI. No network, actual Supabase session, shared secrets or real customer information.

## Security status and explicit limitations

1. This is a **dependency-injected module**, NOT deployed protected HTTPS backend or working sign-in UI. A trusted production implementation of each adapter, including verified JWT signature, active `session_id`, session revocation, independent owner access, private consent issuance and atomic single-use challenge, is still required.
2. Do not wire a public raw bearer POST endpoint with trust flags from request JSON. No service_role secrets in frontend; no real JWT/OTP/refresh token or PII in chat/GitHub.
3. Human consent must be per actor, per Store, independently given after secure sign-in and with voluntary explicit action. Consent can be withdrawn before pair consumption.
4. Protected server must enforce audience, issuer, expiration, token rotation, CSRF/origin/cookie protections as relevant, rate limits, tamper-proof audit and session consistency; test a full malicious principal matrix before hosted release.
5. A/B independent Auth evidence is still NOT verified or collected. The mock inputs are deliberately synthetic and cannot pass hosted authorization.
6. Supabase branch would have organization-specific ongoing compute/usage cost. No quote obtained, no budget cap approved, no restore drill and no new branch created. Existing staging and BIO are excluded as disposable targets.

## Deployment approvals and GO / NO-GO
| Item | Status |
|---|---|
| V17.2C.20 baseline source & PostgreSQL QA | VERIFIED PASS |
| Protected intake + server adapter contract | IMPLEMENTED (Draft) |
| New synthetic backend CI | TESTED PASS |
| Actual HTTPS backend + login UI | PROPOSED, NOT DEPLOYED |
| Independent actor A/B Auth & real consent | BLOCKED |
| Organization-specific branch cost/backup/recovery approval | BLOCKED |
| Real signed Supabase JWT/PostgREST Store A/B negative UAT | NO-GO |
| Production release | NO-GO |

## Rollback and next step
- Revert V17.2C.21 source/workflow changes or close Draft PR #392. No runtime rollback needed.
- No Supabase DDL, branch creation, hosted endpoint, credential edits, n8n workflow edits or customer data changes.
- Before any branch creation, ask the authorized organization owner to confirm organization ID, review returned cost and limit, and approve recovery/cleanup; this project's current reference does not imply consent to spend.
- Next candidate V17.2C.22: protected private-service adapter threat review, explicit independent owner A/B secure intake design, and cost/restore decision. Do not claim hosted UAT GO from source tests.
