# TIEN404 V26 — Thiết kế tích hợp Shared AI Core (PR #488 + Config Core)

- Ngày: 2026-11-22 (UTC) · Trạng thái: **PROPOSED** (chỉ tài liệu, chưa code hợp nhất, chưa publish, chưa migration)
- Nguồn đã đọc: PR #488 `claude/project-thread-srmvl4` @ `3d6382b` (`channels/**`, `docs/multichannel/README.md`), `develop` @ `078c91d` (`config-core/lib/*`, `config-core/n8n/README.md`, `db/config-core/*`), n8n metadata đã audit trong [TIEN404_V26_SYSTEM_AUDIT.md](TIEN404_V26_SYSTEM_AUDIT.md).

## 1. Hiện trạng

| Thành phần | Ở đâu | Trạng thái | Vấn đề chính |
|---|---|---|---|
| Messenger live | n8n `Z7Fd` Published `1f4069a5` | RELEASED (đang dừng do n8n) | Có agent + 5 tool đơn hàng **riêng**, ghi Google Sheet AI_SALES_DEMO |
| BOT CORE | n8n `A7XY` `37af7677` (active sub-workflow) | IMPLEMENTED | **Bản sao** prompt + tool của Z7Fd `4b0fe018` → 2 nơi sửa prompt, đã lệch với Z7Fd hiện tại |
| Adapter Telegram / Web / Instagram | PR #488 `channels/lib/channel-adapters.mjs` (13 unit test) + n8n `fffBRIDD7`, `jkMNMEFz` | IMPLEMENTED + TESTED (staging) | Telegram `active=true` dù mô tả “chưa publish” |
| VOICE | n8n `F7Eh` + `channels/lib/voice-understanding.mjs` | RELEASED (dùng bởi Messenger) | — |
| Config Core | develop: `action-registry`, `channel-render`, `bot-bridge`, DB `assistants` / `assistant_config_versions` / `channel_connections` | TESTED (hosted 21/21, 9/9) | Chỉ quyết định **menu**; chưa quyết định nguồn dữ liệu, tool, policy |
| Config Menu Bridge | n8n `9HXj` `0d04c978` | RELEASED (dùng bởi Z7Fd) | Đọc `get_channel_menu` bằng publishable key |

Hai hợp đồng song song đang tồn tại:

- #488: `Adapter → Core = {channel, accountId, senderId, messageId, text, mediaType, selectedSku?, memoryUserText?}` và `Core → Adapter = {replyText, skus[], source, …}`.
- Config Core: `bot-bridge.decide(menu, event, channel)` → `{mode: legacy|ai|handoff|direct|greeting|rejected}`.

Không có xung đột file giữa #488 (thư mục `channels/`, base `main`) và develop. Xung đột là **về khái niệm**: #488 chưa biết tenant/store/assistant; Config Core chưa gọi lõi AI.

## 2. Kiến trúc đích (một lõi, nhiều cấu hình, nhiều adapter)

```
Kênh (Messenger, Zalo, Web, Telegram…)
  │  1. Adapter: xác thực nguồn (HMAC/secret header/origin), chuẩn hoá, idempotency theo messageId
  ▼
Channel Identity Resolver  ──► channel_connections(channel, external_account_id) → assistant → store → tenant
  │  2. Không tìm thấy / chưa bật → trả lời mặc định an toàn, KHÔNG gọi AI
  ▼
Config Decision (bot-bridge.decide) ──► legacy | direct | greeting | handoff | rejected | ai
  │  3. Chỉ mode=ai mới đi tiếp
  ▼
Shared AI Core (một workflow)
  │  • Context: memory key = tenant:store:channel:account:sender
  │  • Policy: assistant config đã PUBLISHED (giọng điệu, quy tắc, action được phép)
  │  • Tools: chỉ các tool có trong Action Registry của assistant; mọi tool nhận store_id từ Resolver, không từ LLM
  │  • Data source: DEMO Sheet (legacy) hoặc Commerce DB theo store (sau Gate A)
  ▼
Response Renderer (channel-render + compose* của #488) ──► tối đa 3 tin, fallback khi kênh không có nút
```

Nguyên tắc bắt buộc:

1. **store_id/tenant_id không bao giờ đến từ LLM hay từ payload của khách.** Chỉ Resolver gán, và tool đọc nó từ ngữ cảnh đã xác thực.
2. **Một nguồn prompt.** Z7Fd sẽ gọi lõi thay vì giữ agent riêng.
3. **Fail-closed theo kênh.** Lỗi đọc config → `legacy` (giữ hành vi cũ) chỉ cho Page demo đã allowlist; tenant mới → câu trả lời mặc định + handoff, không chạy AI không có policy.
4. **Không service_role trong n8n** (quy tắc chủ dự án). Đọc dữ liệu tenant qua RPC hẹp (mục 4).

## 3. Hợp đồng sự kiện thống nhất (Unified Conversation Event v1)

Gộp hai hợp đồng, giữ tương thích ngược với #488:

| Trường | Nguồn | Ghi chú |
|---|---|---|
| `event_id` | adapter | `channel:accountId:messageId`; khoá idempotency |
| `channel`, `accountId`, `senderId`, `messageId` | adapter | như #488 |
| `text`, `mediaType`, `selectedSku?`, `memoryUserText?` | adapter / VOICE | như #488 |
| `payload?` | adapter | chỉ `T404:M:<item id>` hoặc payload legacy; không mang action |
| `verified` | adapter | `true` chỉ khi đã qua HMAC/secret/origin |
| `resolved` | Resolver | `{tenantId, storeId, assistantId, configVersion, dataSource}`; **không do adapter điền** |
| `decision` | bot-bridge | mode + chatInput/replyText |

Lõi trả: `{replyText, skus[], source, actionsTaken[], handoff?, configVersion}`. `actionsTaken` để ghi audit và outbox, không chứa PII thô.

## 4. Đọc dữ liệu tenant từ n8n mà không dùng service_role

Hiện n8n chỉ có publishable key. Đề xuất (PROPOSED, cần duyệt migration):

- `public.core_resolve_and_read(p_channel, p_account, p_op, p_args jsonb)` SECURITY DEFINER, `search_path=""`, **không grant cho anon/authenticated**; chỉ một role NOLOGIN riêng (`t404_core_caller`) được EXECUTE, và PostgREST đi vào role đó qua JWT do Worker/Render ký (không phải service_role).
- Hoặc tối thiểu: kiểm tra header bí mật lưu trong Vault như mẫu `qa_shop_b_zalo_claim` (đã chứng minh được nhưng kém hơn vì một bí mật chung).
- `p_op` chỉ thuộc allowlist: `catalog.search`, `catalog.get_sku`, `order.lookup_owned` (sau Order Ownership Gateway), `faq.list`. Không có op ghi ở pha đầu.
- Store luôn lấy từ `channel_connections` trong hàm; mọi truy vấn có `store_id = resolved.store_id`.

Test bắt buộc: Page A gọi với `p_args.store_id` của Store B → bị bỏ qua (store lấy từ binding); account chưa bind → 0 dòng; anon gọi → 42501.

## 5. Thứ tự tích hợp (không cherry-pick)

| Bước | Việc | Phụ thuộc | Rủi ro | Rollback | Duyệt? |
|---|---|---|---|---|---|
| S1 | Merge `develop` vào nhánh #488 (thêm thư mục `channels/`, không đụng file chung) rồi retarget #488 → develop | — | Thấp (0 file trùng) | revert | Merge cần duyệt |
| S2 | Thư viện thuần `channels/lib/core-contract.mjs`: Unified Event v1 + validator + memory key có tenant/store; unit test | S1 | Thấp | xoá file | Không |
| S3 | Resolver thuần + fixture: `channel_connections` → assistant/store; test cross-store | S2 | Thấp | — | Không |
| S4 | Sinh lại BOT CORE từ **Z7Fd Published hiện tại** (`build-core.mjs`), thêm input `resolved`, memory key mới; bản DRAFT mới, không đụng `A7XY` đang active | S2–S3, n8n chạy lại | Trung bình (prompt lệch) | giữ `A7XY` `37af7677` | Không (draft) |
| S5 | Migration RPC hẹp ở mục 4 trên restore-test, UAT A/B | B-P0-06 | Cao (quyền DB) | SQL rollback | **Có** |
| S6 | Web widget → Resolver → Core (staging, origin allowlist + Turnstile) | S4, S5 | Trung bình (chi phí AI) | unpublish | **Có (publish)** |
| S7 | Z7Fd gọi lõi chung thay agent riêng, sau khi tách Draft `41bcea84` | S4, B-P1-03 | Cao (bot live) | publish `1f4069a5` | **Có** |
| S8 | Chuyển dataSource Shop từ Sheet sang Commerce DB theo store | Gate A, Order Ownership | Cao | cờ dataSource=sheet | **Có** |

Exit gate Phase 4: cùng một assistant trả lời nhất quán trên ≥2 kênh (Messenger + Web), 0 lộ dữ liệu chéo trong bộ test A/B, memory không lẫn giữa `tenant:store:channel:account:sender`.

## 6. Rủi ro đã biết

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Lõi `A7XY` là bản sao cũ, khác Z7Fd `1f4069a5` (menu, voice, handoff) | P1 | S4 sinh lại từ bản Published; thêm test so khớp prompt (`n8n-published-drift.test.mjs` đã có mẫu) |
| Telegram `fffBRIDD7` `active=true` có thể đã đăng ký webhook thật | P1 | Kiểm tra read-only khi n8n chạy lại; nếu không chủ đích → xin duyệt unpublish |
| Memory key hiện chưa có tenant/store | P0 khi đa tenant | S2 bắt buộc trước khi bind tenant thứ hai |
| Web widget công khai tốn credit AI / spam đơn | P1 | Turnstile + rate limit trước S6 |
| `saveDataSuccessExecution=none` làm mất dấu vết | P2 | Outbox/audit redacted trong DB thay vì execution data |
