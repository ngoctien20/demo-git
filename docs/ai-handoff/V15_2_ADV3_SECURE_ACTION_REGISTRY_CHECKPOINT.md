# TIEN404 AI — V15.2 ADV.3 Secure Action Registry × AI Presentation Intelligence

Ngày kiểm toán: 16/11/2026 JST. Lifecycle: **EXPERIMENTAL / DRAFT / NO-SEND / NO HOSTED WRITE / NO PAID MODEL**. Không thuộc Sales Lite mặc định.

## 1. Đối chiếu checkpoint và nguồn

- PR #134 (ADV.1 Policy) OPEN DRAFT, HEAD đã đối chiếu: `867a0232af5be8a20f93555c62ba43f7e64ed214`.
- PR #138 (ADV.2 versioned registry) OPEN DRAFT, HEAD đã đối chiếu: `2cb5128ef4ffce11fb562805b82b698fe396fed5`.
- PR #142 (ADV.3 existing structured output evaluator) OPEN DRAFT; kế thừa PR #138. **Tiếp tục nhánh này**, không tạo lại ADV.3.
- PR #144 (ADV.1/2 registry UI mới hơn, 4 kênh × 13 thành phần) OPEN DRAFT, HEAD `ebc29571c389e982bdc670a85df08157b3106133` là **nhánh song song**, chưa tự động tích hợp vào PR #142. Phải so sánh API/registry và chọn baseline duy nhất trước release.
- n8n kiểm tra chỉ đọc: Messenger RICH UI candidate `X0MwwQ7LRUqfOVjM` inactive; Zalo RichText `qWMu4n1wLkTZBNpI` inactive; Messenger Published `Z7FdV7uDvApfbURQ` active. Không thay đổi workflow.
- Supabase `ifxlvrhyjhbzbrkdsida` đang ACTIVE_HEALTHY PG17.11 theo kiểm tra chỉ đọc. Không thực hiện DDL, SQL ghi, Auth, GRANT, RLS hoặc sao lưu.

## 2. Kết quả triển khai

Đã bổ sung vào PR #142, chỉ thêm tệp:

1. `qa/v147-custom-studio/advanced-secure-action-registry.cjs`: registry hành động; ký **token QA-only Ed25519** bằng khóa test inject; kiểm chữ ký, audience, version, TTL tối đa 120 giây, thời gian hợp lệ, nonce 128 bit, ràng buộc tenant/store/channel/subject/conversation/decision digest; callback QA để xác minh scope và consume nonce nguyên tử; chống replay và cạnh tranh.
2. `qa/v147-custom-studio/advanced-secure-action-registry.test.cjs`: 25 bài kiểm thử có cả sai quyền, không có nút thật, giả mạo owner, payload tamper, stale, cross-store, cross-channel, prompt injection, duplicate/replay, private order, signed link, ZBS, và thử gửi provider.
3. `.github/workflows/v152-adv3-secure-actions-nosend.yml`: chạy 25 bài mới + toàn bộ regression ADV.3/ADV.2/ADV.1; kiểm tra tĩnh NO SEND/NO WRITE/NO PAID.
4. Tài liệu checkpoint này.

**Quy tắc quan trọng:** Một đề xuất AI không có quyền thực thi hành động. Chỉ khi hành động xuất hiện trong UI preview đã bị vô hiệu hóa và được policy phê duyệt mới có thể phát hành **token synthetic QA**. Token hợp lệ vẫn chỉ cho kết quả PREVIEW_ACK_ONLY hoặc CONFIRMATION_REQUIRED_NO_WRITE. Không gọi Meta, Zalo, Supabase, n8n, Commerce writer, provider payment hoặc model API. Điều kiện role customer chỉ là dữ liệu fixture; **không phải chứng nhận danh tính từ nhà cung cấp**. Không cho phép server signature/attestation làm bằng chứng quyền Owner thật.

## 3. QA evidence

- GitHub Actions [Secure Action CI #43798371352](https://github.com/ngoctien20/demo-git/actions/runs/43798371352): **SUCCESS** sau khi sửa lỗi Node.js `KeyObject` tại commit `6716382df772d414781a1249e7bfab2a559f426f`.
- 25/25 Secure Action Registry PASS.
- 18/18 Structured Output Evaluator PASS (bao gồm corpus **96 mẫu oracle synthetic** trong một test; không phải 96 lời đáp thực tế từ AI model).
- 16/16 ADV.2 Channel Registry PASS.
- 30/30 ADV.1 Presentation Policy PASS.
- **Tổng 89/89 unit tests PASS**, No-Send static guard PASS.
- Lượt CI đầu tiên đã FAIL vì Node.js không chấp nhận `crypto.createPrivateKey(KeyObject)`/`createPublicKey(KeyObject)`. Đã sửa cả hai trường hợp: KeyObject test hoặc PEM. Giữ log thất bại và chạy lại, không bỏ test.
- **Không đo accuracy của model thật, token cost, provider P95 latency hoặc network E2E.** Không dùng dataset khách hàng công khai.

## 4. Hạn chế và cổng phê duyệt

G0 Owner/merchant consent và Store ownership G2.3: BLOCKED. G1 Hosted JWT/RLS Shop A/B: BLOCKED. G2 real trusted channel/provider callback HMAC và bot→shop mapping: BLOCKED. G3 persistent atomic nonce/idempotency store: BLOCKED; Set trong fixture KHÔNG được dùng live. G4 backend authorization + Commerce order status/confirmation: BLOCKED. G5 provider entitlement, media URL allowlist, Zalo OA/ZBS paid approval: BLOCKED. G6 model benchmark thực tế, mobile UAT, release review: NOT RUN.

Không tạo đơn, tra đơn cá nhân, gửi thông báo, cấp quyền hay tính phí qua registry ở phiên bản này. Preview ký số không phải webhook production, token thật, hay bằng chứng được gửi từ provider. **Không dùng test signer dưới bất kỳ hình thức nào cho production.**

## 5. Bước tiếp theo

1. Quy về một Channel Capability Registry duy nhất, đối chiếu PR #138/PR #144 rồi xác định API bản canonical; không merge nhánh chéo tùy tiện.
2. Thiết kế private server action gateway với hệ thống xác thực provider, permission per Store, csrf/replay durable và giám sát abuse; chặn khi chưa có hosted RLS.
3. Chạy bộ đánh giá model giá rẻ theo ngân sách được duyệt, tách metric semantic prediction khỏi policy fallback.
4. Xin phê duyệt riêng trước bất kỳ live send, Order/Stock write, credentials, hosted GRANT/RLS/Auth, ZBS hoặc gói phí.

Rollback: revert các commit add-only trên Draft PR #142 hoặc đóng Draft; các PR gốc, n8n, Supabase, Cloudflare và các workflow Published vẫn nguyên trạng.
