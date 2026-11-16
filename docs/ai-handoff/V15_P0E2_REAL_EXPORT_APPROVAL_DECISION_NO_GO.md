# TIEN404 AI — V15 Sales Lite P0-E.2 — One-Time Export Approval Decision
Date: 16/11/2026 JST
Decision: **NO-GO / NOT AUTHORIZED**.
Scope: GitHub Draft, source-only synthetic QA. No real database export or restore.

## Verified live facts
- Supabase staging ref ifxlvrhyjhbzbrkdsida, ACTIVE_HEALTHY, PostgreSQL 17.11, org plan Free.
- 3 Auth users, 2 Tenants, 3 active memberships, 2 Products, 2 Orders. Canonical Store and Store memberships still absent.
- Parent PR #151 OPEN DRAFT, prior source-only QA 112/112 SUCCESS.
- PR #135 two-role signature tests are SYNTHETIC only; PR #132 pg_dump/pg_restore tests use DISPOSABLE synthetic database.
- The connected Supabase connector does not expose a guarded real hosted database backup export/restore certification action. No authentic controller, private reviewer, backup operator, vault custody, actual export receipt or real restore evidence was available.
- Supabase docs https://supabase.com/docs/guides/platform/backups and https://supabase.com/docs/reference/cli/supabase-db-dump. Free projects should maintain offsite logical backups; default CLI dump does not imply full Auth/Storage recovery.
- Existing warning: anon-executable and authenticated-executable SECURITY DEFINER RPCs remain under independent review; NOT an established exploit.

## Decision matrix and missing private evidence
| Required independently verified dependency | Current result |
| --- | --- |
| Whole-project Controller (all affected tenants, not one merchant) | NOT VERIFIED |
| Independent security reviewer with real scoped approval | NOT VERIFIED |
| One-time least-privilege backup operator | NOT VERIFIED |
| Encrypted private offsite vault and key custody | NOT VERIFIED |
| Auth / Order / customer privacy and data classification | NOT VERIFIED |
| Auth/Storage, roles/schema/data, external service recovery scope | NOT CERTIFIED |
| Approved retention, 0 USD incremental cost | NOT SIGNED |
| Explicit project-bound, expiring, single-use export approval | NOT GRANTED |
| Trusted durable atomic one-time lease and replay prevention | NOT IMPLEMENTED LIVE |
| Private immutable audit, revocation and recovery | NOT VERIFIED |

Outcome: **NO-GO**. No real backup is being attempted. Full set of submitted opaque tickets cannot authorize any action without independent identity and evidence checks.

## Implemented in this Draft
- qa/v15-sales-lite-p0e2/one-time-export-decision.cjs: composes existing P0-E.1 private request and P0-E backup coverage validators. Reports explicit missing dependencies. Only NO_GO and PRIVATE_REVIEW_REQUIRED outputs, both with can_export=false, can_restore=false and no hosted mutations.
- qa/v15-sales-lite-p0e2/one-time-export-decision.test.cjs: negative tests for wrong project, duplicate reviewer tickets, lacking private Controller, security reviewer, operator, vault, consent, exact-once lease, data scope, expiry, forged approval and extra cost.
- .github/workflows/v15-p0e2-export-decision-noexec.yml: synthetic source-only unit tests and inherited P0-E.1/P0-E/P0-D/P0-B/Lite/Commerce no-send QA. It contains no real database credentials and no export code.
- An actual trusted, durable one-time approval lease has NOT been implemented; paper receipts, ChatGPT text and GitHub CI must not act as production authorization.

## Legitimate private procedure after missing proofs are provided
1. Verify project-wide Controller identity/authority from protected trusted organization records, independent security reviewer and scope/legality. Merchant Shop A/B owner proof is not whole-project approval.
2. Verify private encrypted offsite location, key custody, operator privileges, retention/secure deletion and zero incremental spend.
3. Verify a trusted server-side single-use approval issuance/revocation and atomic lease mechanism with private audit, then seek a **separate explicit one-time export authorization** for staging ref ifxlvrhyjhbzbrkdsida. Not authorized by this milestone request.
4. Only a separately authorized operator may execute exactly one supported Supabase CLI backup in a secure private environment, keeping credentials and all dump bytes out of GitHub, ChatGPT and execution logs.
5. Require independent encrypted archive checksum/provenance verification and a **separate** isolated restore approval and QA. Never automatically treat local checksum or simulated pg_restore as real hosted recovery.
6. Migration Store, RLS/GRANT/RPC changes, customer data modifications, Orders/stock writes, Messenger/Zalo sends, paid models and production publishing require their own approvals.

## QA and rollback
Source-only rollback: close the child Draft PR; original PR #151/#139/#135/#132, Supabase hosted and n8n Published remain untouched.
STATUS labels: VERIFIED read-only metadata; IMPLEMENTED source-only; TESTED after exact-HEAD CI; BLOCKED genuine backup/operator/Store ownership and hosted JWT RLS; RELEASED nothing.

Next, if private controller/vault/operator evidence is unavailable, maintain NO-GO and redirect engineering to other safe Sales Lite pilot blockers, rather than creating further redundant evidence gates.
