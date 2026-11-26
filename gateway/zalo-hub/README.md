# TIEN404 Zalo Hub — cổng chung cho bot Zalo của nhiều shop

## Checkpoint hiện tại — 26/11/2026

Đã đọc lại cấu hình đang chạy: Hub staging bật nối Lite và gửi tin, có schema 0001/0002; chưa có catalog riêng hoặc Workers AI. Phiên bản đang phục vụ trước đợt này là `ae2cd33c-03c9-43b1-9403-81f72513f748`.

Nhánh này bổ sung chủ shop tự cài bằng hội thoại, dữ liệu riêng, bật/tạm dừng, hạn mức và AI phân loại ý định có kiểm soát. Xem **[SELF-SERVE-QA.md](SELF-SERVE-QA.md)** để biết phạm vi, kiểm thử, cấu hình, triển khai QA và rollback. Các hướng dẫn n8n bên dưới chỉ áp dụng kết nối theo luồng cũ. **Lite mới không chuyển sang luồng DEMO và không nhận trả lời từ `/v1/send`.**

Ghi nhận lịch sử (24/11/2026): bản 0001 đã thử staging với `qa-zalo-bot`; 0002 khi đó mới offline. Mốc lịch sử không phản ánh trạng thái triển khai của thay đổi trong nhánh này.

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
- n8n không cầm token Zalo. Nó có 2 mã của đúng shop đó:
  - `inbound_key`: hub gửi kèm header `x-tien404-inbound-key` mỗi tin chuyển tới, node Webhook n8n kiểm bằng Header Auth. n8n lưu header vào nhật ký chạy, nên mã này chỉ cho phép gõ cửa n8n, không gửi được tin Zalo.
  - `forward_key`: chỉ dùng chiều n8n → hub (`Authorization: Bearer …` trong credential, n8n che đi trong nhật ký) và để ký HMAC. Hub không bao giờ gửi mã này đi.
- Đổi mã: `POST /v1/admin/rotate-keys {connection_id}` (hoặc `tools/rotate-qa.mjs`): 2 mã mới, mã cũ chết ngay. Dòng nối trước 0002 (chưa có `inbound_key`) vẫn chạy như cũ (header `x-tien404-forward-key`) cho tới khi đổi mã.
- `/v1/send` chỉ gửi tới người đã từng nhắn bot của shop đó, hoặc chủ shop. Shop A không nhắn được khách của shop B.
- Mỗi bot chỉ thuộc một shop; mỗi shop tối đa một bot đang chạy (index duy nhất trong D1).
- Chặn khi gần/hết hạn mức gói Basic của Zalo: 3.000 tin/tháng (`ZH_MONTHLY_CAP`), cảnh báo ở 40/50 người (`ZH_USER_WARN`).
- Zalo trả 401 (chủ shop đã Reset token) → trạng thái `needs_reconnect`. Zalo trả 429 → `quota_exceeded`.

## Chủ shop tự nối bot (App → Kênh kết nối → Zalo Bot)

1. Chủ shop tạo bot trong Zalo (Zalo Bot Manager → Tạo bot), Zalo nhắn mã bot cho họ.
2. Trong App (đã đăng nhập), dán tin nhắn đó → **Nối bot**. App gửi thẳng tới hub `POST /v1/owner/connect` kèm phiên Supabase của chủ shop.
3. Hub hỏi Supabase: phiên còn hạn không, người này có phải `owner`/`manager` của đúng cửa hàng đó không (`store_memberships`, chạy dưới quyền của chính họ). Đạt thì `getMe` → `setWebhook` → trả **mã 6 số**.
4. Chủ shop nhắn mã 6 số vào bot của mình trên Zalo → bot chào "Đã nối xong", App tự chuyển sang "Đang chạy".

- Shop tự nối chạy `flow_mode = 'shared'`: mọi tin vào **một luồng n8n chung** (`ZH_SHARED_FORWARD_URL`), phân biệt shop bằng `store_id` trong tin. Hai mã của luồng chung (`ZH_SHARED_INBOUND_KEY`, `ZH_SHARED_SEND_KEY`) là secret của Worker, chủ shop không bao giờ thấy hay phải dán mã nào.
- Chủ shop không đụng được bot TIEN404 nối hộ (`flow_mode = 'own'`, như bot QA): trả `STORE_MANAGED_BY_TIEN404`.
- Nhân viên (`staff`) hay người của cửa hàng khác: `NOT_STORE_MANAGER`, không gọi tới Zalo.
- Hạn chế hiện tại: lõi AI bán hàng (`A7XYwSqZwr9T7841`) vẫn đọc Sheet demo AI_SALES_DEMO cho mọi shop. Trước khi nhận shop thật, luồng chung phải đọc đúng hàng hoá của từng `store_id`.

## Gói Lite: nối bot hoàn toàn trên Zalo (cho người lớn tuổi)

Gói Lite không cần web. Plus/Pro dùng App để tuỳ chỉnh sâu.

1. Chủ shop tạo bot trong Zalo Bot Manager, nhận mã bot.
2. Mở **Bot TIEN404 AI**, gõ "nối bot", rồi dán nguyên tin nhắn chứa mã bot.
3. Luồng n8n của Bot TIEN404 AI (không lưu nhật ký chạy) chuyển ngay tới `POST /v1/lite/connect {zalo_user_id, token_text}` với `Bearer ZH_LITE_KEY`, rồi trả lời mã 6 số và nhắc xoá tin vừa dán.
4. Chủ shop nhắn mã 6 số vào bot của mình → "Đã nối xong".

- Cửa hàng Lite gắn với tài khoản Zalo của chủ shop trên Bot TIEN404 AI: `store_id = 'zl-' + sha256(...)` (không lộ id Zalo). Cùng người → cùng cửa hàng; người khác không lấy được bot đã nối.
- Trả lời chủ shop: `/v1/lite/reply {zalo_user_id, text}`. Hub giữ mã Bot TIEN404 AI (secret `ZH_SYSTEM_BOT_TOKEN`) và chỉ gửi cho đúng người vừa nhắn, tối đa `ZH_LITE_REPLY_DAILY_CAP` tin/người/ngày.
- Bot TIEN404 AI cũng là bot gói Basic: tối đa 50 người nhắn (cộng dồn), nên nối qua Zalo phục vụ khoảng 50 chủ shop tới khi Zalo mở gói Pro. Nối qua App không bị giới hạn này.
- Lệnh khác: `/v1/lite/status`, `/v1/lite/pairing` (mã mới), `/v1/lite/disconnect`. Bật bằng `ZH_LITE_CONNECT_ENABLED=true`.
- Nếu mã bot lỡ lộ (ví dụ chủ shop không xoá tin): Zalo Bot Creator → Reset token, mã cũ chết ngay, nối lại bằng mã mới.

## Nối một shop (quản trị, luồng riêng)

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
| 6 | Áp `migrations/0002_keys_shared_flow.sql` lên D1, deploy Worker bản mới, chạy `tools/rotate-qa.mjs`, đổi credential Webhook n8n sang header `x-tien404-inbound-key` | Deploy lại Worker cũ, rồi `rollback/0002_keys_shared_flow.down.sql` |
| 8 | Gói Lite: đặt secret `ZH_LITE_KEY` + credential n8n, gắn nhánh "nối bot" vào luồng Bot TIEN404 AI, bật `ZH_LITE_CONNECT_ENABLED=true` | `ZH_LITE_CONNECT_ENABLED=false`, khôi phục bản luồng Bot TIEN404 AI cũ |
| 7 | Tạo luồng n8n chung + 2 secret `ZH_SHARED_*`, đặt biến owner self-connect, bật `ZH_OWNER_CONNECT_ENABLED=true`, deploy App | `ZH_OWNER_CONNECT_ENABLED=false` |

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
