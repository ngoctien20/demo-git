# TIEN404 AI — Messenger Rich UI Lab V13.6M

**Ngày:** 15/11/2026 (JST).  
**Trạng thái:** EXPERIMENTAL / DRAFT / OFFLINE / NO SEND.  
**Nhánh:** `work/v136m-messenger-rich-ui-offline-staging-20261115`, tách riêng trên production snapshot (không cập nhật production) `gh-pages@ff2daf970e8209399a28b2d0cade8a33b9fa71c6`.  
**Không có deploy, publish Meta Profile, credential change, n8n mutation, Supabase SQL, chatbot real send, order write, billing.**

## 1. Kiểm toán thực tế trước khi lập trình — VERIFIED

n8n Cloud `ngoctien20.app.n8n.cloud`, workflow **TIEN404_MESSENGER_TEST** ID `Z7FdV7uDvApfbURQ`, **active**, 27 nodes, `versionId=activeVersionId=d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`.

Đã có:
- Verify challenge GET, POST webhook raw body, Crypto HMAC SHA-256 và Timing-Safe Signature gate.
- Giới hạn Page ID; loại echo, deleted, unsupported, anti-duplicate event ID bằng n8n Data Table; session/page/sender ID binding riêng trong demo.
- Messenger AI Agent + model, read-only Products (Google Sheets DEMO), tool tạo/sửa/tra đơn/hỗ trợ; **các tool thuộc DEMO và chưa chứng minh Commerce multi-tenant.**
- Meta Graph `POST /v27.0/{pageId}/messages` gửi **text** với Bearer credential qua n8n; kiểm tra `message_id` và `recipient_id` trước khi ghi event thành công.

Chưa có trong workflow published:
- `generic template` carousel, Quick Replies, ghi Messenger Profile/Persistent Menu, Webview công khai.
- Nhận `message.quick_reply.payload` chưa có parser riêng.
- `postback.payload` chưa được phân loại: mọi postback chưa có text đang được biến thành câu chào `Bắt đầu trò chuyện`. Không được coi đó là xử lý nút thực tế.
- Trusted Page→Tenant→Store backend, tách shop trên cùng Fanpage và sản phẩm/giá/tồn thật; chỉ có một Page DEMO, Google Sheets DEMO. **Không đưa Rich UI vào workflow này trước khi đạt tenant isolation.**

## 2. Nghiên cứu tài liệu Meta (cập nhật 15/11/2026)

- Messenger Quick Start, Generic Template + `messaging_postbacks`: <https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start>
- Bộ API chính thức Meta Messenger trên Postman: <https://www.postman.com/meta/messenger-platform-api/overview>
- Generic Template, Button Template và Persistent Menu tham khảo qua collection chính thức: <https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api>
- Meta Quick Replies: tối đa 13 text choice; `message.quick_replies` khi gửi và `message.quick_reply.payload` khi người dùng bấm.
- Generic Template: `attachment.type='template'`, `template_type='generic'`, thẻ có title/subtitle/image/buttons, tối đa 10 cards, tối đa 3 buttons/card. Các ngưỡng độ dài văn bản ngắn trong lab còn là **giới hạn kiểm tra nội bộ** để giảm lỗi.
- Persistent Menu dùng `Messenger Profile API`, không phải `/messages`; cần Page token/`pages_messaging` và quyền App phù hợp. Bản lab KHÔNG publish profile.
- Webview: dùng HTTPS `web_url` với domain tin cậy. Tính năng Messenger Extensions, whitelist domain, login, cookie và quyền app cần xác minh riêng trước khi bật.
- Không thể tùy ý thay màu/kích thước/thành phần HTML của native Messenger; bản `preview.html` là **mô phỏng web**, không phải UI đã được Meta render.
- Quy tắc messaging window và Meta App Review/Advanced Access cho người dùng bên ngoài app cần xác minh theo phiên bản và Page thực tế. Không coi tương tác nút là giấy phép gửi tin ngoài cửa sổ.

## 3. IMPLEMENTED — Adapter standalone, không gọi mạng

| File | Chức năng | Gate |
|---|---|---|
| `qa/messenger-rich-v136m/adapter.cjs` | Pure payload builders: `buildCarousel`, `buildQuickReplies`, `buildPersistentMenu`, `prepareWebview`; verify/normalize signed user clicks | No Graph calls, không có token, `previewOnly=true` |
| `qa/messenger-rich-v136m/adapter.test.cjs` | Case dương/âm về giới hạn Meta, tiền VND, giá/tồn nguồn thật, tenant/store/PSID/page, URL, HMAC, expiry, Postback/Quick Replies | Test fixtures tổng hợp |
| `qa/messenger-rich-v136m/preview.html` | 4 tab xem thử UI tiếng Việt, ảnh/giá/sản phẩm QA synthetic, nút bấm phát sự kiện trong trang | CSP `connect-src 'none'`, không gửi/ghi |
| `qa/messenger-rich-v136m/preview.test.cjs` | Chromium 360/390/430/768/1280, mở 4 tab & click action, kiểm tra overflow, no external/mutations | Local HTTP only |
| `.github/workflows/v136m-messenger-rich-ui-qa.yml` | Node 22 isolated contract QA + Chromium offline, upload ảnh QA demo | No secrets, no real sends |

Các giới hạn quan trọng:
1. `trusted.source=SERVER_VERIFIED_MESSENGER_BINDING`, `trusted.verified=true`, `serverDerived=true`: không tin `tenant_id`, `store_id`, Page ID hoặc PSID do browser/AI tự gửi. Lab chưa có backend tạo binding thật.
2. Product record phải có `source=SERVER_VERIFIED_SHOP_CATALOG`, `verified=true`, đúng tenant/store; `priceVnd` và `stock` phải là số nguyên an toàn, không ép string `159.000đ` thành giá; không tin giá AI tự sinh.
3. Nút Postback/Quick Reply được ký HMAC SHA-256 bằng secret **chỉ được cung cấp từ server**; ràng buộc Page+PSID+Tenant+Store và hết hạn 15 phút. Browser/Meta không nhận signing secret. Nút menu **cấp Page**, vì vậy chỉ có các lệnh tra cứu/hỗ trợ `T404M1:MENU:*` không được phép ghi dữ liệu.
4. Parser cần `metaSignatureVerified=true` từ webhook signature guard và Page/PSID đúng session. Sau decode còn yêu cầu replay guard/idempotency ở backend **chưa triển khai**, mọi kết quả `allowedMutation=false`.
5. Image URL và Webview origin phải HTTPS, thuộc danh sách origin được phép và không chứa token/PSID trong query. Webview chỉ là catalog công khai; truy cập đơn, tài khoản, thanh toán phải dùng auth+RLS riêng.
6. Menu Profile mutation, Messenger Extensions, native button sending đều **DISABLED**. Không mang payload demo vào workflow Published.
7. **Không tự mở kênh cho nhiều shop trên cùng Fanpage** cho đến khi resolver phân biệt được shop theo page/channel và có chính sách nghiệp vụ rõ ràng.

## 4. QA acceptance

**TESTED — GitHub Actions [run 43706477065](https://github.com/ngoctien20/demo-git/actions/runs/43706477065), commit `d76876e17d01b53c823c36d92f19ff060ca2e234`:**
- `Pure Meta payload and negative trust QA (NO SEND)`: **53/53 PASS, 0 FAIL**; source syntax và cấm transport/token đều PASS.
- `Chromium five sizes and four lab modes (NO SEND)`: **5/5 viewport (360, 390, 430, 768, 1280 px) × 4 tab PASS**; zero external network, zero mutating request, zero Messenger send; 5 screenshot QA tạo trong artifact.
- 2/2 GitHub Actions jobs SUCCESS.
- <https://github.com/ngoctien20/demo-git/actions/runs/43706477065/artifacts/14158268141> — ảnh preview offline, chỉ dùng dữ liệu QA.
- Browser test là **local HTTP + synthetic records**, KHÔNG phải native UI do Meta render và không chứng minh App Review hay delivery thật.

Chỉ yêu cầu re-run CI trên HEAD nếu có chỉnh sửa **source** sau commit trên. Bản sửa báo cáo đơn thuần không thay đổi mã adapter/browser.

Meta live delivery status: **NOT TESTED**, không có quyền thử gửi trong giai đoạn này.

## 5. Cổng mở rộng sau lab

P0: Trusted Tenant Resolver, signed inbound postback/quick_reply handling, server-owned catalog pricing/stock, idempotency+message outbox, Meta policy window guard, Shop A/B isolation (kể cả cùng tenant nhiều store).  
P1: Thử mock staging router bằng clone workflow **inactive**, log/cost ẩn thông tin khách; Client preview trong Staff Panel với menu/quick reply builder và versioned approvals.  
P2: Phê duyệt riêng 1:1 bounded Meta send thử đúng fanpage/nhận thử, sau khi token/app review/consent/24h window được kiểm tra. Không tự gửi hay publish.

## 6. Rollback và ranh giới phê duyệt

Branch hoàn toàn độc lập; chỉ có file mới dưới `qa/messenger-rich-v136m`, `docs/ai-handoff/V13_6M_*` và workflow CI mới. **Rollback** bằng cách đóng Draft PR này, không đụng PR #81/#84/#85, n8n Published, Meta Profile, Supabase, Cloudflare, Render, production, Orders hoặc Billing. Kích hoạt gửi, sửa credential, thay đổi quyền hoặc giới thiệu tính năng vào Core Bot phải xin phê duyệt riêng.
