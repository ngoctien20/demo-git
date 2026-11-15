# TIEN404 AI V15.0-01 — AI Baseline & Architecture Audit
**Ngày kiểm toán:** 2026-11-16 JST  
**Phạm vi:** GitHub / n8n Cloud READ-ONLY / local QA CSV; no paid API, no credential access.  
**Nhánh an toàn:** `work/v1501-02-ai-core-model-evaluation-offline-20261116`, **kế thừa nhánh Draft V14.8** `work/v14801-unified-identity-candidate-nosend-20261116`.  
**Phát hành:** `EXPERIMENTAL / SOURCE_ONLY / NO_SEND`.

## 1. Trạng thái xác minh trực tiếp (VERIFIED)
| Thành phần | Workflow / version | Trạng thái / model / phụ thuộc |
|---|---|---|
| AI SALES Main DEMO | `v6PBwcqSapVzACMW` / `c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30` | Published, 8 nodes, Chat Trigger + AI Agent + `gpt-5-mini` + Simple Memory window=10 + Google Sheets DEMO + Create/Update/Manage Order workflows. Draft = Published. |
| Messenger Test | `Z7FdV7uDvApfbURQ` / `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92` | Published, 27 nodes, signature/webhook/data-table/idempotency/send path + Messenger AI Agent `gpt-5-mini`, memory window=14 + Sheets DEMO + toolWorkflow. Draft=Published. |
| Zalo ingress | `yIJk8LvJoLF40Z62` / `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` | Published, 10 nodes, webhook, normalized event, synthetic trusted Shop B binding, private routing/no-send; no model node. |
| Zalo private router | `sIPs6egzIwOY1GNv` / `8d91d23c-cd87-462f-a112-9cca2340bec8` | Published 6 nodes, QA Bot registry+Owner allowlist+Shop B catalog read-only + no-send guard; no model node. |
| Isolated G2 model QA | `OMV22pdETQFVU9ru` / `0bbd2547-e68d-419f-a7cb-3460b38b5528` | **Inactive** manual QA, model `gpt-5.4-nano`, no customer send. This is not the `gpt-5-nano` model. |

**Quan trọng:** `AI_SALES_DEMO` và Messenger vẫn dùng các workflow Create Order/Manage Order của DEMO; **KHÔNG** kết luận chúng đã hoàn thành tenant-isolated SaaS Commerce. Không tái sử dụng Sheets DEMO hoặc credential của chúng cho V15 hosted Commerce.

## 2. Prompt / tools / memory
- Main DEMO agent has approximately 8,250 characters of instructions; Messenger AI Agent approx 7,007 characters of instructions. These are separate, non-versioned-as-standalone prompts embedded in workflows. **No independent shared production Agent Core currently verified**.
- Main Simple Memory buffer window 10, custom sessionKey not explicitly configured in current node. Messenger memory buffer window 14 has a custom sessionKey configured. Neither memory node, by itself, constitutes independently verified `tenant_id + store_id + channel + conversation_id` privacy guard. Do not infer leakage without runtime proof; mark **ISOLATION NOT CERTIFIED**.
- Main DEMO tools include `KrSn4DNR9ALX5ng4` (create_order), `BkAi6TVUKAjCnI7v` (update address/order), `fDB9dvs1qPPVt9Sp` (manage_order). Messenger additionally includes `4DFFCk60exrzaIl6` order status and `KqSuGxCHixc6fsiu` ticket; agents currently have channel-specific prompt and tool graph.
- Existing Published Messenger supports webhook Meta signature verification, Data Table duplicate skip and send credential. **Do not move this to V15 without original snapshot, safe test and specific approval**.
- Tool result authorization, RLS, true Store resolution and side effects must be protected at BACKEND, not merely by system prompt.

## 3. V14.7 / V14.8 dependency reconciliation
- **V14.7** Custom Bot Studio PR [#118](https://github.com/ngoctien20/demo-git/pull/118) remains Draft. User-approved synthetic V14.7-03 is not provider-certified.
- **V14.8** Unified Identity PR [#121](https://github.com/ngoctien20/demo-git/pull/121) exists; source file `qa/v148-unified-identity/identity-core.cjs` (13,129 chars) VERIFIED by GitHub read. It explicitly states `OFFLINE_SIGNED_FIXTURE_ONLY`, using V14.7 synthetic HMAC events and process-local replay cache, not durable replay or genuine Meta/Zalo cryptographic proof. No production release evidence. **IMPLEMENTED candidate, NOT RELEASED**.
- Existing LIVE03/G2 identity and Owner trust gates remain separate; G2.1 real signed Bot observation and G2.2 Shop B **CANDIDATE** verified, G2.3 real OAuth+Owner consent BLOCKED. V15 must consume only hosted trusted policy context, and cannot infer Owner permissions from user text.

## 4. Real Messenger response times (n8n execution metadata)
| Execution | Started / stopped UTC | Elapsed seconds | Status |
|---|---|---:|---|
| 3865 | 2026-11-15 19:07:52.338 → 19:07:59.501 | 7.163 | success |
| 3866 | 2026-11-15 19:10:28.711 → 19:10:34.007 | 5.296 | success |
| 3867 | 2026-11-15 19:27:25.424 → 19:27:40.499 | 15.075 | success |
| 3868 | 2026-11-15 19:28:01.876 → 19:28:11.749 | 9.873 | success |

All four executions belong to Published `Z7FdV7uDvApfbURQ`, status SUCCESS. These are **end-to-end n8n execution durations**, not LLM p50/p95 or customer-to-first-token latency, and n=4 is insufficient for an operational SLO pass.

## 5. User-uploaded benchmark CSV inventory — DO NOT MISCOUNT
The files were read locally by CSV parser; raw Q&A text and potential customer-like utterances are not committed to public GitHub.

| File | Rows | Unique case_id | Notes |
|---|---:|---:|---|
| `AI_SALES_QA_CASES.csv` | 97 | 96 | Duplicate `QA01`; `actual_output` populated in 97 rows; may be past results, not current V15 model benchmark |
| `AI_SALES_QA_96_SINGLE_TURN.csv` | 96 | 96 | `actual_output` empty in all 96; benchmark NOT RUN |
| `AI_SALES_QA_96_SINGLE_TURN (1).csv` | 96 | 96 | Identical SHA256 to preceding file; DO NOT DOUBLE COUNT |
| `AI_SALES_36_MULTI_TURN_FOR_LATER.csv` | 36 | 36 | `status=NOT_RUN` in supplied case data; pending multi-turn benchmark |

SHA256:
- Historical `QA_CASES.csv`: `544f03c154cbad8718967be34f6f7de613838c9cec21111d2e5f609e17e55519`.
- Each identical 96-case copy: `f266447e4be2a9a22733cfa81fb80ace8862d286752b15d2d6d1ffc77c9ba257`.
- 36 multi-turn: `8cfccde67964207e199dc20e911a9e6d4ebcbb8b1e2410526f3b40f5b8a2a1c4`.

## 6. Risks and evaluation criteria
| Priority | Issue | Evidence | Gate |
|---|---|---|---|
| P0 | Wrong store access / cross-store memory and tool exposure | V14.8 is source-only fixture; Main and Messenger memory node lacks audited hosted per-tenant enforcement | BLOCKED hosted multi-tenant release |
| P0 | Order/price/inventory writes via AI DEMO tools | Tool workflows are connected to Published DEMO agent, not proven Commerce backend authorization | No real transactions under V15 |
| P0 | G2.3 Merchant Owner/Shop B authorization | Real OAuth, consent and provider Bot Creator admin control not certified | Separate G2 gate |
| P1 | Duplicate channel-specific AI brains | Main and Messenger independently embed AI prompts and models | Universal Core offline candidate proposed |
| P1 | Messenger 5.296–15.075 s in 4 measured executions | Execution metadata, limited sample | Need >=100 real non-sensitive test samples, p50/p95 and tool tracing |
| P1 | Model API cost/entitlements | Published model `gpt-5-mini`, documented deprecated; API model access not tested | Benchmark before switching |
| P2 | Repeated catalog lookup, long prompt/context, model router | Graph audit suggests opportunities, not demonstrated savings | Controlled A/B offline proof |

## 7. Implementation in this V15 Draft
- `qa/v15-agent-core/universal-agent-core.cjs`: **standalone offline seed** for provider-agnostic core. Private-backend resolver required; client cannot promote Store/Tenant/role/capability; read-only tools are merely requests, no execution, no pricing or stock hallucination, distinct hash-scoped conversations, order change blocked, no real LLM/provider calls or sends.
- `qa/v15-agent-core/universal-agent-core.test.cjs`: isolated security regression suite. **This is NOT the production runtime integration**.
- `qa/v15-model-lab/model-pricing-snapshot.json`, `cost-simulator.cjs` + tests: model price and synthetic cost options without using account/API credits.
- V15 baseline / commercial model report records actual end-to-end, not invented quality or speed improvement.

## 8. Rollback and next
Current changes: new V15 GitHub branch and Draft PR only. No n8n workflow changed, no Supabase migrations, no Cloudflare binding/deploy, no webhook Published, no customer/Orders data, no credentials, no API paid call. Rollback by closing Draft PR/reverting new V15 branch commits; preserve prior V14.8 branch and G2 checkpoint.

Next: choose offline run harness covering exact 96 unique single-turn + 36 multi-turn, freeze Store catalog fixture and scoring; then permission-specific benchmark with at most five verified accessible model IDs and **explicit prepaid budget approval**. Only after acceptable quality/latency/cost may any model/router be considered for Commerce staging integration.
