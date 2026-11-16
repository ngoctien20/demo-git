# TIEN404 AI — V15.2-ADV.6C-RPC.2
## Complete Caller Discovery × Private Pairing Transaction × Zero-Downtime Cutover Certification

Date: 2026-11-16 JST.
Lifecycle: EXPERIMENTAL / DRAFT / NO-SEND / NO HOSTED MUTATION.
Parent: RPC.1 Draft PR #183, HEAD ca9c1b75e0cff00537423469f2d6ac2b527fe6d9.
Supabase staging: ifxlvrhyjhbzbrkdsida.

## 1. Security decision — NO-GO for RPC REVOKE or live cutover

Do not REVOKE public.qa_shop_b_zalo_claim(uuid,text,text,text) from anon yet. A verified active/published Zalo workflow dependency exists, and caller completeness outside the connected account is not attested. The existing Vault shared-header secret is an intentional guard, not proof of unrestricted exploitation, but it is not proof of a provider-signed event.

## 2. VERIFIED — Scoped caller discovery

Supabase: RPC SECURITY DEFINER, owned by postgres, executable by anon, not authenticated in observed grants. track_functions=none; 0 tracked calls is not evidence of zero use.

n8n: 114/114 accessible Draft + Published workflow graphs inspected, 19 Active + 95 Inactive. Only one direct literal RPC caller:
- TIEN404_ZALO_V2_SHADOW_STAGING — OgDZNSAvKEvhnAvn; Active+Published version f00ba506-c52a-4340-9a0c-809fd9c6ea9a.
- Enabled node Submit pending claim for Shop B is HTTP POST with httpHeaderAuth.
- Previous nodes: Owner gate disabled, which checks staging Owner allowlist and event characteristics; Recognize Shop B pairing command (staging), requiring an explicit owner pairing command and returning no items otherwise.
- Retained execution count: 1, #2858, manual, success. This is not proof that the actual RPC node was invoked on a live incoming event.

One active upstream caller:
- TIEN404_ZALO_BOT_LAB_V1_STAGING — yIJk8LvJoLF40Z62; Active+Published version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- Path: Zalo Bot Webhook (Protected) -> Validate & Normalize Event (Read Only) -> Ack Zalo (No Message Sent) -> Zalo V2 Shadow (Owner Gate Only) -> downstream V2 workflow -> conditional RPC node.
- Retained execution count: 11, all manual in returned metadata, latest #2839. No verified recent live webhook or exact real RPC invocation.

Cloudflare: 23/23 accessible Worker script content representations scanned, zero exact function-name matches; 13 generic /rpc/ markers were present in BIO-related Worker representations. Dynamic compilation and other accounts/routes remain unexcluded.

Supabase Edge: 1 accessible function tien404-r1-owner-preflight with no exact RPC name or /rpc/ literal marker in inspected result.

GitHub default branch code search returned zero exact function name matches; search index and additional branches or private external source are not complete proof.

UNKNOWN: External PostgREST consumers, old workflow versions, dynamic URLs, private operator scripts, request logs across a controlled observation window, other accounts. Therefore global discovery remains PARTIAL, not CERTIFIED COMPLETE.

Evidence metadata manifest: qa/v152-rpc2/caller-inventory.readonly.json; no credentials, sender IDs, JWTs or customer rows.

## 3. VERIFIED — Existing two-step private QA logic to preserve

The private function tien404_r1_qa.claim_owner_pairing_v3_synthetic is a SECURITY INVOKER function, not directly callable by anon/authenticated. It checks a valid challenge/bot, locks the challenge row FOR UPDATE and inserts a pending claim with ON CONFLICT DO NOTHING.

The separate tien404_r1_qa.confirm_owner_pairing_v3_qa checks authenticated Owner via auth.uid(), locks pending claim, consumes the challenge, confirms the claim and upserts the Owner binding. Reuse the business contract. Never auto-confirm a pairing merely because an inbound event is signed. These are QA functions, not a verified Commerce multi-tenant release.

## 4. IMPLEMENTED — Disposable PostgreSQL 17 pairing transaction

qa/v152-rpc2/ci-private-pairing-fixture.sql is a synthetic schema fixture. It is NOT a Supabase migration and MUST NEVER be applied to hosted.

QA roles t404_pairing_writer_ci, t404_pairing_claim_ci and t404_pairing_confirm_ci are NOLOGIN/NOBYPASSRLS, with no public access. The private definer functions are owned by a limited role, fixed search_path, private schema, FORCE RLS tables and minimum runtime function access. Anonymous, authenticated and synthetic service_role have no direct access.

Claim validates current bot, membership, recipient hash, challenge code digest/expiry and unique event hash. A row lock and unique constraints make the pending claim an atomic single-database operation.

Confirm is a separate owner-authorized stage: verifies matching owner membership, locks pending claim/challenge, marks confirmed and upserts the binding atomically. The owner hash used by the synthetic fixture is NOT a real JWT verifier; live backend MUST independently cryptographically verify JWT, session freshness and store rights.

Test file pg17-private-pairing.integration.test.cjs runs only with CI=true, T404_RPC2_DISPOSABLE_PG=1, loopback PGHOST, exact PGDATABASE=t404_rpc2_ci. Real Supabase connections are refused.

No provider send, no real customer data, no production SQL, no schema migration, no credential rotation.

## 5. PROPOSED — Zero-downtime step-by-step cutover

Phase 0 — Preflight: Independent Controller, Security Reviewer and Operator must verify current caller manifests, real logs, current GRANT/DDL snapshot, approved encrypted backup and independent isolated restore; obtain per-action written approval. Do not infer no caller from track_functions=none.

Phase 1 — Shadow No-Send: Run deterministic synthetic event/parity evaluation of old and candidate authorization decisions, without invoking a second writer. Reject any mismatched Shop/owner, unverified provider signature or replay. No double writes for the same event.

Phase 2 — Isolated staging: After separate approval, deploy narrow private service and DB role with a server-verified identity/consent/challenge proof. Test exact read/claim/confirm contract and real hosted Store A/B isolation. Disposable PG17 tests are necessary but not sufficient.

Phase 3 — Controlled single-writer canary: Only one write path per event. Stable hashed event key, DB unique constraints and durable nonce across retries. Monitor auth 401/403, replay, unexpected duplicate, missed pairing, Shop leakage and chat availability. Controller must approve release percentages and rollback thresholds. Zero cross-store writes/incorrect bindings permitted.

Phase 4 — Privilege removal: After all real callers safely migrated, request separate approval to revoke public/anon EXECUTE on old SECURITY DEFINER RPC. Verify anonymous REST invocation denied, authorized private pairing still succeeds, Owner confirmation remains separate, and Supabase Security Advisor lint 0028 resolves for this function. Do not blindly regrant anonymous access to roll back a broken migration.

Shadow comparison and no-double-writer policy: qa/v152-rpc2/zero-downtime-cutover-review.cjs; 12 negative QA cases; even all-green client metadata cannot auto-publish, send or REVOKE.

## 6. Current proof and release gates

VERIFIED: Connected n8n direct RPC caller + active upstream webhook graph; historical manual-only executions; 23 Worker representation scans; one Edge function, existing private two-stage pairing logic.

IMPLEMENTED: Caller manifest, disposable PG17 transaction candidate, deterministic cutover/shadow decision and safety QA on Draft branch.

TESTED: Mark test PASS only after reviewing exact commit GitHub Actions logs. Disposable PG17 QA is not hosted certification.

BLOCKED: global external caller inventory, independent real request logs, official provider signature proof, hosted Store A/B JWT/RLS, real narrowly scoped runtime role, independent private backup+restore, canary metrics and release approval.

Never change Pubished n8n, Supabase RLS/GRANT, Cloudflare production, credentials, backups or real customer records without separately explicit permission.

## 7. Rollback / next checkpoint

Close this Draft PR to reverse source-only changes. No hosted rollback needed because no hosted changes were made.
Next proposed: V15.2-ADV.6C-RPC.3 — Private Caller Attestation × Hosted Two-Step Pairing Acceptance × Individually Authorized RPC Revocation Plan.
