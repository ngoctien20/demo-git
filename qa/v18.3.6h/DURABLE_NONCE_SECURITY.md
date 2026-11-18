# V18.3.6H — Durable Nonce PostgreSQL 17 Rehearsal

## Security boundary

The disposable PostgreSQL 17.12 test schema is `qa_h_private` with:
- `nonce_ledger` columns: issuer, audience, JTI UUID, Tenant digest, Store digest, authority SHA-256, expiry and consume timestamp.
- PRIMARY KEY `(issuer, jti)`, making JTI globally single-use under that issuer even if a malicious caller swaps Store or signed authority digest.
- Protected `consume_verified_nonce` function with fixed issuer/audience, 64-hex digests and expiry > now and ≤ 120 seconds.
- `ON CONFLICT DO NOTHING` returns `REPLAY` on duplicates, enforcing atomic compare/insert across separate PostgreSQL connections.
- Dedicated no-login nonce owner; separate no-login caller has EXECUTE but no table SELECT, INSERT, UPDATE or DELETE; public/untrusted roles have no private schema usage.
- PostgreSQL RLS enabled on ledger as defense in depth; the function's owner privilege is explicitly a privileged boundary.

The function **does not verify Ed25519 itself** and accepts digests as parameters. It MUST only be invoked after a dedicated server-side cryptographic verifier validates token signature, tenant/store, audience, capability, membership and current session. Its SQL function name/schema is not to be exposed via the Supabase Data API or uncontrolled n8n tools.

## Rehearsal

GitHub Actions creates a synthetic PostgreSQL 17.12 container with `--network none`, no exposed DB port, creates disposable DB `tien404_v1836h_disposable`, runs 34 pgTAP assertions, then sends the SAME JTI from two concurrent independent SQL connections (expect exactly one ACCEPTED and one REPLAY). Restart container and assert persisted nonce still blocks replay. Verify the ledger has exactly one row for the racing JTI.

The nonce ledger persists across **database process restart** in this disposable CI. It does not prove distributed-region consistency, backups/PITR, multi-cloud replication, outage recovery, retention scheduling, or integration with the live G verifier. Parent G currently passes `consumeNonce({jti,expiresAt})`, while H ledger also expects verified issuer/audience and canonical Store/authority digests. **A protected adapter binding the full verified token context is a separate integration gate; do not pass client-supplied hashes as authority.**

## Retention and operations

A production nonce must not be purged while any associated signed token can still be redeemed. Adopt explicit retention longer than max TTL + clock-skew allowance (recommend ≥24 h), atomic cleanup guard, encrypted database backups, monitoring, retry strategy, and separate error/replay telemetry. No cleanup job is deployed here. A store failure returns DENY, never ALLOW. The test table is discarded at the end of the CI run.

## Stop conditions

No staging DDL, no credential grants, no production issuer deployment, no public PostgREST exposure, no service-role reuse, no provider sends, no Commerce writes.
