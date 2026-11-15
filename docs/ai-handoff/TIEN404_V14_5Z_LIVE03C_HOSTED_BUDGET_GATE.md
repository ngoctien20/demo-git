# TIEN404 AI — V14.5Z-LIVE03C: Hosted Budget Guard × Real Identity Preflight

**Checkpoint:** 2026-11-16 JST  
**Security outcome:** HOSTED SYNTHETIC BUDGET QA VERIFIED, REAL BOT IDENTITY & BILLING AUTHENTICATION BLOCKED  
**Release decision:** NO REAL ZALO SEND / NO PRODUCTION CHANGE  
**Branch:** `work/v145z-live01-limited-uat-gate` · Draft PR #103

## 1. Approved scope
User authorized continued LIVE03C development: inspect real Bot identity and n8n Auto top-up read-only; build and test a staging-only cost gate with strict no-send semantics. Approval **did not** grant permission to rotate or expose credentials, configure billing/Auto top-up, activate the existing Published webhook, modify production, create real Orders, or send Zalo.

## 2. Read-only audit outcomes
- n8n registry `TIEN404_R1_SHOP_BOT_REGISTRY_QA` still has exactly two `zalo_bot_fixture / synthetic_qa / dry_run` records. No authoritative provider Bot ID→Shop B→Owner QA mapping.
- Owner allowlist has one `ALLOWED_STAGING_OWNER` row expiring **2026-11-20T13:17:32.511Z**; chat ID deliberately excluded from logs and GitHub. Allowlist is not proof of Bot-to-owner ownership.
- Live ingress `yIJk8LvJoLF40Z62` is active, version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, still contains `trusted_bot_id:'b'` and synthetic Shop B binding; **UNCHANGED**. Private router `sIPs6egzIwOY1GNv` active version `8d91d23c-cd87-462f-a112-9cca2340bec8`, **UNCHANGED**.
- Prior verified provider `getMe` exec **3854** confirms Bot Token valid but existing sanitized gateway returns only boolean, not official provider immutable Bot ID. `getWebhookInfo` exec **3855** matches staging webhook. Neither signs a real Bot→Shop→Owner certification.
- n8n account Gateway coverage available via connector, but connector exposes **no billing balance, Auto top-up or transaction ledger**. The connected browser tab is Service Pricing, not authenticated Gateway billing settings. **Auto top-up cannot be certified** without reading a proper account control.
- User-supplied n8n Service pricing screenshot shows exactly `gpt-5.4-nano` **USD $0.20/M input, $1.25/M output**; configured manual QA model remains `gpt-5.4-nano`, inactive. User Gateway UI shows **$0.59 free credit remaining** at 2026-11-16 02:07 JST; **$0.18/day** recent usage, last 7 days spend $1.20. These are UI observations, not a live account-wide authorized money cap.
- The **$0.01** cap used below is strictly synthetic QA fixture, **not a proposed or approved real billing authorization**.

## 3. Backup/rollback preflight
- Only isolated QA D1 `tien404-zalo-live01-security-qa-staging`, UUID `d6604745-8f8a-4eac-95a3-83f6e4df0d39`, was targeted.
- Pre-LIVE03C migration Time Travel bookmark: `0000000d-00000000-00005124-9865b2040cd17901ae6f1c0dfaa3efb2`. SQL schema audit confirmed **zero** pre-existing `z145z_live03c_*` objects.
- No independent verified external SQL export (previous D1 export signed URL returned HTTP 403); Time Travel bookmark provides time-limited rollback but **not a durable standalone file backup**.
- Migration created **only** `z145z_live03c_budget_policies`, `z145z_live03c_budget_events`, and `z145z_live03c_budget_guard`, leaving all LIVE01 and existing gateway tables untouched. See `qa/zalo-live-v145z/003_live03c_budget_nusd.sql`.
- Undo safe: STOP all QA grants and leave staging Worker isolated; closing Draft PR reverts proposed source. To remove schema/restore Time Travel would be destructive and needs **separate approval**.

## 4. Database design and hosted D1 evidence
- Synthetic QA only: `environment='OFFLINE_QA'`, `trust_level='SYNTHETIC_QA_ONLY'`; strict D1 CHECK prevents promoting to LIVE via input.
- Model ID strictly `gpt-5.4-nano`. Nanodollar integer amounts (1 nUSD = $0.000000001): input **200 nUSD/token** and output **1,250 nUSD/token**. D1 checks that quoted price exactly equals `200*input + 1250*max_output`.
- One `INSERT ... ON CONFLICT DO NOTHING` triggers atomic policy update, protected by DB time, QA scope digest, CAS revision, 3 calls, 2,500 reserved aggregate tokens, capped reserve money and bounded synthetic balance. Any failed predicate rolls back the inserted event and policy changes.
- Synthetic `cap_nusd = 10,000,000` ($0.01), `synthetic_balance_nusd=590,000,000` ($0.59 fixture, **not live spendable balance**).
- Actual direct Cloudflare D1 QA **22/22 PASS**: replay, stale CAS, exact 3 calls, 2,500 tokens, $0.002075 aggregate illustrative reserved cost for mixed tokens, 4th call denied, wrong price, cross-store scope, expired/stopped grants, cap $0.0008 fixture overage rejection, 8 concurrent CAS contenders only one winner, LIVE environment update rejected.
- The first test fixtures and HTTP test fixtures were deliberately set `QA_STOPPED` after QA: **7 STOPPED, 0 armed** in this LIVE03C table.

## 5. New isolated Worker — deployed and locked
- Script `tien404-zalo-live03c-budget-nosend-staging`, deployment `2f0cf146-c893-4a99-80f0-07b4ab26f78b`, version `e2a1ec46-e104-43eb-84db-249b40092483`.
- New URL `https://tien404-zalo-live03c-budget-nosend-staging.tienmobi208.workers.dev`.
- Only one D1 binding `QA_BUDGET_DB` points to isolated QA D1; **no secret bindings**. Source `qa/zalo-live-v145z/live03c-budget-worker.mjs`.
- Worker has only `GET /health` and `POST /v1/qa/reserve`; all `/v1/send`, `/v1/provider*` and `/webhook*` return HTTP 423. No `fetch()` or provider send call, no actual LLM call, no Orders or other data writes.
- QA requests must have valid ephemeral P-256 signature over the exact method/path/body, timestamp within 90 seconds, and matching server-stored QA grant/scope. The ephemeral QA private signer was **not persisted** after testing; only public JWK embedded in Worker.
- The Worker computes the quote itself, refuses request-supplied unit rates, has no connection to real n8n Gateway billing or live identity and **can never approve live sending**.

## 6. Independent n8n HTTPS QA evidence
Two new QA-only workflows, both **INACTIVE**, in folder `90_QA - DIAGNOSTICS`:
1. `n40yAM3D4zRa1mFk`: `TIEN404_V145Z_LIVE03C_BUDGET_HTTP_QA_NO_SEND`, version `acbd05a4-db0d-452b-b3cb-629a899b5445`.
2. `F8EYY5KQCJn8Mkck`: `TIEN404_V145Z_LIVE03C_HEALTH_SEND_LOCK_QA`, version `4cf6ef63-6e55-4b5d-8587-0e07ee0a0c99`.

**Actual HTTPS executions:**
- **3856 SUCCESS**: invalid ECDSA QA signature → HTTP 401.
- **3857 SUCCESS**: valid signed wrong Shop digest → HTTP 403.
- **3858 SUCCESS**: valid signed synthetic 300 input + max 700 output → HTTP 200, 1,000 tokens and **935,000 nUSD ($0.000935)** budget reserved, no real inference.
- **3859 SUCCESS**: artificially tiny policy cap (80,000 nUSD) with a larger quote → HTTP 409; DB rejected money overage.
- **3860 SUCCESS**: /health HTTP 200 and /v1/send HTTP 423. Exactly zero external Zalo sends or AI model calls.
- After these tests, both HTTP fixture policies were set to QA_STOPPED. The total of all 7 LIVE03C policy fixtures is STOPPED/0 ARMED.

## 7. CI regression and safety
- Source-only regression `qa/zalo-live-v145z/live03c-budget-worker.test.mjs`: **14/14 PASS** covering ECDSA, no-send hard lock, provider path denial, wrong Shop/model, malformed quote, expired request/grant, token/cap reject and fail-closed behavior.
- GitHub run [43741753066](https://github.com/ngoctien20/demo-git/actions/runs/43741753066) SUCCESS: inherited QA 189 + LIVE03C 14 = **203/203 PASS**. CI includes no-outbound static checks; these tests do not replace hosted approval or real cost reconciliation.
- Existing outbound Worker `tien404-zalo-outbound-v1-staging` still `ZALO_SEND_ENABLED=false`. Published n8n webhook and routing unchanged. No payment, credential, production or real customer data changes.

## 8. Remaining P0 blockers and approval gate
**BLOCKED — IDENTITY:** Need provider `getMe.result.id` attested in a trusted server-only context; exact Bot→Shop B→Owner QA binding, consent and genuine signed ingress evidence. Current routing still synthetic; no changes approved to live Published ingress.

**BLOCKED — BILLING:** Need check account Auto top-up status directly in n8n Cloud billing/Gateway settings (read only), latest account-wide shared balance, approved monetary ceiling, real pre-inference reservation/LLM billed-token reconciliation and concurrency guard. Current D1 cap is synthetic and not connected to actual n8n Gateway inference.

**BLOCKED — PROVIDER DELIVERY:** Need separately approved outbound dispatcher/outbox, provider replay/idempotency receipt, explicit owner recipient and 3-turn/10-min/2500-token final approval.

**Decision:** LIVE03C HOSTED SYNTHETIC NO-SEND SECURITY GATE ACCEPTABLE, REAL LIVE IDENTITY/BILLING CERTIFICATION NOT ACHIEVED. No further activation permitted based on this checkpoint alone.
