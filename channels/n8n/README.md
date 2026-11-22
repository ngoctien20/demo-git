# n8n workflows — V24 đa kênh

| Workflow | ID n8n | Vai trò |
|---|---|---|
| TIEN404 BOT CORE — AI bán hàng dùng chung (DRAFT) | `A7XYwSqZwr9T7841` | Lõi AI: agent + 5 tool đơn hàng + đọc Sheet AI_SALES_DEMO, fast path SKU, bộ nhớ theo `kênh:tài khoản:người gửi` |
| TIEN404 WEB WIDGET → lõi bot AI (DRAFT) | `jkMNMEFz7ZezCqJA` | Webhook `POST /webhook/tien404-web-chat-v24` cho widget website |
| TIEN404 TELEGRAM → lõi bot AI (DRAFT) | `fffBRIDD7wWIQnXr` | Telegram Trigger (credential "Telegram account"). Live bản 008afb65 (chỉ chữ); bản nháp V24.1 có nhánh tin thoại |
| TIEN404 VOICE → chữ (dùng chung mọi kênh) (DRAFT) | `F7EhVGWIALKWg8Y6` | Hiểu tin thoại: vào `channel, audioBase64, mimeType`; ra `ok, text, selectedSku, memoryUserText, transcript` để gọi lõi, hoặc `ok:false + replyText` hỏi lại khách. Không lưu dữ liệu lần chạy thành công (giọng khách) |
| TIEN404 VOICE QA — 4 mẫu thoại (manual) | `89QpypjEpgMP7gc5` | Chạy tay: tải 4 mẫu trong `qa/multichannel/voice-samples/`, gọi VOICE |

Tất cả nằm trong thư mục n8n `05_TIEN404_DEV_FACTORY - STAGING`.

- `build-core.mjs`: sinh code SDK của lõi từ bản export Messenger `Z7FdV7uDvApfbURQ`
  (`node build-core.mjs z7fd.json`). Bản trên n8n là nguồn chuẩn; generator giữ để so khác biệt prompt/tool khi Messenger thay đổi.
- `build-voice.mjs`: sinh code SDK của VOICE từ hàm thuần `channels/lib/voice-understanding.mjs` (có unit test); `voice.sdk.js` là bản sinh ra.
- `web-adapter.sdk.js`, `telegram-adapter.sdk.js`: code SDK đã validate, credential để dạng tên (không có token).

Kênh khác muốn nghe tin thoại: tải file âm thanh của kênh → base64 → gọi `F7EhVGWIALKWg8Y6` → nếu `ok` thì gọi lõi với `text/selectedSku/memoryUserText`, không thì gửi `replyText`. Xem nhánh "Nghe tin thoại" trong adapter Telegram.

Publish bất kỳ workflow nào ở đây = bật kênh thật → cần chủ dự án duyệt từng cái.
