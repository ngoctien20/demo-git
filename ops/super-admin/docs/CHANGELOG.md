# TIEN404 AI V4 — CHANGELOG

## 2026-11-10 — Isolated Super Admin security core

- Continued from previously approved project context and existing Control Hub V2 Draft PR without replacing any GitHub Pages or Sites frontend.
- Added SQLite staging domain and MFA-secured FastAPI API reference, five server-side roles, tenant scoped membership, sessions, CSRF, logout/revocation and explicit confirmation guard.
- Implemented no-payment-until-verified and no-grace-before-prior-payment safety rule. Fixed a bug caught during automated staging QA that mistakenly gave first-unpaid `PAYMENT_DUE` grace entitlement.
- Added tenant pause/enable policy distinct from n8n workflow activation, signing and tenant resolution checks for an internal entitlement gateway, disabled by default.
- Added sandbox-only HMAC payment fixture with idempotency and mismatch rejection, approved-version knowledge lifecycle and metadata-only connectors.
- Added append-only audit log, tests, API and security specifications, future migration checklist and README.
- No production auth, payment, D1, channel, n8n, or GitHub Pages changes performed.

## Next history entry

Append exact GitHub branch, commit, CI run and QA totals once independent CI completes. Do not overwrite prior checkpoints.