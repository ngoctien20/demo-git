# TIEN404 V20.1-P0-S2 — Published RPC Caller Coverage × Owner/Store Preflight × Zalo QR Provider Evidence

**Date:** 2026-11-21 JST. **Status:** READ-ONLY VERIFIED / OFFLINE IMPLEMENTED / HOSTED+PRODUCTION NO-GO.  
**Based on:** V20.1-P0-S1 Draft PR #473, exact HEAD `19b0f1695ca3d6089538e2c99f456a8b87e6adea`. Reuses historical 171/171 census in Draft PR #447 and V19.8.18 #472. No rewriting either PR.

## 1. CURRENT SYSTEM EVIDENCE

### A. n8n — present active Published census

- Connector `search_workflows(limit=200)` on 21 Nov: **174 accessible workflows, 23 active**.
- **23/23 active Published workflow graphs** inspected via `get_workflow_details(full)` in four bounded cohorts. Direct literal target search across sanitized active node parameter strings: `qa_shop_b_zalo_claim`, `qa_owner_pairing`, `save_merchant_product`, `/rest/v1/rpc/`.
- **One exact caller:** `TIEN404_ZALO_V2_SHADOW_STAGING` (`OgDZNSAvKEvhnAvn`), Published `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`, HTTP node `Submit pending claim for Shop B` contains `qa_shop_b_zalo_claim`.
- Zero other literal target matches in these 23 graphs. A negative literal scan **does not close** dynamic workflow input, expression-composed URL, external scripts, user browsers, Render, Pages or client direct PostgREST.
- Historical Draft PR #447 independently reports a full **171/171** workflow census on 19 Nov (22 active, 149 inactive), same one literal caller. Today the inventory is 174/23: delta does **not** demonstrate full 174/174 code inspection; do not relabel historical coverage as current full coverage.
- Draft/Published versions of Commerce Core and legacy Google Sheets order writers still differ as reported in #472/#473. No changes to live workflow routes.

### B. Supabase — hosted Auth/Store preflight

Project `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY PostgreSQL 17.11; read-only SQL catalog:
- `public.tenants`: 2 rows; `public.tenant_memberships`: 3 rows (all 3 active owner memberships), 2 distinct tenant IDs; `auth.users`: 3 rows. Aggregate counts only; no user IDs/PII read.
- `public.tenants`, `tenant_memberships`, `products`, `orders`, `order_items`, `messages`: RLS enabled, FORCE RLS enabled.
- Policies on `public.products/orders/order_items` use tenant membership / `tenant_id`; no canonical Store-scoped RLS proven. `public.stores` and `public.store_memberships` absent in read-only table catalog. QA schemas contain pairing fixtures, **not** canonical hosted Store tables.
- RPC ACLs unchanged: `qa_shop_b_zalo_claim` EXECUTE anon; `qa_owner_pairing` EXECUTE authenticated; `save_merchant_product` EXECUTE authenticated. All SECURITY DEFINER owned by postgres.
- PostgreSQL `track_functions=none`; **no reliable invocation telemetry can be inferred from `pg_stat_user_functions`**. Do not claim zero real invocations from an empty counter.
- This audit did **not** authenticate real Owner A/B sessions, fetch JWTs, change memberships, run privileged functions, migrate schema, access customer rows, or perform actual Store A/B UAT. **REAL OWNER/STORE AUTHORITY BLOCKED**.

### C. Cloudflare / Render / GitHub — bounded external callers

- Cloudflare connected account: 40 Worker scripts enumerated and their deployed script content scanned read-only for three exact target RPC names, with no literal matches. Some personal BIO Workers contain a generic `/rest/v1/rpc/` route; this is not proof of a TIEN404 Commerce caller.
- 2 Pages projects present: `tien404-ai-git-staging` and `tien404-ai-staging`. Current/preview deployment metadata was inspected, but Pages runtime bundle and service-worker/browser code were **not** comprehensively audited. **Git-connected Pages automatically created preview-only deployment records**, including S2 HEAD `a9c7485b4152c14feb6bb663fc2b244b26fd9507` (`e8d0ddc1-91c1-457b-a5b0-d75cd086a561`) with stage `queued` and status `idle` at inspection. This is not verified runtime serving or production publication. Do not claim external caller closure.
- Render connector has a workspace list but no confirmed selected workspace. Per connector safety instructions **the owner must select/confirm the Render workspace** before service review; this project did not choose on their behalf. Render caller closure BLOCKED.
- GitHub default-branch code search for 3 function names returned no indexed hits. This is **not** a full search of all working branches or deployed bundles.

**Security decision:** REVOKE EXECUTE / STORE MIGRATION / DISABLE LEGACY WRITER = NO-GO. First inventory source callers, document original SQL/ACL and restore path, verify backup restoration, shift to reviewed trusted server adapter, run real Owner A/B and rollback UAT with owner permission. No speculative credential or DB changes.

## 2. OFFICIAL ZALO EVIDENCE — THREE DISTINCT PRODUCTS

| Evidence | Exact authoritative URL | What the source supports | What it does NOT prove |
|---|---|---|---|
| Zalo Bot creation via Bot Manager/Creator and Bot API webhook | https://docs.zaloplatforms.com/docs/BOT/create_bot | Official Bot creation and token via Zalo app; webhook or polling | Bot-specific customer chat deep-link/QR string |
| Zalo Bot overview | https://docs.zaloplatforms.com/zalo-bot | getMe, setWebhook, event receiving, bot profile features | Verified live bot installation, merchant authority, bot chat URL |
| Bot Creator Mini App QR | https://zalo.me/s/botcreator | QR opens Bot Creator Mini App | QR does NOT demonstrate customer can chat with a particular merchant bot |
| Zalo OA Chatbot scenario sharing (21 Jan 2026) | https://oa.zalo.me/home/resources/library/tu-dong-hoa-cham-soc-khach-hang-voi-zalo-chatbot_6352033339970702125 | OA Manager > Chatbot > Danh sách kịch bản > Hành động > Chia sẻ kịch bản yields link for OA chatbot scenario | NOT interchangeable with official Zalo Bot API / Merchant Bot |
| Social SDK OA chat | https://developers.zalo.me/docs/social/share | OA chat/follow widgets | Does not authorize Bot-specific link or one shared Bot multi-Store context |

**Conclusion:** Zalo OA Chatbot **scenario-share URL is a verified product option** and not a Zalo Bot deep-link contract. **ZALO_BOT_DEEPLINK = UNVERIFIED**. Never fabricate `zalo.me/<botId>`, infer URL from `getMe`, or print QR for real merchant use until operator checks a provider-supplied customer link and verifies two-device opening + corresponding trusted webhook bot identity. Screenshot evidence should hide Bot Token, JWT, customer identities and chat content. Only a signed provider/owner binding and canonical server Store resolver can map to a Store.

## 3. AUTHORIZED OWNER / STORE UAT PRECONDITIONS

1. B-00: independently verified full hosted backup and separately isolated restore; no backup currently claimed. Supabase Free service and ownership constraints documented in PR #447.
2. D-02 and ROLE-01: approve Store-specific SKU/permissions as distinct from Tenant owner (not granted in this PR).
3. Hosted canonical `Store` and `StoreMembership` migration reviewed in PR #471/#472 on local Docker, **not applied** to hosted.
4. Real authenticated Owner A/B; same tenant different Store negative cases; revoked owner same JWT; inactive Store; cross-tenant and legacy DEMO regression; all with redacted logs and backup.
5. Trusted bot identity and merchant consent; owner pairing is separate from public customer QR.
6. No `SECURITY DEFINER` privilege escalation; independent audit of `GRANT`, `auth.uid()`, search_path, Vault and RPC callers before approval.

## 4. OFFLINE EVIDENCE GATES

`qa/v201-p0-s2/evidence-review.mjs` is a **pure evidence intake reviewer**, not a runtime guard or authorization service. Even if a reviewer supplies all claims as VERIFIED, its outputs **always** lock `rpcRevokeAllowed`, `hostedMigrationAllowed`, `qrIssuanceAllowed`, `providerSendAllowed`, `orderWriteAllowed`, `productionReady`. The helper distinguishes OA scenario links, Creator Mini App QR and Bot API chat-link candidates.

Run tests: `node --test qa/v201-p0-s2/evidence-review.test.mjs` (Node 22). Synthetic test receipts are untrusted and **cannot prove** actual provider, JWT, backup or owner. GitHub CI must be checked independently.

## 5. RELEASE DECISION / ROLLBACK / NEXT

- **VERIFIED:** 23 active n8n Published graphs; hosted aggregate Auth and tenant ACL / Store catalog; Cloudflare 40 Worker script literal scan; 2 Pages projects; official Zalo docs product distinction.
- **IMPLEMENTED:** additive S2 source-only evidence reviewer, offline tests, CI and this report on a new branch.
- **BLOCKED:** Render workspace selection; all external/browser/dynamic callers; real Owner/Store JWT; hosted Store RLS; B-00 backup and restore; provider Bot chat deep link; two-device customer QR UAT.
- **NO DIRECT CHANGE:** n8n, Supabase schema/policies/RPC, Zalo, Meta, payment, customer records, production. No explicit Cloudflare or Render deploy API call. Git-connected Cloudflare Pages automatically recorded **preview-only** deployment attempts after branch commits; runtime activation was not verified.
- **ROLLBACK:** close/revert this Draft PR, no runtime rollback required.
- **NEXT:** owner-confirms Render workspace for read-only service caller audit; redacted provider Bot Creator screen showing whether a customer chat share action exists; independent B-00 and Owner A/B UAT approval, then separate reviewed hosted security proposal. No send or write without approval.

**Checkpoint:** `V20.1-P0-S2 | N8N_23_ACTIVE_PUBLISHED_SCANNED | HISTORIC_171_CENSUS_REUSED | CF_40_WORKERS_LITERAL_SCANNED | STORE_HOSTED_ABSENT | QR_BOT_LINK_UNVERIFIED | RPC_REVOKE_NO_GO | NO_SEND | NO_WRITE`.
