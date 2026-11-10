# TIEN404 AI V4 — QA_REPORT

- Target: **local staging reference** under `ops/super-admin/` (not existing Sites Control Hub).
- Automated tests: **64 tests passing locally** on 2026-11-10 (verify fresh GitHub Action result before claiming CI success).
- Framework: FastAPI + SQLite + Argon2id + Fernet; no actual provider APIs, no production data or n8n execution.
- Conditions covered: admin MFA/session creation, TOTP replay, login lockout, CSRF + origin denial, role escalation, per-tenant membership, silent cross-tenant access, reason/reauth checks, wrong-tenant mutation confirmation, expired trial, initial unpaid plan, paid grace, stale/replayed payment, wrong amount/currency/tenant, secret-ref read restrictions, unsigned gateway, verified channel account mapping, approved knowledge visibility, audit immutability, connection UNKNOWN and state disabled by default.
- Local test command: `cd ops/super-admin && python -m pytest -q tests`.

| Stage | State | Evidence |
|---|---|---|
| Source code + backend tests | PASS locally | Test output count (no live dependencies) |
| GitHub Actions independent CI | PENDING | Inspect new PR CI run after push |
| API persistence after restart | PASS locally | SQLite reopening test (not D1) |
| Production Sites authenticated routing | UNVERIFIED | Sites source not available |
| Browser desktop/tablet/mobile UI | UNVERIFIED | No new UI deployed |
| Messenger/LINE/Zalo/Telegram OAuth | NOT IMPLEMENTED | Stage adapter design only |
| Real payment provider | NOT IMPLEMENTED | Signed sandbox fixture only |
| Real knowledge RAG to website AI | NOT IMPLEMENTED | Approved version storage only |
| Production backup and restore | NOT TESTED | Stage migration gate outstanding |
| Tenant entitlements in live n8n | NOT CONNECTED | No production tool writes were made |

**Release readiness: NOT VERIFIED.** Count of passing staging tests is not a promise that the live Sites application is secure or commercially operational.