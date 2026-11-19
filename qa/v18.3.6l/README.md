# TIEN404 AI — V18.3.6L

**Authoritative Auth Revocation Architecture Review × Production Key Custody Design × Protected Gateway Threat-Model Closure**

**Date:** 2026-11-19 JST. **Parent:** Draft PR #442 / V18.3.6K final `24d76901081bf6f56f1c353339cceac935d81322`, GitHub Actions #44497091023 SUCCESS (289/289 + cross-runtime HMAC).

**Status:** `OFFLINE ARCHITECTURE/NEGATIVE QA / REAL SECURITY APPROVAL BLOCKED`.

## Contents

- `AUTH_REVOCATION_ARCHITECTURE_ADR.md`: authoritative-session model and preferred **same-PostgreSQL transaction** candidate for `auth.sessions`, membership, nonce and scoped data read; external signout race unproved.
- `PRODUCTION_KEY_CUSTODY_ADR.md`: Supabase Auth verifier vs TIEN404 Ed25519 issuer vs K RPC signing keys; two reviewed alternatives for signing verification; no real keys or KMS connected.
- `GATEWAY_THREAT_MODEL_AND_CLOSURE.md`: six P0 and three P1 concrete threat gates and evidence owner requirements.
- `revocation-architecture.mjs`: pure simulation of Auth/PG revocation ordering, explicitly never authorizing any operation.
- `key-custody-proposal.mjs`: metadata-only key-separation/revocation review, never enabling signing.
- `gateway-threat-gate.mjs`: evidence hashes **only**; no human review status or release admission.
- `test-security-architecture.mjs`: 51 deterministic offline negative and review-contract tests.
- Dedicated GitHub Actions workflow runs the 51 tests and inherited G/H/I + K offline regression, scans the candidate for secrets/network calls, validates threat-register files.

## No-go limitations

- No PostgreSQL schema changes in connected Supabase.
- No call or inspection of actual Supabase Auth `auth.sessions` rows, JWTs, user IDs, owner sessions or customer Orders.
- No actual KMS/HSM keys, key rotation, permissions or service-role deployment; all reviewed signing material is described by metadata only.
- No provider webhook/send/credential changes; no n8n/Cf worker modifications.
- No independent human reviewer signoff; no P0 verified closed; no Store A/B real admission.
- Draft PR only; **DO NOT MERGE/DEPLOY**.

See source docs:
https://supabase.com/docs/guides/auth/sessions,
https://supabase.com/docs/guides/auth/signing-keys,
https://supabase.com/docs/guides/auth/server-side/advanced-guide,
https://www.postgresql.org/docs/17/explicit-locking.html.
