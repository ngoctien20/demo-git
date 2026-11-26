# TIEN404 V17.16 — Commerce Core read-only catalog/privacy/order-intent regression

**Date:** 2026-11-17 JST. **Release verdict:** `PASS_17_CASE_ACTUAL_CENTRAL_CORE_READONLY_QA`; only the **DEMO** Core read-only advisor is published. **NO-GO:** real merchant Store catalog/owner authority, provider Zalo OA, merchant Website signed session, commercial order/stock writes.

## 1. Verified runtime baseline before work

- Real signed Messenger `QA_CORE: F-101` execution `#4544` had been accepted by Meta and proved actual central Core catalog execution `#4545` without old DEMO order-writing tools or duplicate outbound. This is prior checkpoint V17.15R; no need to re-send the same message.
- Current Messenger `Z7FdV7uDvApfbURQ` Published **`2b869035-fe39-46fb-a253-18fefe4ecbfd`**; original DEMO path remains active for non-`QA_CORE:` chats. **CAUTION:** legacy DEMO `create_order` still exists, as proven by historical real execution `#4498`; entire Page is NOT globally read-only.
- Central Core `iyfGUiEsZlNTBWOR` Published old version `3d3905a4-0d26-4253-8a1d-57fd73b043c2` before this task; Messenger signed path, private shadow, Zalo Bot and Website staging published versions are unchanged.
- Two other channel adapters published: Zalo Bot staging `yIJk8LvJoLF40Z62` version **`776486b2-092f-49ec-a7c4-f74ec8b60f07`**; Website marketing bot `wgkkmT7q4lm4HyuA` version **`c81929d4-ab55-4c24-8659-795842739e24`**; protected Zalo/Website private internal Core-deny bridge `4ycmVzaNzVRulBjQ` remains published `76bbb4e9-7ad2-45a6-8188-260523ced57a`.
- Latest n8n executions after F-101 test: only original signed Messenger `#4544`, **no additional real F-102 / unknown SKU Messenger tests**, **no new successful positive Website chat test**, **no real protected Zalo Bot event** observed in the queried window. Zalo stage configuration disables success execution data saving, so native provider proof needs a privacy-safe UAT/receipt rather than assuming absence of webhook from execution list.

## 2. Executed actual Core extended QA, BEFORE patch

- Continued existing **inactive, manual-only** QA workflow `7XzLd51D7C6tlaS4`, appended seven synthetic input cases to its previous eight untrusted-channel and two valid SKU tests (now **17 inputs**); no new public trigger or provider send.
- Actual n8n execution **`#4555` SUCCESS, 17/17**:
  - 8 unknown/forged/missing channels fail closed with `canSend=false`, `canWrite=false`.
  - Valid known DEMO F-101 / F-102 resolve exact sample prices `159000` and `289000` VND.
  - Cross-tenant SKU `VL-101`, nonexistent `F-999` return **no unrelated catalog results/prices**.
  - Phone, URL, prompt injection, overlength inputs return safe privacy refusal without reflection of PII.
  - Order request text `QA_CORE: tao don 2 cai` did **not** write an order or stock; **UX issue:** returned sample product list despite being an order intent.

## 3. Narrow P1 UX fix and verified release

- Modified exactly two existing central Core nodes **in a DRAFT first**:
  1. `V17.15 Sanitize Read-Only Demo Query`: recognize explicit request to create/place/confirm an order, hold/stock or pay. Marks `blockedOrderIntent`; catalog search uses no-match sentinel instead of listing sample products for such intents.
  2. `V17.15 Format Safe Demo Consultation`: explicit safe message `[TIEN404 CORE — DEMO CHỈ ĐỌC]` + `Bản demo không tiếp nhận đặt đơn, giữ hoặc trừ kho, hay thanh toán` with sample disclaimer, no unrelated SKU list.
- Updated QA assertion requires explicit order refusal and **no F-101/F-102 shown for an order-only request**, not merely a generic no-write statement.
- Actual Core QA **`#4608` SUCCESS, 17/17** after patch. Verified full output for order-intent row with refusal, no product list. n8n version diff **exactly two Code nodes modified**, **zero nodes or connections added/removed**; no AI/HTTP/send nodes touched.
- **Published** central Core version **`b08f806b-25dc-40d4-9e82-212307ce19b9`**. Existing Messenger direct signed route and Zalo/Website staging versions left untouched.
- **Post-publish actual n8n regression**:
  - **`#4661` SUCCESS, 17/17** real central Core subworkflow calls: eight channels denied, two correct sample catalog matches, seven unknown/sensitive/order prompts safe. Model sends/writes = zero on this QA path.
  - **`#4682` SUCCESS, 2/2** Zalo Bot staging + Website unbound technical inputs delegated to actual Core and denied; zero provider send, zero customer/Commerce write, no model.
  - **`#4711` SUCCESS, 8/8** actual existing Commerce Catalog tenant isolation / exact sample prices; unbound Page denied, cross-tenant SKU not disclosed.
- QA workflow `7XzLd51D7C6tlaS4` is still **INACTIVE / NOT PUBLISHED**, draft version **`ec998d42-2b23-4dbf-b29b-5a6bfc2489ee`**.

## 4. Live/ownership gaps and recommendation

- **VERIFIED:** first real signed F-101 Messenger Core demo UAT from V17.15R; current Core read-only 17/17 manual/actual subworkflow; protected staging no-send negative 2/2; tenant catalog 8/8. This does **not** independently prove customer-device delivery, concurrent MID dedupe or business owner Store.
- **BLOCKED:** second **real signed** F-102 and cross-store SKU Messenger inbound/outbound test, **positive public Website** chat with valid session and exactly original answer returned via lastNode branch, **native protected Zalo Bot** event and OA-specific App/Page owner proof, Store-level PostgreSQL/RLS, merchant-authoritative products/price/stock, real customer-facing merchant Core.
- Website chat currently uses a paid-model-capable node `gpt-5-mini` and real positive execution would incur potential model/Gateway usage. No cost-bearing positive Website execution was triggered solely by this follow-up without a budget-admitted canary. Staging Zalo Bot is distinct from Zalo OA, which has not been proven merchant-installed or authorized.
- The user may test Messenger **`QA_CORE: F-102`** or **`QA_CORE: VL-101`** from the already authorized test account. Post-test independently inspect signed execution, one Meta MID and no legacy order writer. Do not send test provider messages as assistant.
- Merchant go-live remains **BLOCKED** until actual Meta/OA/Website Store owner binding, signed session, hosted Store RLS and real merchant product catalog are authenticated. This patch did not enable order write, stock mutation, payment or new tokens.

## 5. Rollback / checkpoint

- **Core:** on regression, republish prior known-good `3d3905a4-0d26-4253-8a1d-57fd73b043c2` after assessing active Messenger pilot dependencies; no provider subscription changes.
- **Messenger:** prior known-good `ff7a57d2-519a-4283-933c-37a854df92d2` if pilot reply behavior regresses; current `2b869035-fe39-46fb-a253-18fefe4ecbfd` left untouched.
- **Zalo:** `776486b2-092f-49ec-a7c4-f74ec8b60f07` current unchanged. **Website:** `c81929d4-ab55-4c24-8659-795842739e24` current unchanged; older pre-bridge `fcda12f3-35c6-473e-bc9d-2359ada3989c` remains available.
- No credentials, production callback settings, Supabase tables, Google Sheets or Commerce orders changed by V17.16. PR #243 stays DRAFT.
