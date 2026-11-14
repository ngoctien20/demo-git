# Shop B — réception de la commande GHÉP / staging

14/11/2026. Workflow OgDZNSAvKEvhnAvn. Draft 2717b45d-4396-42f6-bf3a-c5982d5948e4. Published và mốc rollback 7f100319-b820-4f02-a52b-85cd8e0c7e25. Draft nhận dạng lệnh sau Owner Gate, chưa chuyển sang backend. Execution n8n 3345 dùng fixture. Sáu ca parser được chạy độc lập. SQL candidate được tạo, test thiếu credential bị từ chối trong giao dịch rollback. Chưa deploy RPC. Chưa chứng minh HTTP positive, retry hoặc pairing đầu cuối. Cần Header Auth riêng n8n và key tương ứng trong Supabase Vault. Gateway chỉ chuyển yêu cầu pending cho QA Shop B, xác nhận do Owner thực hiện trên Dashboard. Không replay mã từ phiên cũ. Phục hồi draft từ Published nếu cần.

## Shop B sẵn sàng thử từ điện thoại · 14/11/2026 JST
Vault và credential Header Auth riêng đã được cấu hình cho tenant staging. RPC qa_shop_b_zalo_claim chỉ tạo pending của Shop B. Execution 3346 dùng fixture với credential và database staging thật, đọc lại một pending. Execution 3347 chạy lại cùng sự kiện, số pending vẫn là một. Fixture đã hết hạn trước khi mời Owner thử. Chưa xác nhận từ điện thoại. Shadow published a0542183-67be-461d-9d00-c409ab27d2e6; rollback Shadow về 7f100319-b820-4f02-a52b-85cd8e0c7e25. Render dep-dbs448ui0phs73c2ikg0 live 5f121a6c0c402dc5bde679ef48e4db0725040643; rollback giao diện về dep-dbs36d49v7es73bijjf0. Để khóa riêng RPC, thu hồi EXECUTE của anon. Không có bước gửi Zalo trong nhánh ghép. Bước kế tiếp: Owner Shop B gửi một mã mới, kiểm tra pending và xác nhận trên Dashboard.

## VERIFIED — Owner Shop B xác nhận trên Dashboard

Ngày 14/11/2026, Owner báo Dashboard hiện “Đã ghép nối”. Supabase staging xác nhận lúc 20:23:15 JST: claim CONFIRMED, binding paired còn hiệu lực, đúng yêu cầu và đúng tham chiếu người nhận của qa-bot-b. Binding hết hạn lúc 20:23:15 JST ngày 21/11/2026. Đây là nghiệm thu ghép Owner của Shop B. Mốc tiếp theo là bản xem trước thông báo đơn sandbox tới Owner Shop B với outbox HELD; chưa nghiệm thu gửi thông báo thực tế.


## VERIFIED — Shop B sandbox order notification preview HELD (14/11/2026 JST)

**Scope:** Supabase staging `ifxlvrhyjhbzbrkdsida`, schema `tien404_r1_qa`. Không gửi Zalo thật, không sửa Messenger production, không cập nhật đơn thật.

- Trước khi tạo đơn: kiểm tra trực tiếp `owner_bindings` + `owner_pairing_claims_v3`: `qa-tenant-b / qa-store-b / qa-bot-b` = `paired` + `CONFIRMED`, binding chưa hết hạn; challenge, recipient, owner và timestamp đều khớp. Người nhận thuộc namespace QA `qa-recipient-%`, không đưa định danh ra log.
- Bot giữ `enabled_mode = dry_run`; catalog Shop B có SKU `F01`, giá **199000 VND**, tồn kho **5**.
- Chỉ tạo **một** đơn qua RPC `tien404_r1_qa.commit_order_qa` (không gọi lại RPC sau khi thành công): `QA-B-OWNER-HELD-20261114-01`, session/confirmation/idempotency QA chuyên biệt, SKU F01 x 1, expected_total 199000 VND, confirmed=true. RPC trả `CREATED` và event `order_sandbox_saved:qa-tenant-b:qa-store-b:qa-bot-b:QA-B-OWNER-HELD-20261114-01`.
- Post-write readback bằng SELECT JOIN `sandbox_orders` → `owner_outbox` → `owner_bindings` → `owner_pairing_claims_v3`: đơn có `pending_sandbox`, `synthetic_qa`, tổng 199000 VND. Outbox `channel=zalo_bot`, `state=HELD`, `hold_reason=SEND_DISABLED`, message preview có prefix `[SANDBOX-ONLY]`.
- Xác minh `recipient_ref` **bằng** recipient binding mới và `recipient_owner_ref` **bằng** owner_ref binding mới. Claim CONFIRMED và pairing còn hiệu lực. `event_key` khớp đơn QA.
- Đối soát kết quả: **Shop A: 2 đơn + 2 outbox; Shop B: 2 đơn + 2 outbox**. Mã đơn mới có đúng **1 order + 1 outbox**, tổng số outbox lệch HELD = **0**. Tồn kho Shop A vẫn 3, Shop B vẫn 5; không trừ tồn kho ở bước QA.
- Đây là **VERIFIED / TESTED trên Supabase staging (DB backend E2E)** cho đơn QA → preview đúng Owner → HELD; **không** chứng minh tin đã gửi/đã nhận/đã đọc trên Zalo và **chưa** là nghiệm thu giao diện Dashboard hiển thị preview tới người dùng.

**Control Hub:** Mục `Ghép Owner Zalo cho Shop B QA` có bằng chứng đủ điều kiện đánh dấu hoàn thành. Việc cập nhật checkbox thật trong giao diện Control Hub **chưa xác minh**; tránh tuyên bố đã đồng bộ. Mục `Sandbox order → HELD preview đúng Owner` đạt DB QA, UI preview acceptance còn cần xác minh riêng.

**Rollback:** Đây là dữ liệu chỉ trong schema staging QA, không thực hiện rollback xóa vì cần giữ bằng chứng và đối soát. Không tự thay đổi bảng Production, Zalo sender, credential hoặc outbox state.

**Next gate:** Đọc màn hình preview từ Dashboard dưới session Owner Shop B thật; đảm bảo chỉ Shop B thấy đơn, không lộ Owner A; tiếp tục cơ chế Zalo send disabled cho đến khi có phê duyệt riêng. Không yêu cầu Owner gửi thêm mã Zalo.


## READY — TEST SHOP B F01 từ Zalo Bot (14/11/2026 JST)

**Phạm vi:** n8n `TIEN404_ZALO_V2_SHADOW_STAGING` `OgDZNSAvKEvhnAvn` là staging-only Shadow được gọi bởi Webhook V1 `yIJk8LvJoLF40Z62`. Không phát hành production Commerce, không gửi tin bot, không ghi đơn từ lệnh Zalo và không tạo mã ghép mới.

- Pre-change published version `2533f350-3053-47f7-8349-59f0e2f4f433` giữ làm **rollback snapshot**.
- Chỉ sửa Code node `QA marker 1` sau Owner Gate, thêm **exact text** `TEST SHOP B F01`: lệnh hợp lệ từ chat riêng đã qua allowlist ghi riêng `slot=shop_b_owner_probe`, `outcome=eligible`; otherwise logic cũ `slot=owner_gate` vẫn giữ. Không lưu raw chat ID, token hoặc nội dung tin.
- QA pure-code: 8/8 case (eligible, deny, lowercase, Shop A, pairing, group, malformed, prompt injection) PASS. n8n synthetic test execution `3357` status SUCCESS; staging trace `shop_b_owner_probe=eligible` đã readback. **Đây là test mô phỏng, không phải tin từ điện thoại.**
- Published staging Shadow mới: `3aeabdb0-79b1-4dca-96bb-c5b0c9c2bee6`; verified active. Webhook V1 vẫn giữ version cũ, lệnh `GHÉP` và RPC claim không bị sửa.
- Verified read-only Supabase Vault HMAC comparison: sender của đúng một n8n Owner Allowlist row còn hạn khớp **recipient_ref của Shop B paired**, không tiết lộ người nhận; Shop B binding còn hạn. Database outbox chỉ HELD/SEND_DISABLED; không có outbound.
- **Owner test:** mở đúng Bot của Shop B trên Zalo, gửi đúng một tin `TEST SHOP B F01`. Không mong bot phản hồi (ZALO_SEND_ENABLED=false). Sau đó đối chiếu `TIEN404_QA_SHOP_B_PAIRING_TRACE` slot `shop_b_owner_probe` có `eligible` và `observed_at` **mới hơn** synthetic test; kiểm outbox đơn QA `QA-B-OWNER-HELD-20261114-01` vẫn HELD. Không gửi lại lệnh GHÉP.
- Caveat: Đây là acceptance test **webhook ingress + owner gate**; lệnh này không tra catalog/commit order và chưa chứng minh bot hai chiều. Chưa có kết nối Order Service từ lệnh Zalo; muốn bot tự trả lời và tạo đơn cần workflow/app staging riêng, API policy, QA và phê duyệt trước khi bật sender.
- Code node update tooling báo cảnh báo đã tồn tại `HARDCODED_CREDENTIALS` trên HTTP node `Submit pending claim for Shop B` vì có header apikey cố định; cần audit secret/public publishable key trước release, không tự sửa credential khi chưa kiểm tra.

**Rollback:** Restore Shadow version `2533f350-3053-47f7-8349-59f0e2f4f433` trong n8n history (và publish lại nếu được phê duyệt), không xóa Shop B pairing/QA outbox. Mọi dữ liệu QA hiện hữu giữ nguyên làm bằng chứng.


## VERIFIED — Owner đã gửi TEST SHOP B F01 từ Zalo

**14/11/2026 JST, không gửi trả lời Zalo.** Owner xác nhận đã gửi một tin `TEST SHOP B F01` vào Bot Shop B. Đối chiếu trực tiếp n8n Data Table `TIEN404_QA_SHOP_B_PAIRING_TRACE` (`e7eJAGSwzn67aA1z`) thấy dấu `shop_b_owner_probe / eligible` cập nhật `2026-11-14T11:59:24.562Z` (**20:59:24.562 JST**), mới hơn synthetic QA execution `3357` (marker `2026-11-14T11:55:39.991Z`). Dấu inbound `other_text` cập nhật `11:59:24.684Z`, đúng vì đây không phải lệnh GHÉP.

**Chứng cứ:** Bản ghi staging phù hợp với tin nhắn Owner báo vừa gửi, đi qua bước kiểm tra Owner Gate; không có execution chi tiết để định danh một cách độc lập do Shadow cài `saveDataSuccessExecution=none` và `saveManualExecutions=false`. Không tuyên bố đã gửi/phản hồi tin Zalo hoặc nhận tin từ API outbound.

**Read-only Supabase post-check:** `qa-tenant-b/qa-store-b/qa-bot-b` vẫn `paired`, claim `CONFIRMED`, recipient khớp, binding chưa hết hạn; hết hạn 21/11/2026 20:23:15 JST. Shop B vẫn `dry_run`. Số đơn QA Shop B = 2, outbox Shop B = 2, cả 2 `HELD/SEND_DISABLED`. Shop A đơn QA = 2; số outbox khác `HELD/SEND_DISABLED` = 0. Lệnh probe không tạo thêm đơn và không gửi thông báo ra ngoài.

**NEXT:** Thiết kế/kiểm thử chat sản phẩm Shop B phía server dưới Shadow, dùng catalog đúng Shop B (F01 giá 199000 VND, không dùng giá Shop A 159000 VND), rồi xin Owner phê duyệt riêng trước khi bật **một** phản hồi outbound tới tài khoản QA đã xác minh. Không tự bật ZALO_SEND_ENABLED, không dùng OA/business API không đủ quyền, không nối khách thật/production. Rollback n8n Shadow về `2533f350-3053-47f7-8349-59f0e2f4f433` nếu probe lỗi.
