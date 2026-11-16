# TIEN404 AI — V15.0 A → B → C → D — Staging No-Send Delivery & UAT
**Checkpoint:** 2026-11-16 JST  
**Decision:** `A IMPLEMENTED+TESTED OFFLINE / B IMPLEMENTED+TESTED OFFLINE / C IMPLEMENTED ROUTER PREVIEW+CORPUS READINESS; PAID BENCHMARK BLOCKED / D HOSTED STAGING HTML VERIFIED, USER UAT PENDING`  
**Release gate:** `EXPERIMENTAL → CANDIDATE` (source-only + one isolated synthetic HTML Worker); **NOT APPROVED for real multi-tenant Commerce, NOT RELEASED**.
**User authorization:** user explicitly selected and approved sequence A→B→C→D for safe continuation. No new consent to spend API credits, replace provider, change credential, modify existing production/Published services or use customer data.

## 1. Exact inherited checkpoints
- V14.7 custom studio synthetic Shop A/B/C: Draft PR [#118](https://github.com/ngoctien20/demo-git/pull/118) inherited through V14.8.
- V14.8 unified identity candidate: Draft PR [#121](https://github.com/ngoctien20/demo-git/pull/121), source `qa/v148-unified-identity/identity-core.cjs`, **HMAC-signed QA fixture**, *NOT* certified real Messenger/Zalo signature or durable hosted replay.
- V15.0-01/02 audited existing n8n providers and prices: Draft PR [#122](https://github.com/ngoctien20/demo-git/pull/122), model research + cost spreadsheet, **73/73 offline PASS**, no paid inference.
- **Current work:** [Draft PR #123](https://github.com/ngoctien20/demo-git/pull/123), branch `work/v1503-08-agent-skills-router-testlab-nosend-20261116`, **stacked onto PR #122**. Do not merge unreviewed parent chain.
- Zalo G2.1 signed server observation, G2.2 QA Shop B candidate mapping exist independently. **G2.3 owner/merchant consent BLOCKED**; this V15 branch does not change Owner/merchant privileges.

## 2. A — Universal AI Agent Core 2.0 × V14.8 Identity (IMPLEMENTED / TESTED OFFLINE)
- New file `qa/v15-commerce-core/offline-orchestrator.cjs` integrates **the actual existing V14.8 `createUnifiedQaRouter`** and V14.7 `createStudio` (not copies of production provider authentication), together with inherited V15 `planAgent`.
- Uses the exact three synthetic Shop fixtures A/B/C, all four synthetic channels Messenger/Zalo Bot/Zalo OA/Web Widget.
- Events are locally HMAC-signed with in-process fixed **TEST FIXTURE KEY**, not real Meta/Zalo provider signature. Trusted event routing, store, tenant, conversation and shop profile derived from the private offline fixture, not from client-provided IDs.
- Cross-tenant and cross-store requests fail closed. Session reference includes tenant + store + channel + conversation; no memory persistence or real customer data.
- Returns model/skill/intent trace with `can_send=false`, `real_llm_calls=0`, `orders_written=0`.
- **NOT DEPLOYED as a trusted backend / production core**. G2.3 real Owner proof and V14.8 hosted identity/RLS remain release dependencies.

## 3. B — Universal Business Skills Engine (IMPLEMENTED / TESTED OFFLINE)
- `qa/v15-commerce-core/business-skills-registry.cjs`: modes `READ_ONLY`, `DRAFT`, `CONFIRM_REQUIRED`, `AUTHORIZED_EXECUTION`.
- Synthetic `catalog_read` and `price_quote` use the exact V14.7 product/stock per Store, and **reject unknown SKU rather than silently quoting another SKU**.
- `order_draft` / `support_draft` create only local text previews (not Orders or tickets). `owner_report_read` never fabricates real revenue. Other write modes are denied and require future backend authorization and confirmation.
- `runOfflineSkill` refuses forged plan, mismatched tenant/store/session, unsupported role, absent permission and any real tool call.
- **NOT connected to real Products/Prices/Orders**. DEMO Google Sheets & credentials remain isolated.

## 4. C — Smart Model Router × 96+36 QA preparation (IMPLEMENTED ROUTER / PAID MODEL BENCHMARK BLOCKED)
- `qa/v15-commerce-core/smart-model-router.cjs`: deterministic route recommendation, no extra classifier LLM call, never calls provider even if caller claims budget/entitlement. Handles no-model greetings and blocks model fallback after side effects.
- Uses five dated official public model price candidates carried over from V15.0-02: `gpt-6-luna`, `gemini-2.5-flash-lite`, `claude-haiku-5-5`, `gemini-3.1-flash-lite`, `deepseek-flash`. **Availability in TIEN404 provider accounts NOT VERIFIED**; prices are list prices, not booked invoices or true cost per successful task.
- `qa/v15-model-lab/private-dataset-audit.cjs` audits private CSV locally without exposing user prompts. A locally generated sanitized manifest `TIEN404_V15_Private_QA_Corpus_Audit.json` remains as chat attachment, **not GitHub**.
- Privately checked input corpus: 96 unique single-turn cases with `actual_output` blank; one byte-identical duplicate file ignored; 36 valid multi-turn JSON cases comprising **71 total conversational turns**, all originally `NOT_RUN`; historical set 97 rows / 96 unique with QA01 duplicate. **Quality benchmark remains NOT RUN**, no model scores, no real p50/p95.
- Requires explicit provider/key/privacy acceptance and **hard spending cap** before comparing real model responses. Do not modify existing `gpt-5-mini` Published workflows.

## 5. D — Vietnamese Owner AI Test Lab (HOSTED STAGING / SYNTHETIC)
- Source `qa/v15-test-lab/index.html`, hardening template `qa/v15-test-lab/static-worker-template.mjs`, contract + actual DOM event smoke tests.
- User URL: **https://tien404-v15-owner-ai-test-lab-nosend-staging.tienmobi208.workers.dev/**
- Cloudflare Worker: `tien404-v15-owner-ai-test-lab-nosend-staging`; version `4fba3556-5133-4aee-a018-b6dc5409c45e`; deployment `7c7c6104-c738-426f-923a-6e0ee9be2bb7`; source SHA256 `7e239c7ca744ab81d74c68fa8bad78a28423f04835dc88d8decf7670885b6db8`.
- **0 Worker bindings** (no Bot Token, DB, Gateway, OAuth, model API, real Orders); CSP `connect-src 'none'`, noindex, no external scripts or network. All chat/selection/QA results remain within current tab; export JSON is user-triggered. No actual owner login, and selecting Owner in UI is *synthetic*.
- Features: Shop A/B/C selectors, four channel previews, five model candidates, FAQ/quote/missing SKU/order draft/owner role/complaint/unauthorized order scenarios, route & tool trace, synthetic cost estimate, manual PASS/FAIL and local UAT JSON export.
- UI simulates policy and replies **in-browser**. It does not call the server-side Node Agent Core/Skills/Router modules or any real AI provider. This separation is an explicit deliberate security gate, **not a completed live AI integration**.

### Hosted HTTP verification
- New n8n workflow `f0bfCjUE5URqzzfQ` named `TIEN404_V15_OWNER_AI_LAB_HTTP_NO_SEND_QA`, created **INACTIVE** in personal project `WW82YsCCaAxGC9dp` folder `90_QA - DIAGNOSTICS` (`d3ZVrZ9cNiW2SJ1q`). Manual-only; no credentials.
- n8n execution **#3886 SUCCESS** confirmed `GET /health → 200`, `GET / → 200`, response HTML complete, CSP denies network, `POST /v1/send → 405`, `can_send=false`, `owner_authenticated=false`, `real_llm_calls=0`, `orders_written=0`.
- Browser JavaScript automated DOM interaction tests pass (switch store, sample prompts, unauthorized customer report, mock Owner, PASS/FAIL, export JSON and no HTML injection). Actual human mobile/browser usability acceptance **PENDING USER UAT**.

## 6. QA and evidence
| Test suite | Count | Result |
|---|---:|---|
| V15 Universal Core identity/policy | 44 | PASS |
| V15 A/B/C integration, Skills/Router, cross-store | 29 | PASS |
| V15 Cost and token guard | 29 | PASS |
| V15 Test Lab static contract + JS DOM smoke | 28 (18 + 10) | PASS |
| Private corpus CSV parsing / sanitization | 7 | PASS |
| **TOTAL CURRENT V15 A–D CI** | **137** | **137/137 PASS** |

- GitHub CI [run #43767413339](https://github.com/ngoctien20/demo-git/actions/runs/43767413339) SUCCESS. Separate parent V15.0-01/02 baseline 73/73 SUCCESS; some coverage overlaps, so do **NOT** sum to a claim of 210 unique regressions.
- Hosted HTTP and safety evidence: `qa/v15-test-lab/hosted-qa-evidence.json`.
- Earlier standalone code/deploy QA involved two transient fixes: test CommonJS path and static Worker HTML string replacement. Both corrected before hosted verification. Cloudflare initial invalid JS upload returned 400 and was **not deployed**.
- Source/no-send static lint PASS. No real model calls, no revenue, no tool side effects. Benchmark **accuracy, p50/p95, operational SLA NOT MEASURED**.

## 7. Owner acceptance checklist — direct UAT on staging
1. Open AI Test Lab URL above on phone and desktop. Confirm label `STAGING QA · KHÔNG GỬI THẬT` and Vietnamese layout is readable.
2. With `Shop A`, ask **“Mã A001 giá bao nhiêu?”**: must show synthetic **Gạo thơm 5kg 159.000đ**, not Shop B's clothing.
3. Switch to `Shop B`, ask same code: must show synthetic **Áo kiểu nữ 209.000đ**; Shop C should show **Xi măng 259.000đ**. Each isolated.
4. Ask **“Mã A002 giá bao nhiêu?”**: return **không tìm thấy**, not a guessed price. Try `Đặt 2 sản phẩm`: only draft, never ask for or store real customer data.
5. Under `Khách hàng QA`, ask about revenue: **BLOCKED**. Switch to `Owner QA`: only synthetic permission preview, no real sales figures or login.
6. Switch Messenger, Zalo Bot, Zalo OA and Web Widget: UI must display channel selection but **never actually contact provider**. Switch candidate models: it must show estimation only, and model latency unavailable.
7. Mark PASS/FAIL, export `TIEN404_V15_UAT_OFFLINE.json`, attach that file to the project for the next acceptance pass. No secrets or real customer text should be entered.

| Criterion | Current state |
|---|---|
| A shared channel-neutral Core contract source | TESTED OFFLINE |
| A hosted trusted provider-identity backend | BLOCKED (V14.8/G2.3) |
| B read-only and drafts with no backend writes | TESTED OFFLINE |
| B real tenant Commerce tool authorization | NOT TESTED / BLOCKED |
| C deterministic model-selection simulation | TESTED OFFLINE |
| C actual 96+36 real model quality competition | NOT RUN, requires separate API budget |
| D deployed URL HTML + CSP + no-send | VERIFIED hosted HTTP |
| D human UI acceptance from owner | PENDING |
| Real model production provider switch | NOT AUTHORIZED |
| Production merge or publish | NOT AUTHORIZED |

## 8. Security, restrictions and rollback
- Verified current staging HTML Worker has **zero secret bindings**; no chat text leaves browser via network and no data is persisted by the Worker.
- No n8n Published workflow, Messenger/Zalo credential, real webhook send, Supabase Auth/GRANT/RLS, Orders, Products, n8n plan, payment or customer record changed.
- All new n8n QA actions are manual-only, inactive, and do not send messages. Existing `AI_SALES_DEMO` must remain isolated.
- **Rollback UI:** disable only subdomain of `tien404-v15-owner-ai-test-lab-nosend-staging` or redeploy prior staging version; do not delete other Workers, Bots or D1. **Rollback code:** revert/close Draft PR #123 while preserving Draft PR #122 and V14.8 PR #121.
- Zalo G2.3 real Owner/consent still BLOCKED. Trial-continuity decision preserved: review n8n plan on **2026-11-22**, no premature upgrade.

## 9. Next proposal (requires new gates, not automatic)
- `V15.0-03H` Private Hosted Core Integration: server-authenticated, immutable tenant/store resolution via actual provider verification and RLS; cannot reuse synthetic fixtures as trusted provider/commerce authority.
- `V15.0-04H` Real Business Tools permissioned backend: trusted SKU/price/stock, order drafts with explicit confirmations, no unauthenticated writes.
- `V15.0-07P` Controlled Model Tournament: first verify model IDs/account entitlement/provider privacy, then explicit hard USD budget with batch and logging; evaluate 96+36 real model predictions, latency and success cost with no customer data.
- `V15.0-08U` Owner accepts staged UI and provides exported JSON evidence. G2.3 independent Zalo Owner/merchant consent proceeds in a separate security release train.

**No production go-live claim.**

## 10. Owner UAT accepted — synthetic Lab only (2026-11-16 JST)
- **OWNER-ACCEPTED (direct chat confirmation): 7/7 PASS**, encompassing Shop A/B/C correct synthetic price and product, switching four channels no-send, missing A002 no guessed price, order draft-only, customer cannot access Owner reporting, model chooser estimates without real inference, and manual PASS/FAIL + JSON export.
- **Evidence classification:** This is the owner's direct *self-reported acceptance in conversation*, NOT independent verification of individual per-case browser logs. The UAT JSON export was **not attached** in this turn. Use `qa/v15-test-lab/v15-owner-uat-self-reported-7-of-7.json` for an accurate machine-readable record; do not invent signature, timestamped browser capture, or independently observed full dataset.
- Existing **hosted no-send evidence remains independently VERIFIED**: n8n execution #3886 SUCCESS GET health 200 / index 200 / POST send 405, static Worker version `4fba3556-5133-4aee-a018-b6dc5409c45e`, 0 bindings, CSP no-connect; unchanged as of latest read-only audit. Published Zalo ingress remains unchanged, outbound `ZALO_SEND_ENABLED=false`.
- **V15.0-08 SYNTHETIC UI UAT ACCEPTED** by Owner; not an AI model quality/accuracy assessment, merchant account authorization, G2.3 Zalo Owner proof, hosted authenticated backend success or commercial release.
- Following step: `V15.0-03H/04H` source-only trusted backend security gates, mock/staging no-send integration, proof of negative tenant/role and tool authorization. No real customer data, Owner role, Supabase RLS/GRANT, Published workflow, credential, paid API or channel send without separately scoped approval.
