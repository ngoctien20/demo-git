# TIEN404 AI — V15 Owner Synthetic UAT Acceptance × V15.0-03H/04H Safe Hosted Readiness
**Checkpoint:** 2026-11-16 JST  
**Source branch:** `work/v1503-08-agent-skills-router-testlab-nosend-20261116`, Draft PR #123  
**New branch:** `work/v1503h-04h-trusted-core-business-gates-nosend-20261116`, Draft PR #127  
**Classification:** OWNER-ACCEPTED Synthetic UI · IMPLEMENTED Source-only 03H/04H · TESTED Synthetic QA · REAL HOSTED AUTH/BUSINESS BACKEND BLOCKED · NO SEND.

## 1. What the Owner accepted (not a real AI certification)
On 2026-11-16 JST the Owner directly reported **7/7 PASS** in conversation for the V15.0-08 **synthetic-only browser UI**:
- Shop A/B/C synthetic catalog/product/price switches correctly.
- Switch Messenger/Zalo Bot/Zalo OA/Website Widget without provider sends.
- Unknown A002 SKU not invented.
- Order request only drafts, never creates a real Order.
- Customer mode cannot read Owner report.
- Model selection estimates costs, does not call a provider.
- PASS/FAIL controls and JSON export work.

**Evidence strength:** Owner direct self-report. The UAT JSON exported by the browser has **not been supplied for independent per-case inspection**. Do not fabricate attachment contents, verified browser captures, signed Owner records, model QA scores or a real account login. The signed provider Bot Owner/merchant consent gate G2.3 is separate and still BLOCKED.

**Recorded UAT file:** `qa/v15-test-lab/v15-owner-uat-self-reported-7-of-7.json` from previous Draft PR #123. Source checkpoint `docs/ai-handoff/TIEN404_V15_0_ABCD_STAGING_UAT_CHECKPOINT.md`.

## 2. Revalidated independently (read-only)
- Isolated Cloudflare static Lab Worker `tien404-v15-owner-ai-test-lab-nosend-staging` stays on version `4fba3556-5133-4aee-a018-b6dc5409c45e`, zero bindings / zero credentials, subdomain still enabled.
- n8n HTTP QA workflow `f0bfCjUE5URqzzfQ` still INACTIVE, execution **3886 SUCCESS** (GET health 200, GET index 200, POST send 405). No customer data or real model calls.
- Zalo outbound Worker flag `ZALO_SEND_ENABLED=false`. Published ingress `yIJk8LvJoLF40Z62` version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` unchanged. Supabase Shop B QA has 2 active Owner memberships, but this does NOT mean Zalo account/merchant consent was verified.
- Existing A–D code CI **137/137 PASS** and 03H/04H new code no-send QA separately tested below. Parent PR #123 remains Draft, no production merge.

## 3. V15.0-03H — Trusted Core Identity evidence contract
New source-only module `qa/v15-hosted-readiness/trusted-ingress-gate.cjs`:
- Requires TWO **independent ECDSA P-256** signed short-lived QA fixture claims, one channel issuer and one tenant binding issuer, both with identical tenant/store/subject/conversation/event/nonce SHA-256 hashes.
- Checks distinct signer public roots, issuer name, audience, proof expiry ≤120s, timestamp validity, P-256 signatures, channel allowlist, backend pinned synthetic fixture scope, and trusted injected **atomic consume-once nonce** interface.
- Explicitly REJECTS asserted `provider_signature_real=true`, user role `owner`, or verified real provider claims. Only accepts `V148_HMAC_SIGNED_FIXTURE_ONLY` and `V147_STATIC_STAGING_FIXTURE` derived from parent QA fixture architecture.
- Emits `SYNTHETIC_SIGNED_QA_ONLY`, never `REAL_IDENTITY_VERIFIED`; locks `can_send=false`, `can_write_orders=false`, `owner_certified=false`; no network calls/credentials.
- Uses a private-module WeakSet so forged client-created objects that merely copy JSON fields **cannot be passed directly** as authorized context to the QA business tool adapter.
- Issuer and allowed-tool policies are frozen; tampered keys, stale proof, mismatched scope, revoked authority, wrong channel and nonce replay are fail-closed in tests.

**Important limitation:** Two independent keys in this suite are **ephemeral test signers generated in tests**, not production Zalo, Messenger, Supabase or merchant authorization roots. `verifyPinnedFixtureBinding` and `consumeNonceOnce` are *injected mock interfaces*, not connected hosted registry/transactional DB functions. Real security remains BLOCKED until separately approved true issuer integrations.

## 4. V15.0-04H — Authorized Business Tools contract
New source-only module `qa/v15-hosted-readiness/authorized-business-tools.cjs`:
- Requires the exact private WeakSet-issued QA context and trusted fixture source; rejects client-input `store_id`, `tenant_id`, `price_vnd`, role or arbitrary tool arguments.
- Re-verifies stored Shop/Tenant SHA-256 from the private QA fixture before allowing `catalog_read`, `price_quote`, `order_draft` or `support_draft`.
- Unknown SKU is **NOT FOUND** without price. VND must be positive safe integer; stock non-negative safe integer; total checked for integer overflow. Order draft returns `expected_total_vnd` and `customer_order_confirmed=false`, **0 Orders/Stock writes**.
- `inventory_write`, `order_modify`, `owner_report_read`, cross-store or privilege escalation are **BLOCKED**.
- **No real Commerce Products, Orders, Prices, Stocks, Supabase, Google Sheets or n8n tool workflow connected.**

## 5. Atomic replay design — draft only
- `qa/v15-hosted-readiness/atomic-replay-d1-DRAFT.sql` describes an isolated D1 QA table keyed by unique `scope_hash + nonce_digest`, with `event_digest`, created/expiry times and two QA fixture source labels. **NOT EXECUTED against Cloudflare or Supabase**. Does not contain Bot IDs, phone numbers or tokens.
- Actual hosted implementation must perform a single atomic insert and treat uniqueness conflict/failure as replay. Avoid read-before-write check, preflight signed proof time/issuer, and provision independent key lifecycle/rotation/retention before real provider use.

## 6. QA evidence
- New dedicated CI `.github/workflows/v15-hosted-gates-qa.yml`: [GitHub Actions run #43787082272](https://github.com/ngoctien20/demo-git/actions/runs/43787082272) **SUCCESS 54/54 PASS**, plus static no-provider/no-send/no-database-write checks.
- 54 cases include signature tampering, replay, cross-tenant Shop B, proof expiry/future/TTL/audience, public trust policy immutability, forged Owner/tenant/tool args, wrong price, negative stock, VND integer overflow, unknown SKU, order drafts requiring confirmation and disallowed writes.
- Previous V15 A–D suite 137/137 successful; these are separate versioned runs, not claim of production acceptance or real LLM benchmark.
- Two-way staging trusted identity evaluation is **source-only**, not deployed as an authenticated internet endpoint; deliberate because true provider keys, hosted issuer, durable replay and Auth/Owner consent are absent.

## 7. Rollback, blockers and next work
**Rollback:** revert/close only Draft PR #127. Existing #123 UAT record, V15 UI Worker, n8n QA #3886 and all Published workflows remain untouched; no runtime rollback necessary. No token/credential/owner/security-right/payment/production writes occurred in G2.3 or 03H/04H during this turn.

**BLOCKED P0 gates:** V14.8 real provider identity, G2.3 Zalo Bot Creator Owner consent, Supabase server validated tenant membership and RLS, real durable replay store, real isolated Commerce Catalog and tool authorization. Also no actual model API model entitlements, paid test hard cap or measured quality/latency.

**Next milestone:** `V15.0-03H.1 — Private Hosted Issuer Dependency Gate`: separately verify model/provider session credentials are available and source-of-truth registry/RLS readiness read-only; prepare staging-only signed claims with real issuer only after approved key/permissions; run negative hosted QA, keep outbound No-Send. `V15.0-04H.1 — Catalog Read Adapter`: only after trusted tenant/store resolver is verified may connect read-only *staging* catalog with RLS and per-shop product/price evidence, never DEMO Google Sheets or production Orders. Model tournament 96+36 requires separate hard USD spending approval; preserve n8n trial plan review on 2026-11-22.

**No production release or commercial readiness claim.**
