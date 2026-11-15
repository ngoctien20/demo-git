# TIEN404 AI — V14.5Z-LIVE-01 LIMITED REAL AI UAT CHECKPOINT
**Checkpoint date:** 2026-11-15 JST
**Owner request:** proceed V14.5Z-LIVE-01 limited real AI pilot
**Status:** REAL_AI_MODEL_PREVIEW_TESTED / LIVE_ZALO_NOT_AUTHORIZED / NO SEND
**Branch:** work/v145z-live01-limited-uat-gate, stacked on V14.5Z PR #100
**Production:** DO NOT MERGE OR DEPLOY

## 1. Verified read-only baseline
- Active Zalo Bot Creator webhook: n8n `yIJk8LvJoLF40Z62`, active 10 nodes, header-protected and ACK-only; exact published runtime not modified.
- Private Customer Router: `sIPs6egzIwOY1GNv`, active 6 nodes; synthetic Shop B readback, preview only, no provider sender.
- AI Intent Draft: `uGesZLvNkhY4ZO6l`, inactive; execution 3665 prior real model intent classification, NOT real Zalo reply.
- Zalo one-shot send quota from V13.7 already consumed; cannot reuse prior approval.
- Existing Supabase staging hosted Store RLS and PostgreSQL isolated restore unverified, so live commercial catalog/orders remain blocked.
- GitHub V14.5Z PR #100, 28/28 adapter plus 44/44 V13.8 conversation tests succeeded.
- n8n preferences honored: DEMO data and credentials are isolated; no changes to Published workflows.

## 2. Created new manual real-AI QA workflow
- Workflow `OMV22pdETQFVU9ru`, `TIEN404_V145Z_LIVE01_REAL_AI_MANUAL_QA_NO_SEND`.
- URL: https://ngoctien20.app.n8n.cloud/workflow/OMV22pdETQFVU9ru
- Location: Personal project → `90_QA - DIAGNOSTICS`.
- Inactive, manual trigger, 5 total nodes: synthetic fixture → AI Agent + Gateway-managed OpenAI chat model → sanitized no-send preview.
- Gateway-managed credits were automatically assigned to the **new QA workflow's model node**; no existing webhook, secret value or production credential was modified.
- No Zalo sender node, no webhook trigger, no Orders/Products data table write, no customer PII.
- The fixture F01 = fictional "Áo thun QA mẫu", price 199000 VND, stock 5. It is NOT a verified real merchant record.

## 3. Actual model execution evidence (NO ZALO SEND)
- n8n workflow `OMV22pdETQFVU9ru`, execution **3841**, manual, **SUCCESS**.
- Execution timing 2026-11-15T14:57:49.447Z – 14:57:53.608Z.
- AI Agent ran an OpenAI gateway model and returned: "Chào bạn! (Thông tin QA mô phỏng, không phải cửa hàng thật.) Mã F01 là Áo thun QA mẫu, giá 199.000đ, tồn 5 chiếc."
- Execution trace: estimated token usage 156 input + 42 output = 198 tokens. This is a token usage estimate, not a measured invoice cost or agreed future budget.
- Final sanitized audit node: status REAL_AI_MODEL_PREVIEW_ONLY, `model_called=true`, `provider_sends=0`, `orders_written=0`, `stock_changed=0`, `webhook_modified=false`, `live_zalo_verified=false`, `ready_for_send=false`.
- **Do not confuse:** one real synthetic model response DOES NOT prove real Zalo ingress, 3-turn memory, provider delivery, staff handoff, or multi-shop hosted Store RLS.

## 4. Source-only bounded pilot security gate
- `qa/zalo-live-v145z/live01-preflight.cjs`: HMAC-SHA256 grant verification using server-injected secret, 10-minute upper bound, max 3 responses, max 3 model calls, max 2500 tokens, one signed Bot/tenant/store/recipient digest, forbid Orders and real catalog.
- Mandatory security evidence: Bot Creator ownership, protected webhook, independently issued Bot→Store binding, private QA recipient, durable replay, ordered session, hard quota, kill switch, owner approved budget, separately approved provider dispatch.
- **Important:** source-only contract requires an authoritative server to supply real proofs. Attacker-supplied JSON booleans or arbitrary 'verified' values are NOT proof. No production gate has been integrated with a real authenticated backend.
- `assess()` deliberately returns `can_send:false`, `provider_request:null`, `provider_sends:0` even when all fixtures indicate ready; it contains no sending implementation.

## 5. Acceptance gates remaining
- Verify Zalo Bot Creator ownership and exact current getWebhookInfo/getMe via approved read-only channel, with token never exposed.
- Identify and validate ONE owner QA recipient from private allowlist; do not post raw recipient ID to GitHub/chat.
- Wire **a server-issued** immutable Bot→Tenant→Store binding to real webhook, not client-asserted source markers.
- Build/verify durable event claim, per-chat ordering/CAS, idempotent outbox, quota & cost enforcement, emergency disable.
- Perform a specific owner approval of exact Bot, recipient, cap, time window and spend limit; live dispatcher still requires separate rollout review.
- Only then send bounded test replies and collect provider message IDs plus owner phone receipts. Need 3 sequential real messages to claim AI_MULTI_TURN_VERIFIED.
- Hosted Store RLS remains required before using real multi-store products, customer or Orders records.

## 6. Proposed approval envelope, NOT YET AUTHORIZED
- Bot: existing verified Shop B Bot Creator QA only, exact identity to be read back.
- Recipient: previously paired verified QA owner account only, exact digest verified privately.
- Window: 10 minutes from explicitly approved activation.
- Max responses: 3; max model calls: 3; model token ceiling: 2500 total.
- Synthetic store/cat: one Shop B fixture; zero real order writes, zero inventory mutations, zero customer data writes, zero notifications to others.
- Expired/unverified/duplicate/out-of-quota events must fail closed.
- Global `ZALO_SEND_ENABLED` remains false; no published webhook mutation or general send switch allowed.

## 7. QA and rollback
- GitHub CI for this new branch must be inspected after PR creation; never claim tests passed from committed files alone.
- No staging Supabase writes; no actual Zalo dispatch or real-message reception occurred in LIVE-01 so far.
- Rollback source: close draft PR / remove new branch; rollback n8n: keep inactive or archive only new workflow `OMV22pdETQFVU9ru` after owner's approval. Existing Zalo webhook and Private Router remain unchanged.
- For safety in case of unexpected live behavior: keep outbound general gateway locked and do not connect QA model to a public webhook without separate approval.

## 8. Next single decision
Present exact bounded QA recipient/Bot and budget cap to owner for explicit approval; only after verified hosted security prerequisites and a distinct release gate may the limited outgoing Zalo pilot be enabled.

## 9. Verified CI and Cloudflare security follow-up
- GitHub Actions run **43727656808**: https://github.com/ngoctien20/demo-git/actions/runs/43727656808 — SUCCESS.
- Job 132853002956: V14.5Z core **28/28 PASS** + V14.5Z LIVE01 preflight **32/32 PASS** + V13.8 regression **44/44 PASS** = **104/104**, no failures. Syntax and static no-send checks PASS.
- Cloudflare API GET (read-only) on Worker `tien404-zalo-outbound-v1-staging`: script settings reported plain_text `ZALO_SEND_ENABLED=false`. Secret bindings were **not read or displayed**. This verifies the configuration flag at inspection, NOT complete proof of zero possible sending routes.
- No actual Zalo recipient or Bot ownership has yet been independently authenticated in this LIVE01 session; owner QA allowlist remains an approval blocker.

## 10. Sanitized n8n QA identity checks
- `TIEN404_ZALO_OWNER_ALLOWLIST_STAGING_V1`: one existing QA Owner allowlist row, status `ALLOWED_STAGING_OWNER`, approved 2026-11-13T13:17:32.511Z, expires 2026-11-20T13:17:32.511Z. **Raw chat_id intentionally not recorded**.
- `TIEN404_R1_SHOP_BOT_REGISTRY_QA`: two records, BOTH `bot_provider=zalo_bot_fixture`, `enabled_mode=dry_run`, `identity_status=synthetic_qa`. This cannot authorize actual Bot→Store routing or real outbound dispatch.
- `TIEN404_ZALO_SHOP_B_CATALOG_SNAPSHOT_QA`: one synthetic F01 record with price 199000 VND, stock 5. Must not represent this as real merchant price/stock.
- Current documented Cloudflare outbound read-only preflight uses POST `/v1/auth-check`, `/v1/bot-check`; do not execute the existing full preflight workflow just to check the token, because it also calls `/v1/owner-one-shot` which is a send-capable operation. Current outbound global kill switch is false; still no sender call was made.
- Gate: real Bot identity from a trusted read-only getMe/bot-check, exact private binding and one approved QA recipient remain required. Do not promote `synthetic_qa` into `VERIFIED` by editing rows alone.

## 11. LIVE01 read-only provider and cost audit (2026-11-16 JST)
- Existing inactive n8n workflow `bD510xyr5jBHQ99K` manual execution **3842 SUCCESS**, returned ZALO_WEBHOOK_INFO_READONLY, provider webhook exists and matches staging, no sends, no webhook mutation.
- New inactive Manual QA-only workflow `xayBLEyUwd64mcLK` in Personal/90_QA uses existing `TIEN404_ZALO_OUTBOUND_GATEWAY_AUTH_V1` credential by verified exact ID and only POST /v1/bot-check, which Cloudflare source verified invokes Zalo getMe; **3843 SUCCESS**, bot_token_valid true, external sends 0. No new credential created.
- Current Cloudflare staging Worker `ZALO_SEND_ENABLED=false`; old bounded QA RichText and V13.7 media send exceptions have fixed hard expirations on 2026-11-15, already passed. General send route remains 423. No Worker update.
- Existing Worker D1 binding `REPLAY_DB` has `outbound_claims` primary-key idempotency table and `daily_quota` primary-key quota table. Those are NOT verified for per-session transactional 3 replies/3 model calls/2500 token enforcement.
- Provider Bot token is valid and webhook is aligned, **but no authoritative live Bot→Shop B→QA recipient binding exists**. The R1 registry remains only synthetic_qa/dry_run. The private owner allowlist remains a prerequisite, not binding proof.
- n8n Gateway Credits has instance-shared prepaid spend, but tool access and connected browser tabs do not expose the account's current balance, actual gateway model unit rate or auto-top-up settings. Owner must check n8n Cloud console. Published direct OpenAI API benchmark for gpt-5.4-nano is 0.20 USD/1M input and 1.25 USD/1M output; 3841's estimated 156+42 tokens are about 0.0000837 USD at those provider rates, NOT invoiced n8n charge. For a hypothetically *enforced* aggregate 2500 tokens the all-output benchmark is 0.003125 USD, NOT an approved or audited hard money cap.
- Full evidence and explicit NO-GO matrix: `docs/ai-handoff/TIEN404_V14_5Z_LIVE01_FINAL_SEND_GATE.md`.
- **Decision:** read-only staging preflight progressed, LIVE UAT remains blocked. No provider send, no D1 DDL/DML, no customer Orders/Stock write, no production change, no credential/billing change.

## 12. LIVE01 isolated hosted D1 security gate — 2026-11-16
- User approved only isolated staging D1 replay, CAS, quota with backup/rollback, not send/credentials/production.
- New isolated Cloudflare D1 `tien404-zalo-live01-security-qa-staging`, UUID d6604745-8f8a-4eac-95a3-83f6e4df0d39, APAC; initial 4 tables and 1 event index, then 5th `atomic_claims` and AFTER INSERT trigger. No Worker binds database (17/17 scripts inspected).
- Full current checkpoint `docs/ai-handoff/TIEN404_V14_5Z_LIVE01_D1_SECURITY_GATE_EVIDENCE.md` is authoritative for current QA, bookmark, rollback, gaps, and source links.
- Hosted D1 preliminary 28/28 PASS + atomic trigger 20/20 PASS = **48/48**, uses synthetic offline QA records only.
- CI run https://github.com/ngoctien20/demo-git/actions/runs/43731907070 **122/122 PASS** (28/32/44/18). New atomic Python SQLite QA is 18/18.
- Old bound D1 legacy tables remain as before; this session wrote no SQL into the old D1. Old D1 Time Travel bookmark advanced between readings; do NOT infer identical data. SQL export file download via signed URL 403; no independent durable backup file.
- New isolated D1 clean baseline Time Travel bookmark captured before migration: 00000001-00000000-00005124-7e28fe0e4fa45171fa2d4fcb632f9e1c. Restoring is destructive, restricted to this QA DB, and requires separate approval. No restore/drop was executed.
- Existing published Zalo ingress/router versions unchanged, global Worker ZALO_SEND_ENABLED=false, new QA workflows inactive. No provider sends, no actual customer Orders data changes, no credential/billing changes.
- **D1 SECURITY QA VERIFIED, LIVE SEND NO-GO:** real Bot→Shop→recipient bound grant, staging gate/dispatcher integration, aggregate model token hard budgeting and actual Gateway balance/monetary cap, final owner activation approval still missing.

## 13. V14.5Z-LIVE02 hosted no-send integration checkpoint (2026-11-16 JST)
- New Cloudflare staging Worker: `tien404-zalo-live02-nosend-gate-staging`; D1 binding `LIVE02_DB` → `d6604745-8f8a-4eac-95a3-83f6e4df0d39`. No secrets, no provider calls. New Worker `workers.dev` QA route enabled; preview URLs disabled.
- Signed synthetic QA ECDSA-P256 immutable test grant+scope; D1 lookup required BEFORE atomic claim. This is NOT real Zalo Bot→Shop→Owner verification.
- Existing outbound Worker global `ZALO_SEND_ENABLED=false`; existing Zalo ingress/router versions untouched. New n8n manual QA workflows kept INACTIVE.
- Hosted n8n HTTP executions 3844–3852 (missing/bad signature, wrong shop, replay, stale CAS, 1000+1000+500 tokens accepted, overage 501 blocked) verified. Three positive claims produced 3/3/2500 and session revision 3 in D1.
- HTTP execution 3853 SUCCESS: new Worker GET health 200; /v1/send hard denied 423. No real provider send or model inference.
- Fourth signed HTTP attempt was NOT run, so it is not counted. Code/schema prevents seq4 and D1 hosted trigger enforces quota, corroborated by CI.
- GitHub run 43734568228 SUCCESS **132/132** (28 Zalo, 32 preflight, 18 D1 atomic, 10 Worker, 44 conversation).
- After QA, both `qa_live02_b_%` synthetic grants were marked `QA_STOPPED` on isolated QA D1; 0 remain armed. Temporary QA signing private key was discarded, not persisted anywhere.
- Detailed authoritative V14.5Z LIVE02 checkpoint: `docs/ai-handoff/TIEN404_V14_5Z_LIVE02_HOSTED_NO_SEND_CHECKPOINT.md`.
- **Release:** V14.5Z-LIVE02 HOSTED_SIGNED_QA_TESTED, REAL_ZALO_LIVE_SEND_NO_GO. Bot binding, authenticated real ingress, provider dispatcher/outbox, real LLM+money cap and owner final approval are P0 blockers.

## 14. V14.5Z-LIVE03 read-only Zalo identity + n8n Gateway cost certification (2026-11-16)
- Direct real Zalo read-only checks rerun: n8n `3854` getMe/token VALID and `3855` getWebhookInfo aligned with staging URL; neither discloses full trusted provider Bot ID, nor establishes a real Bot→Shop B→Owner QA server registry binding.
- Active ingress `yIJk8LvJoLF40Z62` still binds `trusted_bot_id:'b'` with `SINGLE_STAGING_WEBHOOK_TO_SYNTHETIC_SHOP_B`: hard-coded synthetic identity, NOT official provider Bot ID. Existing registry two `synthetic_qa/dry_run` rows; one Owner QA allowlist expires 2026-11-20.
- Existing Cloudflare old Zalo outbound `ZALO_SEND_ENABLED=false`; LIVE02 no-send Worker has only isolated QA D1 binding; two LIVE02 QA grants remain stopped, no live grant.
- Current manual QA model `gpt-5.4-nano`, provider direct list $0.20/1M input and $1.25/1M output, theoretical max 2500 all-output tokens $0.003125 USD, but n8n Gateway instance-shared balance, actual n8n rate, Auto top-up and USD owner ceiling are UNKNOWN. Provider direct estimate is not actual account spend.
- New `qa/zalo-live-v145z/live03-identity-budget-gate.cjs` with 5 independent ECDSA P256 signed-proof roles, source-only fail-closed `can_send:false`, plus 35 negative tests. Initial GitHub run 43736390952 167/167 PASS (old 132 + LIVE03 35).
- Full evidence and conditions: `docs/ai-handoff/TIEN404_V14_5Z_LIVE03_TRUSTED_IDENTITY_BUDGET_CHECKPOINT.md`.
- LIVE03 remains BLOCKED for real identity + budget; source-only certification logic never constitutes a live gateway. No credential, billing, Worker, n8n active flow, production or customer changes.

## 15. V14.5Z-LIVE03B — model price matching and budget quote QA (2026-11-16 JST)
- Owner's exact n8n service pricing screenshot now confirms configured `gpt-5.4-nano` Input $0.20/1M, Output $1.25/1M. `gpt-5-nano` $0.05/$0.40 is NOT the configured QA model.
- Existing inactive QA workflow `OMV22pdETQFVU9ru` read-only rechecked, unchanged version `0bbd2547-e68d-419f-a7cb-3460b38b5528`. No model switch.
- 2500 total token strict envelope all-output reference estimate $0.003125; 2× buffer $0.00625. Current n8n console UI snapshot $0.59 of shared Gateway credits, not a reserved pilot wallet.
- New offline pricing module with no send `qa/zalo-live-v145z/live03b-price-reconciliation.cjs` and 22 negative tests. CI 43740865678 189/189 PASS.
- COST-02 price row UI VERIFIED; COST-01 UI balance observed; COST-03 Auto topup and money cap unverified; COST-04 hosted trusted shared token-money cap unverified. Real Bot→Shop→Owner mapping still synthetic. Send NO-GO.
- Detailed corrections are in `docs/ai-handoff/TIEN404_V14_5Z_LIVE03A_EVIDENCE_INTAKE_RUNBOOK.md` Section K and `...LIVE03_TRUSTED_IDENTITY_BUDGET_CHECKPOINT.md`.

## 16. V14.5Z LIVE03C hosted budget atomic guard / no-send QA, 2026-11-16 JST
- LIVE03C migration on isolated QA D1 new-only tables `z145z_live03c_budget_policies`, `z145z_live03c_budget_events` and trigger; preflight Time Travel bookmark captured, old tables/production untouched.
- Exact n8n `gpt-5.4-nano` rates in integer nUSD, synthetic $0.01 money ceiling, 3 calls/2500 total token guard: direct hosted D1 **22/22 PASS** including concurrency, replay, CAS, expiry, wrong scope and $ overage.
- New staging Worker `tien404-zalo-live03c-budget-nosend-staging` one D1 QA binding only, no secret, no sendMessage or outbound fetch; new n8n manual-only inactive QA workflows validated HTTP executions **3856–3860** (401, 403, 200 reserve, 409 money limit, 200 health/423 send denied).
- All 7 LIVE03C QA grants STOPPED, 0 ARMED. Active Published ingress/private router preserved, outbound Worker ZALO_SEND_ENABLED=false.
- CI for source after new 14-case Worker regression run 43741753066 **203/203 PASS**.
- Real provider Bot→Shop→Owner and Auto top-up/current account-wide credit/money ceiling still **BLOCKED**; no real sends, no actual model inference, no customer/Orders/billing/credential/production changes.
- Full evidence + rollback `docs/ai-handoff/TIEN404_V14_5Z_LIVE03C_HOSTED_BUDGET_GATE.md`.

## 17. LIVE03D — server-only Bot Identity provenance and Gateway trial risk (2026-11-16 JST)
- n8n Cloud Gateway credit page read directly from connected browser tab: $0.59 / $2 free credits updated Nov 16 02:35 JST; 7-day $1.20 spend, last-7-day daily Nov 9 $1.00, Nov 10 $0.07, Nov 11 $0.13, Nov 14 $0.0026, Nov 15 $0.0001. n8n trial banner says '7 days left', operational renewal risk. Account-specific Auto top-up still NOT visible.
- Official n8n docs clarify free trial can use Gateway credits but cannot top up until paid upgrade; don't infer account auto-topup switch or modify subscription. Exact n8n `gpt-5.4-nano` price $0.20/M input, $1.25/M output remains unchanged.
- Official Zalo `getMe` response returns `result.id` and `account_name`. Current staging gateway sanitizer exposes only valid token boolean; Bot ID is still unavailable to verifier. Registry still 2 `zalo_bot_fixture / synthetic_qa / dry_run` rows, Owner allowlist status only, no provider pair proof.
- New **SOURCE ONLY** `qa/zalo-live-v145z/live03d-trusted-identity-preflight.cjs` requires server-owned authenticated `getMe`, exactly one verified real Bot→Shop B mapping and one independently verified Owner association, HMAC digests only; always `can_send:false`, `can_promote_registry:false`.
- 31 LIVE03D offline negative tests PASS; GitHub CI 43742910640 **234/234 PASS**. No n8n workflow, Cloudflare Worker, D1, customer data, Bot Token, credential, billing or production writes in LIVE03D.
- Full checkpoint `docs/ai-handoff/TIEN404_V14_5Z_LIVE03D_BOT_ID_TRUST_AND_GATEWAY_TRIAL.md`. Real owner/provider pair and account monetary certifications remain BLOCKED. LIVE ZALO NO-GO.

## 18. V14.5Z LIVE03E — Provider Bot ID Attestation × Trial Continuity Gate (2026-11-16 JST)
- User-approved continuation scoped to read-only inspection, source-only no-send implementation and safe QA; no credentials, billing, Published webhook, data or production changes.
- n8n Cloud Browser tab confirms trial banner **7 days left** on Nov 16 2026, Gateway free balance $0.59, spend $1.20 last seven days and current observed consumption ~$0.18/day. Trial expiration estimated around Nov 23, NOT exact; n8n official docs say 14-day trial, 3-day grace then stop, further five-day instance deletion, up to 90 days workflow-export accessibility. Owner must download backup promptly.
- n8n MCP enumerated **98 workflows, 19 Active**. Checked all 19 Active versions; **4 Draft ≠ Published**: Manage Order, Revenue Report, Update Order, Create Order. Metadata-only manifest + version differences in `qa/zalo-live-v145z/live03e-n8n-workflow-inventory.json` and `live03e-active-version-differences.json`. These are NOT backups.
- Existing Zalo read-only `getMe` route returns token-valid boolean but no `result.id`; actual provider Bot ID and Shop B/Owner QA relationship are still UNKNOWN. New source-only `live03e-readonly-provider-id-attestation.cjs` requires server-only getMe result.id and separate HMAC key, returns only nonce-scoped digests, always `can_send:false`, not deployed. 23/23 offline QA.
- New `live03e-trial-continuity-gate.cjs`: source-only fail-closed export/credential/table/restore and subscription decision gate, 28/28 offline QA. New local-only JSON/ZIP file validator `live03e_verify_n8n_export.py` with 11/11 QA. No workflow export has been downloaded or independently verified.
- CI 43744679433 **296/296 PASS** after fixing an initial Python test syntax error in separate run 43744596079. All source/test work in Draft PR only; zero new paid AI calls or Zalo sends.
- Cloudflare outbound staging `ZALO_SEND_ENABLED=false`; 7 budget QA grants STOPPED. Legacy LIVE01 D1 still has 7 QA_ARMED records but all are EXPIRED by database time; no unexpired grant. No D1 or Cloudflare mutations in LIVE03E.
- Full evidence/rollback `docs/ai-handoff/TIEN404_V14_5Z_LIVE03E_PROVIDER_ID_TRIAL_CONTINUITY_CHECKPOINT.md`. n8n owner action Cloud Console → Export → select latest available backup → Download workflows; store privately, locally validate; do not publish raw JSON or tokens.
- Real Bot identity/Owner pairing, backup restoration, actual account Auto top-up, explicit USD cap and live send approval still **BLOCKED**. **LIVE ZALO NO-GO**.

## 19. V14.5Z LIVE03F — Defer n8n subscription until trial-end review (2026-11-16 JST)
- Owner directs to continue n8n Cloud Trial until close to expiry and reassess Starter/Pro against real executions, concurrency, administrative needs and TIEN404 AI commercialization economics. No upgrade, payment or Auto top-up is approved.
- From signed-in account change-plan page, Starter €20/month on annual billing equivalent, 2.5K executions/mo, 1 shared project, 5 concurrent executions; Pro €50/month on annual billing equivalent, 10K executions/mo, 3 shared projects with more administrative capabilities. Annual equivalents €240 vs €600 pre-tax; monthly billing rates still unverified. User plan page shows Pro 20 concurrency while public n8n pricing currently says up to 50: verify at actual checkout before proposing.
- n8n trial banner 7 days left on Nov 16 => approximate end around Nov 23; not an exact expiry confirmation. Official trial docs say instances stop and later delete after grace, and owner workflow exports can remain for up to 90 days; retention is NOT service uptime.
- 98 total workflows, 19 Active and 4 Draft≠Published versions remain measured baseline. Gateway balance screenshot $0.59, but shared instance and not an individual pilot budget.
- No new full n8n Cloud owner workflow Export attached to current conversation and no matching full backup located among conversation/Library files; **BACKUP_FILE_VERIFIED=false, RESTORE_TESTED=false**. Previous manifest and 11 local export QA tests do not certify a real export. Owner may defer subscription assessment, but should privately export promptly to prevent loss.
- If any actual paying customers currently depend on this trial instance, continuity/paid-plan approval must be completed **BEFORE** trial expiry to avoid webhook and bot outages. The customer's live commercial/revenue status itself has not been independently audited in this turn.
- One-time review automation created for **2026-11-22, around 08:00 JST**, one day before estimated expiry, to recheck instance status/prices/usage/backup and present a recommendation only. It cannot auto-upgrade, pay or activate Zalo.
- Decision detail: `docs/ai-handoff/TIEN404_V14_5Z_LIVE03F_TRIAL_PLAN_DECISION.md`. All changes are Draft GitHub documentation only; no production, n8n, Cloudflare, credentials, billing, data changes.

## 20. V14.5Z-UAT01 — Owner-hosted synthetic UAT portal and acceptance roadmap (2026-11-16 JST)
- Owner requests to continue building testable TIEN404 AI roadmap until user can test and sign off. Implemented **isolated, public, entirely synthetic NO-SEND portal** on Cloudflare staging `https://tien404-uat01-synthetic-nosend-staging.tienmobi208.workers.dev`, unique script `tien404-uat01-synthetic-nosend-staging` with **0 bindings, no credential, no D1, no outbound provider/LLM or real Orders API**. No existing Worker replaced.
- GitHub source in `qa/zalo-live-v145z/live04-uat-core.mjs`, `live04-uat-worker.mjs`; 12 fictional Shop A/B cases, deterministic price/stock/draft/cross-shop checks. UAT browser has chat simulation, 12-case selftest and 8 manually marked acceptance checks with local JSON download, with explicit simulation disclaimer. **This is not real AI/Zalo conversation UAT.**
- CI `43747789974` SUCCESS **314/314 PASS** (296 prior +18 UAT01); hosted HTTPS manual n8n workflow `teHbeNGZn7e1TuSy` Inactive, version `718f3f39-70f5-428f-a064-c4ba4483cb02`, execution **3863 SUCCESS**: /api/selftest 12/12, /health 200, synthetic draft QA-B-01 ×2=318000 VND not persisted, /v1/send 423; 0 actual Zalo messages, AI model calls, Orders writes.
- Cloudflare deployment `df852081-f55a-424b-af22-9032dbe5679c`, Worker version `4dee23ca-2e18-4f57-9f4c-f5371711aa6a`; independent confirmed bindings `[]`. Old outbound `ZALO_SEND_ENABLED=false`; 0 unexpired LIVE03C QA grants; n8n live ingress Published version remains unchanged.
- n8n live inventory now **99 workflows, 19 active**, compared with 98 at older snapshot; extra unrelated inactive QA workflow. Full Export backup and 4 draft/published drift remain outstanding.
- Full staged owner acceptance checklist + 6 release gates **G0–G5** at `docs/ai-handoff/TIEN404_V14_5Z_UAT01_HOSTED_OWNER_ACCEPTANCE_ROADMAP.md`. Owner can open site, run synthetic tests, mark 8 checks, download `TIEN404_UAT01_NGHIEM_THU.json`, and return to chat. G1 owner acceptance is PENDING, G2–G5 real identity, cost, Zalo, production are BLOCKED pending independent approvals.
- Trial subscription deferral remains as approved; review scheduled Nov 22 JST. No billing, subscription, credentials, production, Published webhook or customer data modified by UAT01.

- **POST-UAT01 SNAPSHOT** (2026-11-16): n8n search now reports 100 workflows / 19 Active, because an additional inactive QA driver `teHbeNGZn7e1TuSy` was created after the initial 99/19 check. Use 100 as latest read-only count for reporting, and re-inventory when accepting Export backup.

## 21. UAT01 final UI hardening / acceptance handoff (2026-11-16 JST)
- Existing synthetic UAT staging Worker remains unique with no bindings, no provider, no LLM, no Orders write. UI `Test cách ly` now explicitly chooses Shop A for Shop B SKU to avoid owner test ambiguity.
- Added 2 extra browser UI regression cases (JavaScript syntax and Shop A selection), bringing UAT01 tests to **20**, inherited tests 296, expected full CI **316/316**. Real hosted n8n execution **3864 SUCCESS** after redeploy (12/12 synthetic, health 200, draft 318000, /v1/send 423).
- Current UAT Worker version `4a33928c-2395-4d3e-bec7-f8d66001db84`, deployment `dcd273ce-1174-4c3d-947c-acd5877d6a84`; old revision available as rollback checkpoint. No new credential/production/live Bot changes.
- Latest n8n count **100 workflows / 19 Active** including new inactive HTTP UAT QA. Owner G1 manual acceptance remains PENDING; G2–G5 real identity, AI, limited sends and commerce launch remain gated. Detailed runbook updated in `docs/ai-handoff/TIEN404_V14_5Z_UAT01_HOSTED_OWNER_ACCEPTANCE_ROADMAP.md`.

## 22. UAT01 owner upload G1 acceptance (2026-11-16 04:19 JST)
- User submitted actual browser-exported `TIEN404_UAT01_NGHIEM_THU.json` directly in chat, project/version/environment validated; eight required fields `CATALOG_A, CATALOG_B, ISOLATION, DRAFT, STOCK, INJECTION, NO_REAL, REVIEW` ALL `PASS`. File `reviewer=USER_UNVERIFIED_LOCAL`, has no signature; accept only self-report of synthetic storefront.
- Acceptance source explicitly `real_zalo_approved=false`, `real_ai_approved=false`, `orders_written=0`, `provider_sends=0`. Independently verified hosted n8n HTTP 3864 SUCCESS and latest GitHub CI run 43749013167 316/316 PASS.
- G1 changes from OWNER UAT PENDING to **ACCEPTED_BY_USER_SELF_REPORT — SYNTHETIC_OFFLINE_UAT only**. This does not certify real Bot identity, RLS or revenue, authorize Zalo send or remove G2–G5 blocked gates.
- Sanitized acceptance receipt `docs/ai-handoff/TIEN404_V14_5Z_UAT01_OWNER_ACCEPTANCE_8_OF_8.md`. User JSON file itself NOT committed; no credentials/production/runtime writes. Worker no-send and n8n Published versions unchanged.
- Next checkpoint to progress: G2 actual provider Bot→Shop B→Owner QA server-only private attestation, with approved credential scope/immutable id evidence; continue G3 AI commerce RLS and cost QA only in safe staging without real customer data. G4 real Zalo send requires separate final specific approval.

## 23. V14.5Z-G2 — Trusted Bot→Shop B→Owner Certification, read-only + source-only QA (2026-11-16 JST)
- User requested continuation from G1 accepted synthetic UAT. Actual staging Zalo provider check was refreshed using **existing inactive workflow** `xayBLEyUwd64mcLK` execution **3869 SUCCESS**: getMe HTTP 200, `bot_token_valid:true`, 0 Zalo sends, no Bot ID returned. Existing webhook diagnostics workflow `bD510xyr5jBHQ99K` execution **3870 SUCCESS**: provider webhook URL matches staging ingress `/webhook/tien404-zalo-bot-lab-v1`, zero sends/config changes.
- Current Shop Bot QA registry remains 2 rows `zalo_bot_fixture / synthetic_qa / dry_run`, not verified. Owner allowlist QA one row `ALLOWED_STAGING_OWNER`, expiring Nov 20 2026 22:17:32.511 JST, is NOT independent provider/merchant ownership evidence. Published ingress `yIJk8LvJoLF40Z62` still hard-coded `trusted_bot_id:'b'`, synthetic scope, no change.
- Implemented new **DRAFT SOURCE ONLY** gate `qa/zalo-live-v145z/g2-trusted-bot-shop-owner-gate.cjs` (4 independently signed provider/registry/owner/hosted roles, pinned P256 public roots, same nonce and Bot/Tenant/Store/Owner hashes, server-owned scope, durable atomic nonce, consent and expiry). 45/45 negative/positive SYNTHETIC QA PASS; `can_send:false` fixed even for synthetic success.
- Prepared independent **NOT DEPLOYED** provider read-only `getMe→nonce HMAC Bot digest→ECDSA signature` module `g2-provider-identity-attestor.mjs`, WebCrypto compatibility with existing LIVE03 verifier tested **18/18**; no actual Bot Token or signing keys provisioned or accessed in this module. GitHub CI 43753823368 **379/379 PASS** (prior 316 +45 +18).
- G2.0 getMe token validity + webhook read-only **VERIFIED**; G2.1 getMe result.id issuance **BLOCKED**; G2.2 real server Bot→Shop B registry **BLOCKED**; G2.3 authenticated Owner+merchant consent **BLOCKED**; G2.4 de-synthetic hosted ingress **BLOCKED**; G2.5 real signed cert **BLOCKED**. No G2 signer roots exist in connected environment; source-only code does not confer a real certificate.
- Current credential-bound staging Worker `tien404-zalo-outbound-v1-staging` still uses secret Bot Token and outputs only boolean. To obtain privacy-safe **real** signed `getMe.result.id` proof, a **separate narrowly scoped approval** is required for a new authenticated read-only attestation route or isolated secret attestor, distinct signing key; do not modify credential-bound Worker, Published ingress or owner permissions under existing G2 approval.
- Full security evidence, rollback and remaining P0 gates: `docs/ai-handoff/TIEN404_V14_5Z_G2_BOT_SHOP_OWNER_TRUST_GATE_CHECKPOINT.md`. Real Zalo outbound remains NO-GO; no production, billing, credential, customer or published workflow writes.

## 24. V14.5Z-G2.1 — REAL signed provider Bot ID observation on STAGING (2026-11-16 JST)
- User approved narrowly scoped G2.1 read-only attestation including separate signing keys in credential-bound staging Worker, with NO credential rotation, outbound send, Published webhook, real Orders or production.
- Pre-change original Cloudflare outbound Worker source SHA256 `b1c58cf85e74b3e235807d4a5d731369bd15579e5076b18d8774f75e9f5351d3`, deployed version `ed172d3c-e1f1-4daa-bc56-643406441091`. Reversible rollback by redeploying prior 100% version. Six existing bindings preserved using strict inherit, two NEW protected `secret_key` bindings `G2_PROVIDER_SIGN_KEY` and `G2_PROVIDER_HASH_KEY`, new version `3422864f-f095-45b9-85ca-a7d03cb87a3f` deployment `17b7106a-d66a-4e37-a18e-0d8ec97d6f78`; flag still `ZALO_SEND_ENABLED=false`.
- New authenticated `POST /v1/g2-provider-attest` uses existing token internally to call official Zalo `getMe`, returns nonce-based HMAC Bot digest signed by P256 private key, never raw Bot ID/token. Public root stored only in `qa/zalo-live-v145z/g21-provider-public-trust-root.json`.
- n8n INACTIVE QA workflow `bOjbj4MZIZnMn8XP` **execution 3874 SUCCESS** (HTTP 200 getMe signed proof, 0 send, owner_verified:false), independent cryptographic ECDSA signature verification against GitHub-pinned public root **PASS**, official `getMe.result.id` observed only inside Worker. It is signed **server observation**, not a native Zalo certificate.
- Additional INACTIVE negative HTTP QA `wAJddACuIgq93UdZ` **execution 3878 SUCCESS**: GET 405, no auth 401, invalid challenge 422, `/v1/send` 423, `/health` 200 no-send. Existing read-only getMe check **3875 SUCCESS**, existing webhook diagnostics **3876 SUCCESS**, no webhook changes.
- GitHub CI 43755059657 + 43755579758 **409/409 PASS**, 30 new G2.1 negative cases. Current observed n8n workflow inventory **104 total / 19 Active** (prior counts are historic snapshots); both new drivers inactive, existing Published ingress unchanged.
- **G2.1 VERIFIED** for official Bot ID as server-signed privacy-safe read-only observation only. **G2.2 Bot→Shop B registry; G2.3 Owner/merchant proof; G2.4 real ingress; G2.5 four independent roots + persistent nonce remain BLOCKED**. QA registry still 2 synthetic rows and Owner allowlist expires 2026-11-20 22:17 JST; no promotion or credential/access change.
- G2.1 full evidence, rollback and remaining actions: `docs/ai-handoff/TIEN404_V14_5Z_G21_SIGNED_PROVIDER_OBSERVATION_CHECKPOINT.md`. Real provider Zalo sends remain ZERO, G4 NO-GO. n8n trial subscription review remains scheduled Nov 22, no payment.

## 25. V14.5Z-G2.2 — trusted signed provider ID matched ONE isolated QA Shop B candidate (2026-11-16 JST)
- User requested G2.2 continuation. Supabase staging has distinct QA Shop A/B tenants, each with active Owner memberships, but no Zalo record in `app_private.channel_secrets`. QA bot registry remains two synthetic/dry-run rows and Published ingress still static synthetic Shop B scope; **none promoted**.
- New isolated APAC Cloudflare D1 `tien404-g22-botmap-qa-staging`, UUID `4453cadb-3f0e-427c-bc7c-57267878230e`, single table `g22_trusted_bot_candidates` with `owner_certified=0` CHECK. Private admin enrolled one `CANDIDATE` Bot HMAC digest from independently verified *actual* G2.1 signed getMe proof n8n **3880 SUCCESS**, paired to authoritative Supabase staging Shop B tenant identity with hashed pin. No raw Bot ID/Token logged; candidate expires **Nov 19 2026 05:33 JST**.
- New Worker `tien404-g22-shop-b-map-nosend-staging` version `8e458c9c-3231-451c-9229-e26e171d47c3`, exactly ONE `G22_QA_DB` D1 binding and ZERO secrets; read-only `/v1/resolve-bot` pins real provider signature, Bot digest/challenge, Supabase QA Shop B tenant sha, forbids Shop A and owner spoof, returns candidate-only status, /send 423.
- GitHub CI **454/454 PASS** run 43758263470 (409 inherited +45 new offline G2.2 tests). Hosted n8n INACTIVE workflow `znp3ABDLUH5bTqFE` execution **3881 SUCCESS**: new signed real G2.1 proof maps only QA Shop B candidate, owner false, sending false, Orders write 0. Hosted INACTIVE negative workflow `gMN4W0elrxEPmJ61` exec **3882 SUCCESS**: no proof 422, client Shop A override 422, send 423, health 200.
- **G2.2 candidate technical mapping VERIFIED (staging only)**, not a merchant authority/Owner-certified channel. G2.3 owner provider identity, G2.4 real ingress and G2.5 nonce durable replay all BLOCKED. Generic LIVE Zalo and production still NO-GO. n8n latest count 107 total / 19 active (two G2.2 drivers inactive).
- Full evidence, 72h expiry and rollback `docs/ai-handoff/TIEN404_V14_5Z_G22_BOT_SHOP_B_CANDIDATE_MAPPING_CHECKPOINT.md`; manifest `qa/zalo-live-v145z/g22-hosted-qa-evidence.json`. Existing provider G2.1 Worker kill switch still false, Published ingress version unchanged. Trial review on 2026-11-22 unchanged; no account billing, credential, Supabase RLS/GRANT or customer record mutation.

## 26. V14.5Z-G2.3 — Independent Owner & Merchant Consent evidence gate, source/QA only (2026-11-16 JST)
- User requested G2.3 Owner proof × merchant consent after G2.2 staging candidate mapping. Read-only Supabase staging confirms QA Shop B has **2 distinct active Owner Auth subjects and 2 email-confirmed accounts**; current Auth identities are email only (3), **no linked Zalo Social identity**. No Zalo rows in `app_private.channel_secrets`; no user/owner identifiers or credentials copied.
- Existing isolated G2.2 D1 still exactly 1 CANDIDATE `owner_certified=0` expiry **2026-11-19 05:33 JST**. n8n Owner QA allowlist expires **2026-11-20 22:17 JST**, still not independently proven owner consent. Existing Published ingress unchanged and outbound kill switch remains false.
- Official Zalo Bot public API overview contains getMe/getWebhookInfo/getUpdates etc., but reviewed documentation **does not establish a Bot Creator owner admin verification API**. Social OAuth 2.0 verifies a Zalo account, NOT automatically Bot Manager control or authorization to act for the Supabase Shop B merchant. Human independent Bot Manager control review and authenticated account linking are required.
- Implemented **DRAFT SOURCE ONLY** `qa/zalo-live-v145z/g23-independent-owner-consent-gate.cjs`: four separately signed ECDSA P256 proofs for Zalo OAuth session, independently reviewed Bot Creator authenticated control challenge, Supabase Auth active Owner membership & explicit authenticated merchant QA-only consent; server-pinned Bot/Tenant/Store/subject, unique nonce, atomic replay, expiry, active allowlist and G2.2 candidate. Even synthetic positive only eligible for private review; `private_owner_certified:false`, `can_send:false`, zero writes.
- New `g23-independent-owner-consent-gate.test.cjs`: **46/46 synthetic offline PASS**; CI run 43760901522 **500/500 PASS** (454 inherited+46 new). Contract `qa/zalo-live-v145z/g23-owner-evidence-contract.json`; full evidence and approval-gated intake `docs/ai-handoff/TIEN404_V14_5Z_G23_INDEPENDENT_ZALO_OWNER_CONSENT_CHECKPOINT.md`.
- **G2.3 real Owner proof/merchant consent BLOCKED**, no OAuth app/callback/signers/approved Bot Creator reviewer/consent persisted. Source-only test cannot infer real authority or escalate Owner permissions. G2.4 and G2.5, G4 sends and G5 production remain BLOCKED. No Cloudflare or n8n runtime changes, D1 writes, Supabase Auth/RLS/GRANT, billing, credentials or Published webhook changes in this step.
- Next G2.3A requires **separate narrow authorization** before any Zalo OAuth application setup, credential storage, authenticated Owner consent persistence, signing keys or changes to owner allowlist/security. Avoid real customer data.
