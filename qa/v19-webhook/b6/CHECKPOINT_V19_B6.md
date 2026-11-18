# TIEN404 AI — V19.0-B6 Checkpoint

Date: 2026-11-18 JST.
Workstream: Private Hosted Worker Binding Acceptance × Recoverable Event Inbox Design × Verified Store Authority Preflight.
**Status: IMPLEMENTED/TESTED LOCAL; HOSTED PRIVATE WORKER BINDING BLOCKED; REAL STORE AUTH BLOCKED; PRODUCTION NO-GO.**

## 1. Before change / known baseline

- Parent Draft PR #430, head a5c38eefd41f0543cb3dc03199c651dabc6c5493, full B5 QA 219/219 PASS.
- Ancestor Draft PRs #428 (B4), #423 (B3), #419 (B2); all existing code left unchanged.
- Original Cloudflare Worker tien404-v1723u-qa-inbound-locked-staging deployed version 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195 and deployment 8a43101c-39fa-40a0-a022-2528e54b2102. workers.dev and previews disabled.
- Original B2 source Git blob 11affa7658b46ae7c411eed7877d7ccdce61bbad remains immutable.
- Prior Cloudflare hosted D1 B4 QA synthetic tables remain. B5/B6 tables NOT present in hosted database.
- Supabase tien404-staging public orders/products/customers/conversations have tenant_id but lack store_id.

## 2. Implemented in source-only GitHub QA branch

- AES-256-GCM synthetic encrypted and recoverable inbox in B6 candidate, with per-event random IV, AAD binding scope/event/key version, HMAC payload identity and QA_K1/QA_K2 key version testing.
- Strict synthetic fixture payload only. No real customer data is accepted. Ciphertext stored as D1 BLOB, no plaintext.
- Atomic event admission, duplicate conflict checks, lease fencing, active-lease recovery, TTL enforcement, bounded retry and synthetic DLQ.
- Default candidate Worker fetch remains locked 423. Separate local Miniflare harness never interacts with Cloudflare remotely.
- Read-only fail-closed Store Authority preflight evaluator. Passing fake VERIFIED signals never grants commerce permissions.
- 16-item proposal for PRIVATE hosted Cloudflare Worker Binding admission and rollback, not executed.
- Dedicated encrypted inbox ADR and Supabase metadata preflight.
- GitHub Actions local workerd test suite and full B2–B5 regression; no cloud credentials configured.

## 3. Evidence

- B6 local Miniflare/workerd encrypted inbox and Store preflight: 18 tests PASS.
- B5 regression: 11 Node + 8 SQLite = 19 PASS.
- B4 regression: 30 Node + 10 SQLite = 40 PASS.
- B3 regression: 47 Node + 8 SQLite = 55 PASS.
- B2 regression: 105 Node PASS.
- Total: 237/237 tests PASS, 0 failed, 0 skipped, as observed at GitHub Actions run #44293232476, commit 98a0ac7d17cfd22edf814c608c50b753aa86b634.
- Final PR HEAD CI must be checked separately after documentation and PR creation.
- Local D1 Binding used Miniflare 3.20250718.3. No hosted Worker/D1 binding UAT claim.
- Cloudflare state and Supabase RLS checked read-only in this turn.

## 4. Supabase Store Authority metadata (read-only)

- All four public Commerce tables have RLS ON and FORCE RLS ON, anon SELECT revoked and authenticated SELECT granted.
- Each has one policy and zero restrictive policies in pg_catalog; tenant_id present, store_id missing.
- These facts do not prove Store A/B RLS or a data leak; no JWT or private row test performed.
- Existing Store Authority design PR #417 should be completed, not duplicated.

## 5. Security blockers and pending approvals

P0:
- No real authenticated Store authority or owner A/B JWT session with cross-store negative UAT.
- No production encrypted payload key management/rotation/retention, event schema and consent.
- No durable actual provider/webhook receiver and authorized downstream n8n/Commerce processing, idempotent commands or ambiguous ACK reconciliation.

P1:
- Hosted Worker Binding + protected Access operator identity not tested.
- Invalid shared-secret abuse rate gate, WAF/TLS and provider Bot/OA verification not tested.
- B6 synthetic encrypted data has TTL denial but no automatic deletion/retention enforcement.
- Local QA harness is not itself suitable for deployment.

Approval required before:
- Creating or deploying any hosted Worker, opening/changing route, Access/WAF policy or binding;
- Writing B6 tables or any real data in hosted D1/Supabase;
- Calling setWebhook on any Bot, changing credentials, releasing provider send;
- Publishing n8n or accessing real Commerce Orders/Inventory.

No exact Worker/route/operator/approved database target or hosted change window was scoped in this instruction, so HOSTED UAT stays BLOCKED_NO_EXACT_TARGET_APPROVAL.

## 6. Changes / rollback / evidence scope

- GitHub QA branch + CI only; no Cloudflare Worker deploy, hosted D1 B6 schema/write, Supabase migration, provider send, webhook registration, n8n workflow changes, payment changes or customer data.
- Closing/reverting the B6 Draft PR is full code rollback; no cloud rollback needed.
- Existing hosted B4 disposable tables remain, cleanup still requires explicit separate approval.
- No claim of independent human security sign-off.

Next proposed controlled B7: exact-scope private hosted Worker Binding acceptance only after explicit approval, plus verified Store Authority migration rehearsal and real durable encrypted event contract independent of provider sends.

**Checkpoint:** V19_B6_LOCAL_ENCRYPTED_BINDING_237_OF_237__HOSTED_ACCEPTANCE_BLOCKED__STORE_AUTH_BLOCKED__NO_PRODUCTION.
