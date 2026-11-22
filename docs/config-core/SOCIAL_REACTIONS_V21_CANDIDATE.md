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


## 8. Continuation UAT gate / n8n synthetic acceptance (2026-11-22)

**Status: TESTED ISOLATED, LIVE META UAT = BLOCKED (no verified tester message target).**

- Created separate **unpublished** n8n workflow YkVVBQcSsqYdPC9U (TIEN404_V21_SOCIAL_REACTIONS_ISOLATED_QA — NO SEND) in Personal / 90_QA - DIAGNOSTICS.
- Workflow has exactly 2 nodes: Manual Trigger (pinned synthetic inputs) -> Code (pure module from this branch). **No HTTP, webhook, external credentials, database writer, agent, or Send API node.**
- Builder validation: valid=true, nodeCount=2, no warnings.
- n8n test execution **6706**, mode manual, status **success**, 9 synthetic cases:
  - thanks -> ❤️ candidate; praise -> 👍 candidate
  - price question -> pass_through
  - migration approval -> pass_through
  - active human handoff -> pass_through
  - feature disabled -> pass_through
  - cross-Page -> pass_through
  - echo -> skip
  - commerce pending -> pass_through
- Inspected output of Classify reactions - DRY RUN ONLY: 9/9 expected decisions, **every case metaCallExecuted=false** and positive candidates had sendAllowed=false.
- CI previously confirmed: Config Core run 45004416858 PASS (unit, offline PG17), V23 Owner App run 45004416878 PASS. These do not test real Meta reaction delivery.
- Messenger verified at this continuation: Published 47b48f6d-bc3d-40ae-afe6-96c5fd5452ac, Draft b967d427-62e6-40aa-90f4-60d222bb6e03; **unchanged**.
- Live ingress reviewed read-only: recent executions exist but last two were **voice**. They are not a suitable fresh, approved text reaction sample; sender Page scope, tester consent, MID and 24h window must be verified together before a one-off send. No live reaction was attempted.

**Important Meta contract uncertainty:** Graph API v27.0 lists REACT/UNREACT for Page Messages, but its documented top-level payload type is a string while an existing community example passes an object and receives error #100/2018311. The current buildMetaReactionDryRun is therefore an *unvalidated request candidate*, not a production-ready serialization contract. Do not connect it to an HTTP Request node until the exact request shape, permission and result are accepted on an isolated tester account.

**Next acceptance gate:** authorized tester sends a new harmless Messenger text (e.g. "Cảm ơn shop nhé!") to the QA Page while the bot controls the thread; preflight confirms correct Page/MID/PSID and active Meta credential without exporting tokens; send at most 1 controlled reaction with redacted provider outcome, inspect Messenger mobile/web, then revert/flag OFF. If Page or tester cannot be verified, stop with BLOCKED, not a synthetic PASS. A separate owner approval is required before wiring into the live bot.


## 9. Meta v27 single-request live UAT (2026-11-22) — API ACCEPTED, UI PENDING

**Owner consent:** người dùng đã gửi từ tài khoản thử nghiệm và báo "Đã gửi reaction test" theo yêu cầu trong phiên. Không có thao tác gửi với khách khác.

**Nguồn dữ liệu đã kiểm chứng:**
- Messenger DEMO workflow Z7FdV7uDvApfbURQ execution **6707** (2026-11-22 09:23 UTC): inbound text "Cảm ơn shop nhé!".
- Meta HMAC verification và timing-safe verification đều true. Entry Page = recipient Page = extracted Page; sender/mid khớp webhook; không phải is_echo. Page được phép: đúng DEMO. Tin đến trong một giờ khi chạy UAT.
- Published Messenger vẫn **47b48f6d-bc3d-40ae-afe6-96c5fd5452ac**, draft **b967d427-62e6-40aa-90f4-60d222bb6e03**; live bot đã trả lời bằng text như cũ. Không sửa workflow này.
- n8n Personal / 90_QA - DIAGNOSTICS: một workflow riêng, chưa publish, **N8aRqyJtUVKbYsVa** (4 nodes: Manual-only Webhook → strict source/Page/MID/age/consent gate → Meta HTTP Request → redacted result). Reused existing credential TIEN404_META_PAGE_SEND; no tokens copied/exported.
- Chỉ **một** execution **6711** ở chế độ manual, 2026-11-22 09:28 UTC. HTTP POST tới Graph API v27.0 Page Messages bằng sender_action = react, emoji ❤️, và **payload STRING** chứa JSON serialized {message_id, reaction}. Provider response **HTTP 200**, body có recipient_id, không có error. Code normalize providerAccepted=true. Không retry / không gửi tin chữ bổ sung.
- Ngay sau thử nghiệm đã **archive** workflow N8aRqyJtUVKbYsVa, kiểm soát chống gửi lặp. Source project, status của workflow Published DEMO không đổi.
- Bộ tạo body dry-run trong config-core/lib/social-reactions.mjs được cập nhật theo contract thực tế được Meta chấp nhận (payload string, không phải object). Unit + VM tests được cập nhật theo.

**Không suy diễn:** HTTP 200 chứng minh Meta chấp nhận request, không chứng minh ❤️ đã hiển thị trên app Messenger iOS/Android hoặc Messenger web. LIVE UI acceptance = PENDING owner screenshot/observation.

**Tiếp theo:** xác nhận bằng ảnh hoặc báo cáo của người dùng rằng ❤️ nằm trên đúng bong bóng tin "Cảm ơn shop nhé!" trên điện thoại/web (không phải tin nhắn ❤️ mới). Nếu không thấy, điều tra trước khi bật flag. Không mở rộng reaction tự động và không publish bot trong giai đoạn này.

**Rollback:** live one-off đã archive; PR #493 vẫn Draft; không có thay đổi Supabase, giá, đơn hàng, thanh toán, credential hay Published Messenger. Không gửi thêm Meta reaction trước khi có nghiệm thu hiển thị.
