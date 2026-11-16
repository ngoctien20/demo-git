# TIEN404 AI — V16.3 Economy Router × Five Studios
**Checkpoint:** 2026-11-16 JST | **State:** SOURCE-ONLY STAGING, NO-SEND, NO-PAID-CALL, NOT PRODUCTION CERTIFIED.

## 1. Exact upstream baseline — VERIFIED via connector
- Parent Draft PR #193, pinned HEAD \`f043de890751b66888116b25bfefcb441c0a172c\`, source-only V16.2. GitHub Actions run \`43836698757\` SUCCESS (37 new + 42 inherited synthetic assertions).
- Parent-of-parent PR #190 Draft HEAD \`e3d704632df0a1757249f03c7b01c368ff2c9606\`; RPC.3 security Draft PR #186 remains open, hosted NO-GO.
- Messenger n8n \`Z7FdV7uDvApfbURQ\` active version \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\`; Zalo V1 \`yIJk8LvJoLF40Z62\` active \`8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e\`; V2 Shadow \`OgDZNSAvKEvhnAvn\` active \`f00ba506-c52a-4340-9a0c-809fd9c6ea9a\`; AI SALES Main Agent \`v6PBwcqSapVzACMW\` active \`c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30\`.
- Commerce tenant resolver \`5Eeh8hbpsoNhuiVo\` Published \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`, Catalog Query \`oOOXicKXGkBskKqh\` Published \`e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696\`.
- DEMO Create Order \`KrSn4DNR9ALX5ng4\`: Draft \`af9ee686-2a9f-483e-9622-6e449500ac5e\` DIFFERENT from Published \`4740251a-cd01-4f7f-b8e1-e300a8393151\`. Must never hook this into commerce production.
- CAP.1 Messenger 24 webhook executions in observed sample; p50 ~8.96s, p95 ~15.41s end-to-end **workflow runtime**, NOT customer-visible delivery, nor a capacity proof.
- Existing Cloudflare account audit (prior CAP.2) reported 23 Worker scripts and zero Queues; V16.3 does not create or configure new Cloudflare resources.
- Supabase staging remains subject to RPC.3 P0: unauthenticated EXECUTE of public SECURITY DEFINER \`public.qa_shop_b_zalo_claim\` and missing independent hosted Owner A/B JWT-RLS, backup/restore, caller inventory, human approvals. This PR does not read credentials or fix grants.
- n8n DEMO Products/Orders/credentials stay isolated from TIEN404 Commerce.

## 2. Source-only modules
All features are server contracts running with pre-enrolled **QA-only synthetic** tenant/store/actor IDs. Enrollment is injected by offline tests: it is **not real authentication**.
- **FAQ Studio:** \`qa/v163-studios/faq-studio.mjs\`. Owner/manager edits per-Shop/per-key versioned synthetic FAQ; independent reviewer approves/rejects; TTL freshness and optimistic version gate; stock/price never enter trusted FAQ. Versioned preview only, no publish.
- **Cost Center:** \`cost-center.mjs\`. Integer micro-USD per-Shop mock budget, pessimistic reserve/settle/refund, idempotent event IDs, warnings at 70%, 90%, 100%, mock hard cap and quota fallback. All state local memory. No actual invoice or cloud-billing reconciliation, no cross-instance atomicity: real spending hard cap **BLOCKED**.
- **Priority Queue Dashboard:** \`priority-dashboard.mjs\` wraps V16.2 deterministic weighted scheduler; metadata-only per-tenant/per-Shop pending queue age, tier distribution, oldest wait and simulated admission. NOT real Cloudflare Queues or throughput/SLA proof. Per-Shop Economy/Standard/Priority concurrency 1/2/5 and weighted 1:2:4 are proposed test values only. Reviewers may see same-tenant anonymized aggregate, never cross-tenant data.
- **Human Handoff:** \`human-handoff.mjs\`: reason-code triggers, consent gate, idempotent preview ticket and store-scoped manager assignment/resolution. Staff never gets a real message, no customer profile or raw text stored, customer never gets status notification; owner verification and channel notification adapter still BLOCKED.
- **Model A/B Lab:** \`model-ab-lab.mjs\`: exact 96 single + 36-case dialogue-pack metadata manifest, composite case keys SINGLE:QA01 and MULTI:QA01 to avoid collision, candidates \`baseline_small\`, \`economy_candidate\`, \`premium_candidate\` as **unverified labels**. Generate 396 NOT_RUN plan rows (132 per label). Metadata verified directly from user CSV: 36-case pack has 9 one-turn, 21 two-turn, 4 three-turn and 2 four-turn cases (71 total turns); only 27 genuinely test multi-turn memory. No text, prompt, actual output, API key, real model ID or paid inference. Claimed reviewer PASS remains unverified and does not count as certified PASS.

## 3. Data, privacy, tenancy and status
- No actual customer message, phone, address, JWT, token, merchant dataset, prices, stock or order writes should enter source-only modules. All public GitHub files contain only synthetic allowlisted fixtures and state schemas.
- This iteration adds `qa/v163-studios/preview.html` + `preview-ui.mjs` as a responsive LOCAL SYNTHETIC dashboard using in-memory modules. No hosted auth, real end-user UI QA or deployment has been performed. This iteration does not add UI connected to actual Shop identity, persistent DB, Queue, paid API, Messenger/Zalo send or n8n work.
- Every action uses QA-only \`enrolled:true\` context injected in offline tests. A real principal MUST be authenticated and authorized by server-side trusted resolver before any production use. Do NOT reuse QA contexts for authorization.
- All synthetic test measurements (if any) must be labelled LOCAL_SYNTHETIC. Real latency, provider delivery, per-model cost remain unverified.
- Real 132-case quality baseline: 96 single \`actual_output\` blank and 36 multi \`NOT_RUN\`; historical 97 feedback lines include duplicate QA01; do not reinterpret as an independently validated score. No paid model A/B executed.
- Real-time hard cost cap needs durable transactional reservation/refund and reconciliation with provider usage/pricing/billing before GO. In-memory mock cannot enforce multi-instance cap.

## 4. QA and release gates
- New 70-case offline synthetic positive/negative suite + inherited V16.2 (37) + V16.1 (42). CI result must be attached for the exact PR HEAD.
- P0: hosted tenant and Store ownership, independent Owner A/B JWT-RLS, public RPC risk, actual provider verification, human approval; production Commerce remains NO-GO.
- P1: actual Queue fairness, cross-process atomic cost ledger, real deliverability/handoff acknowledgement, model ID/price/RPM/TPM/cost per resolved conversation, 132-case actual scored QA.
- GO: review Draft PR and continue QA-only source-first trials. NO-GO: publish real Worker/webhook, n8n Published, paid model, live send, Order write, Supabase RLS/GRANT/RPC or customer rollout.

## 5. Rollback and responsibilities
Changes are additive and isolated under \`qa/v163-studios/\`, \`.github/workflows/v163-five-studios-nosend.yml\` and this checkpoint. Roll back source proposal by **closing Draft PR**; \`gh-pages\`, all n8n Published workflows, Supabase hosted and Cloudflare resources stay unchanged. Do not merge any parent Draft branch automatically.

- Website team owns future verified mobile UI; this PR defines metadata/API preview contracts, no owner-facing production dashboard.
- Worker team owns trusted auth/queue adapter for future work; n8n team owns Commerce orchestration only after authorization.
- Security reviewer must independently verify the real hosted evidence; AI Research owns 132-case evaluation with real model outputs and cost approval.

## 6. Chủ dự án nghiệm thu
- [ ] Tách DEMO/Commerce và 3 cửa hàng QA, không lẫn quyền.
- [ ] FAQ đúng phiên bản, reviewer khác người tạo, TTL hết hạn fail closed.
- [ ] Cost Center không vượt quota ở mock, 70/90/100 cảnh báo không lặp.
- [ ] Dashboard chỉ thấy queue metadata trong tenant hợp lệ, không lấy tin nhắn thật.
- [ ] Handoff có đồng ý (trừ yêu cầu SAFETY), chỉ assignee giải quyết.
- [ ] 132-case manifest đủ 96/36; 396 candidate rows đều NOT_RUN trước API thật.
- [ ] CI green tại đúng HEAD, không có write/send/mua dịch vụ.
- [ ] Hosted P0 NO-GO được giữ nguyên.
- [ ] Chỉ xem xét V16.4 model API sau phê duyệt **ngân sách cụ thể** và bằng chứng bảo mật.

## 7. Đề xuất V16.4–V16.5 (chưa phê duyệt hành động live)
- V16.4: đưa prompt/expected behavior từ nguồn private vào offline evaluator, không commit PII; kiểm tra model catalog và chi phí mới nhất; chạy model được duyệt với hard budget, chấm độc lập.
- V16.5: thiết kế durable quota and queue with transactional outbox, process restart/replay/cross-Shop tests in isolated disposable DB; funded Cloudflare resources require approval riêng.
- Merchant onboarding: xây wizard import CSV/XLSX chỉ ở môi trường private, validate sản phẩm, mã SKU, giá sỉ/lẻ, phân quyền, backup, DPA và consent; không lưu công khai.

## 8. Dataset structure and additional acceptance evidence
- Read direct user-supplied \`AI_SALES_QA_96_SINGLE_TURN.csv\`: 96 unique IDs, all 96 \`actual_output\` empty.
- Read direct user-supplied \`AI_SALES_36_MULTI_TURN_FOR_LATER.csv\`: 36 unique IDs, 71 dialogue turns; **9 contain 1 turn**, 21 contain 2 turns, 4 contain 3 turns, 2 contain 4 turns. True multi-turn-memory subset is 27 cases. Do not score 9 single-turn dialogue items as memory successes.
- Read historical \`AI_SALES_QA_CASES.csv\`: 97 rows / 96 unique IDs (QA01 duplicate); historical responses are not independent V16.3 model evaluations.
- New metadata-only \`qa/v163-studios/manifest-132.mjs\` mirrors case counts and turn counts, without conversation text. Source CSV remains private (not committed).
- Browser-only QA preview has five responsive tabs; owner/reviewer/staff actors are synthetic fixtures, NOT merchant login or real role enforcement.
- New unit tests include an exact 9 anomalous / 71 turns integrity assertion and Shop-scoped FAQ greetings. **Expected 70 new tests**, inherited 37 + 42 = 149 if all CI jobs pass at exact HEAD.
