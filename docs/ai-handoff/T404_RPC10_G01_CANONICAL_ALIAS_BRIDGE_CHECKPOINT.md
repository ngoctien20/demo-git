# TIEN404 AI — RPC.10 G0.1 Canonical Alias→Store Bridge Gate

**Date:** 2026-11-17 JST  
**Project:** \`ifxlvrhyjhbzbrkdsida\` / \`ngoctien20/demo-git\`  
**Lifecycle:** EXPERIMENTAL → CANDIDATE (source only); NOT APPROVED / NOT RELEASED  
**Authorized scope:** read-only metadata, local/source-only QA, disposable PostgreSQL 17.  
**Hosted change authorization:** NONE.

## 1. What was independently observed

Current staging Supabase schema/read-only status:
- \`tien404-staging\` ACTIVE_HEALTHY, PG17.11, 2 Tenants, 2 Products, 2 Orders, 0 Customers.
- \`public.stores\`/\`store_memberships\` absent; no \`store_id\` on six Commerce tables.
- Tenant memberships prove only three active **Tenant Owners**, not the actual Owner of each of four Commerce rows.
- Existing six public Commerce SELECT policies remain PERMISSIVE Tenant-scoped.
- Prior limited H11R Application archive acceptance is preserved with Auth/Storage omissions; not a current independent real recovery point.

Read-only **in-memory** matching of Supabase Tenant UUID values with connected n8n Data Table fields:
- \`TIEN404_COMMERCE_CHANNELS\`: 6 tenant aliases populated, **0 exact UUID matches** with either of the two hosted Tenant UUID values, **0 UUID-shaped aliases**.
- \`TIEN404_R1_SHOP_BOT_REGISTRY_QA\`: 2 populated aliases, **0 matches**, **0 UUID-shaped**.
- \`TIEN404_V171C_QA_INSTALLATION_BOT_BINDINGS_NO_SEND\`: 3 populated aliases, **0 matches**, **0 UUID-shaped**.
- This is **not proof of a defect or incident**; n8n appears to use noncanonical aliases. It does mean **exact identifier equality does not provide an authorized bridge** to Supabase hosted Tenant/Store records.

Current **Published** workflow node/parameter inspection (not executing business flows):
- Resolver \`5Eeh8hbpsoNhuiVo\` version \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`. Code uses Tenant identifier; no \`storeId/store_id\` token in Code or its 3 Data Table query parameter snapshots.
- Catalog \`oOOXicKXGkBskKqh\` version \`e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696\`. Code and read-catalog Data Table use Tenant identifiers without exact Store token.
- Cart \`igPOsSbEgd4NgtRA\` version \`eff32e20-a6d0-4975-88b8-107eae752b4b\`. Code and read-catalog Data Table use Tenant identifiers without exact Store token.
- This is a **contract coverage gap** for future same-Tenant Shop A/B, not evidence of actual cross-Shop data exposure today.

## 2. Implemented — independently fail-closed bridge shape preflight

New source-only files in Draft #247:
- \`qa/v152-rpc10/alias-bridge-preflight.cjs\`
- \`qa/v152-rpc10/alias-bridge-preflight.test.cjs\`

The pure inspector checks synthetic or privately supplied:
- Canonical Tenant UUIDs and Store-to-Tenant graph integrity, Store activation.
- Internal alias → canonical Tenant UUID uniqueness/origin.
- Unique provider+installation Page/OA binding → exactly one trusted Store in the correct Tenant.
- Binding expiry, revoked/disabled status, explicit version pinning, and **claimed** externally verified native provider/merchant evidence.
- Exact three Commerce caller IDs: resolver, catalog, cart. Each must have a server Store resolver, canonical Store requirement, disabled Tenant-only path and authoritative membership recheck.
- Unknown/duplicate/ambiguous aliases or callers, cross-Tenant store binding, replayable/expired installation and absent reviewer/provider markers are fail-closed.
- The tool does not print tenant/store/account identifiers, private source digests, tokens, recipient IDs or input secrets. All-green *self-reports are not trusted authority*; \`canRelease\`, \`canResolveRealStore\`, \`canMigrate\`, \`canPublish\` always false.

**Explicit design boundary:** This is **NOT** another provider signature verifier, nor an executable runtime resolver. Existing V17.1 Draft #243 owns native-channel QA; V17 CBOT Draft #248 owns cross-channel read-only model; RPC.11/12 Draft #241/#244 own private four-real-row ledger and M0. No parallel hosted migration design is implemented.

## 3. TESTED evidence

**Exact tested source SHA:** \`80dc392124d543bdb0574835bcaabca8487cc202\`  
**CI:** https://github.com/ngoctien20/demo-git/actions/runs/43998900952

From checked GitHub job logs:
- Existing RPC.10 Store Gate: **47/47 PASS**.
- New G0.1 alias bridge: **30/30 PASS**.
- PostgreSQL 17 disposable six-surface FK/RLS, Store A/B/C isolation: **SUCCESS**.
- PostgreSQL 17 separate concurrent sessions / lock / COMMIT / ROLLBACK: **SUCCESS**.
- All **three** jobs completed SUCCESS, zero failed steps.
- No hosted Supabase mutation, Auth JWT use, n8n published edit, real provider send, resource billing or real owner ownership certificate.

**After documentation changes:** verify the latest PR head run independently before labeling the new HEAD TESTED.

## 4. Operator handoff / next decision gate

**G0 (BLOCKED):** RPC.12 private Operator & independent reviewer must verify original primary-source merchant→Store linkage for exactly 2 Product and 2 Order real hosted rows. Do not infer from Tenant Owner, \`owner_verified\` QA flags, n8n aliases, Page names, product SKU or chatbot context. Keep original row/tenant UUIDs and attestation documents outside git/CI and outside this chat.

**G0.1 (BLOCKED actual registry):** Integration Team defines and privately attests:
1. Stable \`provider + installationRef + version\` → canonical \`tenant_id UUID + store_id UUID\` from a trusted server binding registry.
2. Merchant Owner primary source, independent reviewer, effective ownership dates, disabled/revoked handling, dedupe/replay and conflicting bindings.
3. Trusted callback signatures, Page/OA authority, subject identity separate from merchant ownership, and no LLM authority claims.
4. Versioned resolver / Catalog / Cart adapter contracts, write policy and rollback. Resolved Store must be part of every six-table Commerce read/write and FK scope.
5. Provider-specific and same-Tenant Shop A/B negatives with JWT real only *after* G2 gates. Never mix Demo Google Sheets, n8n Data Tables and Supabase hosted writes without explicit approved source mapping.

**G2 (BLOCKED hosted):** Real source-consistent scoped backup/isolated restore, application/Auth/Storage service coverage and caller/RPC compatibility; separate approval for M1, M3, M2/M4 atomic, plus reader lock window. No automatic promotion of local H11R limited acceptance to full M0.

**G3 (NOT RUN):** Real authenticated Shop A/B Owner, Manager, revoked member, cross-store Order/Product/Customer/Message, signed provider replay, privileged RPC and rollback acceptance. Offline booleans or fake JWT do not count.

## 5. Reuse / rollback

- Keep Draft #247 open; do not merge without Integration/Security signoff reconciling sibling Draft #237 (M3 composite FK) and bridge contracts #243/#248.
- Keep RPC.12 Draft #244 as canonical private Operator intake. No duplicate intake or private source upload.
- On source-only rollback: close Draft PR #247. No hosted rollback is necessary because the changes are code + tests only.
- **Checkpoint:** \`RPC10_G01_ALIAS_BRIDGE_77_NODE_PASS_PG17_PASS__REAL_OWNER_CANONICAL_BRIDGE_NO_GO\`.
