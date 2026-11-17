# TIEN404 V17.2C.20 — Private Auth Consent Session Intake × Trusted Pair Verifier × Disposable Supabase Cost/Recovery Approval

Date: 2026-11-18 JST. GitHub Draft PR #392. Previous checkpoint V17.2C.19 HEAD `c557f7b992571e631963ed7b915f23cca0a7a8b9`.

## Verified baseline

- V17.2C.19 source-only run [44175615193](https://github.com/ngoctien20/demo-git/actions/runs/44175615193): completed SUCCESS.
- V17.2C.19 ephemeral PostgreSQL 17 RLS/registry/pair-transaction run [44175615157](https://github.com/ngoctien20/demo-git/actions/runs/44175615157): completed SUCCESS.
- `tien404-staging` Supabase ref `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY on PostgreSQL 17.11. `list_branches` returned ZERO development branches.
- No independently collected live Auth A/B session evidence or consent receipts. No approved isolated Supabase branch, cost approval or restore drill. Existing staging is NOT disposable; do not reuse BIO project.
- No production activity was performed.

## Source-only private consent Auth preflight implemented

`qa/v172c-rpc-closure/v172c20-trusted-private-auth-pair-preflight.cjs` and adjacent `.test.cjs`:

- Inputs are **backend-only evidence** from actual independent Auth/session, verified consent, Store authority, security reviewer, approved disposal, recovery and no-send subsystems; never from a client request or user-supplied JSON.
- Require two distinct Auth subjects, distinct current session proof references, two matching Store mappings, independently verified consent and no withdrawal. Evidence must be current within five minutes. Do not put JWT, OTP, refresh tokens or real user data in CI or public GitHub.
- Reject use of existing tien404 staging or BIO project as disposable by ref; reject unapproved cost/recovery/no-send/reviewer gates.
- Reuse V17.2C.17 pinned Store/subject/issuer Ed25519 receipt validator, revocation and replay-ledger inputs. Even the all-positive synthetic fixture returns `REVIEW_REQUIRED_NOT_JWT_GO` and does NOT call the actual consume_pair SQL, authorize migration or validate live JWT signatures.
- Source tests include independent actor/session, consent withdrawal, stale evidence, budget/recovery, trusted Store binding, revoked/replayed receipt negative cases.
- **Trust warning**: this is a pure source preflight. Real signed JWT validation, session_id current membership check, independent consent intake and authoritative store lookup must be implemented in a protected service and security-reviewed. Caller-controlled flags are unacceptable. A real verifier must not use the JS test harness as an authentication service.

## Operational private A/B consent intake — proposed, NOT deployed

1. Approve a dedicated private HTTPS UI/service with verified origin, MFA/re-auth as needed and no external sends/orders.
2. Owner A signs in as A through Supabase Auth on their own device and consents to Store A synthetic catalog read-only, expiry/revocation rules.
3. Owner B independently signs in as B on separate session and accepts Store B scope. No operator may consent as B on B's behalf.
4. Protected backend verifies actual signed JWT/user subject and `session_id` against current server-side Auth authority, checks real session validity, reauth and consent scope. Do not take ownership from editable user metadata or a client-provided Store id.
5. Trusted owner→tenant→store mapping must be checked against server-controlled membership records; independent reviewer attests distinct actors/Stores within approved synthetic Tenant.
6. Private registry stores opaque receipt IDs, signed consent payload, verified backend provenance, audit timestamps and revocation; no raw tokens in logs or GitHub. The two receipts are consumed atomically only after both consent and independent security review.
7. Host only on approved disposable Supabase service with retention, recovery, timeout and rollback evidence. Not authorized at present.

## Supabase disposable cost/recovery gate — awaiting explicit approval

- No branch was created and no charge was initiated.
- Supabase branch/project price has **NOT been verified or quoted**. Do not infer free usage or authorize spending. Per-product organization-specific cost must be retrieved from Supabase's cost confirmation workflow, disclosed to the operator and explicitly accepted before creating a branch.
- Approvals required: owner of the actual organization; selected isolated QA project/branch and current migration state; maximum hourly and total cap; retention/expiry; backup target and restore test; cleanup owner; staging/prod credential separation; zero live customer records; tested no-send scope and security reviewer.
- Branches may apply existing migrations and must be reviewed for schema compatibility and privileges; do not assume Supabase project BIO is safe for commerce QA.
- **Current GO/NO-GO**: real A/B Auth consent BLOCKED, branch creation BLOCKED, hosted JWT A/B UAT NO-GO.

## Evidence and checkpoint

| Gate | Status |
|---|---|
| Previous PostgreSQL pairwise atomic transaction | VERIFIED TESTED PASS |
| Trusted private A/B preflight source and negative tests | IMPLEMENTED; latest CI outcome must be verified |
| Operational private login/consent service | PROPOSED, NOT DEPLOYED |
| Real live session and independent consent | BLOCKED |
| Current Supabase disposable branch | NONE |
| Cost quote, restore drill, approval | NOT OBTAINED |
| JWT/PostgREST hosted UAT | NO-GO |

Rollback = revert only new Draft PR source/doc commits; no Auth, Supabase, credential, n8n, Zalo, Messenger, payments or customer records were modified.

Next real operation requires a separate private protected consent endpoint, two owner-authenticated approvals, and an explicit organization-specific branch price/recovery approval. Don't declare RELEASED.
