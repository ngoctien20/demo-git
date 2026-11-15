# TIEN404 AI — V15.0-01/02 — SAFE RESEARCH & OFFLINE CORE CHECKPOINT
**Ngày:** 2026-11-16 JST  
**Nhánh:** `work/v1501-02-ai-core-model-evaluation-offline-20261116`  
**Draft PR:** https://github.com/ngoctien20/demo-git/pull/122  
**Parent branch:** `work/v14801-unified-identity-candidate-nosend-20261116` (V14.8 PR #121, DRAFT / NOT RELEASED)  
**Approval:** Existing user's V15 task grants read-only audit, sources, offline code, Draft PR, offline QA; NOT model production/policy/credential/spend/merchant writes.
**Current classification:** `V15.0-01 VERIFIED AUDIT`; `V15.0-02 VERIFIED PUBLIC PRICES + IMPLEMENTED SIMULATION`; `V15 CORE 2.0 SOURCE-ONLY CANDIDATE / NOT INTEGRATED`.

## A. VERIFIED
- n8n **Published** Main DEMO `v6PBwcqSapVzACMW` = `gpt-5-mini` (8 nodes) with 10-window memory, DEMO Google Sheets and order tools. Messenger Published `Z7FdV7uDvApfbURQ` = `gpt-5-mini` (27 nodes) 14-window memory and Meta/DEMO tools. Published Zalo ingress/private router have NO LLM nodes. Isolated G2 QA manual `OMV22pdETQFVU9ru` uses `gpt-5.4-nano`. **None altered**.
- Messenger executions **3865,3866,3867,3868** all success, elapsed **7.163, 5.296, 15.075, 9.873 seconds**. n=4; no claim true operational p95 or lower latency.
- V14.8 PR #121 and source `qa/v148-unified-identity/identity-core.cjs` VERIFIED, explicitly synthetic signed fixtures/in-process cache; no provider-signature/hosted release proof. Parent dependency is a Draft and must not be promoted.
- User-uploaded QA CSVs read locally and SHA-pinned only: historical 97 rows / 96 unique (`QA01` duplicate); 96 unique new single-turn blank actual outputs, identical second uploaded copy; 36 unique multi-turn NOT_RUN. No raw case content uploaded to public GitHub. Details in `qa/v15-model-lab/dataset-inventory.json`.
- Official public pricing verified for OpenAI, Google, Anthropic, DeepSeek with **exact model IDs**; no API account entitlement or billing tested, no paid inference.

## B. IMPLEMENTED — Source, CI, docs only
1. `docs/ai-handoff/TIEN404_V15_0_01_AI_BASELINE_ARCHITECTURE_AUDIT.md`: network graph, model, tools, memory, latency, V14.8/G2 dependency, P0/P1 risk gates.
2. `docs/ai-handoff/TIEN404_V15_0_02_COMMERCIAL_MODEL_COST_RESEARCH.md`: 5-provider/model shortlist with direct official source pricing, 1k/10k/100k conversations, 10/50/100 shop synthetic comparisons, privacy/availability limits, four conditional model strategies. **No actual quality score or model selection.**
3. `qa/v15-model-lab/model-pricing-snapshot.json`: dated official USD/1M rates and limitations.
4. `qa/v15-model-lab/cost-simulator.cjs` and tests: deterministic model-only costing with strict cache/reasoning bounds, DeepSeek off-peak separated and Haiku >100k context surcharge; full SaaS fee and cost-per-success deliberately **null** until evidence.
5. `qa/v15-agent-core/universal-agent-core.cjs` and tests: provider-agnostic read-only/response contract, client identity untrusted, private server resolver required, hash-scoped tenant/store/channel conversation, capability-bound read-only tool requests and unpersisted drafts, no real model/tool/send/Orders.
6. `.github/workflows/v15-agent-core-model-offline-qa.yml`: no-secret CI for module syntax, pricing scenario/security and pure no-send source scanning.
7. **Owner spreadsheet** `TIEN404_V15_Model_Cost_Lab.xlsx` created as a local conversation artifact (5 editable sheets: configuration, dated provider prices, model-only comparisons, TCO with blank fees, G0–V15 owner QA). It is **NOT** committed to public GitHub; may be downloaded through chat.

## C. TESTED and regression handling
- CI initial 43764089403 failed **1 actual test**: complaint text mentioning "sản phẩm" matched generic catalog first. Fixed deterministic intent precedence `SUPPORT` before `CATALOG`.
- CI 43764185462 after fix **SUCCESS**: 29 model-pricing/cost tests +44 shared Core/policy tests = **73/73 PASS**; no provider calls, no source DB writes/send/credential access.
- Later manifest/document-only commits must also pass CI. Do not treat synthetic pass as live user acceptance or multi-model quality proof.

## D. CRITICAL PENDING RELEASE GATES
| Gate | State | Reason |
|---|---|---|
| V15.0-01 actual source/graph/model audit | VERIFIED | n8n and GitHub read-only evidence |
| V15.0-02 price documentation / cost formula | VERIFIED DOCS / TESTED SOURCE | Not true account permission or invoice |
| V15.0-03 Universal Agent Core | IMPLEMENTED SOURCE ONLY | No real authenticated hosted runtime/tenant resolver |
| V15.0-04 Business Skills & tools | PROPOSED | No backend authorization/side-effect QA for V15 |
| V15.0-05 Smart Model Router | PROPOSED | No provider entitlements/actual quality or token budgets |
| V15.0-06 Store/Customer Memory | BLOCKED HOSTED | Need per-tenant persisted memory policies and tests |
| V15.0-07 96+36 model tournament | NOT TESTED | No paid API approval, provider credentials or measured QA |
| V15.0-08 Owner Test Lab | NOT IMPLEMENTED | Staging owner UX still required |
| V15.0-09 Commercial Readiness | BLOCKED | G2.3 Owner proof and multi-tenant hosted gates, cost, billing, trial continuity |

## E. QA/SECURITY
- No real provider Zalo/Messenger message, no new API account/model key, no model production switch, no n8n subscription/payment, no Supabase/RLS, no credential, no customer/order/product mutation, no GitHub PR merge.
- Parent V14.8 branch, G2.1–G2.3 security gates untouched. Draft PR #122 is not a production release.
- Existing Messenger and Main DEMO prompts and Tools left unchanged, including user-protected DEMO Sheets.
- Cost simulator never pretends zero n8n/gateway/DB costs: missing fee data is absent/unknown; success rate requires real benchmark.
- **User-requested n8n trial continuity:** defer plan selection until scheduled review **2026-11-22**; no automatic upgrade.

## F. Owner UAT/checkpoint acceptance
- [x] N8n real Published model/tool/memory inventory read-only.
- [x] V14.8 predecessor checked and kept Draft.
- [x] 96+36 dataset inventory checked; duplicate copy detected.
- [x] Multi-provider exact model rate research with sources.
- [x] Editable synthetic cost spreadsheet delivered in chat.
- [x] Universal channel-neutral Core offline code + security QA.
- [ ] Real provider model entitlements (NOT CHECKED).
- [ ] Vietnamese quality, tool calling and real multi-turn model benchmark.
- [ ] True p50/p95 at >=100 hosted safe samples.
- [ ] Hosted tenant isolation, Owner proof G2.3, source-of-truth Catalog/Orders and durable memory.
- [ ] Actual n8n/gateway/DB/notification unit cost and gross margin.
- [ ] Owner UI Test Lab and signed acceptance.
- [ ] Commercial release, merchant paid tier selection, production go-live.

## G. Next safe work
- V15.0-03: build explicit `UniversalAgentRequest/Response`, offline tool capability registry and channel adapter contracts, reusing V14.7 profiles and V14.8 candidate identity without merging.
- V15.0-04: add READ_ONLY/DRAFT/CONFIRM_REQUIRED/AUTHORIZED_EXECUTION classified skills with backend Authorization interfaces, no real side effects until separate staging UAT.
- V15.0-07 preparation: freeze 96/36 raw CSVs privately, generate no-LLM QA harness first, pin gold catalog, then compare 3–5 model IDs **only under separately approved budget/hard cap**.
- V15.0-08: owner-facing private No-Send Test Lab; do not expose raw customer IDs or Bot Token.

**Rollback:** revert V15 Draft PR #122 commits or delete just its branch after user approval; no runtime rollback required as no published services were modified.
