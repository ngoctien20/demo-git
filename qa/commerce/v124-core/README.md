# TIEN404 V12.4 — Channel-neutral AI Sales Core (staging-only)

## Mục tiêu
Tách luồng bán hàng thành mô-đun có thể tái sử dụng. Zalo, Messenger, Website và Telegram là adapter **không được kết nối** trong phiên bản này. Đây là QA source code, không phải dịch vụ backend đã deploy.

## Mô-đun đã hiện thực
| File | Vai trò |
|---|---|
| ingress.cjs | Kiểm tra HMAC-SHA256 của ENVELOPE QA nội bộ, hạn chế thời gian ±120 giây, ánh xạ bot -> tenant/shop từ registry phía server; chỉ trả actor/receipt hash, không trả sender ID thô. |
| catalog.cjs | Đọc đúng `(tenantId,storeId,sku)` từ repository backend, bắt buộc `source=QA_BACKEND_READBACK`, hạn đọc <=120 giây, kiểm giá/tồn và tên hàng. |
| core.cjs | Luồng read-only: ingress -> rate limiter -> receipt claim -> chặn admin/prompt injection -> intent classifier -> catalog -> bản preview tiếng Việt. |
| ports.cjs | Các port mặc định an toàn: kênh send disabled, model trả `MODEL_COST_GATE_UNVERIFIED`, deterministic intent fixture, in-memory dedupe/rate limiter chỉ dành cho test, fixture catalog. |
| core.test.cjs | 48 bài negative/positive: QA Shop A/B, số tiền, giả mạo scope/chữ ký, stale data, race flags, prompt injection, PII, model gate, no send/no writes. |

## API contract (chỉ dùng trong QA)
Backend fixture tạo signed envelope có đúng các trường:

```json
{
  "version": 1,
  "channel": "qa-fixture",
  "botRef": "bot-qa-b",
  "senderRef": "qa-sender-01",
  "eventRef": "qa-event-123",
  "eventType": "message.text.received",
  "chatType": "PRIVATE",
  "text": "mua F01 2",
  "issuedAt": "<UTC timestamp>",
  "signature": "<HMAC-SHA256 of canonical fields from the trusted internal signer>"
}
```

**CẢNH BÁO:** Chữ ký này do bộ mô phỏng QA phát ra, KHÔNG xác minh chữ ký thực sự của Zalo hay Messenger. HMAC secret thật chưa tạo, không hardcode vào repo và không được ký từ frontend. Khi tích hợp kênh mới, connector phải tự xác thực chữ ký/secret provider trước rồi mới ký nội bộ bằng secret server-only được quản lý.

## Ranh giới dữ liệu
- Không nhận tenant/store/role từ nội dung khách hoặc JSON tự khai. Registry QA do backend inject xác định shop từ `(channel,botRef)` sau khi HMAC hợp lệ.
- Trong fixture cùng SKU F01: A 159.000đ/stock3, B 199.000đ/stock5. Đây là dữ liệu giả phục vụ test, không phải giá hiện hành.
- Không đưa giá vào LLM: classifier chỉ trả `intent,sku,quantity`; lõi xác nhận SKU được khách nhắc, số lượng và catalog riêng shop.
- Không có schema DB thật, OAuth, token Zalo, credential hoặc quyền frontend mới; không ghi Orders/Outbox.
- Limiter và receipt trong RAM chỉ chứng minh API điều kiện; không thay thế khóa PostgreSQL, unique indexes, CAS hoặc giới hạn phân tán trong production.
- Bản thử nghiệm không theo dõi hội thoại nhiều lượt bền vững; mỗi message trả preview độc lập.

## Hành vi fail-closed
- Unknown bot, chữ ký sai, tin nhóm, timestamp sai => `INGRESS_DENIED`.
- Sai dữ liệu catalog hoặc chéo cửa hàng => `CATALOG_UNTRUSTED`.
- Catalog QA hết hạn hoặc giá/tồn không hợp lệ => `CATALOG_NOT_FRESH`.
- Thiếu chứng minh chi phí mô hình => `MODEL_BUDGET_BLOCKED` và không gọi AI.
- Lỗi receipt/limiter/backend/AI => trả mã an toàn, không gửi phản hồi.
- ChannelAdapter Zalo/Messenger/Website/Telegram `state=RESERVED_NOT_CONNECTED`, `send()` luôn ném `CHANNEL_OUTBOUND_DISABLED`.

## Hướng dẫn QA

```bash
node --check qa/commerce/v124-core/core.cjs
node --test qa/commerce/v124-core/core.test.cjs qa/zalo/public-reply-pilot.test.cjs
```

GitHub Actions `V12.4 Public Reply Pilot QA (no outbound)`: run `43619873004`, 83/83 PASS, gồm 48 test Core mới và 35 test V12.4 Reply Pilot trước đó.

## Cổng tích hợp sau khi lõi đạt nghiệm thu
1. Phân tầng Provider ingress: Zalo/Messenger/Website tự xác thực server-side và ánh xạ bot thật, không sử dụng QA fixture `b/route-b`.
2. Adapter DB read-only có scope server-side/RLS; kiểm giá và tồn theo dữ liệu mới.
3. Persistent receipts, rate limiting, session CAS và negative QA chạy hai backend/PostgreSQL sessions thực.
4. Model budget gate giới hạn cứng USD/tokens/calls; được Owner phê duyệt riêng trước khi chạy GPT.
5. Chế độ `preview` giữ nguyên; chọn tài khoản Zalo QA allowlisted và bật phản hồi chỉ sau approval riêng. Order writes/Outbox và production require approvals khác.

## Rollback
Chỉ mã trên Draft PR #52 thay đổi. Có thể đóng/revert PR mà không động n8n V1/V2, Supabase, Orders, credential hoặc Zalo Bot. Không merge PR #52 khi chưa đánh giá các cổng triển khai.