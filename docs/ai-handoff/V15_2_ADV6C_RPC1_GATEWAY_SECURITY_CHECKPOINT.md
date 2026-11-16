# TIEN404 AI — V15.2 ADV.6C-RPC.1
# Public SECURITY DEFINER RPC Elimination × Trusted Channel Gateway × Zero-Trust Action Capability

Audit date: **2026-11-16 JST**  
State: **PROPOSED REMEDIATION / IMPLEMENTED OFFLINE DRAFT / NOT DEPLOYED**  
Parent checkpoint: ADV.6C PR #179 HEAD \`9dba890ee58d9cb9486d41002909e3d25205786f\`  
Mode: **SOURCE ONLY / NO SEND / NO REAL JWT / NO EXECUTE / NO HOSTED WRITE / NO GRANT OR REVOKE**

## 1. Verified P0 baseline

Supabase staging \`ifxlvrhyjhbzbrkdsida\`:
- \`public.qa_shop_b_zalo_claim(uuid,text,text,text)\`: **SECURITY DEFINER**, owned by \`postgres\`; callable by PostgREST \`anon\`, not by \`authenticated\` under checked grants.
- Body checks a Vault-sourced shared header secret and validates input, then calls \`tien404_r1_qa.claim_owner_pairing_v3_synthetic(...)\` with HMAC-pseudonymized sender/event. This is a nontrivial guard, NOT an unconditional open-door data leak. However, the header secret alone is not proof of provider's raw-body signature, and the function body does not itself demonstrate provider event TTL/replay gate.
- Database \`track_functions = none\`. \`pg_stat_user_functions.calls = 0\` cannot be treated as a proof of no callers.
- Supabase Security Advisor reports \`anon_security_definer_function_executable\` WARN (1).
- The RPC owner runs with elevated privileges and is part of QA pairing; do NOT revoke without checking current caller paths.
- No production-store JWT/RLS proof. Parent PR #179 remains Draft and backup export denied.

### Read-only caller discovery (partial, NOT global dependency certification)
1. n8n exact node-parameter keyword review of \`TIEN404_ZALO_BOT_LAB_V1_STAGING\` (\`yIJk8LvJoLF40Z62\`, Published active), \`TIEN404_ZALO_V123_PRIVATE_CUSTOMER_ROUTER_STAGING\` (\`sIPs6egzIwOY1GNv\`, Published active) and \`TIEN404_V145Z_G22_HOSTED_SIGNED_SHOP_B_QA_NO_SEND\` (\`znp3ABDLUH5bTqFE\`, inactive) found **no explicit direct reference** to this RPC or \`/rpc/\` in inspected nodes.
2. n8n name searches for Pair/RPC did not reveal a named caller. This is NOT a full-text search of all n8n workflow code, nor evidence about other n8n instances.
3. Cloudflare Worker script content metadata scan of \`tien404-g22-shop-b-map-nosend-staging\`, \`tien404-zalo-outbound-v1-staging\`, \`tien404-widget-gateway-v144-staging\`, \`tien404-zalo-live02-nosend-gate-staging\`, \`tien404-v15-owner-ai-test-lab-nosend-staging\` found no literal \`qa_shop_b_zalo_claim\` or \`/rpc/\` in returned content representations; **negative literal scan is NOT verified caller absence**, especially under minification/dynamic construction.
4. GitHub repository code search had 0 hits (one query incomplete), and does not inventory external live callers, apps, scripts or private source.
5. **Caller state: UNKNOWN — do not REVOKE public RPC yet.** Require account-owner/operator server logs, Cloudflare Worker source review for dynamic construction, n8n upstream full workflow inventory, internal API contracts and hidden integrations.

## 2. Design decision: NO PUBLIC RPC FOR SENSITIVE OWNER PAIRING (future target)

### Approved? NO. Architecture proposed for staged acceptance.

  Zalo/Messenger signed webhook
    -> Trusted Provider Signature Verifier (raw body, provider-specific)
    -> Channel Account-to-Tenant/Store/Bot Binding (server-side)
    -> Merchant/Owner Consent + Current Challenge Verification
    -> Atomic Durable Provider Event Claim (Replay Guard)
    -> One-Time **OWNER_PAIRING_CLAIM** Capability Receipt
    -> Consume: verify HMAC, context and current ownership/consent/challenge
    -> Atomic Durable Capability Claim
    -> **Future private service** with narrowly scoped DB role (no bypassrls)
    -> Private-schema pairing function; ONLY after separate migration approval

Existing ADV.5/6 canonical \`T404_ACTION_V1\` is **reused** for CATALOG, QUOTE, ORDER_REQUEST, ASK_STAFF, POLICY. Pairing's \`OWNER_PAIRING_CLAIM\` has an **independent HMAC domain**, not aliases to \`ORDER_REQUEST\` or \`ASK_STAFF\`. ADV.3 Ed25519 preview signature domain stays separate.

### IMPORTANT OPERATIONAL CAVEAT
The new preview \`claimInboundEventOnce\` and \`claimCapabilityOnce\` are injected synthetic-only ports. **They are not in the same atomic transaction as the ultimate owner-pairing write**. In production, the private writer must atomically consume the challenge, enforce store owner semantics and record final result with durable idempotency within one transaction, or implement an explicit transactional compensation/retry contract. This draft **does NOT certify exactly-once ownership changes**.

## 3. Implemented in Draft branch
- \`qa/v152-rpc1/trusted-pairing-capability.cjs\`
  - Explicit allowlist: ZALO_BOT / ZALO_OA / MESSENGER signed events only. WEB_WIDGET does NOT use a messaging webhook pairing path.
  - Requires injected raw-body provider-signature verifier, trusted provider-account binding, merchant consent, current challenge proof, and two durable atomic nonce-claim interfaces.
  - Token scoped to channel/account/event/subject digest/tenant/store/bot/challenge/action, 120 second max TTL. No sender phone or raw body in token.
  - Recheck all trusted context before capability claim; reject cross-shop, different tenant, different event, stale timestamp, bad signature, revoked consent or challenge, expired or replayed tokens.
  - No network, credential, hosted DB access, SQL, public RPC call, or actual provider send.
- \`qa/v152-rpc1/rpc1-action-coordinator.cjs\`:
  - Reuses existing ADV.6 canonical signed receipt for commerce actions.
  - Separates owner-pairing from order actions. Ineligible actions/SQL/administrator actions rejected. All business execution and outbound sends disabled.
- Deterministic negative security suite against generated per-test HMAC fixtures (not the actual Zalo/Meta signing algorithms).
- \`docs/ai-handoff/V15_2_ADV6C_RPC1_PRIVILEGE_MIGRATION_DO_NOT_APPLY.sql\`: commented change plan. NO migration deployed.

## 4. Proposed migration/runbook — approval required EACH step
1. Independently identify actual caller, request/response compatibility, observed traffic pattern, n8n Published vs Draft, Worker version and impact. Capture encrypted private source/role baselines and rollback.
2. Certify a provider-specific real signature verifier and event replay guard (must follow provider's documented security contract; don't assume all Zalo modes use Meta-style HMAC). Verify bot mapping, consent and wrong shop denial.
3. Stand up **new private function/service with least-privilege DB role** in isolated staging only, after separate backup+restore and explicit migration authorization. No service_role as the shared AI identity.
4. Shadow: ensure read-only and synthetic No-Send output matches old QA pairing outcome. **Never call both old and new writers for one event**. Confirm no breaking legacy callers.
5. Approved canary switch, 401/403/429/replay monitoring and rapid rollback. Do not send any real user content without approval.
6. Once all callers have safely migrated and security team approves, separately authorize disabling/removing anon access to \`public.qa_shop_b_zalo_claim\`. Negative test: anonymous REST RPC now permission denied. Re-run Supabase Security Advisor. Keep controlled rollback window.
7. Only after hosted Owner A/B JWT-RLS isolation proof and approved backup/restore can Commerce Multi-Store release P0 be reconsidered.

## 5. Stage and QA evidence
- **VERIFIED:** SQL metadata of RPC; limited n8n/Cloudflare/GitHub caller scans and their limitations.
- **IMPLEMENTED:** source-only capability and coordinator, QA fixtures, review-only SQL and checkpoint.
- **TESTED:** CI only after exact SHA log inspection; synthetic QA != hosted certification.
- **PROPOSED:** private data-plane, least privilege Postgres role, new private pairing writer and cutover.
- **BLOCKED:** caller completeness, real webhook signature, hosted Store schema/JWT proof, durable transaction, backup+restore, Controller+Security Reviewer approval, production WAF/rate limits, live cutover, RPC REVOKE.

## 6. Approvals, rollback and hard stop
No user approval to mutate Supabase roles/schema, n8n Published, Cloudflare Workers production, credential/secret material or data. All modules hard fail on publish/send/SQL/write. Close Draft PR for source rollback; no hosted rollback because no hosted change was made.
Use distinct signed approvals for backup export, migration, runtime role, canary cutover, and eventual RPC privilege change. A green synthetic CI does not grant any of these.
