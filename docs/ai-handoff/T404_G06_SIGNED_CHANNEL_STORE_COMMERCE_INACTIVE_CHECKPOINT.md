# TIEN404 G0.6 — Signed-Shaped Channel Ingress × Store Registry × Commerce No-Send Pilot

**Date:** 2026-11-17 JST  
**Lifecycle:** CANDIDATE / SOURCE TESTED / n8n MANUAL INACTIVE TESTED / REAL HOSTED NO-GO  
**PR:** https://github.com/ngoctien20/demo-git/pull/260  
**Parent:** G0.5 Draft PR #258 / exact source base \`e0d88f138ac5b864c65defdd35943f975ff8534d\`  
**Live workflow ID:** \`FqEcdmc8PRRMNUEb\`  
**Editor:** https://ngoctien20.app.n8n.cloud/workflow/FqEcdmc8PRRMNUEb  
**Project:** n8n Personal \`WW82YsCCaAxGC9dp\`  
**Folder:** \`90_QA - DIAGNOSTICS\` / \`d3ZVrZ9cNiW2SJ1q\`  
**Tested workflow draft version:** \`d16b480f-536f-4e26-b728-97e3a5b66c37\`  
**Status directly inspected after tests:** \`active=false\`, \`activeVersionId=null\`.

## 1. Objective and actual scope

G0.6 joins the **previously approved synthetic QA installation registry and Store catalog** with a **manual-only native-*shaped* signed event test**:

Manual QA fixtures → provider-shaped raw body / QA signature or header → parse/bounds/replay tests → n8n QA registry (GET) → registry/Store/tenant/bot scope guard → n8n QA catalog (GET) → scoped SKU/price/stock and cart preview → final 36-case No-Send assertion.

**IMPORTANT:** This is **not** an actual real Meta/Zalo app verification or live callback. No real Page/OA provider credential, actual tenant/store owner or real Supabase customer rows were accessed. The generator and verifier share deliberately published **FAKE QA-only secrets**. A matching synthetic signature is **NOT** an independently authenticated Page/OA signature. The fake HMAC for Zalo OA is **not a Zalo OA native signature implementation**.

## 2. Actual n8n artifacts (VERIFIED)

**Created:** \`TIEN404_G06_SIGNED_CHANNEL_STORE_COMMERCE_INACTIVE_QA_NO_SEND\`.  
Exactly **8 nodes**:
1. Manual G06 QA Only — **Manual Trigger**, no webhook/URL.
2. Generate G06 Signed Channel Fixtures — Code, **36 fake events**.
3. Verify G06 Native-Shaped QA Signatures — Code, QA-only HMAC, bot header, parser and within-batch replay.
4. Read G06 QA Installation Registry — **Data Table GET only**.
5. Validate G06 Synthetic Installation Registry — Code, unchanged G0.5 registry fail-closed checker.
6. Read G06 QA Store Catalog — **Data Table GET only**.
7. Evaluate G06 Channel To Store Commerce No Send — Code, Store/Tenant/SKU/VND checks.
8. Assert G06 Thirty Six Case Release Refusal — Code, must match 7 allow/28 deny/1 duplicate, zero real actions, hard \`HOSTED_NO_GO\`.

Actual workflow checked after final QA:
- \`active=false\`, \`activeVersionId=null\`, **no stored pin data**.
- **0 credential nodes, 0 HTTP/webhook/Google Sheets/Telegram/Supabase/Postgres/LLM/provider send nodes**.
- Exactly **2 Data Table operations, both \`get\`**, reading existing G0.5 QA tables, with no write node.
- Reused \`TIEN404_G05_QA_TRUSTED_INSTALLATION_REGISTRY_NO_SEND\` id \`3KfooDe1hXk3yN0r\` — **7 synthetic binding rows**, all \`qa_only=true\`, all \`approval_scope=QA_SYNTHETIC_NO_REAL_OWNER\`.
- Reused \`TIEN404_G05_QA_STORE_CATALOG_NO_SEND\` id \`qOrmoXfIobogX16d\` — **4 synthetic products**, all \`qa_only=true\`.
- No new n8n Data Tables were added for G0.6. Existing G0.5 and V17.1C QA workflows, as well as all Published Messenger/Zalo/Commerce workflows, were not edited.

## 3. Separate QA provider contracts and limits

**Messenger Meta-shaped:** Meta \`x-hub-signature-256\` shape, HMAC-SHA256 over raw body bytes using **hardcoded FAKE QA secret**, constant-time comparison, page→recipient/entry consistency, 5-minute event freshness, no client Store/Tenant/bot claims, duplicate MID rejection in synthetic batch.

**Zalo Bot:** \`x-bot-api-secret-token\` comparison with **FAKE QA token**, constant-time comparison; checks synthetic \`message.text.received\` shape. **This is a header token, not a signature over message bytes and not Zalo OA authentication.**

**Zalo OA:** \`x-qa-zalo-oa-hmac-256\` artificial **NON-NATIVE QA header**, FAKE HMAC and OA route matching; **DO NOT** use this header/protocol for any production Zalo OA event. Real OA validation requires official policy/API and a privately authorized OA/app.

**Website:** \`x-qa-website-hmac-256\` artificial QA MAC and widget match, **not** real signed session/JWT/CSRF binding.

Because this QA workflow deliberately has no active webhook, **no externally received callback is checked here**.

## 4. Actual n8n execution receipts

Run using \`test_workflow\` with **only manual trigger pinned to empty synthetic item**; the Code nodes and both real QA Data Table GETs executed.

| n8n execution ID | Result | Meaning |
|---|---|---|
| \`4370\` | **SUCCESS** — \`G06_SIGNED_SHAPED_QA_36_OF_36_PASS\` | Full 36 synthetic signed-shaped cases |
| \`4371\` | **ERROR BY DESIGN** — \`G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT\` | Temporary Data Table pin set \`qa_only=false\` |
| \`4372\` | **ERROR BY DESIGN** — \`G06_CATALOG_PRICE_OR_SKU_SCOPE_DRIFT\` | Temporary Shop B price tampered to 1 VND |
| \`4373\` | **ERROR BY DESIGN** — \`G06_CASE_FAILED_QA_G06_01\` | Raw Messenger body changed after fake HMAC (signed message expected ALLOW → verified DENY) |
| \`4374\` | **SUCCESS** — \`G06_SIGNED_SHAPED_QA_36_OF_36_PASS\` | Final clean rerun after adversarial pin-only tests |

Final \`4374\`:
- **36/36 PASS**: **7 permitted read/cart previews, 28 explicit denies, 1 duplicate**.
- \`provider_sends=0\`, \`orders_written=0\`, \`stock_written=0\`, \`hosted_writes=0\`, \`model_calls=0\`, \`real_customer_rows_read=0\`.
- \`real_provider_signature_verified=false\`, \`real_store_owner_verified=false\`, \`real_jwt_rls_verified=false\`, \`real_cross_channel_identity_verified=false\`, \`can_publish=false\`, \`release_status=HOSTED_NO_GO\`.
- After \`4374\`, re-read n8n to confirm workflow remained Inactive, no pinData persisted, original QA 7+4 rows unaltered.

All adversarial inputs in 4371–4373 were **ephemeral \`pinData\`**; no Data Table row updates.

## 5. Source/CI and QA matrix

GitHub source:
- \`qa/v152-g06/INACTIVE_SIGNED_CHANNEL_STORE_COMMERCE_SDK.js\` — n8n Workflow SDK, validated before creation, 8-node snapshot.
- \`qa/v152-g06/INACTIVE_SIGNED_CHANNEL_STORE_COMMERCE_SDK.test.cjs\` — isolated Node VM synthetic QA regression, no external calls or real credentials.
- \`.github/workflows/v152-g06-signed-channel-commerce-nosend.yml\` — Node22 G0.6 source regression plus inherited G0.4/G0.5 tests; no-send/no-hosted static checks and a separate release-refusal check.

**G0.6 actual test corpus = 36 cases**:
- 01–07 positive read/cart, including Meta Shop A/B (same Tenant, different SKU A002 price), Zalo OA Shop B, Zalo Bot Shop A, Website Shop C, Meta catalog, OA catalog.
- 08–16 missing/invalid/tampered HMAC, Bot header, OA artificial HMAC, Website artificial MAC.
- 17–20 unbound/revoked/expired Page and OA route mismatch.
- 21–25 wrong Page recipient, signed client Tenant/Store claim, stale/future timestamps.
- 26–30 unknown Bot route, Website route spoofing, unsupported provider, malformed raw body, unsupported order-write command.
- 31–34 cross-Store SKU, insufficient Shop B stock, invalid quantity, unknown SKU.
- 35 exact MID replay in same batch; 36 same MID but different **validly QA-signed** content conflict.
- Failure cases have **no product price in output**, and final assertion requires *exact* QA shape/counts and no live action flags.

**Node22 GitHub Actions**: source QA run and exact SHA evidence must be independently verified. Do not claim CI success for a newer docs HEAD merely because an earlier code SHA passed. The user-facing report can cite the previous exact source SHA CI when its run is known.

## 6. Release blockers and owner instruction

- **G0 merchant/Store:** 2 Product + 2 Order original hosted row Store ownership, independent reviewer, canonical Store+Tenant registry are **not proven** by this QA table.
- **G2 recovery:** Owner explicitly **deferred actual local-machine backup**. Historical H11R partial acceptance is preserved, but **current independently restored app/Auth/Storage is not certified**. No hosted schema/RLS/privileged RPC change is authorized.
- **G3 real signed ingress:** real approved Meta Page App HMAC and genuine Zalo OA/Bot source authority not tested; no real provider secret or channel callback.
- **G3 customer/JWT:** no real customer cross-channel linking challenge, real Auth JWT same-Tenant A/B RLS or privileged RPC. Durable multi-worker replay protection remains absent.
- **Commerce release:** no actual n8n Published workflow changes, no real Orders or Stock mutations, no model costs and no paid services.

Next phase should be **G0.7 — Private Authorized Provider Authority × Real Signed No-Send Ingress Admission × Store Registry Contract Review**: Integration Team/Operator must verify genuine provider callback credentials and Page/OA installation rights privately, obtain independent Merchant Store evidence and restore acceptance, then admit one scoped read-only pilot with explicit owner consent. No inference from QA test success.

**Rollback / safety:** Keep G0.6 workflow Inactive; revert/close Draft PR for source. n8n QA workflow remains present after PR close; any deletion or credential attachment requires separate approval.

**Checkpoint:** \`G06_INACTIVE_CHANNEL_QA_36_OF_36_PASS__G05_REGISTRY_REUSED__NO_REAL_PROVIDER_AUTH__HOSTED_NO_GO\`.
