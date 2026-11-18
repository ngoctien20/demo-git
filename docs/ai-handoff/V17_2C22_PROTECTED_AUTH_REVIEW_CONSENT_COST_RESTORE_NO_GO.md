# TIEN404 V17.2C.22 — Protected Auth Adapter Security Review × Independent A/B Consent Intake × Supabase Cost/Restore NO-GO

Date: 2026-11-18 JST. GitHub Draft PR #392; previous V17.2C.21 HEAD `9ba743ba3eb9b6d6b579fad6f3f9eb3f3a17eb40`.

## VERIFIED base
- Previous commit CI: `44225694730` protected source, `44225694707` source contract, `44225694713` Postgres integration all completed SUCCESS.
- Supabase `tien404-staging` (`ifxlvrhyjhbzbrkdsida`) lists zero development branches. No separate approved disposable Auth/Commerce project.
- Current user Supabase org identity has NOT been independently acknowledged by organization owner for budgeting. Do not use an inferred organization ID to authorize cost or create a branch.
- Supabase official docs (2026-11-18 review): user JWTs carry a `session_id` claim, used to correlate a session with `auth.sessions`; branch database is separate and starts without source production data; branching may bring migrations. These docs DO NOT imply real user consent, budget approval, or a verified backup/restore.

## Real security defects found and fixed in Draft source
1. `session.expiresAtMs<=Date.now()` was fail-open when expiry was missing/NaN (comparison false). Replaced with strict `Number.isFinite(session.expiresAtMs)` and active-expiry check. `sessionIdVerified` now must be literal `true`.
2. `reviewPair()` previously used private evidence without independently verifying reviewer session within the library contract. Added `verifyReviewerSession` server adapter; reviewer bearer required, session current/verified/active, `sessionIdVerified===true`, role `independent_security_reviewer`, `independent===true`, expiry valid and subject present.
3. Reviewer must not equal the subjectRef of Actor A or Actor B. Backend returns DENY before preflight for conflicts.
4. `qa/v172c-rpc-closure/v172c21-protected-consent-backend.test.cjs` adds synthetic negative coverage of missing expiry, NaN expiry, unauthorized reviewer, expired reviewer, reviewer-actor collision, absent reviewer auth.
5. Last code commit under test `41eadc1a286b277a5271aa09c59e4ba996c8ce0c`: protected backend run `44226527318` job and explicit test step concluded SUCCESS. This is synthetic source test, not hosted Auth.

## Proposed actual independent A/B consent intake — NOT DEPLOYED
- Operator-hosted HTTPS consent UI must use verified origin, safe CSRF/CORS/cookies, HTTPS/HSTS, request size and rate limits, short single-use server challenge bound to authenticated session + immutable server Store mapping, explicit accept and withdrawal.
- Actual Auth adapter must validate JWT signature (iss/aud/exp), identity subject and `session_id` against current trusted Supabase Auth server/state; reject invalidated sessions and anonymous users with the authenticated DB role.
- Actor A and Actor B must log in separately and expressly consent to Store A or Store B for synthetic catalog read-only no-send test. Trusted verifier confirms same synthetic Tenant, different actors/Stores and a reviewer who is neither.
- Protected backend must implement atomic challenge consumption, persist consent receipt securely, and use pairwise all-or-nothing receipt consumption only after independent private security approval.
- Never accept private authority fields from the user request; do not expose service_role credentials to frontend; do not place tokens, OTPs, bearer headers, private signed receipts, PII or raw `auth.sessions` identifiers in GitHub/ChatGPT.
- Current PR includes ONLY a dependency-injected adapter contract and isolated tests; there is no hosted private consent service or actual real JWT test.

## Supabase cost/restore DECISION: NO-GO
- Branch creation not attempted; no cost confirmation requested, approved or charged. Prices depend on organization/account and branch runtime. No verified organization-specific quote or budget cap exists.
- Before approving a branch, independently establish actual billing owner and organization ID, obtain provider cost quote, set hourly and total spending ceiling, expiry/cleanup owner, and independent security review.
- Recovery acceptance requires a known backup baseline, restore rehearsal on isolated resources, evidence of empty/synthetic-only customer tables, checking migrations, masked Auth data, no production tokens, and tested stop/delete/rollback steps.
- The two current connected Supabase projects `tien404-staging` and `ngoctien20-bio` are NOT authorized disposable resources.
- Source-only QA does not authorize hosted UAT, schema writes, auth migrations, Messenger/Zalo sends, or any payment.

## Gate table
| Gate | Result |
|---|---|
| V17.2C.21 previous CI | VERIFIED PASS |
| Session expiry fail-closed and verified independent reviewer | IMPLEMENTED + TESTED synthetic CI PASS |
| Real Auth signed JWT and active session verification | BLOCKED, not implemented |
| Independent A/B actual private consent receipts | BLOCKED |
| Approved disposable Supabase environment and organization quote | BLOCKED |
| Backup/restore validation | BLOCKED |
| Hosted Real JWT Store A/B read-only UAT | NO-GO |
| Production deployment | NO-GO |

## Rollback and checkpoint
Draft source changes only, no published/prod/credential/customer data or Supabase mutation. Revert source commits on PR #392 or close Draft PR. Current checkpoint commit will be recorded after GitHub create_file. Next gate is a real protected server-side Auth and consent implementation *after* approvals rather than further synthetic checklists.
