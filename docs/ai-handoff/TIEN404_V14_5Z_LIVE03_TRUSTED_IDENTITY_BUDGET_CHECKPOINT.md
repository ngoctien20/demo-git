# TIEN404 AI — V14.5Z-LIVE03 TRUSTED IDENTITY × BUDGET CERTIFICATION
Checkpoint: 2026-11-16 JST
Gate outcome: **TRUSTED_IDENTITY_INCOMPLETE / N8N_ACCOUNT_BUDGET_UNVERIFIED / REAL_ZALO_SEND_NO_GO**
Repo: https://github.com/ngoctien20/demo-git
Branch: `work/v145z-live01-limited-uat-gate`
Draft PR: https://github.com/ngoctien20/demo-git/pull/103

## Authorized work and release constraint
The owner requested to continue LIVE03 after V14.5Z-LIVE02. Read-only validation and staged source-only security logic are allowed; do not modify production, Published webhook, active ingress/router, credentials, payment, customer data or Zalo sending. This checkpoint does not grant real send authorization.

## 1. Source-of-truth checks (READ ONLY)
- n8n workflow `xayBLEyUwd64mcLK`, new manual execution **3854 SUCCESS**, real provider `getMe` through existing locked Cloudflare outbound gateway → `bot_token_valid=true`, external sends 0. **Sanitized route returns only boolean, NOT provider Bot ID, Bot metadata or independent ownership proof**. Thus this cannot authenticate actual Bot→Shop B binding.
- n8n workflow `bD510xyr5jBHQ99K`, execution **3855 SUCCESS**, real provider `getWebhookInfo` returned `has_webhook=true`, `matches_staging_webhook=true`, path `/webhook/tien404-zalo-bot-lab-v1`, host `ngoctien20.app.n8n.cloud`; external sends 0 and configuration changes 0. Provider webhook alignment ≠ verified integrity/authenticity of individual incoming events.
- Actual active ingress workflow `yIJk8LvJoLF40Z62`, version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`. Source node `Bind Trusted Staging Bot Identity V12.3` returns **hard-coded** `trusted_bot_id:'b'`, `trusted_route_ref:'route-b'`, `trusted_binding_scope:'SINGLE_STAGING_WEBHOOK_TO_SYNTHETIC_SHOP_B'` after header-protected staging ingress. This is synthetic routing, NOT verified official provider Bot identity.
- Active private router `sIPs6egzIwOY1GNv`, version `8d91d23c-cd87-462f-a112-9cca2340bec8` (not modified).
- Data Table `TIEN404_R1_SHOP_BOT_REGISTRY_QA`, ID `qLf19z9QjEaIHk00`: two rows, both `zalo_bot_fixture / synthetic_qa / dry_run`. Having tenant/store strings in fixtures is NOT an independently authenticated live registry.
- Data Table `TIEN404_ZALO_OWNER_ALLOWLIST_STAGING_V1`, ID `dRPj5k0t51hihJUW`: one `ALLOWED_STAGING_OWNER` row with private chat ID present, expires **2026-11-20T13:17:32.511Z**. No raw identifier printed or copied. Allowlist alone does not prove provider Bot ownership or Shop B association.
- Existing outbound Cloudflare Worker `tien404-zalo-outbound-v1-staging`: configuration **`ZALO_SEND_ENABLED=false`** remains verified. Existing LIVE02 no-send Worker has exactly one `LIVE02_DB` D1 QA binding to `d6604745-8f8a-4eac-95a3-83f6e4df0d39` and no secret binding.
- Isolated D1 QA read-only `SELECT`: exactly **2** `qa_live02_*` rows, **0** `QA_ARMED`; no LIVE03 D1 writes.

## 2. Model and budget findings (read-only)
- Current manual-only LIVE01 real model QA workflow `OMV22pdETQFVU9ru` configured model **`gpt-5.4-nano`**, inactive. Prior one-shot synthetic QA execution 3841 observed estimated 156 input and 42 output tokens (198 aggregate). There was no new AI inference during LIVE03.
- Official OpenAI direct API price for this model is USD **$0.20 / million input** and **$1.25 / million output** at https://developers.openai.com/api/docs/models/gpt-5.4-nano (verified 2026-11-16). Its current model documentation marks GPT-5.4 nano deprecated, with a stated planned shutdown **2027-04-01** in current OpenAI API reference. This is a compatibility watch item, not an authorization to change model settings.
- Theoretical **direct-provider-only** 156 input + 42 output estimate: `156×0.20/1e6 + 42×1.25/1e6 = USD 0.0000837`. If 2,500 aggregate tokens were actually enforced and all priced at max output rate: `2500×1.25/1e6 = USD 0.003125`. Two-times model-only illustrative guard: **USD 0.00625**. These are NOT measured n8n Gateway charges, not audited monetary caps, not even a guarantee of final billed cost.
- n8n Gateway credits feature is available on connected n8n (node/credential support confirmed), **but connector exposes model coverage rather than current account balance, itemized billing rate, Auto top-up, or credit refill state**. Browser tabs currently lack the Cloud Console page, and public `https://app.n8n.cloud/service-pricing` was not fetchable by public search. No billing settings read or changed.
- n8n documentation https://docs.n8n.io/deploy/use-n8n-cloud/gateway-credits/ states Gateway is ONE shared prepaid balance per instance, and n8n charges per request at n8n's own service pricing catalogue. In-flight requests can finish even when balance reaches zero; this reinforces the need for a pre-inference shared concurrency guard and hard provider-side output budget. Gateway credits and n8n Assistant credits are different balances.
- **CURRENT BUDGET CERTIFICATION IS BLOCKED:** authoritative current balance, n8n model unit rates, Auto top-up state and owner-approved USD cap not verified. Do not treat the theoretical USD 0.003125 as actual n8n spend.
- Operator evidence required: n8n Cloud Console → Manage → Gateway credits (remaining balance, usage by model/workflow, Auto top-up enabled/disabled and any limit); service-pricing entry for the actual selected model. Hide billing details, payment method, credentials and account identifiers. No need to send raw card/bank info.

## 3. Source-only certification implementation (PROPOSED/CANDIDATE, not hosted release)
- `qa/zalo-live-v145z/live03-identity-budget-gate.cjs`: independent SIGNED ECDSA-P256 attestation gate for 5 pinned trust roots: provider `getMe` full Bot identity, private live registry mapping, Owner QA consent, trusted hosted ingress and authoritative n8n Gateway billing.
- Cryptographic proof must bind issuer/purpose/evidence ID, not exceed 10 minutes, and carry Bot/store/owner hash mapping. Public keys are pinned in trusted host config, **not accepted from untrusted requests**. No trusted LIVE03 signing keys have been provisioned to any hosted environment.
- Budget gate demands instance-shared balance, n8n official unit pricing source, Auto top-up off, strict pre-model token reservation and shared concurrency guard, owner-approved monetary limit and price/model consistency.
- Output is ALWAYS `can_send:false`, `provider_request:null`, `provider_sends:0`. Even perfectly constructed signed synthetic test proofs yield only `ELIGIBLE_FOR_FINAL_HUMAN_REVIEW_ONLY`, never permission to activate.
- `qa/zalo-live-v145z/live03-identity-budget-gate.test.cjs`: 35 synthetic cryptographically signed positive/negative tests cover fake/missing/tampered/expired proofs, bot/shop/owner mismatch, untrusted ingress, insufficient balance, Auto top-up, direct provider rate substituted for account rate, stale billing snapshot, unsafe cap, model mismatch, and NO SEND invariant.
- CI run **43736390952 SUCCESS**: 28 previous Zalo QA + 32 LIVE01 preflight + 18 D1 atomic + 10 LIVE02 Worker + **35 LIVE03** + 44 conversation regression = **167/167 PASS**. This is OFFLINE synthetic gate test, not actual live identity or account balance verification.

## 4. Mandatory GO/NO-GO before real Zalo LIVE-01 activation
1. Verify official immutable Bot ID through a read-only Zalo Bot Creator/provider getMe response **without exposing token or raw owner chat ID**; link to an authenticated server-side registry record for exactly one Shop B QA.
2. Verify exactly one Owner QA account against provider-verified Bot user using a private digest and actual consent proof; owner allowlist expires Nov 20, 2026, so do not reuse after expiry.
3. Replace hard-coded synthetic Bot binding only in a new isolated staging candidate after an approved trusted mapping and regressions; do not mutate active Published ingress on this approval.
4. Provider event authenticity and signature, replay/CAS and per-session quota must work with real verified identities, not client-provided `verified:true` and not synthetic hardcoded scope.
5. Confirm actual n8n Gateway balance, service pricing, Auto top-up and the owner’s **explicit USD ceiling**; bound the model output & actual charged total so shared instance spend cannot exceed the scoped test budget unnoticed.
6. Before any real send, independent exact-message/receiver/3-replies/10-min/2,500-token final approval, hosted authenticated send path and receipt logging, kill switch and rollback evidence.
7. No real customer orders, stock, tenant data or credential/billing changes.

## Rollback and checkpoint
- No worker deployment, D1 migration, D1 data change, n8n workflow mutation, credential rotation, payment modification, provider send or production action in LIVE03.
- Revert only new GitHub source/test/doc changes if needed; keep PR #103 Draft.
- Existing LIVE02 staging Worker remains no-send, isolated D1 QA grants remain STOPPED.
- **Decision: LIVE03 PARTIAL VERIFICATION + FAIL-CLOSED GATE TESTED; IDENTITY/BUDGET CERTIFICATION BLOCKED.** Do not present LIVE03 as READY_TO_SEND.

## LIVE03A — Approval to proceed with safe evidence intake (2026-11-16 JST)
- User has approved continuation, but the approval does **not** identify an exact Bot ID, Owner QA recipient, USD monetary limit, or provide permission to send real Zalo messages. Continue under staging no-send restrictions.
- Repeat READ-ONLY audit: both live Zalo registry rows remain `zalo_bot_fixture / synthetic_qa / dry_run`; allowlist has one Owner QA row with chat ID hidden; n8n Gateway service coverage is available, account balance and Auto top-up unavailable to connector; connected browser has no authenticated n8n Cloud Console/Bot Manager tab with evidence.
- Official Zalo docs https://docs.zaloplatforms.com/docs/BOT/apis/getMe show response `result.id`, `account_name`, `account_type`; existing staging gateway route returns only token validity boolean, cannot independently attest official provider bot ID. Do not send Bot Token to user or reclassify fixture as verified.
- n8n official docs https://docs.n8n.io/deploy/use-n8n-cloud/gateway-credits/ confirm Gateway credits balance shared by instance, real rates taken from n8n's own service-pricing page, and in-flight requests can complete after balance reaches zero. Need account console screenshot and pre-inference budget guard before certification.
- Created `docs/ai-handoff/TIEN404_V14_5Z_LIVE03A_EVIDENCE_INTAKE_RUNBOOK.md`: exact nonsecret Bot Manager and Gateway evidence instructions, ID-01..GO-01 acceptance gates and rollback/no-send rules.
- This approval stage changed **only GitHub Draft documentation**; no Cloudflare/n8n/D1 writes, no provider sends, credential or billing changes, no merge. LIVE03 remains IDENTITY_BUDGET_BLOCKED, LIVE_SEND_NO_GO.
