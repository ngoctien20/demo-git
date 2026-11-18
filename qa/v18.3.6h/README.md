# TIEN404 AI — V18.3.6H

**Trusted Supabase Session Adapter Contract × Durable Nonce PostgreSQL 17 Rehearsal × Independent Security Admission Gate**

**Classification:** `QA CANDIDATE / OFFLINE FIXTURES / DISPOSABLE PG17 ONLY`  
**Parent:** V18.3.6G Draft PR #431, head `425ec533e3b4777b4a9e81c2b1140d218c396694`.  
**Base branch:** `qa/v1836g-private-signed-authority-preflight-20261118`.

## Deliverables

- `trusted-session-adapter.mjs`: fail-closed contract demanding server-resolved opaque session handle, trusted JWT signature/issuer/audience check, Supabase Auth user consistency, authoritative active-session lookup and canonical Store-scoped membership query. **Callbacks are MOCKED in CI; no actual Supabase connection.**
- `test-trusted-session-adapter.mjs`: 27 offline tests, including integration against the V18.3.6G Ed25519 issuer with ephemeral test keys.
- `01_NONCE_PG17_DISPOSABLE.sql`: actual private PostgreSQL 17 nonce ledger and restricted `SECURITY DEFINER` SQL function, unique on `(issuer,jti)`. No direct table rights to caller.
- `02_PGTAP_NONCE.sql`: 34 real PostgreSQL pgTAP assertions for grants, Store/authority digest checks, issuer/audience, TTL, duplicate nonce and incorrect scope.
- `independent-security-gate.mjs`: signed reviewer-evidence evaluator, **offline only**. Valid crypto does not prove a real independent human reviewer.
- `test-independent-security-gate.mjs`: 20 offline tests for reviewer≠implementer, P0 resolution, review expiry, signature, evidence hashes and actual staging blockers.
- Dedicated GitHub Actions: predecessor G 93-case regression, H 27+20 offline tests, 34 pgTAP tests, two independent SQL connections consuming same JTI and restart-persistence replay check.
- `AUTH_SESSION_ADAPTER_CONTRACT.md`, `DURABLE_NONCE_SECURITY.md`, `INDEPENDENT_SECURITY_ADMISSION_GATE.md`, and final `QA_CHECKPOINT_V18_3_6H.md`.

## Admitted proof scope

- Synthetic session adapter/Ed25519 integration only; not real Supabase JWT or live Auth session.
- PostgreSQL 17 disposable nonce ledger is **real database persistence**, not a local Map, but no hosted production D1 or Supabase deployment.
- A signed reviewer-test statement is just a cryptographic fixture. **No independent real security reviewer has approved** the project.
- The reviewed staging schema still does not include canonical `stores`/`store_memberships` or Commerce `store_id`.
- All code is read-only authority proof or test-only nonce writes in an isolated database. No Commerce writes, provider sends, credential access or staging DDL.

## Explicit NO-GO

Real Auth A/B, production issuer, protected live session adapter, real owner consent, independent human security approval, Meta/Zalo/Website installation claims, service-role production gateway, live staging migration, legacy backfill, Commerce writer, billing and notification send are **BLOCKED**.

Do not merge this Draft PR as migration or release authorization. See [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims), [PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) and [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725).
