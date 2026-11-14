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
