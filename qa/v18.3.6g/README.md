# TIEN404 AI — V18.3.6G

**Independent Security Review × Private Signed Authority Issuer Contract × Real Auth A/B Admission Preflight**

**Status:** `CANDIDATE — OFFLINE ED25519 QA / REAL AUTH A/B BLOCKED / NO STAGING DDL`  
**Parent:** V18.3.6F Draft PR #425, commit `daee41076c02d16c7ff902db600a407e8e44f429`.  
**Date:** 2026-11-18 JST.

## What is implemented

1. `signed-authority.mjs` — actual Node.js Ed25519 sign and verify operations for a **read-only, short-lived private authority JWT**. Only `CATALOG_READ` and `ORDER_READ`. Verifier pins exact `kid`, `typ`, algorithm, issuer/audience, Tenant/Store/session, membership revision, expiry and checks a single-use nonce.
2. `test-signed-authority.mjs` — 60 tests for crypto integrity, wrong Store, wrong session, stale membership, expired/revoked access, key/algorithm confusion and concurrent replay.
3. `real-auth-ab-preflight.mjs` and `test-real-auth-ab-preflight.mjs` — 15 tests for fail-closed admission readiness, requiring two independent Owners in the same Tenant, protected verifier, approved schema, backup, independent security review and redacted evidence. **Never claims a real Auth UAT was performed.**
4. `test-independent-structural-review.mjs` — 18 second-pass static checks against actual F/G code to preserve critical known findings and avoid silent privilege assumptions.
5. `SECURITY_REVIEW_FINDINGS.md` — 16 specific security findings and remediation gates. It is an automated engineering review; **an independent human reviewer has not approved it**.
6. `PRIVATE_SIGNED_AUTHORITY_CONTRACT.md` — exact claims, trust boundaries, issuer API, key handling, nonce and session requirements.
7. `REAL_AUTH_AB_ADMISSION_PREFLIGHT.md` — private real Owner A/B read-only admission requirements and observed staging blockers.
8. GitHub Actions runs 93 tests using Node built-ins only. CI keypairs and HMAC binding secrets are random in-memory fixtures; no private key files, npm dependencies, HTTP integrations, credentials or real customer data.

## Important distinctions

- **Crypto test ≠ real session proof.** The Ed25519 signature is real cryptography, but keypairs and all Supabase Auth/membership callbacks are synthetic. An operator must implement, protect and independently review the real server-side adapters.
- **Reviewer code ≠ independent human reviewer.** Even if the separate static review suite passes, an authorized second human reviewer must sign off before any real Auth UAT.
- **Read-only authorization ≠ production Commerce writer.** No order creation/update, provider sends, channel installation, media rights, payment or product/stock writes are included in G.
- **Postgres RLS ≠ service-role isolation.** The F executor bypasses RLS and remains a P0 production blocker unless a separately reviewed narrow gateway ensures all operations are scoped.
- **Metadata readiness ≠ real Auth A/B admission.** Real A/B preflight remains BLOCKED with current Supabase staging schema.

## External services and effects

No Supabase DDL/DML, Auth session reads, provider account queries, n8n workflow execution, service-role credentials, Meta/Zalo sends, webhooks, Cloudflare changes, real Orders/Stock edits or production deployment. All repository changes are isolated to this QA candidate and its dedicated CI workflow.

## Release decision

- `V18.3.6G_OFFLINE_ED25519`: CANDIDATE pending verified CI.
- `V18.3.6G_SECOND_PASS_STATIC_REVIEW`: CANDIDATE pending verified CI.
- `V18.3.6G_INDEPENDENT_HUMAN_REVIEW`: BLOCKED.
- `V18.3.6G_REAL_SUPABASE_AUTH_AB`: BLOCKED.
- `V18.3.6G_PRODUCTION_ISSUER`: NOT IMPLEMENTED.
- `STAGING_DDL / LEGACY_BACKFILL / PROVIDER_SEND / PRODUCTION_WRITER / RELEASE`: NO-GO.

## References

- [RFC 8725 JWT Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725)
- [Supabase User Sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims)
- [Supabase Advanced Server-Side Auth Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
