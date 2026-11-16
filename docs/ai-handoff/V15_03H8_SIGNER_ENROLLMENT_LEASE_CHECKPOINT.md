# TIEN404 AI — V15.0-03H.8
## Trusted Signer Enrollment SOP × Crash-Safe Approval Lease & Recovery QA

**Checkpoint:** 16 November 2026 JST  
**Mode:** SOURCE-ONLY / SYNTHETIC / DISPOSABLE PostgreSQL 17 / NO-SEND / NO HOSTED BACKUP / NO-GO  
**Parent:** Draft PR #149 at a8f23bc34dd2d909e4443f9d577f800b970ffbce (unmerged); inherited H.7 registry, H.6 coverage and #135 dual-approval contract.

### 1. Authorization and identity boundaries
- The *Merchant Owner* consents to an exact Store↔Bot/Account channel. They cannot authorize exporting another tenant's data.
- The *Platform Data Controller* must have real authority over the whole Supabase staging project before authorizing any multi-Tenant logical export.
- An *Independent Security Reviewer* must be a different verified person/organization principal from the Controller, and must review purpose, scope, duration, custody, key provenance and cost.
- A *Backup Operator* is separately identified, least-privileged and cannot self-approve. A dedicated executor, not a bot/LLM or public browser, would perform the actual operation after a future independent implementation and approval.
- Signing an approval is different from verifying a key, authorizing an export, executing an export, certifying an artifact and authorizing a restore. No permission is inherited across those transitions.

### 2. Trusted Signer Enrollment SOP — PROPOSED, NOT EXECUTED
1. **Private ticket:** open an opaque enrollment request scoped to project ifxlvrhyjhbzbrkdsida, staging only, one purpose, role, expiry and a defined independent reviewer. Do not put personal IDs, channel IDs, phone numbers, emails, raw JWTs, tokens or backup destinations in GitHub or AI chat.
2. **Independent identity:** verify real user/organization identity via a controlled private workflow, current role and organizational mandate, MFA/session assurance and sanctions on delegated access. Record private source and reviewer receipt IDs only, not public personal data.
3. **Key ceremony:** generate non-exportable per-person signing keys in an approved protected system (hardware-backed KMS/HSM where available), bind verified owner and role to the Ed25519 public key **SPKI SHA-256** fingerprint; verify proof of possession with a fresh server nonce over project + operation + account scope + expiry. Avoid user metadata as an authorization source.
4. **Two-witness review:** a reviewer independent from the key holder validates provenance, key strength, role, purpose, expiry, possession, and enrollment record. The Controller and Security Reviewer cannot be aliases of one identity or reuse a shared signing key. The Backup Operator is another actor, not a third approval signature in H.7.
5. **Protected registry:** write an append-only or strictly audited private trusted signer registry (key versions, immutable identities, role, environment, project, timestamps, active/revoked), with restricted service access, explicit no-grants to anon/authenticated, minimal logs and secret-safe retention.
6. **Rotation and revocation:** explicit revocation, signer departure, compromised key and role changes invalidate unconsumed approvals. For key rotation, deactivate the old key according to a reviewed bounded grace policy; invalidate approvals using revoked key IDs. A revoked signer must never be reinstated by a replayed client request.
7. **Signed authorization:** require independently verified Controller and Security signatures over the **same canonical request digest**, operation, project, amount/cost (0 new USD unless separately approved), private storage class, one-use nonce, retention, validity and authorized executor. Use a trusted, durable issuer ledger that verifies actual identity, key version and revocation on **every admission**.
8. **Replay ledger:** transactionally claim one approved request in a private database. A signed receipt is not a bearer execution token: the executor must recheck independent identity/role, exact scope, status, outstanding obligations, private custody and approved tool capabilities.
9. **Operator release gate:** before any hosted action, require a *new*, explicit instruction to do **one** staged export, private encrypted destination verified, no credential exposure, approved read-only exporter, no paid resources, an authorized supervised security reviewer and an independent rollback/restore plan.
10. **Separate restore:** backup export authorization never authorizes restoring it. Obtain separately approved isolated target, paid costs (if any), disabled outbound integrations, row/FK/role/RLS/Auth/Storage reconciliation and evidence of recoverability.

**Current state:** every private human signer authority, actual enrolled key, public-key trust anchor, operator verification, live approval service and persistent ledger remains **UNVERIFIED / NOT DEPLOYED**.

### 3. Crash-safe lease model — disposable contract
This project adds only a QA source-only PostgreSQL 17 **state machine**, not a production migration:
\`ready → leased → succeeded\` on verified worker+fence+valid lease; \`leased → needs_review\` after timeout/crash; and \`ready/leased/needs_review → revoked\`. No automatic transition from \`needs_review\` back to \`ready\`.

- A claim verifies exact project, operation, signed-request digest *placeholder*, nonce, valid authorization expiry, operator naming fixture and state. In the disposable database, the **atomic UPDATE** returns a monotonically incremented fence; competing claims cannot both reserve the same approval.
- \`renew_lease\` requires the same worker and fence, nonexpired lease and authorization; each renewal is limited to at most 60 seconds and cannot exceed the 5-minute fixed hard deadline.
- \`finish_once\` accepts an opaque 64-character **synthetic digest** only if the lease still belongs to the same worker/fence and has not expired or been revoked. No real artifact bytes or backup custody are validated by this QA SQL.
- A timed-out lease enters \`needs_review\` permanently for the synthetic fixture. **No auto retry**: the operator must independently establish whether an external backup artifact was already written, abandoned or partially persisted; without that evidence a second export is unsafe.
- Revoking a lease prevents further DB admission/completion; it cannot interrupt an external process already executing. Production would need a kill/cancellation/attested destination gate and fencing validation at the **external side-effect boundary**.
- The private audit must record opaque request/attempt/fence IDs, lease transitions, artifact reconciliation, operator and reviewer identities and replay/expiry denials; without sensitive log values.
- **Critical exactly-once caveat:** this SQL only proves an atomic local reservation, not exactly-once external backup. True production safety requires durable idempotency at the executor/destination, fenced writes, artifacts indexed under unique operation IDs, crash reconciliation, and a supervised reserve → execute → reconcile → succeed/abort lifecycle. No such real bridge is deployed here.

### 4. Source and CI deliverables
- \`qa/v1503h8-lease/signer-enrollment-review.cjs\`: private intake **shape only**. Three independent roles, witnesses, receipts, non-overlapping signers, synthetic key fingerprints and anti-forgery controls. Always \`canExport=false\`.
- \`qa/v1503h8-lease/signer-enrollment-review.test.cjs\`: negative matrix for role impersonation, reused receipts, fake verification, secrets, expiry, rotation readiness, private vault claims and unapproved budgets.
- \`qa/v1503h8-lease/ephemeral-pg17-crash-safe-lease.sql\`: database-name hard guard, private fixture schema, no PUBLIC grants, RLS+FORCE, SECURITY INVOKER functions, atomic lease/renew/finish/quarantine/revoke, replay and negative SQL assertions.
- \`.github/workflows/v1503h8-crash-safe-lease-no-send.yml\`: Node 22 H.8 + inherited H.7/H.6 tests; disposable postgres:17-alpine, concurrency **8 claims → exactly 1 reserved / 7 rejected**, simulated worker crash → \`needs_review\`, no automatic new lease, no host credentials or provider sends.
- This checkpoint document; PR remains DRAFT, unmerged.

### 5. Acceptance and safety gates

| Gate | Expected status |
| --- | --- |
| Enrollment intake / negative tests | SOURCE TESTED ONLY; not real human proof |
| Disposal-only single-use fenced lease, renewal, revoke and crash quarantine | PG17 CI proof only |
| Real signer identity, possession ceremony, MFA and independent witness | BLOCKED |
| Deployed trusted registry, approved vault, one-use persistent ledger | BLOCKED |
| Externally fenced idempotent backup executor / failure reconciliation | NOT IMPLEMENTED |
| Real Controller, Security and Operator authorization | NOT GRANTED |
| Actual hosted encrypted backup and separate isolated restore certification | BLOCKED |
| Owner G2.3 merchant/provider consent, hosted signed JWT Store RLS | BLOCKED |
| Hosted Store schema migration, paid services, customer pilot | NO-GO |

### 6. Rollback and non-goals
Close this Draft PR to revert all H.8 source-only changes; its parent #149 and siblings #141/#135/#132/#133 remain untouched. No hosted Supabase DDL/DML/RLS/GRANT/Auth/RPC, user/Order/Stock data changes, database credential read, pg_dump of live data, real backup/restore, Cloudflare deploy, n8n Published change, Meta/Zalo send, billing or production merge was authorized.

**Proposed H.9:** Independent signed Owner/Controller/Reviewer private receipt onboarding review, idempotent external executor *design only*, and hosted export permission gate — still fail closed until approved and verified.
