# TIEN404 AI V4 — PROJECT_STATUS

Snapshot: 2026-11-10 (JST). Scope: standalone security core on a **staging-only branch stacked over the existing Control Hub audit PR**.

## Observed before changes

- Public website and repo: `https://ngoctien20.github.io/demo-git/`, `ngoctien20/demo-git`, GitHub Pages branch `gh-pages` at `7bf9c660e70a65295e80b0fba8c241590d6aa0bf`. Previous website QA confirmed 108/108 browser tests; do not confuse that with Super Admin QA.
- Existing Control Hub: `https://tien404-control-hub.fairflounder1.chatgpt.site`, anonymous HTTPS 401 in previous independent GitHub Actions, authorized UI and Sites/D1 source **not accessible** to this session.
- n8n: 29 workflows, 16 Active; Create Order, Manage Order, Update Order and Revenue Report Draft differ from Published. No n8n workflow altered here.
- Existing Control Hub observability checkpoint: Draft PR #1 remains open. It is not the hosted Control Hub source.

## What was built locally

- A reference isolated FastAPI staging API with Argon2id+TOTP MFA, server cookies, CSRF, role/tenant enforcement and session revocation.
- SQLite staging domain with configurable plans, subscription cycle/eligibility, signed sandbox-only payment event verification/idempotency, fail-closed per-tenant entitlement, channel metadata vault references and approved knowledge versions.
- A test-only signed service gateway that maps verified channel account identity to tenant and does not trust a user supplied tenant ID.
- Hash-chained append-only audit and tests. None of this is connected to real Stores, production payment or n8n workflows.

## Snapshot accuracy

- Staging tests: 64 passing locally; GitHub Actions verification and exact PR commit are to be populated after pushing.
- Website = existing project, unchanged.
- Customer Dashboard = still demo; no production subscription API wired.
- Super Admin = **code-only isolated staging core**, not a visible site and not production deployed.

Release: BLOCKED, pending authorized Sites source, provider approval, official payment integration, backup restore and production security testing.