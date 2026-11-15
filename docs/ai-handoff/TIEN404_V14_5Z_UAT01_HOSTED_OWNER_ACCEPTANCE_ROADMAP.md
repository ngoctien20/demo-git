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
