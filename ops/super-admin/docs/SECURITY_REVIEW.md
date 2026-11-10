# TIEN404 AI V4 — SECURITY_REVIEW

**Security gate: NOT APPROVED for production.** Audit date 2026-11-10. Stage database contains generated QA users and sample plans only. Real Control Hub Sites app code, D1 schema, authenticated session and production channels remain unverified.

## Implemented in staging, with automated unit/API evidence

- Password + TOTP MFA (Argon2id, encrypted TOTP secret, counter anti-replay, login throttle). Session ID is generated with `secrets`, stored hashed and transmitted only as Secure/HttpOnly/SameSite Strict cookie. Session revocation, reauth and CSRF token rotation are included.
- Backend RBAC for 5 roles, membership check per tenant; failed-access tests cover staff read/write, technician billing writes, support channel writes and tenant separation.
- Formally independent entitlement decisions: service enabled flag, manual bot pause, subscription status/dates, prior verified payment. New unpaid tenants do not receive a grace entitlement. Channel metadata must be mapped and VERIFIED in internal test fixture. Shared n8n workflows are never touched by this service.
- Payment fixture validates timestamp, HMAC, currency, amount, subscription/tenant, event idempotency, and denies fake screenshot confirmations. **This is intentionally NOT a production payment processor.**
- Channel credential references are opaque `vault://` pointers; the API never returns plaintext tokens or references; multi-tenant uniqueness prevents a single channel account being bound to two tenants.
- Versioned knowledge sources remain DRAFT until explicit approval; there is no automatic push to website AI, Messenger bots, RAG or customer workflows.
- Audit table is append-only under SQLite triggers, SHA-256 chained; request body/password/token are not recorded. It is NOT equivalent to externally immutable WORM storage.

## Risks that still block production

| Priority | Risk / missing control | Required action |
|---|---|---|
| P0 release gate | No authorized inspection of existing Site auth/D1 and access controls | Inspect app in Work, perform backup, compare framework and migrations; port policies in place |
| P0 release gate | External payment gateway and signature semantics unknown | Select provider, verify official webhook rules, handle retries/refunds/reversals and inspect audited signed events |
| P0 release gate | Real platform webhook authenticity, token vault, tenant mappings not verified | Implement official Messenger/LINE/Zalo/Telegram adapter, rotating secrets, provider account ownership and durable replay cache |
| P0 release gate | Local SQLite/Argon2/TOTP staging backend is NOT production-grade multi-instance infrastructure | Replace SQLite with audited Sites/D1 or approved datastore; central rate limiting; secure backups; authentication recovery; MFA enrollment and incident response |
| P1 | Approve/reject two-person changes to payment, admin and tenant service states | Workflow with durable approval rows and independent approver, reauth, audit and rollback |
| P1 | Missing scheduler/outbox for subscription renewal, notification and safe retry | Durable idempotent outbox, cron/reconciliation, confirmed payment source |
| P1 | No production encrypted token store/secret rotation | Vault/KMS binding, key lifecycle, restricted server role, secret-scoped leases |
| P1 | No production-grade rate limiting at gateway or password/TOTP reauth | Shared IP/user/device rate limits and challenge policies; detect abnormal logins |
| P1 | No authenticated browser security review at Control Hub | Test sessions, secure headers, CSRF, XSS, role escalation, refresh/logout/relogin and audit proofs |
| P2 | No billing calendar-month accuracy / VAT / merchant documentation | Approve prices and policy; implement time-zone-safe recurring invoices |
| P2 | No production assistant RAG, hallucination evaluation, scoped analytics | Build approved KB search + version guard + human review before publishing |
| P2 | No UI for role management and approval modal | Integrate with existing Sites UI after source audit; design staging and responsive QA |

## Threat model highlights

- Public website must never receive n8n admin token, GitHub PAT, Messenger page token, Zalo OA token or AI API key.
- Caller-controlled tenant_id is forbidden in unauthenticated channel payload. Server resolves tenant from verified platform account plus signed internal assertion. A spoofed or unmapped account gets no service.
- Store STAFF and OWNER membership is scoped by tenant. SUPPORT_ADMIN cannot modify billing or credentials; TECH_ADMIN cannot alter plans or approve paid status; SUPER_ADMIN requires fresh MFA for privileged writes.
- Client screenshot, browser redirect or speech cannot be interpreted as verified payment.
- Automatic integration from sales-demo workflows to paid Commerce is expressly prohibited; keep the separate sandbox intact.
- Confirm tenant_id on the exact action target to reduce wrong-store suspension; build real confirmation modal and two-person approval before production.

## Measured tests

Local: `pytest -q tests` against disposable SQLite and test-only HMAC keys; no production network. Coverage includes unknown API, revoked session, failed-login lockout, CSRF origin, exact tenant matching, wrong tenant suspension, trial/payment gating, duplicate webhook, missing/wrong signature, knowledge approval and audit tampering and private staging SQLite backup/restore integrity. View GitHub Actions run for independent result before merging.

## Release policy

Do NOT publish, merge into production Sites or connect to real tenant data until every P0 release gate is verified by authorized source review, a tested stage restore and a human-approved release plan. Do NOT claim that this is a live Super Admin SaaS.

Staging backup drill: `app.backup.backup_private_stage()` writes a 0600 SQLite snapshot only to an operator-controlled 0700 directory, computes SHA-256 and verifies `PRAGMA integrity_check`. `verify_stage_restore()` opens a separate connection and rechecks the audit hash chain. This is **not** a real Sites/D1 or n8n workflow export/restore.