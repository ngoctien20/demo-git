# TIEN404 AI — V15.0-03H.9
## Independent Signer Evidence Review × External Backup Executor Idempotency Contract

**16/11/2026 JST · DRAFT / SOURCE-ONLY / SYNTHETIC NO-SEND · NO LIVE BACKUP / NO HOSTED WRITE**

### 1. Source of truth
- Child branch based on H.8 Draft PR #153 exact HEAD \`da889b9ec89242ac35b11ada32efa6d4ef6b407e\`. Parents #149 (H.7), #141 (H.6), #135 (09D). All unmerged, no production deployment.
- Read-only hosted Supabase staging ref \`ifxlvrhyjhbzbrkdsida\`: **3 Auth, 2 Tenants, 3 active Tenant Memberships, 2 Products, 2 Orders, 0 Storage buckets; no canonical Stores/StoreMemberships**. Legacy QA paired/CONFIRMED Owner is not independent human/Provider G2.3 owner attestation.
- Separate real identities remain unverified: **merchant owner** only authorizes Store/Channel; **platform data controller** is responsible for entire multi-Tenant staging data; **independent security reviewer** validates; **backup operator** is not allowed to self-approve.

### 2. Private signer evidence review: code vs real evidence
- \`qa/v1503h9-private-executor/independent-signer-evidence.cjs\`: reads a **synthetic** H.8 enrollment intake and 3 mock evidence lanes, strictly cross-checks signer/role/witness/opaque identity and possession receipts, requested project, expiry, key fingerprints, distinct principal digests and issuers. It fails closed for fake \`approved\` flags, leaked secrets, swapped signer, reused receipt, revoked/expired evidence, mismatched source fixture digest.
- Even a structurally coherent packet returns **SYNTHETIC_EVIDENCE_CONSISTENT_NOT_REAL_ATTESTATION**. This DOES NOT authenticate a real human, independently fetch a source, establish real key possession or verify signed private approvals. It returns **all authorization flags false**.
- A production-ready review requires identity verification by an independent authorized human, proof of organizational role, fresh MFA/session integrity, protected Ed25519 signing keys, nonce-bound proof of possession, a verified private vault with minimal-access logging, revocation/key rotation, and signed request digest. No real key, owner receipt, document, certificate or secret should be pasted into public GitHub or CI.
- **Never certify identity from opaque SHA-256 of a guessed phone/email.** These fixtures use random-looking IDs and hashes solely for structural QA; real identity must be checked out of band.

### 3. External backup executor idempotency: design contract
\`qa/v1503h9-private-executor/synthetic-external-sink.cjs\` is deliberately only an **in-memory synthetic object metadata simulator**. It makes **zero** actual object store, filesystem, network, Supabase, Meta, Zalo or backup calls. It cannot import customer data or accept arbitrary file bytes.

**Immutable identity tuple**: \`projectRef + signedRequestDigest + nonceDigest + operationRef\`; resulting deterministic SHA-256 \`artifactRef\` is only a MOCK reference, not an encryption key or real storage key. One signed requestDigest cannot be bound to multiple operationRefs/nonces. Real systems should use an unpredictable, protected idempotency ID and securely store the binding, not expose the hash as authorization.

**Admission gate**: Only a mock staging-only plan with 12 ordered H.6 coverage components and explicit \`hostedExportAuthorized=false\`, \`realSignerVerified=false\`, \`externalWritesEnabled=false\` can be simulated. A source packet that claims any real permission is rejected. The simulator enforces a worker/fence and an unexpired lease and authorization, but **these fields are caller-provided QA metadata, not true authority**.

**Staging contract**: Each of 12 H.6 coverage classes is represented by an opaque digest and size declaration, not actual data. Replaying an identical part is a no-op. Replaying the same component with a different digest or size permanently enters \`NEEDS_REVIEW\`; existing metadata is never overwritten. Missing component prevents seal.

**Commit / lost ACK**: \`seal\` deterministically hashes the manifest, marks a synthetic receipt SEALED and disallows further writes. If an ACK is lost after sealing, \`inspect\` observes that one mock manifest and the request is **not re-executed**. SEALED is **not real BACKUP_VERIFIED**, encryption verification or restore certification.

**Crash / timeout**: An incomplete synthetic receipt gets \`PRIVATE_MANUAL_RECONCILIATION_REQUIRED\`. An expired/uncertain lease or conflicting chunk is quarantined; there is no automatic rearm. A real private operator must inspect the actual encrypted destination, object version, integrity and custody before any future separately approved retry.

**Critical production requirements NOT implemented**:
1. A protected trusted enrollment/authorization issuer, actual two-human signatures, real operator identity and scope; the mock simulator cannot supply these.
2. Persistent PostgreSQL approval ledger with fencing + strict least privilege; H.8 PG17 is disposable and not deployed.
3. An external storage destination with **atomic conditional create** (If-None-Match/compare-and-swap or equivalent), immutable names, versioning and server-side enforcement of the fence/idempotency key. Relying on an in-memory map does not prevent collisions across processes/restarts.
4. Streaming encrypted backup artifact custody with application data/roles/Auth/Storage coverage, checksum, encryption/key management, scoped retention and complete audit; none exists yet.
5. A durable **reserve → upload provisional → verify+commit → reconcile success/uncertain/abort** protocol with independently approved retries, external side-effect cancellation, failure injection, private restore and measured RPO/RTO.
6. No automatic retry after a worker crash even when the local lease expires. Real external exactly-once *cannot* be inferred from a successful DB UPDATE.

### 4. Test acceptance and labels
- H.9 Node22 independently checks synthetic evidence and no-real-auth flags, duplicate/competing operation, partial metadata conflicts, receipt replay, lost seal ACK, 12-class manifest completeness, crash quarantine, synthetic lease expiry, stolen fence/worker, malformed scopes and credentials.
- CI inherits H.8/H.7/H.6 Node tests and runs H.8 disposable PostgreSQL17 lease SQL, independently checking 8 parallel reservations (1 succeeds, 7 denied) and no rearm after a simulated crash.
- Valid CI means \`PASS_SYNTHETIC_SOURCE_ONLY\`, NOT actual hosted backup or actual owner certification.

### 5. Release gates
| Gate | Status |
|---|---|
| H.9 synthetic independent evidence receipt consistency | SOURCE QA only |
| H.9 deterministic metadata object sink / replay / crash QA | SOURCE QA only |
| H.8 persistent lease in hosted / trusted operator | BLOCKED |
| True independently verified Controller/Security/Operator identities and approvals | BLOCKED |
| Real encrypted vault, source export coverage, external conditional create and complete custody | NOT DEPLOYED |
| Real one-time hosted backup, SHA and isolated restore certification | NOT AUTHORIZED / NOT EXECUTED |
| Merchant owner G2.3, canonical Store, signed hosted JWT Shop A/B/C | BLOCKED |
| Hosted Store migration, Meta/Zalo customer send, commercial pilot | NO-GO |

### 6. Safety / rollback
This is a **new source-only child Draft branch**. No Supabase hosted DDL/DML/RLS/GRANT/Auth/RPC, no credentials, backups, restores, n8n Published, Meta/Zalo sends, Orders/Stock writes, Cloudflare production or paid models. Closing the Draft PR reverts H.9 source without modifying parents #153/#149/#141/#135 or Store migration #133.

**Next decision:** collect real private controller/security/operator evidence only through an approved independently audited private channel; do not attempt hosted export until explicit project-wide scope/cost/security/retention approval and a supported protected export operator exist. Any external executor implementation must pass a separate security threat model and live proof-of-identity review first.
