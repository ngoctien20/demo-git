# TIEN404 AI — V17.2C.29 No-Cost Isolated Store A/B Authorization Contract QA

Date: 2026-11-18 JST. User explicitly chose **Option A: no Supabase upgrade and no additional charge**.

## Verified starting state
- Draft PR #392 OPEN at baseline HEAD `47fda7c6a90f51584361f0a7fc7576b61cbc6c69`.
- Supabase organization `pjdoiuhtwrhzkzlhelvr` `ngoctien20's Org` remains `plan=free`; project `ifxlvrhyjhbzbrkdsida` has no development branches.
- Previous `get_cost` response: `0.01344` per hour for a branch; not approval. User explicitly rejected upgrade/spending in this stage.
- PR #392 still contains source-only Auth/consent adapters; no hosted HTTPS environment was deployed, no real A/B JWT/consent was supplied.

## Source-only code implemented
- `qa/v172c-rpc-closure/v172c29-no-cost-ab-store-isolation-probe.cjs`: fail-closed *synthetic* Store read authorization contract with server-injected actor/session verifier, owner-to-tenant/Store resolver, synthetic catalog loader and strict no-send isolation gate.
- `qa/v172c-rpc-closure/v172c29-no-cost-ab-store-isolation-probe.test.cjs`: synthetic positive scoped read for Store A/B and negative cross-Store A→B, cross-Tenant A→C, wrong read scope/action (order write forbidden), forged tenant or owner client fields, revoked consent, expired/unverified session, disabled sandbox, and catalog adapter returning wrong Store.
- Existing `.github/workflows/v172c21-protected-consent-qa.yml` extended to include this suite. No new hosted services, database credentials, notifications, orders or network request needed.

## QA evidence at source HEAD 97e152dd04b4ad8a9324a457ebb4228c2c9dfd65
- Protected Consent + Store A/B synthetic negative suite: GitHub Actions [44233222360](https://github.com/ngoctien20/demo-git/actions/runs/44233222360) SUCCESS (including test step).
- RPC privilege source contract: GitHub Actions [44233222364](https://github.com/ngoctien20/demo-git/actions/runs/44233222364) SUCCESS.
- Ephemeral PostgreSQL integration: GitHub Actions [44233222363](https://github.com/ngoctien20/demo-git/actions/runs/44233222363), last observed IN_PROGRESS (update status separately before claiming PASS).

## Explicit limits
- The tests use mock trusted adapters and synthetic actor/Store labels, NOT real Supabase Auth / JWT/GoTrue, real Messenger/Zalo conversations, or an actual multi-tenant database integration.
- No independent real consent A/B or human reviewer was verified. DO NOT call Store A/B live security VERIFIED.
- All tests are SOURCE-ONLY or GitHub's ephemeral PostgreSQL 17; they do not incur a new Supabase branch/project fee. Normal GitHub Actions quotas/billing may still apply to workflow minutes; do not claim a global zero-cost guarantee.
- This is a contractual negative test, not proof that the production Commerce Core actually enforces the same policy. Real end-to-end cross-channel order QA remains blocked.

## Stage status
- IMPLEMENTED: synthetic no-send A/B Store scoped read contract.
- TESTED: protected CI source PASS; PostgreSQL outcome must be checked.
- BLOCKED: hosted private HTTPS, real owner Auth A/B and independent consent/reviewer.
- NO-GO: real JWT/PostgREST cross-Store UAT, production deployment.
- NO CHANGE: no Supabase plan upgrade, branch/project creation, cost acceptance, paid resources, production credentials, n8n/Messenger/Zalo deployments, or customer data writes.

## Rollback
Revert V17.2C.29 Draft PR source/CI changes or close PR #392. GitHub Actions' temporary PostgreSQL containers are not hosted Supabase resources.
Next step: produce protected Auth UAT prerequisites and start real tests only after explicit environment and consent approval, while continuing to reuse existing no-cost CI.
