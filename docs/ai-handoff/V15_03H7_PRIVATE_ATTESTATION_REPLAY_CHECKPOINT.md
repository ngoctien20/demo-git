# TIEN404 AI — V15.0-03H.7 · Private Attestation Registry Design × One-Time Approval Replay Protection

**Checkpoint 2026-11-16 JST | SOURCE-ONLY CHILD DRAFT | SYNTHETIC QA / DISPOSABLE PG17 / NO SEND / HOSTED EXPORT NO-GO.**

## 1. Continuity and architecture
- Parent PR #141 (H.6 coverage, no hosted export) → its parent PR #135 (09D dual Ed25519 synthetic authorization).
- Do not merge/deploy parent branches. This H.7 draft adds isolated code and ephemeral QA only.
- Supabase staging \`ifxlvrhyjhbzbrkdsida\` Free: 3 Auth users, 2 Tenants, 3 active memberships, 2 Products, 2 Orders, zero Storage buckets and no canonical Stores / Store memberships. Real Owner/G2.3, true Shop JWT RLS, private backup and restore remain unverified.
- **Authorization identity separation:** Merchant Owner verifies Store↔Provider only. Platform Data Controller decides multi-Tenant backup scope. Independent Security Reviewer reviews authorization. Backup Operator executes *only* after separate authorization. No role is interchangeable.

## 2. H.7 source components
1. \`qa/v1503h7-attestation/attestation-registry.cjs\`: pure Node 22 synthetic proof verifier. Requires exactly three distinct, nonexpired, nonrevoked, project- and environment-scoped registry entries (Controller, Security, Backup Operator). Checks Ed25519 SPKI SHA-256 public key fingerprints and delegates signature checking to the inherited 09D canonical request verifier. Binds replay nonce digest to canonical *signed* request fingerprint, not a client arbitrary string. **Nothing in this module enrolls a real human, checks private vault custody or grants any right to execute.**
2. \`attestation-registry.test.cjs\`: generated ephemeral Ed25519 keys; positive **shape** case and explicit negative tests for role/issuer duplication, swapped keys, revoked/expired entry, fingerprint mismatch, replay nonce substitution, tampered canonical scope or signature, credential fields, unauthorized cost, environment and operation changes. All tests are offline.
3. \`ephemeral-pg17-replay.sql\`: STRICT **disposable database name guard** \`tien404_h7_ephemeral\`; creates synthetic private schema and RLS/FORCE tables with no PUBLIC grants, \`SECURITY INVOKER\` consume function with PUBLIC EXECUTE revoked. Unique requestRef and nonceDigest, expiration and revoked state. Atomic \`UPDATE .. WHERE state='ready' .. RETURNING\` is the linearization point.
4. \`.github/workflows/v1503h7-private-attestation-no-send.yml\`: ephemeral \`postgres:17-alpine\`, Node22, source tests, SQL fixture, **eight simultaneous** one-time consume calls. Required exact outcome **1 success / 7 denied**, no real Supabase credentials, backup, provider or payment.

## 3. Threat model and limitations
- **No real trust anchor:** \`registry\` is a *caller-provided synthetic QA fixture*, never a trusted server-enrolled public key set. A malicious caller can forge the entire fixture. This is why even perfectly verified fixture signatures return \`realAuthorizationVerified=false\` and \`allowedToExport=false\`.
- No actual persistent private signer registry, HSM/KMS key attestation, independent identity proof, revocation service, secure custody, approval audit, real ACL, authentication, per-merchant consent or protected cloud executor has been deployed.
- **Disposable PG17 atomic claim is NOT a real permission token:** tests can execute the restricted function as ephemeral CI owner; there is no deployment to Supabase hosted or service-role integration. RLS/FORCE does not protect against privileged BYPASSRLS operators.
- A real execution bridge needs **transactionally verified authorization + durable claim key and request digest**, an approved identity-bound least-privileged operator, server-side signed request hash, exact scope, expiry/revocation checks, and a **persistent audit record**. Never accept \`client supplied approved=true\` or LLM output as authority.
- One-use claims must be matched to exactly one *specific* operation and idempotency key. Real export delivery requires a separate supervised **reserved → succeeded / aborted** process to handle crashes; this draft does not solve backup delivery exactly once, only proves *atomic single-use claim* on synthetic PG.
- Do not grant client roles, \`anon\` or generic \`authenticated\` access to privileged registry/consume RPC. In production a dedicated protected schema and trusted service executor would need independent threat review.
- **Backup remains separate from restore**: no real export, no isolated restore, no inherited permission to run Store DDL/RLS, no Meta/Zalo send, Orders or billing.

## 4. Acceptance matrix and release gates
| Area | Status |
| --- | --- |
| Synthetic Ed25519 signer shape, roles, scope and fingerprint | SOURCE/CI QA; **not real signature enrollment** |
| Atomic single consume with simultaneous requests | DISPOSABLE PG17 CI QA |
| Trusted private registry & identity/provider human verification | BLOCKED |
| Durable deployed one-use approvals ledger & release executor | BLOCKED |
| Signed real Controller/Security approvals and Backup Operator permission | BLOCKED |
| Encrypted offsite vault + authorized full-scope Free backup | BLOCKED |
| Actual hosted snapshot & isolated restore test | BLOCKED |
| Canonical Store/StoreMembership + real signed JWT RLS | BLOCKED |
| Hosted migration and pilot | NO-GO |

## 5. Rollback and dependencies
Close the H.7 child Draft PR to discard only new source/QA. PRs #141, #135, #132, #133 and their parents remain unchanged. No Supabase DDL, SQL execution, Auth, RLS, GRANT, RPC, tenant/customer data, credentials, real backup/restore, n8n Published, notifications, production merge or paid service was touched.

**Next candidate:** V15.0-03H.8 — Independent Controller/Security Signer Enrollment SOP × Crash-Safe Approval Lease Design (source-only), then separate real human approvals, private encrypted backup authorization and certified restore. **No release gate is auto-approved by an offline PASS.**
