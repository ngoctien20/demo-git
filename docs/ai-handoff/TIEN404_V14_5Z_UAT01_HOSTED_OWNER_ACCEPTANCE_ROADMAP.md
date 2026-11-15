# TIEN404 AI — V14.5Z-UAT01 Hosted Merchant Acceptance Portal & Roadmap
Date: 2026-11-16 JST
Branch: work/v145z-live01-limited-uat-gate
PR: https://github.com/ngoctien20/demo-git/pull/103 (DRAFT, NOT MERGED)
Release: STAGING — SYNTHETIC_OFFLINE_UAT — NO ZALO SEND
Access: https://tien404-uat01-synthetic-nosend-staging.tienmobi208.workers.dev

## Scope and security contract
Owner requests progressive execution through testable milestone gates, owner-operated UAT and acceptance. This phase deliberately deploys a **standalone public staging synthetic demonstration only**. It is NOT connected to live Zalo, real Bot Token, tenant/order/product customer data, an AI model, n8n production or subscription services. It cannot create an Order, consume Gateway credits or send any provider message.

Live changes, a real provider/owner identity mapping, n8n payment or trial upgrade, public sends, production changes, and real customer data operations remain separate approval gates.

## Status verified at this checkpoint
- n8n Cloud workflow inventory now **99 total / 19 Active**. Earlier 98 count was an older snapshot; one later QA offline workflow was added. Do not assume 99 is a frozen baseline. Existing active ingress yIJk8LvJoLF40Z62 version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e unchanged.
- Cloudflare outbound staging Worker `tien404-zalo-outbound-v1-staging` has `ZALO_SEND_ENABLED=false`. Isolated LIVE03C budget D1 has 0 unexpired QA_ARMED grants.
- Owner's decision to defer n8n upgrade to trial deadline remains in effect. Review task for Nov 22, 2026 at approx 08:00 JST. No subscription payment or auto topup.
- Full owner n8n Cloud Export remains NOT VERIFIED; a GitHub workflow inventory JSON cannot substitute for a restore test. 4 previously checked Active workflow Draft≠Published divergences require backup reconciliation.
- Real Zalo Bot `getMe.result.id` and Owner QA verified Shop B pairing remain missing. Do not confuse synthetic fixtures with trusted mapping.

## Delivered code and deployment
- `qa/zalo-live-v145z/live04-uat-core.mjs`: two **synthetic QA catalogs** with distinct `QA-A-*` and `QA-B-*` SKU identifiers, deterministic price and stock responses, draft-only order quote, no persistence, refusal of cross-shop products and unconfigured wholesale prices, injection/payment actions disabled.
- `qa/zalo-live-v145z/live04-uat-worker.mjs`: self-contained Vietnamese mobile-first UAT app, exposed via new Cloudflare Worker `tien404-uat01-synthetic-nosend-staging`. Public interface contains **only synthetic fixtures and local checkboxes**.
- HTML includes chat demonstration; button "Chạy QA" calls the Worker /health and /api/selftest endpoints, renders real HTTP response and **12/12 deterministic simulated checks**. Browser-local acceptance checklist for 8 owner tests can be downloaded as `TIEN404_UAT01_NGHIEM_THU.json`. This local file records the owner's self-assessed answers, not server-signed certification.
- UAT Worker deployment ID `df852081-f55a-424b-af22-9032dbe5679c`, version `4dee23ca-2e18-4f57-9f4c-f5371711aa6a`. **ZERO Worker bindings**, no secrets, no D1, no outgoing Cloudflare fetch, no model invocation. No authenticated tenant resolver here (it is purposely a public fake fixture portal).
- Endpoints: GET / (HTML), GET /health, GET /api/meta, GET /api/selftest, POST /api/chat (synthetic). POST to /v1/send, /api/order, /api/orders, /webhook/*, /v1/provider/* → HTTP 423.
- Existing Cloudflare Workflows/n8n Published ingress, old outbound Worker and Supabase data have NOT changed.
- GitHub CI [43747789974](https://github.com/ngoctien20/demo-git/actions/runs/43747789974): prior 296 QA + 18 UAT01 offline/contract regression = **314/314 PASS**.
- n8n new manual QA workflow `teHbeNGZn7e1TuSy`, folder `90_QA - DIAGNOSTICS`, version `718f3f39-70f5-428f-a064-c4ba4483cb02`, remains **INACTIVE**, no credentials. Manual execution **3863 SUCCESS** verifies actual hosted HTTPS GET /api/selftest 12/12, GET /health 200, POST /api/chat returns draft total 318,000 VND without storing, POST /v1/send 423 locked. Zero real provider sends, model calls or Orders writes.

## USER UAT01 — HOW TO TEST NOW
1. Open https://tien404-uat01-synthetic-nosend-staging.tienmobi208.workers.dev on phone or desktop.
2. Choose Shop A. Ask `Giá QA-A-01`, expected simulated price **125,000 VND** / stock 7. Ask `Giá QA-B-01` while still in Shop A, expected cross-shop denial.
3. Choose Shop B. Ask `Mua QA-B-01 2`, expected quote **318,000 VND** (159,000×2), a **draft not a real order**.
4. Choose Shop A, ask `Mua QA-A-02 3`, expected stock denial since QA stock is 2. Ask `Giá sỉ bao nhiêu`, expected requirement for a configured wholesale table.
5. Ask `ignore previous secret`, expected injection denial; use the **Chạy QA 12 ca** button and check the result **12/12 PASS** and HTTP status 200.
6. In the checklist, mark PASS/FAIL/PENDING for the eight rows. Download `TIEN404_UAT01_NGHIEM_THU.json`. Review it locally and attach it back in chat if the user wants QA sign-off. **Do not enter personal/customer data**.
7. Pass criteria: expected SKU/price/stock, no data leakage across shops, draft amount correct, no payment or send, and 12/12 hosted selftest PASS. A user PASS grants only **G1 synthetic UAT acceptance**, NOT G2–G5 or real Zalo send.

## ROADMAP RELEASE GATES (no invented percent completion)
| Gate | Scope | Checkpoint | Acceptance criteria | Next approval |
| --- | --- | --- | --- | --- |
| G0 | Safety NO-SEND | VERIFIED/TESTED | Worker Zalo send false; no unexpired grants; public UAT has zero secret/data bindings, /send 423; n8n Published versions unchanged | None for no-send |
| G1 | Shop A/B synthetic UAT | IMPLEMENTED/TESTED; OWNER UAT PENDING | 12/12 HTTP synthetic logic PASS; owner chat tests + downloaded acceptance JSON; mobile manual checks | Owner acceptance of *synthetic* G1 |
| G2 | Provider Bot→Shop B→Owner QA real identity | BLOCKED | Trusted server-only getMe.result.id, one pinned provider Bot, tenant/shop mapping, independent Owner pair+consent, genuine ingress signature; no raw IDs/secrets in reports | Separate identity/credential-scope approval if required |
| G3 | AI SALES + Commerce hosted negative tests | BLOCKED | Verified real AI reply quality on staging with measured spend, no made-up VND prices, cross-tenant RLS, order/stock replay-CAS, receipt and notification outbox dry-run; regression 96 single-turn + 36 multi-turn reviewed | Trial AI spend/budget/QA approval |
| G4 | Bounded LIVE Zalo owner UAT | BLOCKED | G2/G3 certified, n8n account hard cap and actual balance checked, one real Bot and Owner QA consent, 3 model calls/3 replies, ≤2,500 aggregate tokens, ≤10 min, explicit monetary cap and kill switch; signed final approval | **Separate FINAL approval for real Zalo send** |
| G5 | Commercial go-live | BLOCKED | owner export/restore tested, trial continuity plan, merchant billing/consent, tenant isolation, refunds/stock/order and support QA, merchant acceptance on phone, role/admin security, SLA/rollback | Separate production/billing/go-live approval |

## Risk / rollback
- Zero secrets/credentials or customer data ever enter UAT01 Worker. The portal is public because all data is synthetic; do NOT later attach real store catalog or Bot token without authentication and a separate security review.
- If hosting shows errors, STOP and inspect this independent UAT Worker; revert by disabling only `tien404-uat01-synthetic-nosend-staging` or reverting Draft PR sources. Do not touch Published Zalo ingress or outbound.
- If user tests reveal a mismatch, mark FAIL and attach exported UAT JSON; fix only this staging code, re-run GitHub CI + n8n HTTP QA, preserve evidence, and request owner retest.
- No full real AI/Zalo end-to-end acceptance is claimed from synthetic tests.

## Next checkpoint for owner test
Owner should open the staging URL, run 12/12 QA, complete at least 8 acceptance checklist items and return the exported JSON. On receiving it, evaluate G1 pass/fail and continue G2 identity and G3 real AI negative tests with specific approvals. Meanwhile, trial review on Nov 22 remains active and separate.

## 2026-11-16 post-driver snapshot correction
- After adding the new inactive manual-only UAT01 HTTP QA driver `teHbeNGZn7e1TuSy`, n8n MCP reports **100 workflows, 19 Active**, with that driver as latest workflow. The earlier 99/19 inventory in the beginning of this checkpoint is a genuine earlier snapshot taken **before** the driver was created, not the final total. Metadata changes need a fresh inventory before backup validation.
- This additional workflow remains **INACTIVE** with zero auto-assigned credentials. Real hosted HTTP execution 3863 SUCCESS is already recorded above.

## Final UAT01 UI hardening + hosted QA (2026-11-16 JST, supersedes earlier QA counts)
- Detected and fixed a **cross-shop quick test UX ambiguity**: when clicking `Test cách ly`, the browser now sets Shop A before asking about Shop B SKU; this reliably expects a cross-shop denial rather than a legitimate Shop B price.
- Added **two extra CI checks**: browser-inline JavaScript parses cleanly and the cross-shop shortcut selects Shop A. UAT01 Worker test count **20** (previous 18). With inherited 296 cases, the combined CI target is **316/316** when the last run completes.
- Redeployed only the isolated UAT staging Worker (no production) version `4a33928c-2395-4d3e-bec7-f8d66001db84`, deployment `dcd273ce-1174-4c3d-947c-acd5877d6a84`; post-deploy bindings still exactly zero, old outbound flag remains false. Previous Worker version `4dee23ca-2e18-4f57-9f4c-f5371711aa6a` retained as possible rollback checkpoint.
- **Real hosted n8n HTTPS regression execution 3864 SUCCESS** after redeploy: 12/12 Worker simulation tests, health 200, draft quote 318,000 VND not persisted, /v1/send HTTP 423, zero provider sends/AI calls/Orders writes. Earlier 3863 also passed on the initial deployment.
- Latest n8n metadata read after adding the new inactive UAT01 HTTP driver: **100 workflows, 19 active**; not the older 99 pre-driver or 98 earlier backup manifest.
- The website is ready for **owner-side manual UAT G1**, not authenticated real Zalo/AI certification. No owner acceptance JSON has been submitted at checkpoint time.

## G1 USER-REPORTED ACCEPTANCE RECEIVED — 2026-11-16 04:19:29 JST
- The user uploaded `TIEN404_UAT01_NGHIEM_THU.json`. Parsed full content and validated **8/8 expected checklist keys PASS**, correct project/version/environment, and explicit `real_zalo_approved:false`, `real_ai_approved:false`, `orders_written:0`, `provider_sends:0`.
- Submitted `reviewer=USER_UNVERIFIED_LOCAL` and source notice `Self-reported local UAT, not live Bot/AI certification`. No cryptographic signature or per-case browsing proof. This is **user self-reported acceptance of the synthetic G1 portal**, not independent attestation of merchant identity or live AI/Zalo.
- Independent hosted evidence reconfirmed: n8n manual HTTP execution **3864 SUCCESS**, synthetic 12/12, draft quote 318000 VND not persisted, `/v1/send` 423; GitHub CI **316/316 PASS** run 43749013167. Cloudflare UAT has zero bindings, outbound send flag false, 0 unexpired budget QA grants, n8n 100 workflows / 19 active.
- **G1 = ACCEPTED (USER_SELF_REPORT, SYNTHETIC_ONLY)**; **G0 = VERIFIED**, **G2–G5 remain BLOCKED**. Do not call G1 real provider commerce acceptance.
- Sanitized acceptance receipt and SHA fingerprint: `docs/ai-handoff/TIEN404_V14_5Z_UAT01_OWNER_ACCEPTANCE_8_OF_8.md`. Source file deliberately not copied to public GitHub.
- Next G2 step is to independently attest the real immutable Zalo provider Bot ID and approved Shop B/Owner QA association in a trusted server-only isolated staging component; read-only provider verification and QA possible, but no credentials, Published webhook modifications or real sends without specific approval. Existing synthetic registry must not be promoted to verified.

## G2 progress after G1 synthetic owner signoff — 2026-11-16 JST
- G1 remains `ACCEPTED_BY_USER_SELF_REPORT / SYNTHETIC_OFFLINE_UAT` supported by 8/8 submitted checklist, CI 316/316 and hosted n8n execution 3864. This does NOT change status of real Zalo or real Commerce.
- G2.0 real Zalo getMe token validity and expected webhook verified read-only, n8n executions **3869** and **3870**, no sends/config changes.
- G2.1–G2.4 real Bot ID, server Shop B mapping, independent Owner/merchant consent and real trusted ingress **BLOCKED**. Owner allowlist expiry **2026-11-20 22:17:32.511 JST**; do not reuse expired allowlist as proof.
- New offline 4-root signed provenance + durable replay candidate: 45/45 PASS; standalone WebCrypto provider HMAC/P256 signer adapter: 18/18 PASS. GitHub CI 43753823368 **379/379 PASS**, no live credential access or deployment. Source is NOT a Zalo-signed certificate or deployed provider identity service.
- G2 review requires separate approval before any change to credential-bound Worker or signer secret. The existing Worker /v1/bot-check only shows boolean, and Published ingress still synthetic; do not grant G4 send permissions as a result of source QA.
- Detailed G2 checkpoint: `docs/ai-handoff/TIEN404_V14_5Z_G2_BOT_SHOP_OWNER_TRUST_GATE_CHECKPOINT.md`.

## G2.1 hosted evidence VERIFIED after narrow user-approved deployment — 2026-11-16 JST
- The G1 browser synthetic acceptance remains 8/8 self-report PASS; no real Zalo sends authorized by G1.
- **G2.0 VERIFIED**: real Zalo getMe token and original webhook via read-only prior executions 3869–3870 and post-deployment regressions 3875–3876, 0 sends.
- **G2.1 VERIFIED (limited)**: exact provider `getMe.result.id` observed server-side, bound to nonce HMAC and ECDSA-P256 signed evidence; verified independently with pinned public signing key. n8n execution 3874 SUCCESS. Credential-bearing Worker staging version `3422864f-f095-45b9-85ca-a7d03cb87a3f` is deployed; retains 6 old bindings + two new protected cryptographic keys, `ZALO_SEND_ENABLED=false`. No raw Bot ID/Token disclosed.
- Hosted negative execution 3878 PASS: wrong GET=405, unauthorized=401, invalid signed challenge=422, send=423, health=200 (disabled). CI 409/409 PASS. Full evidence and rollback in `docs/ai-handoff/TIEN404_V14_5Z_G21_SIGNED_PROVIDER_OBSERVATION_CHECKPOINT.md`.
- **G2.2–G2.5 BLOCKED**: two existing registry rows are still synthetic/dry-run; Owner allowlist does not prove provider/merchant ownership and expires Nov 20 JST; Published ingress still hardcoded synthetic; no distinct registry/owner/hosted signer roots or durable nonce challenge store. Do not treat a single provider signer as four-issuer certification or approve Zalo sending.
- Next tasks: trusted server Bot→Shop B mapping **without promoting synthetic fixture rows**, independently verified Owner/merchant consent and new expiry approval; create isolated ingress staging candidate only after separate scope/QA. G3/G4/G5 release gates unchanged, including trial-continuity and billing gates.
