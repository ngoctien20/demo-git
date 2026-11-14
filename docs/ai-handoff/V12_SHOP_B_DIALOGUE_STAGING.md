# TIEN404 AI — Shop B Zalo Conversation Staging Candidate (14/11/2026 JST)

**Status:** IMPLEMENTED + UNIT TESTED + MANUAL N8N QA · **NOT APPROVED FOR AUTOMATIC SENDING/ORDER WRITES**.

## Checkpoint từ Owner

- Chủ dự án xác nhận **đã nhận đúng tin Zalo Bot F01 giá 199.000đ** sau lần gửi QA duy nhất đã phê duyệt.
- Bằng chứng kỹ thuật trước đó: n8n `Nm2sYvW0cCT2FpWR` execution `3361`, provider ACK `d87d9c1e5d2d0c74553b`, D1 claim `SENT`, quota ngày 14/11 = 1/1.
- Gateway đã rollback về Cloudflare Worker version `38c7df57-8e22-4b79-b5c4-e08b342833c6`; `ZALO_SEND_ENABLED=false`.
- Nghiệm thu này xác nhận **Owner đã thấy nội dung tin cố định**, không xác nhận hệ thống tự động hội thoại hai chiều.

## Kiểm toán nền tảng được kế thừa

- Repo: `ngoctien20/demo-git`, branch gốc `work/v12-r1-shop-owned`, draft PR #34 đang mở.
- Staging Shadow `OgDZNSAvKEvhnAvn` published version `3aeabdb0-79b1-4dca-96bb-c5b0c9c2bee6`, Webhook V1 `yIJk8LvJoLF40Z62`: **giữ nguyên**.
- Supabase `ifxlvrhyjhbzbrkdsida`, `tien404_r1_qa.catalog`: Shop A F01 `159000 VND/stock 3`, Shop B F01 `199000 VND/stock 5`. Không dùng `qa/zalo/engine.cjs` hardcoded fashion F01 159000 cho Shop B.
- Binding Owner B tại `tien404_r1_qa.owner_bindings` đang `paired`, claim `CONFIRMED`, hết hạn 21/11/2026 20:23:15 JST; scope và vai trò phải được tái xác minh tại lúc sử dụng.
- Shop B `dry_run/synthetic_qa`, 2 đơn QA, 2 outbox `HELD/SEND_DISABLED` trước giai đoạn này. Không có quyền gửi chung.

## IMPLEMENTED

- `qa/zalo/shop-b-conversation.cjs`: hàm thuần `turn()`. Nhận `binding`, `event`, `catalog`, `state` **từ backend đáng tin cậy**, không sử dụng Shop ID, chat ID hay giá do người nhắn tự cung cấp.
- Bắt buộc `server_verified`, `owner_binding_confirmed`, `owner_recipient_verified`, đúng tenant/store/bot `qa-tenant-b/qa-store-b/qa-bot-b`, giới hạn thời gian binding và loại tin riêng từ webhook đã chuẩn hóa.
- Mỗi catalog được xác nhận readback và thuộc đúng cửa hàng; bắt lỗi giá/tồn kho sai và dữ liệu chéo tenant.
- Hỗ trợ hỏi giá, tồn kho, sản phẩm không có, hỏi số lượng, xem nháp, huỷ, yêu cầu xác nhận QA chính xác; từ chối giá khách tự đề xuất hoặc lệnh truy cập Shop A.
- **Không tự ghi đơn:** chỉ phát sinh `commit_proposal` sau tin nhắn xác nhận QA đầy đủ và kiểm lại giá/tồn kho. Backend sau này phải kiểm JWT/role, idempotency, giá, tồn, và xác nhận `commit_order_qa` + readback trước khi báo đã tạo đơn.
- `state` có TTL 30 phút, receipt dedupe 32 lượt (đơn luồng); khóa theo owner scope **do backend phát hành**, phải đổi namespace khi Owner được ghép lại.
- Mã xác nhận `issued_confirmation_code` và `issued_order_key` bắt buộc từ backend. **Không dùng mã cố định của fixture trong môi trường kết nối người dùng**. Mã mới phải sinh bằng CSPRNG, 128 bit hoặc hơn, liên kết owner/session và có TTL.

## SAMPLE SIMULATED MULTI-TURN

1. Owner: `Giá F01` → Bot preview: `[SANDBOX-ONLY] Áo thun đen L [QA - B] (mã F01) giá 199.000đ, còn 5 ...`.
2. Owner: `mua F01 2` → Bot preview: `2 × 199.000đ = 398.000đ`; yêu cầu mã xác nhận do backend cấp, **chưa lưu đơn**.
3. Owner: `XAC NHAN QA <mã backend phát hành>` → chỉ sinh `commit_proposal` với expected_total 398000; **chưa ghi Orders**.
4. Trusted backend kiểm tra lại Shop B và transaction rồi mới được ghi đơn `pending_sandbox`; outbox phải `HELD/SEND_DISABLED`. Bước 4 **chưa nối**, không gọi từ mã mới.

## QA EVIDENCE

| Layer | Evidence | Outcome |
|---|---|---|
| GitHub CI | `V12 Shop B Conversation QA (no outbound)`, run `43594606685`, job `132446332702` | 44/44 PASS, 0 fail |
| n8n | `TIEN404_ZALO_SHOP_B_CONVERSATION_QA_STAGING`, workflow `HOTkruOTMmat24eT` execution `3362` | 20/20 simulated fixtures PASS, `outbound_calls:0`, `orders_written:0` |
| Catalog | Supabase staging SELECT `tien404_r1_qa.catalog` | Shop B F01 199000/stock 5; Shop A F01 159000/stock 3 |
| Provider | one-shot `3361` + Owner acceptance in ChatGPT | One fixed message received; **not conversation auto-reply** |

No credentials or real customer data used in new QA workflow. n8n workflow is Manual Trigger and Inactive in Personal / `90_QA - DIAGNOSTICS`. Provider/message/chat IDs are not included in QA result payloads.

## BLOCKED / RELEASE GATES

1. **P0:** Authenticated inbound bridge: V1 normalized webhook → Shop B owner gate → backend catalog readback → isolated session lock & replay protection → no-send preview. Must test on actual inbound (not only fixture) and assert no cross-tenant exposure.
2. **P0:** Per-session CSPRNG confirmation challenge, exclusive session revision/atomic receipt, expiry/re-pair invalidation; current pure function **does not promise concurrency-safe idempotency**.
3. **P0:** Order write bridge requires separate permission: validated preview, explicit confirmation, transactional `commit_order_qa` staging, database readback, `HELD` outbox. No production Orders/Products.
4. **P1:** Outbound auto-reply after real inbound requires **separate Owner approval**, valid Zalo provider policy, actual recipient rights, rate/usage limit, gateway kill-switch and safe fail-closed behavior; no automatic test sends or costs.
5. **P1:** Negative live Zalo QA: duplicate webhook, group chat, wrong Owner, cross-tenant, stale binding, >stock, price conflict, webhook retries, timeout and crash before/after provider ACK.

## Rollback & ownership

New code lives only in a feature branch and draft PR into `work/v12-r1-shop-owned`; close/revert PR if QA fails. No existing published n8n workflow changed, no new DB migration, no Cloudflare Gateway deployment, no end-user external sends in this phase. No actual rollback needed.

**Next recommended safe action:** implement a separate *read-only inbound preview* endpoint for Shop B, route only verified Owner ingress, and log previews to QA staging with redacted identifiers. Do not enable outbound until Owner separately approves auto-replies.


## V12.1.1 — Real inbound Shadow QA preview (14/11/2026 JST)

**Trạng thái:** VERIFIED/IMPLEMENTED/TESTED trên staging. **Không có auto-reply Zalo; không tạo đơn và không thay đổi production**.

### Kiểm toán trước thay đổi

- Active Shadow trước thay đổi: `OgDZNSAvKEvhnAvn` published `3aeabdb0-79b1-4dca-96bb-c5b0c9c2bee6`. V1 webhook `yIJk8LvJoLF40Z62` version `9ef7342b-0623-4921-9969-7d33d112bbef` giữ nguyên.
- Owner Shop B binding `paired`, claim `CONFIRMED`, recipient đúng claim, `dry_run`, expires **21/11/2026 20:23:15 JST**.
- Supabase catalog Shop B F01 `199000/stock 5`; Shop A F01 `159000`. Hai đơn QA và hai outbox `HELD/SEND_DISABLED` của Shop B tồn tại trước thay đổi.
- Cloudflare staging Zalo Gateway version `38c7df57-8e22-4b79-b5c4-e08b342833c6`, `ZALO_SEND_ENABLED=false`, không thay đổi.

### Implemented

- Tạo QA Data Table `TIEN404_ZALO_SHOP_B_CATALOG_SNAPSHOT_QA` (`utCOLub7gJO3pIaZ`) từ **một read-only Supabase SELECT** tại `2026-11-14T12:41:35.598Z`, chỉ chứa dữ liệu sản phẩm QA F01 Shop B, không có PII, không chứa credential.
- Tạo bảng `TIEN404_ZALO_SHOP_B_CHAT_PREVIEW_QA` (`dh0SSc30x3pw4rDx`) chỉ lưu: `slot, outcome, sku, unit_price_vnd, stock, quantity, total_vnd, preview_text, observed_at, catalog_mode`. Không lưu chat ID, token, message ID hoặc nội dung thô của tin nhắn.
- Thêm **4 node mới** vào Shadow sau `Owner gate disabled`: `Route Explicit Shop B Chat QA Only` → `Read Shop B Fresh QA Snapshot` → `Compose Shop B QA Preview No Send` → `Save Sanitized Shop B QA Preview`.
- Diff n8n: 4 node + 4 kết nối, **0 node cũ sửa, 0 node xóa, 0 kết nối cũ xóa**. Nhánh mới chỉ xử lý lệnh Owner chat riêng đã qua Owner Gate và có tiền tố `TEST SHOP B CHAT`.
- Các lệnh hỗ trợ: `TEST SHOP B CHAT F01`, `TEST SHOP B CHAT GIÁ F01`, `TEST SHOP B CHAT MUA F01`, `TEST SHOP B CHAT MUA F01 2`. Lệnh ngoài phạm vi không tác động preview.
- Bản sao catalog có TTL **3 giờ**. Hết hạn sẽ ghi `BLOCKED_STALE_SNAPSHOT` không đưa ra giá hoặc ghi đơn, không làm rò dữ liệu. **Thời điểm hết hạn: 15/11/2026 00:41:35 JST**. Cần đối chiếu Supabase và refresh thủ công trước bài test tiếp theo sau thời điểm này. Không đánh đồng với catalog realtime.

### QA đã chạy

| Bài thử | Execution | Kết quả |
|---|---:|---|
| Mua F01 2 (nháp 398.000đ) | 3363 | PASS — `ORDER_DRAFT_PREVIEW` |
| Mua F01 6 (vượt tồn 5) | 3364 | PASS — `INVALID_QUANTITY` |
| Hỏi giá F01 | 3365 | PASS — `PRICE_PREVIEW` |
| Tin ngoài cú pháp Shop B | 3366 | PASS — không đổi preview |
| Chat ID không có trong allowlist | 3367 | PASS — không đổi preview |
| Mua F01 2 sau kiểm thử âm tính | 3368 | PASS — khôi phục preview nháp |
| Kiểm tra cuối sau sửa fail-closed TTL | 3369 | PASS — `PRICE_PREVIEW` 199.000đ/stock 5 |

Execution 3363–3369 dùng **pin dữ liệu inbound giả lập** nhưng truy cập Data Tables staging thật; **chưa phải bằng chứng Owner đã gửi lệnh hội thoại mới từ điện thoại**. QA GitHub độc lập của conversation candidate: 44/44; manual QA engine: 20/20 (execution 3362).

- Đã publish **riêng Shadow staging** version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`, active và draft khớp. V1 webhook vẫn version cũ.
- Đối soát sau publish: Gateway vẫn `ZALO_SEND_ENABLED=false`; Supabase Shop B vẫn 2 orders + 2 HELD, không có outbox khác HELD. Shop A F01 giữ giá riêng.
- Cảnh báo có sẵn: node `Submit pending claim for Shop B` vẫn có header `apikey` cố định được n8n cảnh báo. Chưa thay đổi credential/security settings trong lượt này.

### Bài nghiệm thu người dùng từ điện thoại (chưa diễn ra)

Trước **15/11/2026 00:41 JST**, Owner đã ghép gửi đúng một trong hai câu riêng biệt tới Bot Shop B:

- `TEST SHOP B CHAT F01`
- `TEST SHOP B CHAT MUA F01 2`

Bot **sẽ không tự phản hồi**. Khi Owner báo “đã gửi”, đối chiếu row `shop_b_chat_preview` có `observed_at` mới hơn execution 3369, và kết quả `PRICE_PREVIEW`/ `ORDER_DRAFT_PREVIEW` tương ứng. Không cần GHÉP lại, không gửi mã xác nhận hay thông tin khách thật.

### Giới hạn & release gates

- **P0:** Hiện mới là lệnh thử đơn lượt có prefix; chưa nối engine hội thoại đa lượt `shop-b-conversation.cjs` vào webhook với state bền vững. Chưa sinh mã xác nhận CSPRNG và chưa gọi RPC tạo đơn từ tin nhắn.
- **P0:** Nguồn catalog QA snapshot chỉ được cập nhật thủ công; phải thay bằng query backend xác thực ở từng bước giá và xác nhận. Không dùng snapshot làm cơ sở cho đơn thật.
- **P0:** Cần atomic session CAS/receipt chống race và xác minh binding quyền theo mỗi request qua backend; n8n Owner Gate allowlist là một trong các lớp bảo vệ, chưa đủ để thương mại hóa.
- **P1:** Kích hoạt outbound auto-reply Zalo đòi hỏi phê duyệt riêng, kiểm tra chính sách provider, quyền Owner và giới hạn sử dụng.
- **P1:** Ghi đơn sandbox cần xác nhận qua backend, giá/tồn kho realtime, idempotency, readback và outbox vẫn `HELD`; không ảnh hưởng production.

**Rollback:** Nếu có regression, khôi phục và publish Shadow version `3aeabdb0-79b1-4dca-96bb-c5b0c9c2bee6`; dữ liệu QA snapshot/preview giữ lại làm evidence, không xóa. Không cần thay đổi webhook V1, Cloudflare hoặc Commerce production.


### QA bổ sung — Mốc chặn catalog cũ

- **Execution 3370: PASS**. Pin bản sao F01 với `snapshot_at=2026-11-10T00:00:00Z` (chỉ dữ liệu giả lập cho test). Workflow ghi `outcome=BLOCKED_STALE_SNAPSHOT`, `catalog_mode=QA_SNAPSHOT_EXPIRED`, giá trả về `0` với nội dung *không báo giá, không tạo đơn*. Đây là chặn dữ liệu cũ, **không phải mức giá của sản phẩm**.
- **Execution 3371: PASS**. Sau đó bỏ pin snapshot cũ, n8n đọc snapshot staging hiện có, phục hồi đúng `PRICE_PREVIEW`, F01 giá 199.000đ, tồn QA 5; snapshot gốc `2026-11-14T12:41:35.598Z` không bị sửa.
- Hai bài kiểm thử đều chạy bằng pin input tổng hợp, không gửi Zalo hay gọi Order Service; không làm mất dữ liệu catalog/sandbox.


## V12.1.2 — Hai tin Owner gửi từ Zalo: chưa thấy cập nhật trong trace

**Ngày kiểm tra:** 14/11/2026, khoảng **22:05 JST**. Chủ dự án đã xác nhận **"Đã gửi 2 tin"** theo kịch bản `TEST SHOP B CHAT F01` và `TEST SHOP B CHAT MUA F01 2`. Đây là xác nhận thao tác của chủ dự án, **chưa phải bằng chứng webhook đã nhận hoặc xử lý**.

### VERIFIED (read-only connector QA)

- n8n workflow `TIEN404_ZALO_V2_SHADOW_STAGING` `OgDZNSAvKEvhnAvn` **active/published** version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`. Workflow V1 `yIJk8LvJoLF40Z62` **active/published** `9ef7342b-0623-4921-9969-7d33d112bbef`. V1 webhook `POST tien404-zalo-bot-lab-v1` dùng headerAuth, phản hồi HTTP trước khi gọi subworkflow Shadow.
- n8n Data Table `TIEN404_ZALO_SHOP_B_CHAT_PREVIEW_QA` `dh0SSc30x3pw4rDx`: vẫn chỉ có **một** row `shop_b_chat_preview`, `outcome=PRICE_PREVIEW`, `quantity=0`, `total=0`, `observed_at=2026-11-14T12:52:22.792Z` (**21:52:22 JST**). Đây là kết quả **execution 3371** mô phỏng trước khi Owner báo gửi tin, không chứng minh bài thử trên điện thoại.
- n8n Data Table `TIEN404_QA_SHOP_B_PAIRING_TRACE` `e7eJAGSwzn67aA1z`: `slot=inbound` cuối `2026-11-14T12:52:23.041Z`; `slot=owner_gate` cuối `2026-11-14T12:52:22.917Z`. Không thấy cập nhật mới sau bài thử từ điện thoại. Trace `shop_b_owner_probe` vẫn là bài thử cũ ngày 14/11 lúc 20:59 JST.
- n8n execution search không có execution mới từ webhook: workflow hiện cấu hình `saveDataSuccessExecution=none`, `saveDataErrorExecution=none`, `saveManualExecutions=false`. Do đó không thể lấy execution log làm bằng chứng âm tính về tin nhắn người dùng.
- Owner allowlist `ALLOWED_STAGING_OWNER` vẫn **còn hiệu lực**, đến `2026-11-20T13:17:32.511Z`. Supabase Shop B Orders vẫn **2** (không tạo đơn từ hai tin). Cloudflare gateway đang ở version `38c7df57-8e22-4b79-b5c4-e08b342833c6` và `ZALO_SEND_ENABLED=false`.

### TEST RESULT & BLOCKER

**Kết quả: BLOCKED / NOT VERIFIED** cho bài thử Owner-device inbound. Không tuyên bố 2/2 tin đến webhook, không đánh dấu PASS, không yêu cầu Owner ghép lại và không gửi phản hồi Zalo. Hai giả thuyết cần phân biệt: (1) nhà cung cấp không gọi/không xác thực được webhook, (2) tin đã đến nhưng lỗi ở chuyển tiếp hoặc ghi trace. Chưa có bằng chứng xác nhận nguyên nhân.

### Khắc phục được đề xuất (chưa thực thi)

1. Kiểm tra cấu hình webhook Bot Zalo trong dashboard/provider, trạng thái subscription, HTTP status/last delivery, đúng địa chỉ HTTPS và headerAuth — **không lộ webhook secret**.
2. Bổ sung **telemetry chỉ đếm, không ghi nội dung/PII** tại webhook V1 staging để phân biệt HTTP receipt → normalized/accepted → Shadow gate; đảm bảo không thay đổi đáp ứng HTTP, có rollback version và QA riêng.
3. Chạy lại một sự kiện được Owner chủ động gửi **sau** khi telemetry đã kiểm thử; xác minh cả hai code paths và lúc nhận. Không yêu cầu gửi lại trong khi chưa xác định đường webhook.
4. Catalog snapshot QA hết hạn `2026-11-14T15:41:35.598Z` (00:41:35 JST ngày 15/11); refresh từ Supabase trước test tiếp theo nếu quá hạn, không tái sử dụng dữ liệu cũ làm giá thật.

**Rollback/production:** Chưa có bất kỳ sửa đổi code, published workflow, credential, dữ liệu đơn thật, gateway hoặc outbox trong lượt đối soát này; chỉ cập nhật checkpoint. Các automation gửi vẫn khóa.


## V12.1.3 — Zalo webhook live-ingress repair / diagnostics (14 Nov 2026 JST)

**Vấn đề:** Owner đã báo gửi hai lệnh `TEST SHOP B CHAT F01`, `TEST SHOP B CHAT MUA F01 2`. Không có marker mới sau execution 3371; không thể nghiệm thu dựa trên lời xác nhận gửi tin và test mô phỏng. V1 trước đó tắt lưu execution thành công/lỗi nên thiếu log nhận sự kiện.

### Audited, no external sends

- **Provider Zalo Bot API `getWebhookInfo`** qua Cloudflare staging: n8n workflow `TIEN404_ZALO_SHOP_B_WEBHOOK_DIAGNOSTICS_STAGING` `bD510xyr5jBHQ99K`, execution **3372 SUCCESS**, `has_webhook=true`, URL HTTPS trỏ chính xác `ngoctien20.app.n8n.cloud/webhook/tien404-zalo-bot-lab-v1`, không phải `webhook-test`. **Không sửa webhook, không gửi tin**.
- Cloudflare Gateway diagnostic-only version `74a4d872-a1e6-420e-9d9c-2cb92c60dbdc`, được deploy lên staging với 6 bindings/secret kế thừa, `ZALO_SEND_ENABLED=false`. API chẩn đoán `/v1/webhook-diagnostics` chỉ gọi `getWebhookInfo`. Thay đổi tạm thời trước đó phục vụ gửi F01 một lần đã không còn trong phiên bản này. Bản rollback gốc `38c7df57-8e22-4b79-b5c4-e08b342833c6` còn lưu.
- V1 webhook `yIJk8LvJoLF40Z62` giữ node `Zalo Bot Webhook (Protected)` headerAuth, `Validate & Normalize Event (Read Only)`, `Ack Zalo (No Message Sent)` và `Zalo V2 Shadow` **không sửa**. Bổ sung đúng 2 node song song: `V1 Private Ingress QA Meter (No PII)` → `Upsert V1 PII-Free QA Markers`. Bản mới `08f22ee1-cf5a-4459-bd33-bf80ac67af0e` đã publish. Diff so với `9ef7342b-0623-4921-9969-7d33d112bbef`: +2 node, +2 kết nối, 0 node sửa/xóa, 0 link xóa. n8n đã tự bỏ nhóm node trang trí `Event intake — read only` khi thêm nhánh, nhưng không bỏ node chức năng.
- QA marker lưu **chỉ** `slot`, `outcome`, `observed_at`, không lưu Chat ID, người gửi, message ID, token hay văn bản tin. Các slot: `v1_ingress_any`, `v1_shop_b_price_cmd`, `v1_shop_b_order_cmd`. Marker chung chỉ nói request vượt qua HeaderAuth và được normalize, **không tự chứng minh do Zalo thật gửi**.
- Execution **3375**: n8n test_workflow với pin fake event thành công, ghi `v1_shop_b_order_cmd`. Đây là fixture, không phải tin từ Owner.
- Tạo workflow thủ công `TIEN404_ZALO_V1_WEBHOOK_HTTP_AUTH_PROBE_STAGING` ID `RnbsXSriPcythZjq`; dùng credential webhook staging đã có dưới dạng reference, gửi một POST tổng hợp không có PII tới chính URL staging. Execution **3377 SUCCESS**, HTTP **200**, body `{ok:true}`; `v1_ingress_any=ACCEPTED` được readback, Owner Gate **denied** người gửi giả đúng thiết kế. Không tạo đơn, không gửi trả lời Zalo.

### Telegram screenshots provided by Owner: independent issue

Các ảnh là n8n workflow Telegram `AI_SALES_V4_3_TELEGRAM_CHAT_DIAGNOSTIC_STAGING`, ID `nAHHoEEMEhYkujys` và credential `Telegram account` (không phải Zalo Bot API). Execution **2680 ERROR** `The resource you are requesting could not be found` giải thích ảnh chụp; execution **2681 SUCCESS** (read-only Chat ID match, type private, valid for private notification, 0 sends) chứng minh đã qua bước đó. Notification V4.5 Telegram exec 2686 sau đó có API ACK. **Không tự thay token hay chuyển Chat ID Telegram sang Zalo**.

### Status & next owner acceptance

- **VERIFIED:** Zalo provider có đúng URL webhook; n8n header-auth live endpoint hoạt động với request synthetic; Owner pairing Shop B valid tại lần kiểm tra; Shadow staging version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a` không sửa.
- **NOT VERIFIED:** hai tin Owner gửi trước telemetry mới; chưa có Zalo provider-origin event sau khi bật telemetry. Không thể kết luận nguyên nhân từ token, URL hay app khi chưa có sự kiện mới. Không tuyên bố đã sửa xong hai chiều.
- **NEXT:** Owner gửi một lệnh QA **mới** vào đúng Zalo Bot Shop B từ tài khoản Owner đã ghép, trước khi catalog QA snapshot hết hạn **15/11/2026 00:41:35 JST**: `TEST SHOP B CHAT MUA F01 2`. Sau khi Owner báo đã gửi, đọc `v1_shop_b_order_cmd` thời gian **sau 22:25 JST**, Owner Gate `eligible`, `shop_b_chat_preview=ORDER_DRAFT_PREVIEW`, total `398000`. Nếu `v1_ingress_any` không đổi, tập trung vào provider-to-n8n / header secret; nếu `v1_ingress_any` đổi nhưng preview không đổi, sửa normalizer hoặc Shadow.
- Không kích hoạt `sendMessage`, không chạm Orders/Products production, không đổi provider `setWebhook`, không kích hoạt phí. Phần gửi trả lời tự động vẫn cần phê duyệt riêng.

**Rollback:** n8n V1 quay về published version `9ef7342b-0623-4921-9969-7d33d112bbef` nếu telemetry phát sinh regression; Cloudflare diagnostic worker quay về `38c7df57-8e22-4b79-b5c4-e08b342833c6`. Trước rollback phải xác minh version thật và giữ lại QA evidence.


## V12.1.4 — Owner repeat live Zalo chat: provider delivery or secret mismatch remains unverified

**Ngày:** 14/11/2026 JST (sau 22:38). Owner xác nhận đã gửi lại `TEST SHOP B CHAT MUA F01 2` vào bot đang ghép. **Nghiệm thu chưa PASS** vì không có dấu mới từ provider; không đánh đồng mẫu synthetic với Zalo device ingress.

### Verified observations

1. Đọc trực tiếp n8n Data Table `e7eJAGSwzn67aA1z` và preview `dh0SSc30x3pw4rDx` sau lời xác nhận của Owner:
   - `v1_ingress_any`: cuối `2026-11-14T13:25:48.591Z` (**22:25:48 JST**), là probe HTTPS giả lập có xác thực trong n8n execution `3377`.
   - `owner_gate=denied`: `13:25:48.329Z`, đúng với chat giả lập không được phép từ execution `3377`.
   - `v1_shop_b_order_cmd`: `13:20:57.227Z` (pin/mock execution `3375`).
   - `shop_b_chat_preview=ORDER_DRAFT_PREVIEW`, total `398000 VND`: `13:20:56.543Z` (pin/mock). **Không có marker sau 22:25:48 JST**.
2. **NEW: getMe + getWebhookInfo** qua Cloudflare Worker phiên bản diagnostic-only `ef7b7a33-5551-48e0-954b-646c047b5c6d`, n8n `bD510xyr5jBHQ99K` execution **3380 SUCCESS**: API Bot trả name **`Bot TIEN404 AI`**, giống tên trong ảnh chụp Bot Creator Owner đã cung cấp; Webhook URL của bot trỏ đúng `https://ngoctien20.app.n8n.cloud/webhook/tien404-zalo-bot-lab-v1`; `provider_ack=true`, `external_sends=0`, `configuration_changes=0`. Đây chỉ chứng minh **bot/token identity và webhook configured URL**, không chứng minh provider đã POST từng event.
3. n8n V1 `yIJk8LvJoLF40Z62` active/published `08f22ee1-cf5a-4459-bd33-bf80ac67af0e`; Shadow `OgDZNSAvKEvhnAvn` active/published `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`. V1 có `httpHeaderAuth` credential `TIEN404_ZALO_WEBHOOK_STAGING_V2`, metadata ID `HEkVpC6qHYZpLG9r`; không đọc secret hoặc header value.
4. Synthetic HTTP POST tới V1 qua n8n credential cùng tên đã trả HTTP 200, chứng minh **n8n có thể nhận request khi ký đúng credential n8n**. **Không** xác minh secret do Zalo Bot Creator hiện cấu hình có khớp credential n8n; Zalo thường gửi header `X-Bot-Api-Secret-Token`, cần review headerName+secret locally. Nguồn: https://docs.zaloplatforms.com/zalo-bot và Zalo Bot SDK webhook documentation.
5. Cloudflare gateway `ZALO_SEND_ENABLED=false`, 6 binding hiện hữu; không bật gửi. Supabase `qa-store-b` giữ `2` sandbox orders, `2` outbox `HELD/SEND_DISABLED`; không có state khác; F01 `199000 VND`, stock `5`. Không có tin outbound hoặc đơn được tạo trong lần kiểm tra này.

### Root-cause classification

- **VERIFIED:** đúng bot/token, đúng webhook configured URL, synthetic authorized HTTP V1 → Shadow marker hoạt động.
- **BLOCKED / UNKNOWN:** Provider-origin POST có đến n8n hay không, response HTTP 401/403 trên provider delivery, và `X-Bot-Api-Secret-Token` của Zalo Bot Creator có khớp HeaderAuth credential của V1 không. Không thể đọc, suy đoán hoặc log secret. Không tự đổi credential hoặc gọi `setWebhook` vì đây là thay đổi bảo mật cần owner phê duyệt.
- **NEXT OWNER ACTION (non-secret):** Mở Zalo Bot Creator → Bot TIEN404 AI → Thiết lập chung, xác nhận URL vẫn trỏ đúng `/webhook/tien404-zalo-bot-lab-v1`. Trong n8n, mở Credentials → `TIEN404_ZALO_WEBHOOK_STAGING_V2`, kiểm tra **Header Name = `X-Bot-Api-Secret-Token`**; so sánh *trực tiếp trong giao diện riêng*, không gửi secret vào chat. Nếu khác, Owner phê duyệt chỉnh credential bằng quy trình backup + rollback. Nếu Zalo có logs delivery/HTTP status, chỉ cung cấp status code (không gửi token).
- Khi đã xác minh/điều chỉnh secret, refresh QA catalog từ read-only Supabase trước khi chạy lại nếu snapshot hết hạn lúc **15/11/2026 00:41:35 JST**. Sau đó gửi **một** lệnh mới `TEST SHOP B CHAT MUA F01 2`, yêu cầu marker `v1_shop_b_order_cmd` mới + `owner_gate=eligible` + preview `ORDER_DRAFT_PREVIEW` 398000; no-send/no-order-write.

**Rollback:** Cloudflare diagnostic version trước `74a4d872-a1e6-420e-9d9c-2cb92c60dbdc`, original locked Gateway `38c7df57-8e22-4b79-b5c4-e08b342833c6`, Shadow/V1 rollback versions trong V12.1.3. No production, credential, secret, Zalo API webhook configuration or orders touched in this subphase.
