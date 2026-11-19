# TIEN404 V19.0-B7-S4.1 — Render Service Caller × RPC Dependency Evidence

**Date:** 2026-11-19 JST
**Status:** SOURCE STATIC AUDIT IMPLEMENTED / PREVIOUS DEPLOY SOURCE PINNED / CURRENT RENDER SERVICE CENSUS BLOCKED / RPC DEPENDENCY CLOSURE NOT ACHIEVED.
**Parent:** V19.0-B7-S4 Draft PR #455. Canonical Store Authority design: Draft PR #417.
**Scope:** GitHub historical source snapshots, n8n published workflow metadata, live Supabase pg_proc ACL read-only. No Render service calls or mutations without user workspace selection.

## 1. Important correction to previous 17-workflow inspection

Previous V19 S3 scanned 17 selected workflow definitions and found no literal V1 product writer RPC references. V18.6.10 Draft PR #447 already contains a FULL **current n8n list static node-parameter scan** at its 2026-11-19 snapshot: 171/171 workflows (22 active, 149 inactive); ONE direct literal RPC reference. Do not rerun all 171 without a reason or claim this as exhaustive runtime instrumentation.

Verified again in S4.1:
- Parent \`yIJk8LvJoLF40Z62\` \`TIEN404_ZALO_BOT_LAB_V1_STAGING\` is active/published, has enabled "Zalo V2 Shadow (Owner Gate Only)" execute-workflow node.
- Child \`OgDZNSAvKEvhnAvn\` \`TIEN404_ZALO_V2_SHADOW_STAGING\` is active/published, has enabled "Submit pending claim for Shop B" HTTP POST node with literal RPC \`qa_shop_b_zalo_claim\`.
- No RPC execution or real provider event was triggered/verified in S4.1.
- Live Supabase \`public.qa_shop_b_zalo_claim\` is SECURITY DEFINER owned by postgres, anon EXECUTE true and authenticated EXECUTE false, with a private application-header guard described in prior reviews. This is **not** proof a call occurred or that the header is sufficient real provider identity.
- **Do not revoke anon EXECUTE, change the RPC contract or cut the n8n edge** without independent owner-approved compatibility and rollback. Preserving a legacy RPC does not mean it is approved for live commerce.

## 2. Render Auth — previous source; exact literal caller, NOT proven runtime invocation

Pinned Git commit previously observed on Render Auth staging: \`b14501a0ebf04d991302cb32b5d548a68d6b39bd\` (prior PR #72 / PR #7). Independently read file blobs:
- \`assets/merchant-product.mjs\` Git blob \`36eba0144d4944c9a7e889c104f31abc181a9a81\`
  - line 4: \`PRODUCT_EDITOR_ENABLED = false\`;
  - line 68: \`client.from('products')\` with \`tenant_id\` and SKU, not Store;
  - line 93: \`client.rpc('save_merchant_product',payload)\`; payload contains \`p_tenant,p_sku,p_name,p_price,p_active,p_initial_stock,p_expected_updated_at\`, no Store.
- \`assets/merchant-portal.js\` Git blob \`48ab82d01b4f78664e6ee7d3a33a8201baddcd4a\`: checked imports, **does NOT import \`merchant-product.mjs\` or call \`addProductEditor\`**.
- \`scripts/build-auth-preview.mjs\` Git blob \`9389ad6ddaeb9cc32f680b95523c555ffce5b1e0\`: build allowlist **includes** \`assets/merchant-product.mjs\`.

Thus \`save_merchant_product\` is a **literal static call-site in a shipped/allowlisted module**, but the tested page entry does not wire the editor and the feature flag is false. A build allowlist does not imply module execution; **no actual product write is proven**. Nonetheless this dormant client is a compatibility risk before V1 retirement or product UI promotion.

Current Render deployed source/version is UNVERIFIED because connector requires the user to select \`My Workspace\` first.

## 3. Render Data — prior pinned FastAPI source, tenant-only API

Pinned Git commit previously observed on Render Data staging: \`ab940a95dae8afdff426bc6ac71693833d5348ce\` (PR #411).
- \`ops/data-platform/app/main.py\` blob \`a7a11abeffb378b3f9952005ffdd489c54df1c13\`:
  - line 197: \`GET /api/v1/tenants/{tenant_id}/products\`
  - line 209: \`GET /api/v1/tenants/{tenant_id}/orders\`
  - no \`store_id\` reference in that source.
- No literal \`save_merchant_product\` call is present in inspected \`main.py\`, \`merchant_orders.py\`, \`commerce_transactions.py\` or \`signed_n8n.py\`.
- Prior PR #411 used *exact deployed-source replay* with synthetic data, showing same-tenant Store A/B rows would be both returned by the tenant-only Orders route (not a real customer data leak claim).
- PR #413 already proposes legacy route block 503 pre-cutover / 410 post-cutover; this is **design only**, never deployed as a result of S4.1.

These V1 routes must NOT become cross-Store readers when Store Authority is enabled. Do not disable them prematurely when current users still rely on tenant-only staging.

## 4. Product writer live contract — current Supabase metadata

Read-only pg_proc confirms:
- \`save_merchant_product\`: SECURITY DEFINER, owner postgres, authenticated EXECUTE true, anon false, no Store parameter.
- \`qa_shop_b_zalo_claim\`: SECURITY DEFINER, owner postgres, anon EXECUTE true, authenticated false.
- \`qa_owner_pairing\`: SECURITY DEFINER, owner postgres, authenticated EXECUTE true.
No changes to grants, functions, Store migration, credentials or private records.

## 5. Closure decision matrix

| Caller/dependency | Evidence scope | Decision |
|---|---|---|
| Render Auth product module | Historical pinned Git source static call-site, feature flag false, no page import | **P0 COMPATIBILITY INVENTORY** / runtime unverified |
| Render Data V1 Products/Orders | Historical pinned FastAPI source and previous offline replay | **P0 TENANT-ONLY READER** / store cutover blocked |
| n8n Zalo Shop B claim | Current published parent+child node configuration read-only | **P1 ACTIVE RPC DEPENDENCY** / cannot revoke blindly |
| n8n \`save_merchant_product\` | Previous 171/171 static list scan found no literal match | No *literal* match in that scan; runtime/dynamic/other apps unknown |
| Supabase product writer | Current callable SECURITY DEFINER function | Preserve signature/grants until actual callers, auth and rollback reviewed |
| Render live services/deployed SHAs | Workspace **not user selected** | **BLOCKED** |
| Other branches, mobile clients, external API callers | No complete authenticated runtime trace | **UNKNOWN** |
| Real Owner A/B and Store RLS | No canonical Store tables, signed same-Tenant A/B UAT not completed | **BLOCKED** |

## 6. Next read-only Render audit after user chooses workspace

User must explicitly confirm \`My Workspace\` for **read-only** Render access. Then:
1. \`list_services({workspaceId: confirmed})\`, \`get_service(...)\` for actual service IDs.
2. Check actual deployed branch + commit (not only historical PR #72/#411) via \`list_deploys\`, and compare source blob SHAs.
3. Verify whether current merchant portal imports/enables \`merchant-product.mjs\`; inspect actual static asset delivery and runtime invocation evidence without taking credentials or customer payloads.
4. Inspect approved non-sensitive logs/request paths only if accessible; do not copy access tokens, \`Authorization\`, cookies, customer IDs or raw messages.
5. Determine if V1 Data API is live, referenced by UI and protected from Store rollout. Preserve legacy until a separately approved compatibility plan.
6. Reconcile dynamic/external callers and n8n child workflows. Even clean logs in a short window do **not** establish there are no callers.
7. Record scoped tested evidence, reviewers, exact source commit, and rollback. Any Render changes require a **separate approval**.

## 7. Safety and rollback

All S4.1 changes are a GitHub source-only Draft PR + CI. No Render service was queried beyond \`list_workspaces\`, no deployment, restart, env access or log access; no Supabase DDL/DML, n8n execution/publish, provider send or live Zalo webhook change.

Closing/reverting S4.1 Draft PR is sufficient rollback. Real Store migration, RPC cutover and hosted Cloudflare worker remain **NO-GO**.

**Checkpoint:** \`B7_S41_PINNED_RENDER_SOURCE_WITH_DORMANT_RPC_CALLSITE__PUBLISHED_ZALO_CLAIM_DEPENDENCY__LIVE_RENDER_WORKSPACE_BLOCKED__PRODUCTION_NO_GO\`.
