# TIEN404 SALES LITE V1.1 — V13.1 Menu & Operations QA Report

**Date:** 2026-11-15 JST. **GitHub branch:** `work/v131-sales-lite-menu-staging` (base `9875f15ffe6dcf80c4c76aec4cb150d518d159fb`).  
**Release:** EXPERIMENTAL · **NO PROVIDER SEND** · **NO DATABASE WRITES** · no production promotion.

## Test evidence (not inferred)

1. GitHub Actions [run 43665786546](https://github.com/ngoctien20/demo-git/actions/runs/43665786546) job `132664707203` at commit `5b9a5729e6a7b04db85b7561f56a4942df1fb3d9` completed **SUCCESS**, Node 22 `node --test qa/sales-lite/v131/*.test.cjs`: `1..116`, **116 pass / 0 fail / 0 skipped**. Four suites: menu 68, business contracts 38, mock HTML 10. Source code changed later only by documentation; rerun on PR head is required before promoting.
2. n8n QA workflow `TIEN404_SALES_LITE_V11_MENU_SMOKE_QA_STAGING` id `2JUqVjPToWUmLfPL`, version `d7ac8f92-ffe7-4502-8349-a05040473e88`, **INACTIVE**, in `Võ Ngọc Tiến` Personal / folder `90_QA - DIAGNOSTICS`. Manual execution **3809 SUCCESS**, 16/16 synthetic fixtures. Output `real_provider_tested=false`, `external_sends=0`, `orders_written=0`, `outbox_written=0`, `paid_model_calls=0`. The workflow is independent smoke, not a copy of entire GitHub engine.
3. Supabase read-only baseline: `tien404_dialogue_private.shop_b_sessions=0`, `shop_b_receipts=0`, Shop B sandbox Orders=2, outbox=2, F01=199000 VND/stock5. No V13.1 database migration, role grant, stored secret or order mutation.
4. Existing Published n8n workflows were inspected only, not edited; Customer Router `sIPs6egzIwOY1GNv` still separate from Owner Shadow `OgDZNSAvKEvhnAvn`. No Zalo send API calls and no live provider test.

## Coverage categories

| Category | QA scenarios / key assertions | Result |
|---|---|---|
| Menu capability BOT-M01…BOT-M12 | Native/quick disabled, mock renders 6 Customer & 7 Owner, fallback, invalid, spoof callback, stale menu, permissions, paused shop | PASS (12/12) |
| Customer CUS-01…CUS-12 | fresh read port, correct price fixture, draft no write, retry, stale price, stock, owner isolation, support not claimed delivered | PASS (12/12) |
| Owner OWN-01…OWN-12 | paired fixture guard, read inbox, confirm/reject/pause/open proposals only, report port, wrong shop, duplicate | PASS (12/12) |
| Notification NOT-01…NOT-06 | no notification before commit, disabled sender, provider not tested, no misplaced Owner | PASS (6/6 in Menu Engine) |
| Security SEC-01…SEC-20 | foreign tenant, role spoof, callback, menu reorder, duplicate IDs/numbers, subscription, no-PII metrics, unknown channel | PASS (20/20) |
| Additional Menu CONTRACT-01…06 | template/router wrapper, retry read failure releases receipt, future-dated quote rejected | PASS (6/6) |
| Business order/notification/support/subscription | 38 tests, verified order ID ownership, status transitions, HELD candidate only, Revenue PAID guard, no payment or ticket created | PASS (38/38) |
| Mock UI & registry | 10 static tests: responsive UI, local registry, no JS external send, no persisted Orders/customer data | PASS (10/10) |
| n8n synthetic smoke | 16 independent, no-send menu number fixtures | PASS (16/16) |

**Accounting:** `12+12+12+6+20+6=68` Menu Engine; `38` business; `10` UI; total **116** GitHub. n8n smoke **16** is a separate test harness, **not** additive coverage over same production bridge.

## Guardrails verified from source

- No `sendMessage` node or outbound HTTP in the new n8n workflow; no credential assigned.
- Menu Engine's channel adapter `send()` always denies with `ZALO_OUTBOUND_DISABLED`.
- `business-contracts.cjs` returns only `CONFIRMATION_REQUIRED`, `SERVER_COMMIT_REQUIRED` proposals; no Orders writes. Preparing notification only yields `OUTBOX_CANDIDATE_ONLY` / `SEND_DISABLED` after a backend-supplied persisted result (trusted port **not** wired).
- In-memory QA receipt is explicitly **single-process**, not safe for multi-worker production.
- The mobile mock role selector is visual only; selecting Owner does not create backend authority.
- Callback on `ZALO_BOT` channel always denied, even when QA mock verifier accepts; only `MOCK_WEB` can simulate callback.
- No commercial Billing changes. No cost-bearing LLM inference. Test fixtures do not represent live customer transactions.

## BLOCKED / not proven

- **Native Zalo Bot menu:** no official public payload schema for buttons/quick reply/callback in Bot `sendMessage`; state **UNKNOWN**, not PROVIDER_TESTED. OA Menu is a separate product.
- **Customer Core** PR #52 and **Owner** PR #41 independent; no V13.1 runtime adapter connected. Real multi-shop provider webhook, persistent session, order commit, Owner notification and Zalo auto-reply untested.
- **Supabase backup/credential** gate from V12.4 remains; no NEW DB migration/role/credential was performed.
- **Merchant subscription payment** actual success or renewal and support tickets not integrated; UI is nonfunctional mock.
- **AI cost cap** 0.10 USD/10 model calls not verified: paid model calls 0, no live inference.
- **Commercial Bot API** messaging/limits/terms need provider verification before selling subscription.

## Rollback

Only new GitHub branch and standalone INACTIVE n8n QA workflow were added. No production rollback or Supabase migration needed for V13.1. To retract Candidate, close/revert the new PR branch; keep the n8n QA workflow inactive (delete only with separate owner approval). Existing PR #41/#52 and Published workflows unaffected.

**Acceptance scope:** Menu Engine code, mock renderer, text fallback, permission/security ports and preliminary business contracts are `IMPLEMENTED + TESTED`; **live Zalo interactive menu and Sales Lite V1.1 release are not accepted**.


## Regression extension — V12.4 Reply Guard QA (15/11/2026)

After V13.1 Menu Engine CI, **re-ran** the existing n8n `TIEN404_ZALO_V124_REPLY_GUARD_QA_STAGING` workflow id `nKNKDLO4l2PXL4tx` in MANUAL mode after reviewing all its nodes (Manual Trigger → Data Table read → 3 Code QA nodes, no sending/DB write tools). **Execution 3810 SUCCESS**, `total=25`, `passed=25`, `failed=0`, `allPassed=true`, `real_llm_tested=false`, `orders_written=0`, `external_sends=0`. It covers cross tenant, Owner separation, prompt injection, price/inventory, replay, human handoff, model output and no-order-commit.

This is an **additional independent regression suite** and does not prove the new V13.1 router is attached to V12.4. The existing Commerce Agent Sandbox `iyfGUiEsZlNTBWOR` uses OpenAI model and tool-workflows; it was **not executed** due cost/write gates. Owner Shadow was **not manually exercised** because it is Published and currently handles live Zalo; its version remained unchanged. Core PR #52 CI is existing independent evidence, not rerun or merged in this branch.
