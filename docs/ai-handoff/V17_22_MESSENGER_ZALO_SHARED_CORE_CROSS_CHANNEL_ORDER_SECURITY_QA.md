# TIEN404 V17.22 — Messenger Order → Zalo Bot Status × Cross-Account Security QA

**Checkpoint:** 2026-11-17 JST. **Verdict:** `IMPLEMENTED_SOURCE_ONLY`, `TESTED_42_OF_42_GITHUB`, `INDEPENDENT_N8N_QA_25+40+36_PASS`, **`NO_GO_LIVE_CROSS_CHANNEL_ORDER`**. No real provider sends, Commerce writes, credential changes, or live bot reconfiguration occurred during V17.22.

## 1. User's exact acceptance goal

The owner wants a genuine Messenger shopper to **place an order**, then use a separate Zalo conversation to **check the same order**, while a second Messenger or Zalo account attempts unauthorized lookup. This requires more than receiving callbacks: proven **same Store** installation authority, proof that the two channel accounts are controlled by the same human, a shared tenant-scoped Commerce order ledger, read/write and status gates, and independent Store A/B security tests.

For first UAT use **synthetic opt-in QA orders**, not real customer/order/payment/stock data. Merchant production Commerce is a separate gate.

## 2. Actual current integrations read from connected n8n and Supabase

| Resource | Observed | Security / impact |
| --- | --- | --- |
| Messenger `Z7FdV7uDvApfbURQ` | Published `1064b1b3-d3f1-4a6b-a367-2414ba691522`; native Meta HMAC path; `QA_CORE:` read-only consultation route; default Agent retains `create_order`, `update_order_address`, `manage_order`, `get_order_status` legacy tools | **Never** route Commerce cross-channel QA through the unprefixed DEMO order writer; existing order status `4DFFCk60exrzaIl6` queries `AI_SALES_DEMO` Orders Sheet by code/phone, not a verified customer identity/store |
| Zalo Bot `yIJk8LvJoLF40Z62` | Published `2d912cb0-007f-452f-9536-b92ba12a03e6`; protected Header Auth + real EXT03 inbound, Owner/Customer split, no-send shadow | **No Zalo customer reply node** in the current published V1 route; `trusted_binding_scope=SINGLE_STAGING_WEBHOOK_TO_SYNTHETIC_SHOP_B`; this is Bot, **not native OA** |
| V12.3 Customer Router `sIPs6egzIwOY1GNv` | Published `8d91d23c-cd87-462f-a112-9cca2340bec8` | Owner isolate/customer route accepted on earlier real EXT03; **not** proof of Merchant Store authority |
| Shared Zalo/Web Core Shadow `4ycmVzaNzVRulBjQ` | Published `76bbb4e9-7ad2-45a6-8188-260523ced57a` | Fail-closed, no send, unregistered channel denied |
| Actual Commerce Core `iyfGUiEsZlNTBWOR` | Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d` | Existing read-only Sandbox Core/Catalog possible under approved demo; no Store-verified cross-channel order transaction |
| Supabase `ifxlvrhyjhbzbrkdsida` | `public.orders` has Tenant but **no store_id**; `public.stores` and `public.channel_identity_links` **absent**; only existing read RLS is membership Owner/Manager; `tien404_r1_qa.sandbox_orders` does exist separately | Customer cannot be given Store-scoped order read based only on order number / phone; must use private dedicated and verified customer authorization |
| Cloudflare V17.21H.2 hosted Replay | Newly deployed private DO class `ZaloBotReplayBucketV2`, no public URL; hosted SQL QA and rollback passed earlier | Replay storage only, **not** a shared cross-channel order database / not an authenticated channel identity issuer |

No n8n Published callback, Supabase hosted schema, Cloudflare Worker, Meta Page configuration, Zalo Bot credential or provider send was edited in V17.22.

## 3. IMPLEMENTED in unmerged GitHub Draft PR #243 only

`qa/v1722-cross-channel-order/cross-channel-qa-core.mjs`

- Exact **synthetic-signed** two-channel Store A/B/C fixtures. Page/Bot → Store/Tenant binding is server-owned **within the test fixture**, NOT production Page ownership proof.
- Messenger `QA_ORDER PREVIEW QA_SKU_001 <qty>` obtains Store-specific approved **sample** price; no order written.
- Same Messenger actor `QA_ORDER CONFIRM <preview_ref>` creates one QA-only in-memory order with frozen SKU, qty, unit price/total, 2-minute preview expiry. No stock decrement.
- Original Messenger actor `QA_LINK START <order_ref>` issues a six-digit QA code (cryptographic `randomInt`) with 5-minute expiry. Only the matched Zalo Bot account can submit `QA_LINK CODE <messenger_code>` to receive **a different second code** on Zalo.
- Original Messenger sender must complete `QA_LINK CONFIRM <link_ref> <zalo_code>`; a different Messenger account **cannot** approve, Zalo actor receives no order info before confirmation. OTP hashes are stored, not plaintext codes.
- Zalo `QA_ORDER STATUS <order_ref>` returns a QA order only after verified, unrevoked same-Tenant/same-Store link to the original Messenger owner. Unauthorized code known/unknown results are indistinguishable generic denial. `QA_LINK REVOKE` immediately revokes the link.
- Duplicate signed fixture event ID returns `DUPLICATE_IGNORED` without repeating an OTP or order response; changed payload with same event ID denied. Invalid provider/Store claim, wrong HMAC, stale event and prompt-injection-like command fail closed.
- In-memory QA-only: `provider_sends=0`, `commerce_writes=0`, `model_calls=0`, `live_orders=0` and explicit unsupported real send/order functions. **Hardcoded keys in fixture are fake and must never be deployed.**
- **Important gaps:** OTP/replay/rate limits currently not durable/distributed, and the implementation does NOT ingest actual Meta/Zalo provider callbacks, persist across workers or call the published Commerce Core. Dual-code confirmation reduces mistaken account linking but cannot eliminate social-engineering where both codes/confirmations are intentionally surrendered.

`qa/v1722-cross-channel-order/PRIVATE_STAGING_SCHEMA_CANDIDATE.DO_NOT_APPLY.sql`

- **PROPOSED but NOT APPLIED** isolated `tien404_v1722_qa` private PostgreSQL schema with QA orders, two-channel link challenges, hashed links and replay. All four tables are `ENABLE/FORCE ROW LEVEL SECURITY`, no `anon/authenticated/service_role` API/table grants and no dangerous `SECURITY DEFINER` function. Requires separate security review and dedicated least-privilege actor/real Store proof before any hosted migration.

`qa/v1722-cross-channel-order/cross-channel-qa-core.test.mjs`, [runbook](https://github.com/ngoctien20/demo-git/blob/work/v171a-channel-store-bot-vertical-slice-nosend-20261117/qa/v1722-cross-channel-order/README.md), and `.github/workflows/v1722-cross-channel-commerce-ownership-nosend.yml`: independent CI, NO SEND/NO DB WRITE static gate, **live promotion job intentionally SKIPPED**.

## 4. TESTED — real execution evidence and limits

- **[GitHub Actions #44079399865](https://github.com/ngoctien20/demo-git/actions/runs/44079399865)** SHA `bedb94e0039f22883c2e44699415b1f9b634bb48`: **42 tests, 42 pass, 0 fail**, static no-provider-send/no-hosted-data-source guard PASS. First source CI #44078575510 had 41/41 PASS, expanded with private-schema security test; [#44079934465](https://github.com/ngoctien20/demo-git/actions/runs/44079934465) SUCCESS after adding the README. Includes full QA flow and negative actor/Store/Tenant/replay/OTP/expiry/price cases.
- Existing **n8n `TIEN404 V17.5 ORDER OWNERSHIP SECURITY QA` execution #5023 SUCCESS**: **25/25** synthetic ownership cases PASS, no real backend access.
- Same n8n execution **#5023 `V17.5C Smart Security OTP Handoff Policy QA`**: **40/40** policy cases PASS, no actual provider OTP delivery or production handoff.
- Existing **n8n V14.8 unified identity lab execution #5024 SUCCESS**: **36/36** synthetic Messenger/Zalo/Website routing fixtures PASS; all `providerSends=0`, `hostedWrites=0`, `orderWrites=0`.
- These are **different independent synthetic QA suites**, not 143 unique vendor live transactions. Do not label this as real Messenger→Zalo Commerce UAT.

## 5. GO/NO-GO and steps to first real opt-in UAT

| Gate | Decision |
| --- | --- |
| Source cross-channel order+dual-code ownership, actor attacks | **IMPLEMENTED / TESTED (synthetic)** |
| Existing signed Meta Page ingress | **VERIFIED earlier** but its Store assignment is still DEMO |
| Existing Zalo Bot shared-header ingress / Customer Router | **VERIFIED earlier** but its Bot installation uses synthetic Shop B |
| Private same-Store Page & Bot owner attestations backed by real auth/JWT | **BLOCKED / no independent proof** |
| Customer identity + order scope durable backend, least-privilege RLS and idempotency | **PROPOSED / not applied or hosted-tested** |
| Actual opt-in bot callback routing to this QA order contract | **NOT CONNECTED** |
| Zalo Bot reply to consenting QA account | **NOT ENABLED** |
| Actual Messenger order QA → verified Zalo Bot status → unrelated account DENY | **NOT RUN / NO-GO** |
| Real Zalo OA OAuth/signature/approved merchant installation | **SEPARATE NO-GO** |

**Next bounded safe stage `V17.22B`:** validate real owner consent/bindings for the specific existing Messenger QA Page and Zalo Bot to the **same disposable QA Store**; build a staging-only, private order/link ledger and trusted no-send ingress adapters without the old DEMO sheets; independently QA stateful optimistic/atomic confirmation, JWT, Store A/B denial and OTP replay. Then a **separate approved** *exact-prefix QA-only* Messenger/Zalo Bot send canary with consenting test accounts and no payment/stock writes. Only after the canary is safe should the user send real channel UAT messages. Do not instruct the owner to send an unprefixed order now: the existing Messenger agent still has DEMO order-writing tools.

## 6. Rollback and review

- Current changes are **GitHub source/CI/report only**; rollback by reverting V17.22 files or closing PR #243. **No n8n, Supabase, Cloudflare, Zalo or Messenger rollback required**.
- Before any DB migration or live bot publishing: take a fresh schema/workflow snapshot, verify owner approval and payment limits, test 2 unique identities + cross-Store, write down event ID/execution IDs, and prepare a stop/rollback switch.
- Production release remains explicitly **NO-GO** until the separate real merchant Store authorization and data safety approvals are proven.
