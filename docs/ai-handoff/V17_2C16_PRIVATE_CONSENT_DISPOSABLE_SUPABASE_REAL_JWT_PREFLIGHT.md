# TIEN404 V17.2C.16 — Private A/B Consent Intake × Disposable Supabase Authorization × Real JWT UAT Preflight

Date: 2026-11-18 JST.
Parent: GitHub Draft PR #392.
Predecessor V17.2C.15 checkpoint SHA `bbdab75a976059db5cd8e1b7baf18411c1229bb4`.
**Decision: PRIVATE REAL JWT AND SUPABASE BRANCH MIGRATION — NO-GO.**

## 1. Runtime evidence, verified
- Source-only contract run [44169626484](https://github.com/ngoctien20/demo-git/actions/runs/44169626484) = SUCCESS.
- Ephemeral PostgreSQL 17 RLS/rollback run [44169626470](https://github.com/ngoctien20/demo-git/actions/runs/44169626470) = SUCCESS.
- Supabase connected projects: `tien404-staging` (ref `ifxlvrhyjhbzbrkdsida`) and `ngoctien20-bio` (ref `svxkwpmxgnfvewzwsbdt`). Neither is an approved disposable Commerce QA project; do not repurpose BIO.
- Supabase development branches of `tien404-staging`: empty. Current staging contains existing Commerce rows. Do NOT execute candidate migration there.
- No independent, protected signed QA A and QA B consent receipts or verified private Auth session evidence. Real JWT UAT is not authorized.
- Header Name `x-tien404-pairing` was operator-attested in V17.2C.6A; no credential secret was read.

## 2. Implemented: fail-closed independent private consent validator, source only
- `qa/v172c-rpc-closure/v172c16-private-ab-consent-admission.cjs` uses Node built-in `crypto.verify` on **Ed25519-signed receipts** and a canonical versioned payload. Its public verification keys, expected issuer and Auth subject references, project and tenant MUST come from a trusted private local/server configuration, never receipt-supplied keys or chat/GitHub.
- Two slots QA_A/QA_B must have distinct trusted signing keys, distinct issuer refs, distinct subject refs, distinct stores within same synthetic tenant/project; 24h maximum receipt lifetime, scope `synthetic_catalog_readonly_no_send_no_write`, no future-issued or expired receipts.
- Gate requires private session binding and independent actual consent auditing, explicit isolated disposable approval, founder/reviewer authorization and rollback approval, all **from independent private verifiers**. Boolean flags in CI are synthetic and must never be substituted for evidence from real services.
- On missing/invalid signature, wrong principal, cross-tenant, revoked scope, absent private session evidence or absent approvals: returns `DENY`. When every mocked field is true, returns **`REVIEW_REQUIRED_NOT_JWT_GO`** — NEVER automatic authorization to run real JWT UAT.
- `qa/v172c-rpc-closure/v172c16-private-ab-consent-admission.test.cjs` contains synthetic in-memory keypair tests. It is a source-only security contract, not an operational consent capture service, does not store or issue a real human consent receipt, and cannot validate actual Supabase access tokens.
- Only the approved private consent registry may store signed receipts. Never commit or post receipt contents, private subject refs, real JWTs, credentials, OTP, passwords, session IDs or service role keys to GitHub/ChatGPT.

## 3. Actual private operational intake — **not yet completed**
1. QA Actor A independently opens the approved protected application/session and signs in through Supabase Auth. A clearly consents to a short-lived synthetic Store A read-only/no-send/no-write scope and ability to revoke. The trusted service validates actual Auth session server-side.
2. QA Actor B separately does the same in a distinct verified Auth session, consenting to Store B within the same synthetic Tenant.
3. Trusted consent service registers private subject bindings and two independent trusted signing key IDs; independent reviewer matches store/tenant authority and keeps receipt data private.
4. The private verifier produces ONLY a redacted result: verified actor slots, distinct membership assertion, receipt expiry class and audit references without identifiers. This public GitHub document is NOT such a receipt.
5. Founder/security owner approves a new isolated disposable Supabase branch/project cost and data retention, written recovery/drill plan, and specific no-send PostgREST test window. Branch creation can incur compute charges and was **not requested or performed**.
6. Only after the approved branch exists, apply candidate schema there and rerun real PostgreSQL metadata check. Provision synthetic accounts and Store A/B fixtures under separately scoped authorization. Execute real short-lived Supabase Auth JWT A/B PostgREST catalog read-only tests and cross-Store denials, with sanitized evidence.

## 4. Admission matrix
| Gate | Verified status |
|---|---|
| Ephemeral PostgreSQL RLS and rollback | TESTED PASS on independent local CI |
| New private signed receipt source and tests | IMPLEMENTED (CI pending for final SHA) |
| Two independently signed real consent receipts | BLOCKED / not collected |
| Independently verified live A/B Auth sessions | BLOCKED / not collected |
| Approved disposable Supabase project or branch | BLOCKED / none currently listed |
| Approved cost and recovery drill | BLOCKED |
| Real JWT A/B Supabase read-only negative UAT | NOT RUN / NO-GO |
| Production | NO-GO |

No change was made to staging DB, auth accounts, credential, n8n published workflow, Messenger/Zalo, customer data or payments. Rollback: revert source-only Draft commits or close PR #392. Do not report RELEASED.
