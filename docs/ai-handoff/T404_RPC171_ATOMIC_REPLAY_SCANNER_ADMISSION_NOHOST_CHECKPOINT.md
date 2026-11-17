# TIEN404 AI — RPC17.1 Durable Replay Ledger × Private Rate Limit × Scanner Admission

2026-11-17 JST · SOURCE-ONLY · NO-SEND · HOSTED NO-GO

## Parent and scope
- Child of RPC17 Draft PR #322 at `eff4038de28f78cfbe5011e3a3ce929f59cd6ddc`, itself child of RPC16 PR #313.
- Adds `qa/v152-rpc171/atomic-admission.mjs` and tests.
- Retains Cloudflare RPC16 inactive 404-only Worker, Access DENY ALL, private R2, no hosted changes.
- All integration tests use synthetic, test-generated Ed25519 keys and fabricated PDF bytes; no secrets, customer or merchant data.
- No new Cloudflare DO, Access, R2, route, credential, database, provider call, or paid resource.

## Threat controls demonstrated locally
1. Verifies externally pinned Ed25519 scanner verdict bound to exact SHA256 full bytes, tenant/store/object/scanner, audience, CLEAN status and 120s maximum freshness.
2. Fails closed on missing signatures, unknown key, forged evidence, mismatched file/hash/store, stale or malicious status.
3. Uses an `async claimAtomic` interface to require a single atomic replay-claim + rate-quota decision for each nonce and tenant/store/operator bucket. Synthetic in-memory implementation exercises concurrency only: **not durable after restart or across isolates**.
4. Valid invitation + valid file + scanner CLEAN + successful mock claim can produce OFFLINE_REHEARSAL_ONLY, but `can_upload`, `can_send`, `can_open_access` ALWAYS false.
5. Head metadata checks do NOT perform malware scanning, CDR, PDF full parsing or image sanitization. Signed receipt is a CONTRACT, not a deployed scanner.

## Deployment admission requirements (BLOCKED)
- Independently authenticated owner/security approval, explicit Cloudflare cost ceiling, dedicated managed secrets and operator rollback.
- Real Cloudflare Durable Object SQLite atomic transaction under hosted failure/restart/concurrent claims, rate limit keyed by trusted identity rather than browser-submitted strings, nonce TTL cleanup preserving required replay semantics.
- Isolated malware scanner with managed engine/signatures, safe decompression, deterministic CDR and signed result retrieval; all bytes in private quarantine, never user-facing before review.
- Server-verified Supabase Auth Store A/B and Cloudflare Access principal, stable tenant/store canonical lookup, signed Merchant P1/P2/O1/O2 source proofs, independent reviewer.
- Private retention and deletion policy, audit metadata hygiene, no risky file display and verified restore path.
- Separate authorization to create Worker/DO, open Allow policy, accept actual Merchant files, or run hosted acceptance tests.

## QA
- GitHub Actions results MUST be verified from exact HEAD commit and run logs before saying passed.
- Source rollback: close child Draft PR, preserve parent RPC17/RPC16 and all hosted resources.
- No production impact.

CHECKPOINT: RPC171_SOURCE_ONLY · ATOMIC_INTERFACE_MOCK · SCANNER_SIGNED_RECEIPT_MOCK · NO_UPLOAD · HOSTED_NO_GO
