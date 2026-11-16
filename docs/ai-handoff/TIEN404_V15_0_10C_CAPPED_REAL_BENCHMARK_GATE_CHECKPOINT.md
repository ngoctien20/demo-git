# TIEN404 V15.0-10C — REAL AI BENCHMARK AUTHORIZATION × CAPPED EXECUTION PREFLIGHT

Ngày: 16/11/2026 JST.
Trạng thái: IMPLEMENTED source-only / QA OFFLINE / REAL PAID RUN BLOCKED BY NUMERICAL CAP.
Kế thừa: V15.0-11A PR #150, commit 00d9b35b77f7eba9b25446c210cf184bfe0cbca2.

## 1. Quyết định phê duyệt và giới hạn
- User đã nói "tôi phê duyệt ngân sách cho AI benchmark 132 ca thực tế". Đây là phê duyệt **mục tiêu benchmark**, NHƯNG không có con số USD/JPY/VND tối đa. Không suy diễn "vô hạn", không tự đặt hạn mức là đã được user chấp thuận.
- Mức trần đề xuất để user phê duyệt riêng: **1,00 USD cho MỘT lần chạy trên dữ liệu QA**, tối đa 334 model requests (167 customer turns × dự phòng 2 lượt model), input <= 5000 tokens/request, output <= 1200 tokens/request, tối đa 1 retry được tính trong 334 requests. Đây là giả thiết, không phải số request thực tế. Model tool-calling có thể cần >2 lượt và giới hạn này sẽ dừng đúng khi hết requests.
- Với đủ 334 requests đạt token maximum và model gpt-5-nano: API standard list-price ~0,24382 USD, buffer giả định 2× ~0,48764 USD.
- Với đủ 334 requests đạt token maximum và model gpt-6-luna: API standard list-price ~0,36740 USD, buffer giả định 2× ~0,73480 USD.
- Ước lượng KHÔNG bao gồm: n8n Gateway credits/markup không được đo, model deliberation token nếu không được tính đúng từ output usage, phí phụ trợ, latency phí dịch vụ, cache write, regional processing. Không thể bảo đảm tổng hóa đơn <=1 USD nếu dùng Gateway thiếu API quota/budget enforcement độc lập. Chỉ là bảng đánh giá sơ bộ.
- Giá API được kiểm tra trong tài liệu OpenAI 16/11/2026:
  gpt-5-nano $0,05/triệu input, $0,005 cached, $0,40 output; đã deprecated: https://developers.openai.com/api/docs/models/gpt-5-nano.
  gpt-6-luna $0,10/triệu input, $0,01 cached, $0,50 output: https://developers.openai.com/api/docs/models/gpt-6-luna và https://developers.openai.com/api/docs/pricing.
- CHƯA xác minh nhà cung cấp Gateway/credential của n8n có model Luna, có thể truy cập đúng token usage hoặc có mức trần nạp tiền. KHÔNG thay đổi credential.
- Giới hạn phải được xác nhận TRƯỚC bất kỳ API-call trả phí, không chỉ trước khi publish.

## 2. VERIFIED dataset và đặc điểm benchmark
File local PRIVATE: AI_SALES_QA_96_SINGLE_TURN.csv (96 trường hợp), AI_SALES_36_MULTI_TURN_FOR_LATER.csv (36 trường hợp, 71 customer turns).
SHA256 tương ứng f266447e4be2a9a22733cfa81fb80ace8862d286752b15d2d6d1ffc77c9ba257 và 8cfccde67964207e199dc20e911a9e6d4ebcbb8b1e2410526f3b40f5b8a2a1c4. 132 case IDs namespaced by single/multi, tổng 167 lượt hỏi. Các ca single QA01..QA96 cần tra Products và không được ghi Order thật. Multi có yêu cầu tạo/sửa Order, tình huống gian lận, đổi giá/tồn, phone text, formula injection, readback fault và no-send. Không thể chỉ dùng "QA Dry Run Tool" 5 ca và công bố PASS 132 vì các trường hợp này yêu cầu isolated stateful tool/injection.
Toàn bộ 132 mẫu yêu cầu từ đầu vào vẫn chưa có phản hồi mới. Đã tạo bản PRIVATE plan tại đường dẫn artifact riêng, không commit prompt/các đầu vào có thể chứa thông tin nhạy cảm lên public GitHub.

## 3. Direct n8n audit và blocker
Manual QA workflow uNTFqxh6OLPuH7Vw đang INACTIVE; 5 ca, dùng gpt-5-nano, catalog Shop QA A tĩnh, 1 dry-run order tool. Lần chạy #3884 có 4 PASS, 1 FAIL của bộ tự chấm. Theo runData có 25 model node runs / 4 Catalog ReadOnly / 2 Order DryRun. Tool event chưa đủ để map/verify từng case; cost provider thực tế/usage per turn chưa được cung cấp. D05 có câu trả lời từ chối Shop B nhưng toolHealthy=false => độc lập kiểm trace trước khi kết luận.
Không thực hiện thêm model calls, không sửa n8n/credential, không bật Published.
Cổng independent QA tool trace mới từ chối:
- Không có log công cụ độc lập => INCONCLUSIVE, không gắn PASS.
- Gọi tool không allowlist, truy cập Shop khác, hosted Reads/Writes, gửi Meta/Zalo, credential, write ở case chỉ-đọc => BLOCKED.
- Chỉ cho phép sửa/tạo TEST order tại DISPOSABLE_QA_ONLY và các case quy định, không cấp quyền người dùng thật.

## 4. IMPLEMENTED draft-only
- qa/v15010c-capped-run/budget-guard.cjs: finite budget numeric gate, whitelist model, maximum requests, conservative reserve with uncached input, output max, Gateway factor, per-call settle, stop on usage invalid/retry/double count. NEVER grants provider call because no verified private operator API.
- qa/v15010c-capped-run/budget-guard.test.cjs: regression budget, double reservation, cap, model/role/expiry missing, abort.
- qa/v15010c-capped-run/independent-tool-trace-gate.cjs + tests: record structure checking, no claim from AI answer that tool was executed, no hosted writes/sends, synthetic only.
- .github/workflows/v15010c-capped-benchmark-no-send.yml: GitHub Actions Node22 tests, no provider/hosted calls.
- This checkpoint. Source-only; no Approved->Released promotion.
- CI exact final HEAD and run IDs must be inspected before claiming TESTED.

## 5. Next **real execution** gate checklist — all must be satisfied
- [ ] User specifies hard maximum spend (e.g., 1,00 USD), model and whether budget includes Gateway surcharge; no invented amount.
- [ ] Independently verify quota/credit available AND a real externally enforced hard spend stop, no plaintext key in GitHub. If unavailable, report BLOCKED / seek safer billing.
- [ ] Create and test isolated stateful QA Order/Products/Customer fixtures for 36 multi-turn (including fault injection) with no provider send or Commerce hosted write.
- [ ] Configure manual-only staging runner bound to trusted QA tools with execution tracking by case, no fallback to published AI_SALES_DEMO or any credentials of other tenant.
- [ ] Run bounded smoke first, verify independent provider usage/cost and successful zero-outbound traffic, then continue approved 96+36 only while budget permits.
- [ ] Collect true per turn input/output/cached usage, model version, duration, retries, tool name/arguments safely redacted, execution ID, comparison with expected behavior, human adjudication. Keep private.
- [ ] Validate failures, hallucination and tool accuracy separately; no rough string-matching accuracy numbers.
- [ ] Abort immediately on unexpected tool, signed Owner/Store bypass, actual Order changes, provider send, unknown cost, provider billing anomaly.
- [ ] Hosted RLS/Owner G2.3/Backup Production gates remain independent and BLOCKED; cannot use passing benchmark as Commercial release proof.

## 6. Approvals, changes, rollback
VERIFIED: source dataset SHA, n8n historical QA, PR #150 baseline, official prices.
IMPLEMENTED: offline budget/trace gate and private manifest.
TESTED: only when GitHub CI finishes.
BLOCKED: paid 132 case actual model run until exact amount, live billing controls, safe stateful test tool and credential selection are verified.
No Supabase hosted mutations, n8n Published edits, new Meta/Zalo messages, credential changes or customer Order/Stock writes. Rollback closes child Draft PR.
