# V22 — Zalo Bot trả lời chủ shop (owner-only, sandbox)

Trạng thái: **n8n đã publish** (OgDZNSAvKEvhnAvn → `dd64a1cd`, rollback `f00ba506`). **Worker chưa deploy** — tới khi deploy, n8n gọi vào route chưa có (404) và bỏ qua, không ảnh hưởng gì.

## Chủ dự án deploy Worker `tien404-zalo-outbound-v1-staging` (Cloudflare)

1. Chép `worker-v22-owner-text.mjs` vào source Worker, trong `fetch` thêm trước các route khác:
   ```js
   import { v22OwnerTextRoute } from './worker-v22-owner-text.mjs';
   const r22 = await v22OwnerTextRoute(request, env, new URL(request.url).pathname);
   if (r22) return r22;
   ```
2. Thêm biến (Settings → Variables), **không** đổi `ZALO_SEND_ENABLED` (giữ `false`):
   - `ZALO_OWNER_TEXT_ENABLED` = `true`
   - `ZALO_OWNER_TEXT_EXPIRES` = `2026-11-22T14:10:00Z`
   Dùng lại secret sẵn có: `GATEWAY_AUTH_KEY`, `ZALO_BOT_TOKEN`, `ZALO_OWNER_CHAT_ID`, D1 `REPLAY_DB` (bảng `outbound_claims`).
3. `wrangler deploy` (hoặc dán vào Dashboard → Deploy).

Kiểm tra: nhắn Zalo Bot `TEST SHOP B CHAT F01` → bot trả lời
`[TIEN404 SANDBOX - Shop B] F01: 456.000đ, tồn QA 5. Chỉ xem giá, chưa tạo đơn.`

## Giới hạn an toàn (test 7/7: `node --test worker-v22-owner-text.test.mjs`)
- Chỉ gửi tới `ZALO_OWNER_CHAT_ID`; chat khác → 403, không gửi.
- Worker tự soạn câu từ 5 mẫu cố định; n8n không gửi được chữ tự do.
- Mỗi tin vào chỉ trả lời 1 lần (D1 claim trước khi gửi, không retry); tối đa 30 tin/ngày; hết hạn theo biến và cứng 2026-11-28.

## Tắt khẩn cấp
`ZALO_OWNER_TEXT_ENABLED=false` (Worker) hoặc restore OgDZ về `f00ba506` rồi publish (n8n).
