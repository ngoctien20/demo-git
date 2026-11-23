# TIEN404 Sale — sản phẩm AI chốt đơn (nguồn sự thật)

Tiến chốt ngày 23/11/2026: tách riêng và hoàn thiện phần **bán hàng** trước (AI chốt đơn trên Messenger + Zalo cho shop nhỏ).
Nghệ sĩ/KOL, đa ngành, Instagram/TikTok, widget web: đóng băng, nghiên cứu sau.

- Audit + lộ trình 30 ngày: https://claude.ai/artifact/4hzBoh2WUpaDjWZupSnczC
- Mục tiêu 30 ngày: 3-5 shop thật dùng hằng ngày, đo tỉ lệ tin nhắn ra đơn.
- Thứ tự (Tiến chọn "Shop thật dùng được trước"): GĐ0 bật lại n8n → GĐ1 chủ shop biết có đơn → GĐ2 thêm shop trong 30 phút → GĐ3 Zalo bán cho khách → GĐ4 pilot.

## Đang chạy thật (trước khi n8n hết hạn 22/11)

| Thành phần | ID / phiên bản | Ghi chú |
|---|---|---|
| Messenger bot | n8n `Z7FdV7uDvApfbURQ` published `1f4069a5` | Runbook bật lại: `docs/checkpoints/TIEN404_V26_WSC_GO_LIVE_RUNBOOK.md` (PR #498) |
| Tạo đơn | n8n `KrSn4DNR9ALX5ng4` `af9ee686` | Ghi Sheet `AI_SALES_DEMO` tab Orders |
| Sửa / quản lý đơn | `BkAi6TVUKAjCnI7v` `3bd7043f`, `fDB9dvs1qPPVt9Sp` `03384201` | |
| Dữ liệu | Google Sheet `AI_SALES_DEMO` | Products (sku, name, price, stock) + Orders |
| Zalo gửi tin chủ shop | Worker `tien404-zalo-outbound-v1-staging` | route V22 owner-text (sandbox) |

## GĐ1 — chủ shop biết có đơn (thư mục này, CHƯA bật)

| File | Làm gì |
|---|---|
| `lib/order-rules.mjs` | Luật tạo đơn = bản `af9ee686` + **giữ tồn**: đơn `pending` giữ hàng 24 giờ, `confirmed`/`paid` giữ 7 ngày; `cancelled`/`shipped`/`done` không giữ. Khách thứ hai không đặt được món cuối đã có người giữ. |
| `n8n/build-validate-order.mjs` | In ra code cho node `Validate Order` (sinh từ thư viện trên, không sửa tay trong n8n). |
| `lib/order-alert.mjs` | Soạn tin báo đơn cho chủ shop (Zalo + email) chỉ từ dữ kiện đã kiểm: tổng = giá × số lượng, SĐT Việt Nam, kênh hợp lệ, lọc link. Cảnh báo khi còn ≤ 3 cái. |
| `worker/order-alert-route.mjs` | Route Worker `POST /v1/sales/order-alert`: người nhận luôn là `ZALO_OWNER_CHAT_ID` (n8n không chọn được), mỗi mã đơn báo đúng 1 lần (D1), tối đa 200 tin/ngày, Zalo từ chối thì trả `fallback: email`. |
| `lib/funnel.mjs` | Đếm tin nhắn → đơn **không lưu dữ liệu cá nhân**: mỗi dòng chỉ có ngày, shop, kênh, loại sự kiện, mã băm người gửi đổi mỗi ngày. Báo cáo ngày: số người nhắn, số đơn, % ra đơn. |

Test offline: `node --test sales/test/*.test.mjs` (25 ca, CI `tien404-sales-gd1-qa.yml`).

### Ví dụ tin báo đơn trên Zalo

```
★ ĐƠN MỚI qua Messenger
ORD-20261124030000-exec6999-550000
A003 · Áo thun nam đen basic size L
2 × 159.000đ = 318.000đ
☎ QA Tien · 0912345678
⌂ 12 Lê Duẩn, Đà Nẵng
ⓘ Gọi khách xác nhận rồi đổi trạng thái trong Sheet.
```

### Bật GĐ1 (mỗi bước 🔒 cần Tiến duyệt riêng, làm SAU khi GĐ0 xong)

1. **Worker** 🔒: thêm route vào `tien404-zalo-outbound-v1-staging` (gộp file bằng `npx esbuild sales/worker/order-alert-route.mjs --bundle --format=esm`), gọi `orderAlertRoute` trước các route khác; thêm biến `SALES_ORDER_ALERT_ENABLED=true`. Dùng lại secret sẵn có. Tắt khẩn cấp: biến = `false`. Rollback: phiên bản Worker trước đó.
2. **Create Order `KrSn`** 🔒 (giữ nguyên tên tab/cột Sheet):
   - `Order Input` thêm trường `channel` (Z7Fd truyền cố định `messenger`, lõi Telegram `telegram`).
   - `Validate Order` ← kết quả `node sales/n8n/build-validate-order.mjs`.
   - Sau `Append Order`, nhánh song song: HTTP Request `POST <worker>/v1/sales/order-alert` (credential header TIEN404_ZALO_OUTBOUND_GATEWAY_AUTH_V1, timeout 10 s, *On Error: Continue*), body = các trường đơn + `channel` + `available_after`. Nếu không phải HTTP 200 → node Gmail gửi `composeOrderEmail` tới email chủ shop. **Không gọi lại route cho cùng mã đơn.**
   - `Order Created Result`: đổi câu "Tồn kho chưa bị trừ" thành "Shop giữ hàng cho bạn 24 giờ".
   - Rollback: dán lại code `qa/v26-wsc/nodes/create-order-validate.af9ee686.js`, bỏ 2 node báo đơn, publish.
3. **Đếm tin nhắn** 🔒: tạo n8n data table `sales_funnel_events` (day, shop, channel, kind, sender); Z7Fd ghi 1 dòng ở các điểm: tin vào, báo giá, tạo đơn, hết hàng, chuyển nhân viên. Mã băm dùng node Crypto (HMAC-SHA256) với khóa bí mật lưu trong credential n8n, không để trong repo.
4. **UAT** 🔒: 10 đơn thử từ tài khoản Tiến → 10 tin Zalo tới chủ shop dưới 10 giây, không tin trùng; đặt món còn 1 cái từ 2 tài khoản → tài khoản 2 bị từ chối; đổi đơn thử thành `cancelled`.

Lưu ý thay đổi hành vi so với `af9ee686`: kiểm đơn trùng chạy **trước** kiểm tồn (gửi lại cùng đơn được báo "đã có đơn" thay vì "hết hàng"); tồn kho không phải số hợp lệ thì từ chối với câu riêng.
Quy ước cho chủ shop: khi giao hàng, trừ `stock` trong Products và đổi trạng thái đơn thành `shipped`.
