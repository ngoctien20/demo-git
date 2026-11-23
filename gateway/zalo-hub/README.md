# TIEN404 Zalo Hub — cổng chung cho bot Zalo của nhiều shop

Trạng thái: **PROPOSED**. Code và kiểm thử offline (20/20 PASS). Chưa tạo D1, chưa deploy Worker, chưa đổi webhook bot nào, chưa đụng n8n/Supabase.

Thiết kế và nguồn tài liệu Zalo: tài liệu "Shop tự nối bot Zalo — kiểm tra và thiết kế" (https://claude.ai/artifact/8xqoRi8zWxrVbsUkhJZrUx).

## Cách chạy

```
Khách quét QR / bấm deeplink của bot shop
   → Zalo gọi  POST /v1/zalo/wh/<path riêng của shop>  (header X-Bot-Api-Secret-Token riêng của shop)
   → Hub: so secret, chống trùng message_id, xác định shop THEO ĐƯỜNG DẪN (không theo nội dung tin)
   → Hub ký HMAC và chuyển sự kiện chuẩn hoá tới luồng của shop (forward_url, n8n)
Luồng shop trả lời
   → POST /v1/send (ký bằng forward_key của shop) → Hub giải mã token → Zalo sendMessage
```

- Token bot chỉ nằm trong D1 dạng AES-256-GCM, khoá chính `ZH_MASTER_KEY` là secret của Worker. Bản mã gắn với (kết nối, shop, trường): chép sang dòng/shop khác thì không giải được.
- Secret webhook và mã ghép 6 số chỉ lưu SHA-256.
- n8n không cầm token Zalo. Nó chỉ có `forward_key` của đúng shop đó.
- `/v1/send` chỉ gửi tới người đã từng nhắn bot của shop đó, hoặc chủ shop. Shop A không nhắn được khách của shop B.
- Mỗi bot chỉ thuộc một shop; mỗi shop tối đa một bot đang chạy (index duy nhất trong D1).
- Chặn khi gần/hết hạn mức gói Basic của Zalo: 3.000 tin/tháng (`ZH_MONTHLY_CAP`), cảnh báo ở 40/50 người (`ZH_USER_WARN`).
- Zalo trả 401 (chủ shop đã Reset token) → trạng thái `needs_reconnect`. Zalo trả 429 → `quota_exceeded`.

## Nối một shop

1. Chủ shop tạo bot trong Zalo (OA "Zalo Bot Manager" → Tạo bot) và nhận mã bot qua tin nhắn.
2. `POST /v1/admin/connect` với `{store_id, token_text, forward_url}`. Có thể dán nguyên tin nhắn Zalo. Hub gọi `getMe`, kiểm bot chưa thuộc shop khác, rồi `setWebhook` với đường dẫn và secret mới.
   - Dự phòng `set_webhook:false`: hub trả Webhook URL + Secret Token để chủ shop dán tay vào Zalo Bot Creator → Thiết lập chung → Lưu thay đổi.
3. Chủ shop nhắn mã 6 số (hạn 30 phút, sai tối đa 5 lần) vào bot → trạng thái `active`, bot chào "Đã nối xong", và chat đó được nhớ là chủ shop (`is_owner: true` khi chuyển tin).
4. `forward_key` chỉ hiện một lần → dán vào credential n8n của shop đó.

Ngắt: `POST /v1/admin/disconnect` → `deleteWebhook`, xoá mọi bản mã. Nếu nghi lộ, chủ shop Reset token trong Zalo Bot Creator (token cũ hết hiệu lực ngay).

## Bot QA của anh Tiến làm shop thử

- `store_id = qa-zalo-bot`. **Không dùng Bot TIEN404 AI** (đang trỏ webhook về n8n, giữ nguyên).
- Chạy trên máy anh: `node tools/connect-qa.mjs --store qa-zalo-bot --forward https://ngoctien20.app.n8n.cloud/webhook/<qa-path>`. Mã bot được hỏi ẩn trên terminal, không dán vào chat hay repo.
- Luồng n8n QA đã tạo (chưa publish): `QA · Zalo Hub · bot QA (qa-zalo-bot)` id `yYDIPEBBIW1v9Mj9`, thư mục `90_QA - DIAGNOSTICS`. Không cần Code node:
  - Webhook `POST /webhook/tien404-zalo-hub-qa`, Header Auth credential **mới**: tên header `x-tien404-forward-key`, giá trị = `forward_key` của bot QA. (n8n tự gắn tạm credential cũ "Header Auth account" — phải đổi sang credential mới.)
  - HTTP Request `POST <hub>/v1/send`, Header Auth credential mới: header `Authorization`, giá trị `Bearer <forward_key>`. Sửa URL `<hub-host>` sau khi deploy.
- Luồng có code (tuỳ chọn, chặt hơn vì có chống phát lại): `n8n/verify-forward.js` + `n8n/sign-send.js` (ký HMAC).

## Các bước cần anh Tiến duyệt riêng (theo thứ tự)

| # | Việc | Đảo ngược |
|---|---|---|
| 1 | Tạo D1 `tien404-zalo-hub-staging` + áp `migrations/0001_init.sql` | `rollback/0001_init.down.sql` (để ngoài `migrations/` vì wrangler áp mọi file .sql trong đó) hoặc xoá D1 |
| 2 | Tạo Worker mới `tien404-zalo-hub-staging`, đặt secret `ZH_MASTER_KEY`, `ZH_ADMIN_KEY`; để `ZH_ENABLED=false` | Xoá Worker |
| 3 | Tạo luồng n8n QA (chưa publish) với `forward_key` của bot QA | Xoá workflow |
| 4 | Bật `ZH_ENABLED=true`, chạy `connect-qa.mjs` → đổi webhook **bot QA** sang hub | `/v1/admin/disconnect` rồi đặt lại webhook cũ của bot QA |
| 5 | Bật `ZH_SEND_ENABLED=true`, nhắn thử từ Zalo | `ZH_SEND_ENABLED=false` |

Tắt khẩn cấp: `ZH_ENABLED=false` (hub bỏ qua mọi tin, trả 200 để Zalo không gửi lại) hoặc `/v1/admin/disable` cho từng shop.

## Kiểm thử

```
node --test gateway/zalo-hub/test/*.test.mjs
```
Dùng SQL thật của migration (node:sqlite), Zalo API giả, luồng shop giả. Không gọi mạng, không có token thật.

## Còn mở

- Chưa có trang tự nối cho chủ shop trong `/app/` (hiện là route admin). Bước sau: Supabase JWT của chủ shop → route connect riêng.
- Chuyển tin tới n8n chưa có hàng đợi gửi lại; n8n lỗi thì tin đó mất (đã ghi log).
- Chưa rõ người dùng thứ 51 của gói Basic gặp gì phía Zalo.
