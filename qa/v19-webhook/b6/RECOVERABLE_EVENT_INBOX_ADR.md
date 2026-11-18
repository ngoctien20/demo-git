# TIEN404 V19.0-B6 — Recoverable Event Inbox & Encryption ADR

**Date:** 2026-11-18 JST
**Status:** SOURCE-ONLY CANDIDATE, LOCAL WORKER D1 BINDING TESTED, NOT LIVE-CUSTOMER READY.

## Why B5 was insufficient

B5 persisted only synthetic fixture references and HMAC digests. It could not recover the event body after a crash. B6 tests a narrow encrypted-recovery pattern without real messages, provider credentials, Store authority, order writes or outgoing messages.

## B6 implementation in isolation

- Data plane: Miniflare/workerd LOCAL D1 binding, table v19_b6_qa_encrypted_inbox, never in hosted D1.
- Encryption: AES-GCM 256-bit key, 96-bit random IV, 128-bit authentication tag, per-event AAD consisting of the constant prefix TIEN404_B6_AES256_GCM_V1, scope_key, event_key and key_version.
- Identity and payload binding: stable HMAC-SHA256 digest using a separate QA pepper; D1 primary key (scope_key,event_key) and conflict rule reject altered payload or unexpected key version without rewriting existing ciphertext.
- Key ring: QA_K1 and QA_K2 synthetic versions only. Test keys are fixture constants, NOT service credentials. Production requires a managed secret/KMS integration, key rotation, revocation, access logs and decryption policy.
- Storage: only ciphertext, IV, opaque digests, key version, fixture ref and state. No raw customer IDs, plaintext messages, phone, address, orders or Bot credentials.
- Recovery: only for active, unexpired lease token; decrypt with exact AAD; verify payload HMAC and strict SYNTHETIC QA schema. No public endpoint exposes the recovered fixture.
- Timeout/retention: synthetic TTL up to one hour; no claim or recovery after expiry; no SQL purge, delete or retention automation. Production deletion needs explicit approval and QA.
- Recovery states: READY -> LEASED -> RETRY/DONE/DLQ, max three attempts. Atomic lease tokens use crypto.randomUUID, old lease cannot ACK. DONE means synthetic QA completion, not real provider delivery.
- Default Worker fetch always 423. Separate Miniflare harness is NOT deployable; fixed local-only synthetic fixture route.

## Trust boundary and promotion

Never promote a synthetic B6 receipt into Commerce Core. The B4 registry match is NOT real provider or Store authorization. Real merchant ownership, Store-level memberships/RLS, tenant scope, customer identity and provider channel ownership remain independent P0 requirements.

## Production requirements — PROPOSED, NOT IMPLEMENTED

1. Authenticate provider using correct channel-specific Bot/OA contract, with protected Access/WAF and rate controls.
2. Approve encrypted raw-event payload schema, source, event ID, installation scope, retention basis, key version and ciphertext. Do not log raw payload.
3. Persist recoverable encrypted payload plus durable receipt before approved provider ACK; verify provider retry/ack rules.
4. Implement a queue/scheduled consumer with bounded concurrency, per-Store idempotent commands and trusted authority; do not use best-effort waitUntil as sole durable mechanism.
5. After a verified downstream receipt, atomically mark processed. Reconcile ambiguous Meta/Zalo ACKs; no blind repeat sends.
6. Handle crash between outbound action and state write with durable outbox and idempotency; never claim exactly-once external delivery.
7. Define key rotation, old key recovery, crypto-shredding, retention, privacy audit and cost caps.
8. Test Store A/B RLS, tenant alias conflicts, subscription expired, wrong installation, client spoofed identity and prompts.
9. Hosted Worker Binding acceptance H01–H16 needs separate scoped owner approval and evidence.
10. Independent security review and release approval before deployment.

## Evidence and limitations

Local B6 QA tests actual local workerd D1 Binding, encrypted storage, wrong-key/tamper/AAD failure, bounded TTL, stale leases, concurrent claims, retry-to-DLQ and permanent Store authority denial.

This does NOT prove production cryptographic key management, real provider signature, hosted Worker Binding, WAF/Access, real Store RLS, recovery of actual customer data or durable Commerce processing.

**Classification:** EXPERIMENTAL / CANDIDATE for review; NOT APPROVED / NOT RELEASED.

References:
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/queues/
