# n8n workflows — V24 đa kênh (bản nháp, CHƯA publish)

| Workflow | ID n8n | Vai trò |
|---|---|---|
| TIEN404 BOT CORE — AI bán hàng dùng chung (DRAFT) | `A7XYwSqZwr9T7841` | Lõi AI: agent + 5 tool đơn hàng + đọc Sheet AI_SALES_DEMO, fast path SKU, bộ nhớ theo `kênh:tài khoản:người gửi` |
| TIEN404 WEB WIDGET → lõi bot AI (DRAFT) | `jkMNMEFz7ZezCqJA` | Webhook `POST /webhook/tien404-web-chat-v24` cho widget website |
| TIEN404 TELEGRAM → lõi bot AI (DRAFT) | `fffBRIDD7wWIQnXr` | Telegram Trigger (credential "Telegram account") |

Tất cả nằm trong thư mục n8n `05_TIEN404_DEV_FACTORY - STAGING`.

- `build-core.mjs`: sinh code SDK của lõi từ bản export Messenger `Z7FdV7uDvApfbURQ`
  (`node build-core.mjs z7fd.json`). Bản trên n8n là nguồn chuẩn; generator giữ để so khác biệt prompt/tool khi Messenger thay đổi.
- `web-adapter.sdk.js`, `telegram-adapter.sdk.js`: code SDK đã validate, credential để dạng tên (không có token).

Publish bất kỳ workflow nào ở đây = bật kênh thật → cần chủ dự án duyệt từng cái.
