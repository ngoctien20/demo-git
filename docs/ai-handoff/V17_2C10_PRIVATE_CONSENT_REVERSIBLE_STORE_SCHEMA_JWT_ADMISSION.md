# TIEN404 V17.2C.10 — Private Consent Intake × Reversible Disposable Schema × Independent Real JWT A/B Admission

Date: 2026-11-18 JST.
Base: Draft PR #392, previous V17.2C.9 checkpoint HEAD `9f8689d13dfb6d0565527f27a57ed5bf45ef92a3`.
Database: Supabase staging `ifxlvrhyjhbzbrkdsida`.
Stage: **CANDIDATE SOURCE ONLY — NO hosted migration / no real JWT UAT**.

## I. Direct verification

- GitHub Actions of prior V17.2C.9 HEAD run [44149041313](https://github.com/ngoctien20/demo-git/actions/runs/44149041313) = SUCCESS, source-only unit suite; not hosted JWT proof.
- Supabase staging ACTIVE_HEALTHY PG17.11, Supabase `list_branches` returned **zero development branches**.
- Read-only SQL snapshot: auth users 3; tenants 2; public products 2; orders 2; tenants with >=2 active owners 1; tenants with >=2 distinct QA `store_key` 0; canonical Store tables 0; `store_id` commerce columns 0.
- Independently signed actor A and B private consent receipts have NOT been provided. Supabase auth membership or session counts cannot establish individual human consent.
- Previously verified n8n Header Auth Name `x-tien404-pairing` via operator screenshot, secret masked; matching Vault secret and successful live RPC still not verified. Existing published Zalo V2 `qa_shop_b_zalo_claim` caller must retain its current privilege.

## II. Concrete isolated schema and reversal artifacts

Candidate ONLY, never run on present staging:
1. `qa/v172c-rpc-closure/v172c10_disposable_schema_candidate_NOT_EXECUTED.sql`: isolated `tien404_v172c10_disposable` with QA tenants, QA stores, Store memberships bound to `auth.users`, Store catalog, composite Tenant+Store foreign keys, four RLS-enabled tables; `authenticated` SELECT access only, catalog access validated against `auth.uid()` + both tenant/store; no anon/attendee write grants.
2. `qa/v172c-rpc-closure/v172c10_disposable_rollback_candidate_NOT_EXECUTED.sql`: reversible QA-only structure, four-table inventory check and external-dependent relation gate, no CASCADE; deletes QA data **only if separately approved**. No action taken.
3. `qa/v172c-rpc-closure/v172c10-schema-rollback-source.test.cjs`: source contract assertions for RLS, composite Store authority and guardrails. This is **static QA only** until independently tested and CI confirms it; even green CI is not proof that SQL migration or rollback succeeded in PostgreSQL.

Critical security distinction: mere placement of a schema in staging does **not** make it disposable. The current staging project has existing business rows and no isolated development branch. Source SQL is a candidate design for a separate approved disposable project, not permission to run against existing `ifxlvrhyjhbzbrkdsida`. To test PostgREST, schema exposure/roles and authentic user JWT require separate scoped approval, and must be audited; service_role RLS bypass cannot be used to claim JWT isolation.

## III. Consent intake — independently verifiable, not fictitious

Privately (no JWTs or human identifiers in GitHub/chat):
- Actor A consents to a restricted synthetic role in Store A; Actor B separately consents to Store B.
- Each actor authenticates through a genuine managed Supabase Auth flow; independent verifier binds a pseudonymous, expiring receipt to `auth.users.id` and current permission. The signer identities must differ, Store IDs must differ, and both Stores must share a separately approved synthetic Tenant.
- Receipts must specify project, allowed read-only synthetic catalog tests, request cap, expiry, revocation, no-send/no-order-write/no-customer-access and approved rollback/cost boundary.
- Independent security reviewer approves receipt authenticity and scoped test readiness. Receipts remain in protected repository/service, never public GitHub comments or test fixtures.
- The operator's request to continue a stage is NOT automatically consent of a second Auth principal or permission to mutate Supabase.

## IV. GO/NO-GO

| Gate | Result |
|---|---|
| Existing Header Name | VERIFIED from operator screenshot |
| Source suite previous commit | PASS at run 44149041313 |
| Latest SQL + test candidates | IMPLEMENTED source only, CI pending |
| Dedicated disposable Supabase branch/project | NO-GO; none exists |
| A/B independent signed consent | BLOCKED |
| Canonical same-Tenant Store A/B | BLOCKED |
| Safe approved rollback & restore drill | BLOCKED (candidate only) |
| Real signed JWT A/B negative UAT | NOT AUTHORIZED / NOT RUN |
| RPC privilege closure / production | NO-GO |

## V. Next execution path after consent & approval

1. Approve a true isolated disposable project/branch including cost, retention, restore, permissions and no-send.
2. Obtain two independent private receipts and separate Auth sessions with a trusted verifier; do not copy JWT into chat.
3. Review candidate SQL under independent security review and run on only an approved disposable instance. Insert two known synthetic Store fixtures under a separately authorized private operator. Snapshot + rollback drill.
4. Verify real JWT A→A ALLOW, A→B DENY, B→B ALLOW, B→A DENY, unrelated/cross-Tenant/expired/revoked DENY under PostgREST and actual Store policies; collect sanitized evidence.
5. No n8n Published/webhook, Zalo/Meta sends, existing Commerce data migration or RPC grants changed until independent GO.

No runtime changes were made. Rollback of this step: close PR #392 or revert the three source-only files and this document. Hosted application continues unaffected.
