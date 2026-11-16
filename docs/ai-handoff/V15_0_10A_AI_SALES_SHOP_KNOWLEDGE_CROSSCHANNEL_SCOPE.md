# TIEN404 AI — V15.0-10A NORMALIZED SCOPE × AI SALES / SHOP KNOWLEDGE / CROSS-CHANNEL ORDER
**Ngày:** 16/11/2026 JST | **Trạng thái:** DRAFT — NO SEND, NO LIVE ORDERS, NO HOSTED CHANGES
**Tên gốc trong tài liệu người dùng:** V15.0-09C — REAL AI CAPABILITY TEST × SHOP KNOWLEDGE RAG × CROSS-CHANNEL ORDER CONTINUITY.
**Chuẩn hóa:** đổi mã nghiệp vụ sang **V15.0-10A**, bởi V15.0-09C hiện đã dùng cho Independent Owner/G2.3 Certification × Private Recovery Evidence tại PR #132, tiếp theo V15.0-09D tại #135. KHÔNG ghi đè #132/#135.

## 1. Nguồn & kế thừa
- Tài liệu người dùng đính kèm 532 dòng ngày 16/11/2026. Ba mục tiêu: AI sales quality, Shop-specific Knowledge, Messenger→Zalo shared order lookup.
- Sales Lite Pilot Consolidation PR #128 HEAD 1099f8c7589544c93a03d4afe03545c266c00170 là BASE của child Draft. #128 gồm mới nhất V15 Agent Core, V14.7 Studio, V14.8 synthetic identity, V15 Test Lab, private-dataset gate #125, hosted security #126. Không merge.
- PR #135 V15.0-09D là nhánh song song về Security/Recovery, kế thừa #132/#129/#126. #128 và #135 KHÔNG có chung một HEAD tuyến tính. Không được tự gọi là đã hợp nhất code; cần reconciliation riêng.
- Tái sử dụng chính xác V14.7 FIXTURES/createStudio và V15 createOfflineLabEngine; thêm module chứ không thay thế.
- Supabase staging hiện Tenant-only: 2 Tenants, 2 Products, 2 Orders; thiếu public.stores và public.store_memberships. Real hosted Store RLS/JWT vẫn P0 BLOCKED.
- Messenger Published dùng AI_SALES_DEMO, chưa dùng Commerce multi-tenant. Zalo Private Router chưa nối customer live. Không chỉnh Published.

## 2. READ-ONLY real model evidence (lịch sử, không gọi API mới)
- n8n manual workflow uNTFqxh6OLPuH7Vw INACTIVE, version 85b91983-2d4d-4129-9467-a0fce162da9a, có gpt-5-nano, static Shop QA A catalog và dry-run Order Request tool; không gửi tin hay ghi đơn thật.
- Execution #3884 từ ngày 15/11 UTC manual SUCCESS: QA Verdict ghi D01 consultation PASS; D02 quote PASS; D03 order-intent PASS; D04 fake-admin PASS; D05 cross-shop FAIL do toolHealthy=false, trong khi câu trả lời thực tế từ chối lấy dữ liệu B. Cần audit độc lập tool calling và logic chấm điểm; KHÔNG khẳng định đã leak Shop B.
- Không chạy thêm model trả phí hoặc thay đổi credential. 96+36-case REAL model test: NOT_RUN; P50/P95, token cost/accuracy trên 132 cases: UNKNOWN.
- CSV riêng tư đã được kiểm tra cấu trúc cục bộ (không đưa raw CSV lên public GitHub): AI_SALES_QA_96_SINGLE_TURN.csv có 96 unique, 96 blank actual_output; AI_SALES_36_MULTI_TURN_FOR_LATER.csv 36 unique, 71 tổng lượt, toàn bộ status NOT_RUN. AI_SALES_QA_CASES.csv cũ có 97 hàng nhưng chỉ 96 case unique, là lịch sử không phải kết quả benchmark mới.
- Tái sử dụng private-dataset integrity gate từ #125; GitHub CI chỉ dùng fixture synthetic.

## 3. Source-only IMPLEMENTED
### A. Shop Knowledge adapter
qa/v15010a-sales-knowledge/shop-knowledge-v15-adapter.cjs tái dùng createStudio/FIXTURES V14.7 và V15 offline Agent Core, tạo dữ liệu tổng hợp ba shop A tạp hóa, B thời trang, C vật liệu. Structured SKU exact + Shop FAQ/intro/returns/shipping/hours, version QA v1 và staged B v2. QA INTERNAL_STAFF_QA memory-only phê duyệt đổi version. Không bịa năm thành lập/chính sách khi thiếu dữ liệu; không cho client xác lập Store/tenant/role. Price và stock luôn lấy structured fixture, không dùng similarity. Không bật vector embedding/real RAG trong dữ liệu QA ít. Đây là thiết kế thử nghiệm, không phải hosted knowledge hoặc owner-approved release.

### B. Shared Order QA persistence
qa/v15010a-sales-knowledge/disposable_order_continuity.py dùng một SQLite disposable được inject từ test; Shop seed từ V14.7 fixtures. Messenger và Zalo SIMULATOR cùng đọc một bảng Orders, không có Orders riêng per-channel. QA HMAC context là giả lập, không phải provider/real JWT.
ORDER_DRAFT → customer explicit confirm → QA_PERSISTED, backend sinh mã TEST. Trước lưu đọc lại price/stock, không trừ kho; chống request trùng và xác nhận lặp cho cùng draft. Zalo phải vượt one-time QA challenge + explicit consent + store-scoped link; biết order_id không đủ xem PII. Owner A đọc A, Owner B cùng Tenant bị chặn, Owner C khác Tenant bị chặn. Store pause, owner revoke và channel pause đều chặn tức thì. SQLite file mở lại từ connection thứ hai chứng minh đã lưu trên DB disposable. Không có PII thật.
Không được coi SQLite thành Supabase PostgreSQL hosted hoặc claim native Messenger/Zalo Auth.

### C. QA/CI
qa/v15010a-sales-knowledge/shop-knowledge-v15-adapter.test.cjs Node22, test_disposable_order_continuity.py Python3.12, GitHub workflow v15010a-ai-sales-crosschannel-no-send.yml. Chạy regression offline V15 Agent/Skills, Pilot Scope, private CSV synthetic integrity. CI phải verify ở exact HEAD mới được báo PASS.

## 4. Gating
- Synthetic E2E QA: tư vấn → quote → pending draft → explicit confirm → TEST persisted ID → Zalo linked identity lookup → Owner A query.
- Từ chối unknown order, cross-store same tenant, foreign tenant, fake identity, replay, change price/stock, paused bot, duplicate confirmation.
- Live Meta/Zalo E2E còn BLOCKED: provider ingress trust, owner G2.3, hosted signed JWT/RLS, canonical Store, safe Commerce writer, durable replay, protected backup/restore.
- 96+36 model bench chưa được chạy, metrics không được tự suy đoán. Historical five-case #3884 không tương đương benchmark.

## 5. Safety and next actions
No hosted Supabase writes, Messenger/Zalo sends, n8n Published edits, credential access, Google Sheets DEMO Orders, Cloudflare deploy, paid AI inference, billing or production merge. Rollback = close Draft child PR; parent #128 and parallel #135 preserved.
V15.0-10B: cho phép budget cụ thể để chạy model gpt-5-nano trên 96+36 và đánh giá independent tool traces, p50/p95, model token/cost; xử lý D05 toolHealthy trước.
V15.0-11A: reconciled Sales Lite+G2.3/Recovery source branch sau reviewer; signed hosted Auth/Store RLS; native provider verified cross-channel Order continuity chỉ sau staged backup, migration & owner consent.
