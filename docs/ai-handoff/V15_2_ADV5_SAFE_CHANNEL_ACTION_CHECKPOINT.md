# TIEN404 AI — V15.2-ADV.5 CHECKPOINT
Ngày: 16/11/2026 (JST)
Phân loại: EXPERIMENTAL / DRAFT / NO-SEND / SOURCE-ONLY / KHÔNG PHÁT SINH CHI PHÍ API
Phạm vi: Advanced Experience add-on, **không mặc định đưa vào Sales Lite**.

## 1. VERIFIED — Trạng thái đầu vào
- PR #145 được kiểm tra ở HEAD `5fd3298b2e7ff5b6bed74bb6af4484d96100542c`, 6/6 GitHub Actions SUCCESS; vẫn là Draft, chưa merge.
- PR #142 (ADV.3) có HEAD thay đổi sau checkpoint trước; tuyệt đối không giả định đã đồng bộ vào PR #145. PR ADV.5 là nhánh con chính xác của PR #145, không tự rebase hoặc merge các nhánh khác.
- PR #138 (ADV.2) còn Draft.
- Không sửa n8n Published, Supabase hosted, Cloudflare staging/production, Meta/Zalo OA/Bot, credential, billing và dữ liệu khách hàng.

## 2. IMPLEMENTED — Safe Channel Adapters
- `qa/v147-custom-studio/advanced-safe-channel-adapters.js`: trình chuyển đổi preview dùng **ADV.3 trusted evaluator** và **ADV.2 capability registry** làm nguồn duy nhất, không nhận một object quyết định tự xưng đã tin cậy từ client.
- Bốn kênh:
  - Messenger: văn bản, cấu trúc thẻ generic 1 sản phẩm, nhãn quick replies dưới dạng hint; không có người nhận, token postback, ảnh URL, endpoint gửi.
  - Zalo Bot: văn bản và `text_styles` có kiểm tra vị trí UTF-16 trong chuỗi JavaScript; không tạo nút/carousel native chưa kiểm chứng, không gọi sendPhoto.
  - Zalo OA: chỉ văn bản fallback; CTA, menu, ZBS bị khóa; không coi tài liệu công khai là quyền tài khoản.
  - Website Widget: plain text + semantic spans, thẻ sản phẩm từ fixture đúng Store; không có HTML thô, link/ảnh bên ngoài.
- Mọi output chứa `delivery.canSend=false`, `delivery.providerPayload=null`, `recipient=null`, `credential=null`, `actionExecutable=false`, `providerSends=0`, `hostedWrites=0`.
- Đây **không phải provider payload đã chứng nhận hoặc endpoint thực thi**.

## 3. IMPLEMENTED — Signed Action Registry, chỉ phía server
- `qa/v152-advanced-actions/signed-action-registry.cjs` dùng Node `crypto`, HMAC-SHA256, `timingSafeEqual` và domain separation.
- Token có phiên bản `T404_ACTION_V1` và `kid` để xoay khóa; cấm sử dụng trong browser.
- Phạm vi bắt buộc: `tenant_id`, `store_id`, `channel`, `subject_id`, `recipient_binding`, `action`, `resource_ref`, `iat`, `exp`, `jti`.
- TTL tối đa 5 phút. Mỗi token có nonce ngẫu nhiên; tiêu thụ phải kiểm tra lại danh tính, vai trò và callback `nonceStore.claimOnce` nguyên tử, dùng một lần.
- `resolveVerifiedContext(request)` phải lấy danh tính từ JWT đã xác thực hoặc binding kênh xác thực tại server, không phải trường `verified:true` do client gửi. `authorize` bắt buộc ở cả giai đoạn phát và tiêu thụ; có thể chặn nếu quyền đã bị thu hồi.
- Cấu trúc action được cho phép: CATALOG, QUOTE, ORDER_REQUEST (chỉ nhắc khách xác nhận, **không tạo đơn**), ASK_STAFF, POLICY.
- TRACK_ORDER, CREATE_ORDER, UPDATE_STOCK, ADMIN, BILLING và mọi hành động không cho phép bị từ chối.
- Thành công trả về `VERIFIED_CLAIMED_NO_EXECUTION`. Không có thực thi business tool hoặc gửi nhà cung cấp.
- Test `createEphemeralQaClaimStore` chỉ dùng trong cùng một tiến trình Node và không bền qua restart/multi-instance; **tuyệt đối không tái sử dụng để bảo vệ production**.
- `recipient_binding` trong tương lai phải là định danh không tiết lộ PII, do server xác minh và ràng buộc; không ghi phone, PSID, token hoặc secret thật vào GitHub. Khóa ký phải lấy từ hệ thống secret manager.
- Khi tích hợp thực, cần transactional DB/DO claim với UNIQUE key và đồng bộ với xử lý nghiệp vụ theo mô hình idempotent, thời gian lưu đủ qua cửa sổ token/retry.

## 4. TESTED — QA và nguồn bằng chứng
- 96 tình huống Shop A/B/C x Messenger/Zalo Bot/Zalo OA/Website x 8 ý định: kiểm tra không gửi, không ghi, không chéo Store.
- HMAC: chống giả chữ ký, sửa payload, sai tenant/shop/channel/recipient/subject, hết hạn, khóa xoay vòng, xác thực/role thất bại, nonce replay, nhiều yêu cầu đồng thời.
- Negative: giả giá, SKU, tenant, postback, URL, SQL, yêu cầu ZBS chưa duyệt, lộ thông tin đơn.
- CI GitHub `v152-adv5-channel-actions-nosend-qa.yml`: server Node test, adapter Node test, hồi quy ADV.2/ADV.3/ADV.4, kiểm tra CSP, Playwright bốn kênh trên màn hình nhỏ/lớn và chạy lại sáu kích thước ADV.4.
- Chỉ công bố **TESTED** với từng job đã SUCCESS trên HEAD chính xác, không lấy kết quả từ commit cũ.
- Không đo AI accuracy/latency/token cost, provider API ACK, JWT/RLS hosted hoặc E2E Messenger→Zalo Commerce.

## 5. P0/P1 — GATE CHƯA ĐẠT
P0: Tài khoản Owner và Store JWT/RLS hosted độc lập, chặn chéo Shop A/B và RPC có quyền cao.
P0: Shared Order Lookup từ Commerce QA với xác minh người dùng Messenger/Zalo đã đồng ý liên kết.
P0: Controller approval và backup riêng trước migration hay quyền production.
P1: JWT/identity resolver và `authorize` server được triển khai với bằng chứng thực.
P1: Nonce durable atomic claim (DB/DO/transaction), chống gửi trùng và replay qua multi-instance/restart.
P1: Xác minh entitlement/capability của Meta Page, Zalo Bot, Zalo OA và cấu hình mẫu tin/phí.
P1: QA model giá rẻ thực, ngân sách, chuẩn đo model latency và chi phí.
P1: Owner mobile UAT, provider one-shot sau phê duyệt.

## 6. Quyền phê duyệt
Không cần phê duyệt để phát triển và kiểm thử nội bộ Draft/No-Send. Cần phê duyệt riêng trước khi thay đổi hosted DB/GRANT/RLS, đưa secret vào backend, phát sinh phí API, gửi provider thật, liên kết danh tính người dùng hoặc publish.

## 7. Rollback
Đóng PR #152 hoặc hoàn tác nhánh `work/v152adv5-safe-adapters-signed-actions-nosend-20261116`.
Không có Supabase migration, Cloudflare deploy, workflow edit hoặc sản xuất nên không cần phục hồi dữ liệu hosted.

## 8. Next executable milestone
**V15.2-ADV.6 — Durable Claim Design × Server-Verified Identity Connector × Real Channel Entitlement Preflight** trên staging No-Send:
định nghĩa giao diện nonce store bền vững, migration draft riêng chưa áp dụng, truy xuất danh tính JWT thực QA khi được phép; provider preflight chỉ đọc và ma trận tính năng, không send. Giữ Sales Lite tối giản.

Tham khảo bảo mật: https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html
