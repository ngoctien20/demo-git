# TIEN404 AI — V18.3.6K

**External Auth Revocation Fail-Closed Adapter × Signed RPC Caller Isolation × Final-HEAD Regression Acceptance**

**Date:** 2026-11-19 JST. **Classification:** QA CANDIDATE / SYNTHETIC ONLY. **NO LIVE AUTH / NO STAGING DDL / NO PRODUCTION SEND**.

**Parent:** V18.3.6J Draft PR #439, head `6a91050fdf268ec0efe3166edcd609a59eaf3987` (previous final-HEAD CI was not confirmed).

## Implementation scope

- `fail-closed-signed-rpc.mjs` combines I's actual Ed25519 verifier with a callback contract for a **fresh server-side authoritative external Supabase Auth session check**. Missing, revoked, mismatched, stale, future, overly long or unavailable verdicts deny without reaching PostgreSQL.
- Successful synthetic external Auth proof binds exact signed nonce/Store/subject/session to a single read-only resource, then signs a K1 canonical HMAC (SHA-256) to be checked inside PostgreSQL. Neither external verdict nor key material is accepted from a client or user message in the design.
- `test-fail-closed-signed-rpc.mjs` — 30 offline tests for signature, replay, wrong Store, external revocation, dependency outage, stale/forged verdict, HMAC and privilege boundaries.
- `01_PG17_SIGNED_RPC.sql` — disposable PG17 private HMAC verifier using `pgcrypto`, a private synthetic signer registry, and K-specific NOLOGIN EXECUTE-only role. It closes I and J older synthetic EXECUTE grants to prevent a bypass path. After proof verification, it invokes J's transaction-bound catalog read including membership/session locks and nonce consumption within the **same transaction**.
- `02_PGTAP_SIGNED_RPC.sql` — 45 actual PG17 assertions including old route revocation, key ACLs, forged proof, expired Auth proof, Store A/B isolation and replay.
- `qa-cross-runtime-proof.mjs` — CI-only Node-generated HMAC fixture. Final CI compares its canonical digest byte-for-byte against PostgreSQL pgcrypto using a fixed synthetic timestamp; the 45 separate pgTAP assertions exercise actual signed RPC acceptance and short-lived Auth proof rejection.
- Dedicated GitHub Actions: GHI 164 Node assertions, J 50 PG17 assertions, K 30 Node assertions, K 45 PG17 assertions, Node↔PostgreSQL HMAC proof bridge.
- `AUTH_REVOCATION_PRODUCTION_GATE.md` — explicit remaining P0 risk and independent-review requirements.

## Security and limitations

1. Supabase Auth callbacks are MOCKED and the Ed25519 issuer keys ephemeral. Neither actual Supabase JWTs, sessions nor real owner consent are verified.
2. The HMAC signer secret in disposable SQL is a **synthetic, public fixture**; do not deploy it, copy it into staging or treat it as production key custody.
3. This code has no network API, no real Postgres connector and no provider credentials; the JavaScript and SQL parts are independently tested plus one synthetic HMAC cross-language vector.
4. A fresh Auth check immediately **before** RPC is not atomic with external Supabase Auth revocation **after** that check. A stale-but-not-yet-expired remote decision may permit a read. The K pgTAP intentionally demonstrates this as an unresolved P0.
5. The K function still runs as a SECURITY DEFINER fixture owner. True production role separation, database secret custody, per-tenant key rotation, real Auth revocation synchronization, live issuer, independent reviewer and secure API exposure need additional proof.
6. The prior J public/private RPC grants are revoked **only inside the disposable database**. No connected Supabase grants were modified.
7. The protected operation reads only synthetic catalog code/price. No Orders, real stock, customer PII, provider sends, billing, migration or production writer.

**Release decision:** OFFLINE QA only. REAL AUTH A/B, LIVE ISSUER+SIGNER, STAGING MIGRATION, PRODUCTION GATEWAY, PROVIDER SEND and COMMERCE WRITER = **NO-GO**.
