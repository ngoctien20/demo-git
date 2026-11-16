# TIEN404 AI — V15.0-10D: Approved $1 Benchmark × Real Gateway Spend-Cap Evidence Gate

Ngày checkpoint: 16/11/2026 JST.
Trạng thái: FINANCIAL BUDGET USER-APPROVED ($1.00) / SOURCE QA IMPLEMENTED / PRIVATE N8N PREFLIGHT TESTED / REAL MODEL BENCHMARK NOT RUN.
GitHub parent: V15.0-10C Draft PR #155, commit 79cdec5bc62212f918268146f0b687bbbd1877f8. Production NO-GO.

## 1. Phê duyệt thực tế
Người dùng đã phê duyệt rõ trần **1 USD cho TOÀN BỘ 132 ca, bao gồm phụ phí n8n Gateway nếu có** trong hội thoại. Đây là trần tổng, không phải $1 mỗi trường hợp; không có quyền auto topup, thay đổi thanh toán, credential hay sử dụng model cao cấp ngoài phạm vi.
Không cần hỏi lại số tiền. Quyền này CHƯA được phép thực thi nếu thiếu biện pháp bảo đảm rằng tổng chi phí không vượt 1 USD.

## 2. Dữ liệu đã xác minh (riêng tư)
AI_SALES_QA_96_SINGLE_TURN.csv: SHA256 f266447e4be2a9a22733cfa81fb80ace8862d286752b15d2d6d1ffc77c9ba257; 96 case và 96 lượt.
AI_SALES_36_MULTI_TURN_FOR_LATER.csv: SHA256 8cfccde67964207e199dc20e911a9e6d4ebcbb8b1e2410526f3b40f5b8a2a1c4; 36 case và 71 lượt.
Tổng 132 case / 167 lượt hỏi; all result fields NULL / NOT_RUN trước benchmark.
Tạo local PRIVATE packet TIEN404_PRIVATE_BENCHMARK_132_CASE_1USD_AUTHORIZED_NOT_RUN_2026-11-16.json: 132 case, prompt, expected và 167 turns; cờ user approved $1; gateway unverified; actual calls 0; not uploaded to GitHub.
Tạo local private metadata status JSON không chứa prompt/chat.

## 3. n8n DIRECT EVIDENCE — Thực sự tạo và chạy QA Preflight
- Đã đọc mcp n8n get_user_preferences: không đụng AI_SALES_DEMO, Commerce Products/Orders hoặc Published; dùng folder QA.
- Gateway credential support: list_n8n_gateway_services available=true, openAiApi and lmChatOpenAi supported, nhưng connector KHÔNG cung cấp balance, per-workflow cap, actual rate, invoice hay hard limit.
- Đã tạo workflow staging mới bằng SDK đã validate: TIEN404 V15.0-10D — Approved $1 Model QA Budget Preflight [NO SEND].
  ID CvPi2QWXyoc9P9BU; version ca191046-01d6-4cb9-ae33-388df4464d13.
  Personal project WW82YsCCaAxGC9dp, folder 90_QA - DIAGNOSTICS (d3ZVrZ9cNiW2SJ1q).
  Workflow INACTIVE, Manual Trigger only, 3 nodes, NO credential, NO model node, NO external HTTP, NO provider send, NO hosted writing.
  URL https://ngoctien20.app.n8n.cloud/workflow/CvPi2QWXyoc9P9BU.
- Đã chạy MANUAL EXECUTION #4023: SUCCESS, output final:
  approvedBudgetUsd:1; benchmarkCases:132; customerTurns:167;
  realCasesCompleted:0; actualModelCostUsd:null;
  decision BLOCKED_GATEWAY_HARD_CAP_UNVERIFIED;
  modelCallsAllowed:false; providerSendsAllowed:false; hostedWritesAllowed:false;
  certification APPROVED_USD_CAP_NOT_EXECUTION_PERMISSION.
- Đây là kiểm chứng THỰC về workflow preflight ở n8n, KHÔNG PHẢI cuộc gọi model hoặc benchmark trả phí.

## 4. Tại sao Gateway hiện vẫn bị chặn
Tài liệu n8n Cloud:
- Gateway là PREPAID CREDITS DÙNG CHUNG CHO TOÀN INSTANCE, mức phí theo model từ service pricing.
- Có thể bật AUTO TOP-UP; nếu hết credit giữa execution, yêu cầu đã in-flight có thể kết thúc và phần âm được ghi vào lần top-up tiếp theo.
- Gateway on/off là cấp INSTANCE, không chứng minh một hard cap riêng 1 USD cho workflow. Có thể xem balance/spend tại n8n Cloud Console; connector hiện không đọc được thông tin đó.
- Source: https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/use-n8n-cloud/gateway-credits/README.md
- Source: https://github.com/n8n-io/n8n-docs/blob/main/docs/build/understand-workflows/use-gateway-credits.md
- Public pricing: https://app.n8n.cloud/service-pricing — phải xác minh model và giá trong console ngay trước model run.
- Không có bằng chứng hard spending quota thực thi cho riêng workflow hay bảo đảm Gateway credit không bị workflow khác sử dụng. Không được âm thầm chạy 5-case smoke rồi khẳng định sẽ không vượt $1.

## 5. IMPLEMENTED source-only
- qa/v15010d-gateway/gateway-hard-cap-certification.cjs: pin APPROVED_CAP_USD=1, 132/167 case turn, exact private dataset SHA; liệt kê 10 hard gates; không thể tự nâng cờ cho phép gọi AI từ JSON/checkbox tự khai.
- qa/v15010d-gateway/gateway-hard-cap-certification.test.cjs: tests for scope, source trust, forgery, shared balance, in-flight overrun, unrelated workflow spending, auto topup.
- .github/workflows/v15010d-gateway-hard-cap-no-send.yml: Node22 source-only QA + inherited 10C budget/trace/fault security, NO real model.
- This checkpoint.
- 10C code already tested separate; none of it is a live provider executor. CI exact HEAD needs verification after PR creation.

## 6. GATE checklist — next actions on explicitly approved $1
- [ ] REAL Gateway price for selected model verified on service-pricing and account Console.
- [ ] Real Gateway balance and auto-topup status verified privately, credentials remain secret.
- [ ] Independent spend cap for one benchmark (including requests still in flight) or a mathematically enforceable per-request cost guarantee verified. If Gateway cannot do this, choose dedicated prepaid provider key/project with a real non-overspend hard limit (may need separate approval to change credentials or provider).
- [ ] Approved staging model version and full usage logging, including input/output/cached tokens, safely sampled for one case before mass QA.
- [ ] QA-only stateful multi-turn tools checked independently in an isolated environment, no live sends or Orders.
- [ ] Paid smoke 5 cases only AFTER above; then remaining 127 cases while actual invoiced spend within $1.
- [ ] Independent human review for all 132 cases and tool evidence. Report actual accuracy only after measured.
- [ ] Security/Recovery/Owner/hosted JWT remains G0–G3 BLOCKED independent from model quality.

## 7. Checkpoint verdict/rollback
Verified: current user cap 1 USD, private SHA, n8n available Gateway support (not billing quota), manual preflight execution #4023 success.
Implemented: guarded source tests and n8n 3-node manual workflow.
TESTED: manual no-send preflight only + offline CI when green.
BLOCKED: actual provider calls, 132-case model benchmark, actual billed cost, real Gateway hard spending guarantee, cross-Store hosted commerce.
No credit top-up, no credential updates, no n8n Published edits, no Meta/Zalo sends, no customer/hosted database writes, no production.
Rollback: close this GitHub Draft branch; n8n preflight workflow remains inactive with no execution action beyond manual run #4023. Any removal of it is not necessary and would require explicit request; no data migrations performed.
