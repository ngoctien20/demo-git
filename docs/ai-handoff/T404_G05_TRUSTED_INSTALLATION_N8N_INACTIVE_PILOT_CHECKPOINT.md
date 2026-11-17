# TIEN404 AI — G0.5 Trusted Installation Registry × Inactive n8n Commerce Pilot

**Date:** 2026-11-17 JST  
**Lifecycle:** EXPERIMENTAL / CANDIDATE source, QA-only, INACTIVE, NO-SEND  
**Real Commerce permission:** **NO-GO**, no hosted Store owner proof, no real provider signature, no JWT/RLS.

## 1. Reused checkpoint and design boundary

- Parent: G0.4 Draft [PR #255](https://github.com/ngoctien20/demo-git/pull/255) has **223/223 Node22 tests** on exact previous candidate source, including 76 new source tests, but no real host Store ID.
- Legacy Published Messenger, Tenant Resolver, Commerce Catalog/Cart and V3 Business Core are **unchanged**. They currently use Tenant-only identifiers/Data Table reads.
- Existing inactive V17.1C Messenger shadow \`AKgE96Xvbqxw4rGb\` was inspected; its 3 entries have QA-only noncanonical Store aliases and none has real independent Owner proof. It was **not modified** or promoted.
- Owner explicitly **deferred actual local-machine backup work**, not current recovery acceptance or hosted RLS release gating. See RPC.12 Draft #244.
- G0.5 is a **synthetic, persisted registry and separate catalog QA pilot**. Its \`qa_owner_marker=true\` is a **QA fixture marker**, not real Merchant/Operator/independent-reviewer authorization. Never use it to authenticate a real customer or Shop.

## 2. Actual n8n artifacts CREATED — VERIFIED

**n8n Cloud:** https://ngoctien20.app.n8n.cloud  
**Project:** Personal \`WW82YsCCaAxGC9dp\`  
**Folder:** \`90_QA - DIAGNOSTICS\`, id \`d3ZVrZ9cNiW2SJ1q\`

**Workflow ID:** \`AQ6JEfQzdC4aEglH\`  
**Name:** \`TIEN404_G05_TRUSTED_REGISTRY_COMMERCE_INACTIVE_QA_NO_SEND\`  
**Open:** https://ngoctien20.app.n8n.cloud/workflow/AQ6JEfQzdC4aEglH  
- **Inactive:** \`active=false\`, \`activeVersionId=null\`.
- **7 nodes:** 1 Manual Trigger, 4 Code QA logic/assertion nodes, 2 n8n Data Table **GET-only** nodes.
- **0 credentials, 0 HTTP Request, 0 Webhook, 0 AI Agent/model, 0 Google Sheets, 0 DB write, 0 provider Send.**
- Workflow source is versioned in \`qa/v152-g05/INACTIVE_N8N_COMMERCE_PILOT_SDK.js\` on G0.5 child Draft. Workflow SDK validated before n8n creation and again before subsequent versioned one-node updates.
- n8n only has manual QA/test invocation; **no Published callback or live channel**.

**New separate QA Data Table 1:** \`TIEN404_G05_QA_TRUSTED_INSTALLATION_REGISTRY_NO_SEND\`  
**ID:** \`3KfooDe1hXk3yN0r\` — **7 SYNTHETIC records**.
- 2 valid Messenger installations (Shop A/B), 1 Zalo OA (B), 1 Zalo Bot (A), 1 Website (C), 1 Messenger REVOKED and 1 Messenger EXPIRED.
- Fields include provider, installation_ref, synthetic canonical-format tenant/store UUID, fake bot version, registry version, status, expiry, \`qa_owner_marker\`, \`qa_only\`, \`read_only\`, and fixed \`approval_scope=QA_SYNTHETIC_NO_REAL_OWNER\`.
- All synthetic identifiers intentionally use known fixture UUID formats and do not correspond to actual Supabase Tenant/Store authority. **No real credential, provider token, customer ID, live Page ID, phone or Order data.**

**New separate QA Data Table 2:** \`TIEN404_G05_QA_STORE_CATALOG_NO_SEND\`  
**ID:** \`qOrmoXfIobogX16d\` — **4 SYNTHETIC products**.
- Shop A (Tenant T1) SKU A002, 159000 VND, stock 5; Shop A SKU A003, 99000 VND, stock 4.
- Shop B (same Tenant T1) SKU A002, 259000 VND, stock 2.
- Shop C (Tenant T2) SKU A002, 309000 VND, stock 8.
- All rows \`qa_only=true\`. No real Products/Orders imported or modified.

The two new QA tables and Inactive workflow **persist independently of closing GitHub Draft PRs**. Do not delete QA records or archive workflow without separately reviewed cleanup approval.

## 3. Real n8n QA — executions

Actual \`test_workflow\` was run with a **manual trigger pinned to one empty synthetic item only**; Code nodes and both n8n Data Table readers executed normally in n8n.

1. **Execution \`4359\`: ERROR** — replay fixture event_id accidentally overwritten by generator's default. Fixed \`make()\` parameter order so intentional duplicate retains initial event_id. One-node QA workflow source and GitHub SDK were both patched and SDK/node configs validated.
2. **Execution \`4360\`: SUCCESS** — \`G05_QA_21_OF_21_PASS_NO_SEND\`; **21/21 QA cases**: **6 ALLOW**, **14 DENY**, **1 DUPLICATE**. Final node reported \`provider_sends=0\`, \`orders_written=0\`, \`stock_written=0\`, \`hosted_writes=0\`, \`model_calls=0\`; \`real_jwt_rls_verified=false\`, \`real_provider_signature_verified=false\`, \`release_status=HOSTED_NO_GO\`.
3. **Execution \`4361\`: ERROR BY DESIGN** — temporary pinned DATA TABLE response changed first registry row \`qa_only=false\`; workflow refused \`G05_QA_REGISTRY_AUTHORITY_OR_FIXTURE_DRIFT\`. No persistent table edits.
4. **Execution \`4362\`: ERROR BY DESIGN** — temporary pinned catalog response changed Shop B SKU A002 price to 1 VND; workflow refused \`G05_CATALOG_PRICE_OR_SCOPE_DRIFT\`. No persistent table edits.
5. Hardened catalog check to reject a product whose \`tenant_id\` conflicts with its Store fixture graph; separate SDK+Code-node validation and one-node in-place update performed, without changing workflow activation.
6. **Execution \`4364\`: SUCCESS** — 21/21 after the catalog tenant/store scope fix.
7. **Execution \`4365\`: ERROR BY DESIGN** — temporary pinned Shop B product with Tenant T2; workflow refused \`G05_CATALOG_SOURCE_INVALID\`.

No real provider traffic, real JWT, RLS, private operator owner records or customer data was used in any test. Pinned registry/catalog injected negative test inputs are **ephemeral test inputs**, not persistent table writes.

## 4. QA coverage and limits

**TESTED n8n real QA engine, synthetic data:**
- Unique provider+installation mapping, QA-only flags, active/revoked/expired states, synthetic canonical-format Tenant/Store ID cross-check and bot-version mapping.
- Retail catalog/cart readback for same-Tenant Shop A/B with different VND price/stock and different-Tenant C; strict no-source-fallback for SKU A003.
- Rejection of fake client-supplied Store/Tenant/price/registry version/bot identity, unsigned synthetic event, insufficient stock, invalid quantities, unsupported channels, absent SKU and local replay.
- Replay guard exists only inside this **one 21-case QA batch** (not durable); no real provider HMAC/OA proof or JWT. These cases do not certify real model accuracy or eventual order creation.
- Static/source test file: \`qa/v152-g05/INACTIVE_N8N_COMMERCE_PILOT_SDK.test.cjs\` covers node topology, no-send, replica synthetic QA counts, poisoned Store/price/registry tests. GitHub CI exact HEAD should be checked separately before calling source CI TESTED.

**UNTESTED/NO-GO:**
- Real signed Meta or Zalo OA ingress, cross-channel verified customer linking, prompt/knowledge customization in production, image SKU identification (managed in V17.1 PR #243 / CBOT PR #248).
- Actual hosted Supabase Store Owner four-row primary-source attestation, independent reviewer, canonical Store Membership/RLS, privileged RPC caller compatibility and real JWT Owner/Manager access.
- Current independently restored Auth/App/Storage backup, M1/M2M4/M3 hosted migrations and production rollback rehearsal.
- Real Send, n8n production deployment, Order write, stock mutation, provider performance, multi-worker durable idempotency.

## 5. Handoff and next release gate

1. Preserve pilot workflow **Inactive** and isolated in QA folder; keep old V17.1C and all Published untouched.
2. Replace synthetic \`qa_owner_marker\` with a truly independently verified private Registry authority only **after** real merchant Owner/Store evidence and out-of-band reviewer signoff. Do not use this QA registry for real customer routing.
3. Integration Team maps native signed installation→canonical hosted Tenant + Store, and migrates Catalog/Cart to Store-aware source with actual credentials in a separately approved inactive candidate; never reassign old four real hosted rows by guessing.
4. Add durable idempotency and cross-channel identity challenge, separately admitted real Signed No-Send provider QA after actual Page/OA authorization. Retain existing V17/CBOT projects.
5. Backup-on-local-machine step is **DEFERRED BY OWNER** as requested; current M0 independent recovery **still blocks hosted write/RLS cutover**. No extra payment authorization implied.

**Scope rollback:** Leave workflow Inactive, return registry/catalog access only to QA, revert G0.5 source Draft if required. Destructive archive/delete needs explicit authorization; closing Draft does not delete n8n artifacts.

**Checkpoint:** \`G05_INACTIVE_N8N_QA_REGISTRY_7_CATALOG_4__RUN4364_21_OF_21_PASS__HOSTED_NO_GO\`.
