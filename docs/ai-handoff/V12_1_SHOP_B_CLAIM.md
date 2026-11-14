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
