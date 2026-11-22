# TIEN404 AI Social Reactions — V21 CANDIDATE (22/11/2026)

**Trạng thái: IMPLEMENTED ở nhánh QA, NO-SEND, NOT RELEASED.**

## 1. Phạm vi đã có

- Pure classifier: config-core/lib/social-reactions.mjs.
- QA unit: config-core/test/social-reactions.test.mjs.
- Trình tạo Code node n8n dạng không gửi: config-core/n8n/build-reactions-code.mjs.
- QA VM cho node được tạo: config-core/test/reactions-bundle.test.mjs.
- Thao tác Meta mới chỉ được **dựng body dạng DRY_RUN_ONLY, sendAllowed=false**; không có HTTP, credential, webhook hay Page ID thật trong các file.
- Messenger Published Z7FdV7uDvApfbURQ: 47b48f6d-bc3d-40ae-afe6-96c5fd5452ac (kiểm tra 22/11); Messenger draft b967d427-62e6-40aa-90f4-60d222bb6e03. Cả hai đều **không được thay đổi** bởi nhánh này.
- Config Core PR #489; Menu QA PR #491; branch mới được tách từ PR #491 để giữ tương thích mà không viết chồng lên hai PR đó.
- AGENTS.md không tìm thấy tại root của nhánh nguồn (không suy diễn thêm quy tắc chưa kiểm tra).

## 2. Hành vi V1

Một lời cảm ơn thuần túy (vd. "Cảm ơn shop nhé") có thể đề xuất ❤️, khen ngắn có thể đề xuất 👍. Các tin nhắn còn lại đều chạy qua đường trả lời cũ, không làm mất tư vấn/báo giá/đặt hàng.

Các guard bắt buộc do **adapter tin cậy** cấp, không được lấy từ chính văn bản khách gửi:

- Meta HMAC đã xác minh; tenant/store và account/Page đã resolve; Page được allowlist cho tenant.
- Message là tin chữ của khách, có MID, PSID, Page ID đúng; không phải echo, postback, comment, voice hay reaction webhook.
- Page vẫn do bot sở hữu hội thoại; còn trong window cho phép của Meta; owner đã bật feature flag riêng cho Page.
- Đã có quyền reaction cooldown từ cơ chế rate limit; không có pending order, payment, approval, privileged action hay human handoff.
- Dedupe phải là unique atomic claim theo [tenant, page, sender, message, react] **trước** outbound send.
- Ưu tiên bất biến: nghiệp vụ, quyền riêng tư và thông tin thật > trải nghiệm emoji.

Tin "Được tiếp tục", "Đồng ý", "OK", "Đặt 2 món", "Cảm ơn, giá bao nhiêu?" **không được** reaction-only. Reaction của khách trên tin nhắn bot chỉ là social signal; không là phê duyệt, không mở công cụ, không tạo đơn hay thay trạng thái thanh toán.

## 3. n8n QA — chỉ chạy trong workflow riêng

Có thể tạo script offline:
node config-core/n8n/build-reactions-code.mjs > /tmp/tien404-social-reactions-qa.js

Gán output này cho một Code node **trong workflow QA không có HTTP node**. Input mỗi item:
{
  "event": {
    "channel":"messenger", "kind":"message", "messageType":"text",
    "tenantId":"tenant-a", "pageId":"1234567", "senderId":"7654321",
    "messageId":"mid.$synthetic", "text":"Cảm ơn shop nhé"
  },
  "gate": {
    "featureEnabled":true, "signatureVerified":true, "tenantResolved":true,
    "pageAuthorized":true, "botOwnsThread":true, "withinMessagingWindow":true,
    "cooldownGranted":true, "allowedPageIds":["1234567"]
  }
}

Output: decision (pass_through, skip hoặc reaction_candidate), dryRun (chỉ cho candidate), metaCallExecuted=false.

Không cho phép sử dụng input test này từ endpoint public để tự đặt các trust flags thành true. Luồng production phải dựng chúng từ webhook HMAC, trusted tenant resolver, Page installation registry và ownership state đã xác minh.

## 4. Meta API gate

Meta v27.0 Page Messages liệt kê sender_action REACT/UNREACT nhưng contract payload cụ thể và khả năng hỗ trợ trên Page/app đang có cần **test real isolated**. Đã có báo cáo lỗi #100 / 2018311 Invalid sender action trên một số cấu hình. Không được coi một body QA là bằng chứng gửi thành công.

Cần owner phê duyệt riêng trước khi:
1. Dùng một Fanpage test + một tài khoản tester được phép, HMAC và quyền App Review phù hợp;
2. Gửi đúng **một** reaction thật, ghi HTTP status + redacted error code + MID liên kết (không log token/PSID raw);
3. Gỡ/tắt thử nghiệm, xác minh luồng fallback khi provider 100/613/190/200;
4. Ghép vào Messenger flow theo feature flag mặc định OFF, không ảnh hưởng menu / voice / human handoff / order tools;
5. Live mobile Messenger + desktop acceptance và rollback.

Thao tác gửi phải đặt sau atomic idempotency claim và phải tắt trong lúc đang có handoff. Không retry tự động khi transport không rõ kết quả.

**Zalo Bot:** chưa có API reaction official xác minh; không gửi mô phỏng qua API tài khoản cá nhân hoặc unofficial SDK. **Web:** có thể xây reaction UI riêng, không nhầm UI local với provider Messenger.

## 5. Chạy QA offline

node --test config-core/test/social-reactions.test.mjs config-core/test/reactions-bundle.test.mjs

CI của Config Core đang chạy node --test config-core/test/*.test.mjs trên pull request thay đổi config-core; không cần secret hay hosted infrastructure. Kết quả chỉ được ghi PASS sau khi xem kết quả workflow thực tế.

## 6. Các rủi ro & điều kiện nghiệm thu

- Tránh reaction-only cho câu vừa cảm ơn vừa nhắc đặt hàng, refund, complaint, OTP, approval.
- Page A không được reaction vào thread Page B; dedupe key không dùng MID đơn lẻ.
- Customer reaction không thay thế consent/owner approval.
- API bị từ chối phải tiếp tục trả lời bình thường, không spam.
- Không lưu PII / Page access token trong public repo hoặc QA artifact.
- Không thay đổi giá, tồn kho, Orders hoặc billing; không dùng credential DEMO cho Commerce.
- Đặt ngưỡng rate limit và chỉ theo dõi số lượng phản ứng được xác minh.
- Không publish Messenger khi chưa có UAT thật và owner duyệt workflow version cụ thể.

## 7. Rollback/checkpoint

- Git: revert riêng nhánh và PR Social Reactions (chưa nhập vào các nhánh released).
- n8n: không sửa draft hay Published, nên không cần rollback runtime.
- Chỉ chuyển giai đoạn CANDIDATE -> APPROVED -> RELEASED sau khi đủ test evidence và owner consent.
- Nếu Meta không hỗ trợ, giữ tính năng OFF; đường trả lời văn bản hiện tại không đổi.

Nguồn Meta: https://developers.facebook.com/docs/graph-api/reference/page/messages
