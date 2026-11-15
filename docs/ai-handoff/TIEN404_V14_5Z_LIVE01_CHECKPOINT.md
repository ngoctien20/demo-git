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
