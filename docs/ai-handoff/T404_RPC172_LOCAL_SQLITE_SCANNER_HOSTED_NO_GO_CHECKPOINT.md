# TIEN404 AI — RPC17.2 Real Local Durable Object SQLite × Offline Scanner × Hosted Admission Review

**2026-11-17 JST — SOURCE IMPLEMENTED / CI PENDING / CLOUD HOSTED NO-GO**

## Verified parent
- RPC17.1 Draft PR #327 on head `b7a4e1bc92fbeabb580e9c7c2d28c5791661297a`, itself stacked on RPC17 PR #322 and RPC16 PR #313.
- No existing RPC16 Cloudflare Worker, Access, R2, Supabase or n8n mutation during RPC17.2.

## Source implementation
- `runtime/worker.mjs`: real Durable Object class using SQLite `sql.exec` and synchronous `storage.transactionSync` for nonce replay and per-operator quota; no await between related SQL operations, no public entry point (always 404).
- `sqlite-runtime.test.mjs`: Miniflare Workerd tests for 20-concurrent nonce claims, quota, operator/store isolation, persisted SQLite across a new Miniflare instance, invalid input and public 404.
- `scanner-bridge.mjs`: injected offline scanner transport, binds signed Ed25519 CLEAN receipt to full SHA256 file bytes, tenant, store, scanner ID and object; no external scanner host, R2, upload, URL fetch or file render.
- `scanner-bridge.test.mjs`: synthetic signed receipt and negative-path tests including malware, hash/store mismatch and scanner unavailable.
- GitHub Actions only local Workerd, Node tests and inherited RPC13-17.1 suites. It does not perform Cloudflare API write.

## Important limitations
- Local Miniflare Workerd SQLite persistence is NOT independent hosted evidence, NOT multiple geographic instances, not real service authentication.
- DO is reachable only through internal namespace in test; no hosted DO deployed. Current DO accepts test-supplied synthetic operator ID and lacks broker-verified authorization; must never expose as an internet endpoint.
- The local quota has a fixed 3 / 60 seconds window and retains replay nonce indefinitely in the local fixture. Real deployment requires nonce retention TTL policies, capacity limits, trusted store routing, abuse resilience, monitoring and stable preservation of nonce replay guarantees.
- Scanner integration only validates *test-signed* result from an injected callback. No running malware engine, CDR, sandbox, isolation boundary, malware signature feeds, reviewer workflow or accepted Merchant evidence.
- Store A/B authenticated Supabase JWT, P1/P2/O1/O2 primary owner evidence and independent security signoff remain missing.
- The pre-existing RPC10 workflow failure is outside this PR and remains to be audited.

## Admission gate
NO Access Allow policy, public route, merchant upload, scanner cloud service, external egress, R2 read/write, DO cloud provisioning or paid resource without separate explicit authorization, verified identity and finance scope. `can_upload` remains false.
A future hosted UAT must use dedicated private identity, fresh MFA, scoped host Access, independently confirmed real Store A/B JWT, separate reviewer and rollback, then only no-send canary on synthetic records before real Merchant docs.

## QA/rollback
- Confirm exact GitHub run and CI pass counts from logs; do not promote based on local source presence.
- Rollback: close/revert source-only child Draft PR; preserve RPC16/RPC17/RPC17.1 and all live cloud resources unchanged.
- Snapshot: base `b7a4e1bc92fbeabb580e9c7c2d28c5791661297a`.

CHECKPOINT: RPC172_LOCAL_WORKERD_SQLITE_SOURCE · SCANNER_OFFLINE_RECEIPT · PRIVATE_NOHOST · MERCHANT_NO_GO
