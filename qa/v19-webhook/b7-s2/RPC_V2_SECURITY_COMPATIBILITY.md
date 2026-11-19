# TIEN404 V19.0-B7-S2 — Versioned Store Product RPC Security and Compatibility

**Date:** 2026-11-19 JST  
**Classification:** EXPERIMENTAL / SOURCE-ONLY / DISPOSABLE PostgreSQL 17 TESTED / LIVE CUTOVER BLOCKED.  
**Inherited:** B7-S1 PR #440, canonical Store Authority proposal PR #417. Do NOT fork a new Store authority model.

## A. What we actually verified on connected staging

The existing \`public.save_merchant_product\` function is \`SECURITY DEFINER\`, uses a fixed empty \`search_path\`, verifies a Supabase Auth actor with \`auth.uid()\`, requires owner/manager Tenant membership and allowlists two specific QA Tenant identities. It writes \`products\` using \`tenant_id + sku\`, with no Store reference. The \`authenticated\` role can EXECUTE; \`anon\` cannot.

**This is not evidence that it is already Store-safe.** The six Commerce tables in staging are still Tenant-scoped; no canonical \`store_id\` columns were present in the latest read-only metadata check. \`UNIQUE(tenant_id,sku)\` remains in effect.

## B. Proposed versioned API, not deployed

In **disposable schema \`b7s2\` only**, a candidate function is defined with this input shape:

\`save_product_store_v2(p_tenant, p_store, p_sku, p_name, p_price, p_active, p_initial_stock, p_expected_updated_at)\`

It deliberately models the *next* product command without modifying the existing V1 function:
- Reject absent actor, suspended Store, missing Store membership, expired/revoked Store membership, Staff pricing edits and cross-Store requests.
- Require active Tenant owner/manager **and** active exact Store owner/manager with matching Store ID.
- Use an atomic INSERT or a compare-and-set UPDATE anchored on \`(tenant_id,store_id,sku,updated_at)\`.
- Preserve the current Tenant-wide \`UNIQUE(tenant_id,sku)\` until the business decision D-02 is approved.
- Validate money in integer VND (0 to 10^12 inclusive); negative stock rejected; an UPDATE cannot change inventory through the product edit command.
- Emit minimal synthetic audit receipts for successful create/edit.
- Reject direct product DML from the fixture caller role. Function is schema-local with narrow EXECUTE and a pinned search path.

**Critical authentication warning:** The disposable fixture reads \`request.jwt.claim.sub\` through a helper solely to simulate \`auth.uid()\`. A raw PostgreSQL client can modify that setting. It is **not a JWT verifier and is never safe to copy into a production function**. A real implementation must derive its actor from independently verified Supabase Auth, use PR #417 canonical membership/schema and undergo SECURITY DEFINER review; do not grant production permissions from this fixture.

## C. Tests and rollback

\`tests/pg17_versioned_store_writer_qa.sql\` executes the synthetic versioned function and tests:
1. Caller role has no direct product/audit table privileges.
2. Missing actor denied.
3. Owner A creates Store A; Owner A cannot touch Store B.
4. Suspended Store denied.
5. Negative price, negative stock and duplicate SKU rejected.
6. Product edit cannot change stock; optimistic CAS rejects stale timestamps.
7. Owner B creates Store B with another SKU.
8. Owner B cannot reuse Store A's SKU under Tenant-wide uniqueness (D-02 risk).
9. Store A Manager updates, Staff denied.
10. Revoked/expired membership and Tenant Owner without Store membership denied.
11. Final exact VND/stock values and audit count verified.

\`tests/pg17_rollback_transaction_qa.sql\` rehearses **within an isolated CI transaction** removing the *QA-namespaced* versioned function and rolling the transaction back, confirming the function and synthetic data are intact. It never touches Supabase or the real old RPC.

The CI additionally reruns B7-S1 six-table composite FK + restrictive RLS scenarios.

## D. Real caller inventory — constrained by inspected evidence

| Platform | Observed evidence | Remaining |
|---|---|---|
| Supabase PostgreSQL | Existing V1 signature, owner/manager checks and EXECUTE grants inspected live | Identify server-side RPC callers; verify storage/Edge Function routes |
| GitHub gh-pages | Prior inspection of five relevant web assets found no literal V1 RPC call | Not a complete scan of all branches or all deployed frontend bundles |
| n8n Commerce AI Core \`iyfGUiEsZlNTBWOR\` | Draft/published nodes inspected; no direct V1 RPC call found | Indirect child tool workflows must be checked |
| Messenger workflow \`Z7FdV7uDvApfbURQ\` | Active workflow inspected, DEMO tools and Google Sheets still used | Published linked tool chain, external integrations |
| DEMO order tool \`KrSn4DNR9ALX5ng4\` | Draft and published versions use Google Sheets; no V1 RPC call found | Does not represent Commerce writer cutover |
| n8n selected inactive Supabase/adapters | Four relevant workflow definitions inspected; no literal V1 RPC found | Search by workflow name is not an exhaustive codebase inventory |
| Render service | No workspace selected in connection; connector requires explicit user's workspace selection | BLOCKED, cannot safely infer absence of callers |
| Other live clients / other GitHub branches | Not fully inventoried | BLOCKED |

Do not state “no RPC callers exist” from these negative samples.

## E. Safe migration prerequisites and release gates

- Decision D-02: keep Tenant-wide SKUs or allow Store-local SKUs? Test collateral references and inventory import/export before changing the unique key.
- Complete caller inventory, capture actual caller owner, contract version, deployed commit/workflow version and return-code expectations.
- Prepare a **new versioned RPC** in an approved migration branch. Review owner/definer rights, explicit authentication, schema-qualified SQL, tenant + Store FK, RLS and \`service_role\` bypass.
- Validate real Store Owner/Manager/Staff sessions and Store A/B isolation with signed Auth, not a synthetic \`SET request.jwt.claim.sub\`.
- Plan backward-compatible dual-call/no-write UAT. Do not revoke, rename or replace V1 until traffic/integration inventory and rollback are proven.
- Add Store IDs/constraint migration only after safe legacy ownership manifest, approved quarantining/backfill and FK/RLS tests.
- Preserve order total, product price, stock, subscription and channel-auth guards. No unapproved payment, notification or provider changes.
- Require exact approval before staging schema/RPC writes, Cloudflare hosted canary, n8n publish, credentials, webhooks or production cutover.

## F. Status

VERIFIED: V1 live database signature/grants, no Store columns, selected n8n read-only workflow inventories.  
IMPLEMENTED: isolated SQL versioned writer candidate, rollback test, CI.  
TESTED: only when current PR HEAD Actions result is SUCCESS.  
BLOCKED: complete writer inventory, real Auth/RLS, D-02, hosted Worker UAT, live RPC cutover.  
NO-GO: production.
