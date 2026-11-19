# TIEN404 AI — V19.0-B7-S4.1 Checkpoint

**Date:** 2026-11-19 JST.
**Workstream:** Render Service Caller Audit × RPC Dependency Closure.
**Truth:** IMPLEMENTED/TESTED PINNED GITHUB SOURCE ONLY, ACTIVE PUBLISHED N8N RPC CONFIG VERIFIED, RENDER LIVE SERVICE CENSUS BLOCKED, RPC CLOSURE BLOCKED, PRODUCTION NO-GO.
**Parent:** V19.0-B7-S4 Draft PR #455 (HEAD at start \`a620de66b7f328cd07013839b00fa445fc25fb02\`). Existing PR #417 remains canonical Store Authority design.

## Before changes — checks

- Read-only Render \`list_workspaces\`: one \`My Workspace\` returned. The user's last message asked to continue B7-S4.1 but did NOT explicitly select \`My Workspace\`; no \`list_services\`, deployment/log query or workspace selection was made.
- GitHub pinned Render Auth and Render Data commits were re-opened. Historical Render deploy evidence in PR #72 / PR #411 (Nov 14 / Nov 18); **current hosted deploy cannot be inferred**.
- Supabase read-only pg_proc ACL checked the three relevant RPC signatures: \`save_merchant_product\` (authenticated EXECUTE), \`qa_shop_b_zalo_claim\` (anon EXECUTE), \`qa_owner_pairing\` (authenticated EXECUTE); all are SECURITY DEFINER owned by postgres. No changes.
- n8n two exact active/published graphs rechecked: \`yIJk8LvJoLF40Z62\` parent with enabled shadow child, \`OgDZNSAvKEvhnAvn\` child with enabled POST node \`qa_shop_b_zalo_claim\`. No workflow execution, no send.
- Prior PR #447 inspected **171 of 171** workflows in its list snapshot, one literal \`qa_shop_b_zalo_claim\`, no literal \`save_merchant_product\`; this is only a static node scan and not runtime proof.

## Key findings (source not runtime)

1. \`assets/merchant-product.mjs\` in historical Render Auth source \`b14501a0...\` contains \`client.rpc('save_merchant_product',payload)\`, no Store argument.
2. Module explicitly declares \`PRODUCT_EDITOR_ENABLED=false\`; \`merchant-portal.js\` does not import it. Auth build script ALLOWLISTS the module. **Thus presence of the callsite is confirmed, execution is NOT confirmed.**
3. Pinned Render Data FastAPI \`ab940a95...\` \`main.py\` has \`GET /api/v1/tenants/{tenant_id}/products\` and \`/orders\` and no \`store_id\` checks. Previous PR #411 replay showed synthetic cross-Store leakage under a Tenant-only contract. This is a Store rollout compatibility risk, NOT evidence of customer data exposure.
4. Published Zalo shadow child still has \`qa_shop_b_zalo_claim\` dependency; do not revoke anon EXECUTE/rename the RPC or disable the published edge as a side effect of product-writer refactoring.
5. Real Owner A/B Store authorization not established; no Store migration or production permission was granted.

## Implemented — GitHub QA branch only

- \`render-rpc-dependency-evidence.json\`: pinned historical code SHAs and evidence categories; does not include secrets, personal data, runtime credentials or real tenant/store IDs.
- \`render-rpc-dependency-gate.mjs\`: strict source-only classifier plus fail-closed dependency gate, permanently denies Store, RPC revoke, hosted deployment or provider sends.
- \`tests/render-rpc-dependency-gate.test.mjs\`: 18 negative/safety/static-source tests.
- GitHub Actions: checks out both **pinned historical Git commits**, verifies five exact file blobs and immutable V19 Worker source, runs Node.js tests, prohibits deployment.
- \`RENDER_RPC_DEPENDENCY_CLOSURE.md\`: decision matrix and post-authorization Render read-only closure sequence.
- This checkpoint.

## Tested

- Initial workflow run \`#44512106714\`, source SHA \`b111cfe6a79cf4b21e9ac4db488e70970b3a972f\`: SUCCESS, **18/18 Node tests**, 0 failed.
- A new final PR HEAD run must be checked after documentation/PR changes before reporting final QA.
- No test used current Render APIs or actual Supabase Auth JWT.

## Blockers, approval and rollback

- Need **explicit user confirmation** of Render workspace \`My Workspace\` before service/deploy/log read-only inspection.
- Cannot close Render callers until exact current deployed source/versions, route handling, logs (non-sensitive) and external caller scope are reconciled; short logs alone cannot establish total absence.
- Product editor dormant module may become active later; versioned V2 and old V1 require compatibility and security review.
- Tenant-only Render Data V1 Products/Orders must not remain a multi-Store reader. Design-only block 503/410 in PR #413 not deployed.
- Real signed Owner A/B Store RLS, PR #417 migration, D-02 SKU decision, backup restore rehearsal, security reviewer and rollback are still missing.
- Hosted Worker Binding, provider events/messages and Commerce writer remain NO-GO.

All changes are GitHub Draft QA files only; rollback: close/revert PR. No Render/Supabase/n8n/Cloudflare/data mutation or credentials affected.

**Checkpoint:** \`V19_B7_S4_1_PINNED_RENDER_CALLSITE_DORMANT__TENANT_ONLY_DATA_API__ACTIVE_ZALO_CLAIM_RPC__18_OFFLINE_PASS__LIVE_RENDER_WORKSPACE_BLOCKED__PRODUCTION_NO_GO\`.
