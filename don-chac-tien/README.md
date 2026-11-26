# Đơn chắc tiền (TIEN404)

Hướng Tiến chọn ngày 25/11/2026 ([tài liệu hướng đi](https://claude.ai/artifact/4Ta3iEsBq6a5ANDexWW9XQ)):
chủ shop cứ bán Zalo như cũ; chốt khách xong **nhắn cho bot** → bot tạo đơn, giữ hàng, gửi **mã VietQR đúng số tiền**
để chủ chuyển tiếp cho khách → tiền vào thẳng tài khoản shop → bot báo "tiền về" → tối tổng kết.
TIEN404 không giữ tiền, chỉ thu phí trên **đơn đã thu được tiền**.

Trạng thái: **IMPLEMENTED + TESTED offline**. Chưa deploy, chưa migration, chưa nối hub thật (mỗi bước cần Tiến duyệt).

## Có gì trong thư mục

| File | Làm gì |
|---|---|
| `lib/vietqr.mjs` | Chuỗi VietQR chuẩn EMVCo/NAPAS 247 (tag 38 `A000000727` + BIN + số TK + `QRIBFTTA`, 53=704, 54 số tiền, 62/08 nội dung, CRC16). Tự tạo, **không gọi img.vietqr.io**. 25 ngân hàng phổ biến + bí danh không dấu ("vcb", "ngoại thương", "techcom"…). |
| `lib/qr.mjs`, `lib/png.mjs` | Vẽ mã QR (mức sửa lỗi M) ra SVG/PNG, không thư viện ngoài, chạy được trong Worker/trình duyệt. |
| `lib/parse-owner.mjs` | Hiểu tin chủ shop, có dấu hay không dấu: `chị Lan 2 cái A003 giao Q7 0912345678`, `cô Hoa 350k`, `anh Tuấn 1tr2 cod cọc 200k`, `ship 30k`, `giảm 20k`, `đã nhận đơn 12`, `huỷ đơn 12`, `đã giao 12`, `gia hạn 12`, `qr 12`, `ai chưa trả`, `hôm nay`, `kho`, `phí`, `in qr`, `ngân hàng MB 0123… TÊN`, `thêm hàng …`, `nhập 10 A003`, `giá A003 165k`, dán tin biến động số dư. Không dùng AI → cùng câu luôn cùng kết quả. |
| `lib/engine.mjs` | Lõi một shop: đơn nhiều món, giữ hàng 12 giờ rồi tự nhả, không bán quá tồn, mã CK `T404XXXXXX` (bỏ 0/O/1/I/L), tiền đủ/thiếu/dư/trùng/trễ/sai tài khoản, tiền về không có mã thì **hỏi chủ** (không đoán), giá chủ nhắn khác giá kho thì hỏi, gửi trùng trong 30 phút thì hỏi, COD có/không cọc, báo cáo 21:00, phí tháng. |
| `lib/reconcile.mjs` | Đọc webhook SePay và Casso (v1, v2), tìm mã đơn trong nội dung ngân hàng chèn thêm chữ. |
| `worker/worker.mjs` | Cloudflare Worker: nhận tin chủ shop từ Zalo Hub (kiểm chữ ký HMAC, chỉ chat chủ đã ghép), trả lời qua hub `/v1/send`, ảnh QR `/qr/<shop>/<mã>.png?s=<chữ ký>`, webhook SePay/Casso theo từng shop (khoá lưu dạng băm), cron 15 phút. Ghi D1 kiểu so-sánh-rồi-ghi để 2 sự kiện cùng lúc không đè nhau. Công tắc `DCT_ENABLED`. |
| `migrations/0001_init.sql` | Bảng `shops`, `bank_links` (CHƯA ÁP). Hoàn tác: `rollback/0001_init.down.sql`. |
| `demo/don-chac-tien-demo.html` | Trang mô phỏng chữ to cho người lớn tuổi, chạy đúng lõi thật, bấm đúp là mở (không cần mạng). Sinh lại: `node don-chac-tien/tools/build-demo.mjs`. |
| `tools/new-bank-link.mjs` | Tạo đường nhận báo tiền SePay/Casso cho 1 shop (in SQL + khoá một lần). |

Test: `node --test don-chac-tien/test/*.test.mjs` (38 ca, trong đó 1 ca giải mã ngược ảnh QR bằng jsQR chỉ chạy khi có cài `jsqr pngjs`; CI có cài).
Đã đối chiếu riêng: ma trận QR của `lib/qr.mjs` **trùng từng ô** với thư viện `qrcode` 1.5.4 trên 45 chuỗi, và jsQR đọc lại đúng 45/45.

## An toàn tiền và dữ liệu

- Không số tài khoản thật trong repo (mẫu `0123456789`). Tài khoản nhận tiền do **chủ shop tự nhắn**, bot đọc lại và bắt bấm `1` mới lưu.
- Tiền chỉ được ghi vào đơn khi: có mã đơn trong nội dung, hoặc chủ xác nhận. Tiền không mã chỉ được **gợi ý** khi đúng 1 đơn chờ đúng số tiền.
- Webhook ngân hàng trùng mã giao dịch thì bỏ qua; tiền vào tài khoản khác tài khoản shop thì bỏ qua.
- Link ảnh QR có chữ ký HMAC; đơn đã trả/hết hạn thì link trả 410, không lộ số tiền cũ.
- Phí (đề xuất, chưa chốt): 30 đơn đã thu đầu tháng miễn phí, sau đó 1.500đ/đơn, trần 299.000đ. Đơn chưa thu tiền không tính.

## Bật thật (mỗi bước 🔒 cần Tiến duyệt riêng)

1. 🔒 Tạo D1 `tien404-don-chac-tien` + áp `migrations/0001_init.sql`, deploy Worker với `DCT_ENABLED=false` (từ máy Tiến `E:\tien404`, như các Worker khác).
2. 🔒 Zalo Hub (#507) thêm 1 nhánh: tin có `is_owner = true` và kết nối có bật "đơn chắc tiền" → chuyển tới `POST <dct>/v1/hub/owner` (cùng định dạng + chữ ký như chuyển cho n8n), thay vì BOT CORE. Tin của khách giữ nguyên đường cũ. Đề xuất thêm: hub `/v1/send` nhận `photo_url` để gửi thẳng ảnh QR (Zalo Bot API `sendPhoto`, cần kiểm tài liệu) thay cho link.
3. 🔒 Bật `DCT_ENABLED=true` cho shop thử (Tiến), UAT: đặt TK thật của Tiến, tạo đơn 2.000đ, chuyển thật, bấm `đã nhận`.
4. 🔒 (Tuần 4 theo kế hoạch) Shop nào đồng ý thì nối SePay/Casso bằng `tools/new-bank-link.mjs` → tiền về tự báo.

Tắt khẩn cấp: `DCT_ENABLED=false`. Rollback: phiên bản Worker trước; dữ liệu: `rollback/0001_init.down.sql`.

## Chưa làm (cố ý)

- Đọc ảnh chụp đoạn chat thành đơn, nghe ghi âm: bot hướng dẫn chủ bấm micro trên bàn phím để nói ra chữ.
- Đồng bộ kho với Google Sheet `AI_SALES_DEMO`: lõi này giữ kho riêng từng shop (thay cho Sheet dùng chung). Đơn từ bot Messenger cũ vẫn đi đường n8n cũ.
- Gói thuê bao LITE/PLUS/PRO và trang Tài khoản: luồng khác đang làm (apps/owner).
