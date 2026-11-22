# TIEN404 V26 — WS-C Go-live runbook (khi n8n chạy lại)

- Viết lúc: 2026-11-22 22:40 UTC (07:40 sáng 23/11 giờ Tokyo). Chủ dự án dự kiến nâng gói n8n tối 23/11.
- Đi kèm: `TIEN404_V26_WSC_N8N_COMMERCE_MESSENGER.md` (phân tích, diff, test offline 68/68).
- Quy tắc: **mỗi bước có dấu 🔒 cần chủ dự án duyệt riêng** (publish, gửi tin thật, ghi/sửa đơn thật). Không bước nào được đánh PASS nếu chưa có execution id thật + xác nhận của chủ dự án.

---

## 0. Trạng thái trước go-live (VERIFIED 22:40Z qua n8n MCP)

| Workflow | ID | Published (`activeVersionId`) | Draft | Ghi chú |
|---|---|---|---|---|
| Create Order Tool | `KrSn4DNR9ALX5ng4` | **`af9ee686`** | `af9ee686` | **Đã publish 21:06:59Z** (phiên khác, ghi chú “with owner approval”, B-P0-03). |
| Update Order | `BkAi6TVUKAjCnI7v` | **`3bd7043f`** | `3bd7043f` | **Đã publish 21:07:00Z** (B-P0-04). |
| Messenger | `Z7FdV7uDvApfbURQ` | `1f4069a5` | `41bcea84` | Không đổi từ lần phân tích. |
| Config Menu Bridge | `9HXjjJ5ghPKUu43b` | `0d04c978` | `0d04c978` | Không đổi. |

- Execution sau 11:00Z: **0** → n8n vẫn dừng; hai bản Commerce mới **chưa chạy lần nào trên production** (TESTED offline, live NOT RUN).
- ⚠️ **Lịch sử phiên bản của KrSn và BkAi hiện chỉ còn 1 bản** (`af9ee686`, `3bd7043f`). Hai bản cũ `4740251a`, `93cf227a` **không còn trong `get_workflow_history`**, nên lệnh “publish lại versionId cũ” có thể không chạy được. Rollback thay thế ở mục 4.

---

## 1. Bước G0 — Xác nhận n8n đã chạy lại (không cần duyệt, không gửi tin)

1. Chủ dự án nâng gói tại trang quản lý gói của n8n Cloud.
2. Claude kiểm: `get_workflow_details` cho 4 workflow ở mục 0 → `active=true`, `activeVersionId` khớp bảng (phát hiện ai đổi trong lúc chờ).
3. Chủ dự án nhắn “Xin chào” vào Page DEMO từ tài khoản của mình.
4. Claude kiểm: `search_workflow_executions(workflowId=Z7Fd, startedAfter=<giờ nhắn>)` có execution mới, `status=success`.

**Đạt khi:** có execution mới và chủ dự án nhận được lời chào. **Không đạt:** dừng, không làm bước nào khác; xem lại gói n8n trước khi nghi workflow.

## 2. Bước G1 — UAT live trên bản đang chạy (Messenger `1f4069a5` + Commerce mới)

Ghi kết quả vào bảng mục 5. Tất cả tin chỉ gửi giữa tài khoản chủ dự án và Page DEMO.

| ID | Kiểm gì | Cách làm | Kỳ vọng | Duyệt |
|---|---|---|---|---|
| U1 | **HMAC chặn request không chữ ký** | Claude gửi 1 POST tới webhook production với body `{"object":"page","entry":[]}` và **không có** header `x-hub-signature-256` (curl hoặc `execute_workflow` mode production, trigger `Webhook1`). Lặp lại với chữ ký sai. | HTTP 403 `Forbidden`; không có node nào sau `Verify Meta Signature` chạy; không tin nhắn nào được gửi (body rỗng, không có người nhận). | 🔒 (gọi endpoint production) |
| U2 | **A003 báo giá (đường nhanh, không AI)** | Chủ dự án nhắn `Xem A003`, rồi `A003 giá bao nhiêu` | Mỗi tin nhận **1** trả lời trong ~5 s: `A003 — Áo thun nam đen basic size L \| 159.000đ/cái. Còn 18 cái.` (số tồn theo Sheet lúc test) + quick reply `Đặt A003`, `Xem mẫu khác` | 🔒 (tin thật, chỉ chủ dự án) |
| U3 | AI tư vấn + nút SKU | Nhắn `shop có áo polo nào` | 1 trả lời có tối đa 3 nút `Xem Axxx`; giá trong câu khớp Sheet; không mời đặt hàng khi khách chỉ đang xem | 🔒 |
| U4 | **Tạo đơn** (Create Order `af9ee686`) | Nhắn: `Mình đặt A003 1 cái, tên QA Tien, SĐT <SĐT di động của chủ dự án>, địa chỉ <địa chỉ test có chữ, ≥10 ký tự>`, xác nhận khi bot hỏi | Bot báo mã đơn dạng `ORD-<14 số>-<execution id>-<6 số>`, tổng **159.000đ**; Sheet Orders có đúng **1** dòng mới, `unit_price=159000`, `total=159000`, `status=pending` | 🔒 (**ghi 1 dòng Sheet DEMO**) |
| U5 | Chống trùng đơn | Trong 30 phút, đặt lại y hệt U4 | Bot báo đã có đơn tương tự; **không** có dòng mới | 🔒 |
| U6 | **Sửa địa chỉ** (Update Order `3bd7043f`) | Nhắn đổi địa chỉ đơn U4: mã đơn + SĐT + địa chỉ mới có chữ | Báo đổi thành công; dòng Sheet đổi địa chỉ, không đổi cột khác | 🔒 (**sửa 1 dòng Sheet**) |
| U7 | Sửa địa chỉ bị từ chối | (a) Địa chỉ mới `1234567890`; (b) SĐT sai 1 số | (a) “Địa chỉ mới quá ngắn…”; (b) “Không tìm thấy đơn hàng khớp…” (không lộ đơn có tồn tại hay không) | 🔒 |
| U8 | Lỗi nút danh mục (đang tồn tại) | Mở persistent menu → bấm mục danh mục | **Kỳ vọng hiện tại = lỗi đã biết:** bot trả lời chào thay vì danh mục. Ghi lại để so sánh sau S3. | 🔒 |
| U9 | Dọn dữ liệu test | Đổi `status` đơn U4 thành `cancelled` (qua bot “hủy đơn” hoặc sửa Sheet) | Sheet không còn đơn `pending` của QA | 🔒 (**sửa dữ liệu**) |

**Điều kiện dừng ngay (rollback mục 4):** bất kỳ đơn nào có giá/tổng khác giá Sheet; bot gửi > 3 tin cho 1 tin khách; U1 trả 200; lỗi lặp ở `Validate Order`/`Validate Address Update`.

## 3. Bước G2 — Publish Messenger theo gói (mỗi bước 🔒)

Dùng đúng snapshot đã lưu, **không sửa Draft**. Trước mỗi bước: `get_workflow_history(Z7Fd)` xác nhận versionId vẫn còn và chưa ai publish bản khác.

| Bước | Lệnh | Gói | UAT sau publish | Rollback |
|---|---|---|---|---|
| S1 | `publish_workflow(Z7FdV7uDvApfbURQ, versionId=b967d427-62e6-40aa-90f4-60d222bb6e03)` | P1 handoff theo vai trò + P2 khớp nút menu theo Page/người gửi | Lặp U2; bấm menu “Gặp nhân viên” → câu báo nêu đúng bộ phận + thread chuyển sang Page Inbox; **trả thread lại cho bot** trong Business Suite sau test | `publish_workflow(Z7Fd, versionId=1f4069a5-5e74-4c79-935b-40f02b3582d8)` |
| S2 | `… versionId=9c08fdd3-7583-49e5-adb4-8b4d9e0c0688` | + P3 nút SKU khi AI liệt kê ≥4 mẫu | U3 với câu `shop có những áo nào` → vẫn 1–2 tin, có 3 nút | publish `b967d427-…` |
| S3 | `… versionId=9342025c-ea16-4965-97ac-bc4b98591996` | + P4 danh mục phân trang (sửa lỗi U8) + P5 shadow reaction (không hành vi) | Lặp U8 → “Danh mục Sản phẩm — trang 1/N”, 3 nút Xem, quick reply “Trang tiếp”; bấm “Trang tiếp” → trang 2; lặp U2 | publish `9c08fdd3-…` |
| S4 | `… versionId=41bcea84-703d-40bc-be2a-71f84ca4e2d8` | + P6 đối soát đủ số tin Meta | Câu hỏi dài để bot trả 2 tin → cả 2 tới nơi; lặp U2 | publish `9342025c-…` |

- Có thể gộp S1→S3 trong một lần duyệt nếu chủ dự án muốn sửa lỗi danh mục nhanh; rollback vẫn là `1f4069a5`.
- **Không** publish `18125761` (con trỏ không có checksum, bridge đang chạy từ chối — TESTED).
- Sau mỗi bước, kiểm `get_workflow_details(Z7Fd).activeVersionId` đúng versionId vừa publish.

## 4. Rollback

| Đối tượng | Cách 1 (nhanh) | Cách 2 (nếu versionId cũ đã mất khỏi lịch sử) |
|---|---|---|
| Messenger Z7Fd | `publish_workflow(Z7Fd, versionId=<bản liền trước>)`; khẩn cấp `1f4069a5-5e74-4c79-935b-40f02b3582d8` | `restore_workflow_version` về `1f4069a5` rồi publish |
| Create Order KrSn | `publish_workflow(KrSn4DNR9ALX5ng4, versionId=4740251a-cd01-4f7f-b8e1-e300a8393151)` — **có thể không còn** (mục 0) | `update_workflow` 1 thao tác `updateNodeParameters` cho node `Validate Order` với `jsCode` = nội dung `qa/v26-wsc/nodes/create-order-validate.4740251a.js`, rồi publish. **Lưu ý:** bản cũ có lỗi giá P0; chỉ dùng nếu bản mới chặn đơn hợp lệ hàng loạt. Thay thế an toàn hơn: tạm tắt tool `create_order` trong Z7Fd. |
| Update Order BkAi | `publish_workflow(BkAi6TVUKAjCnI7v, versionId=93cf227a-ab8a-42c6-9185-7ec44f7aeb00)` — **có thể không còn** | Như trên với `qa/v26-wsc/nodes/update-order-validate.93cf227a.js` cho node `Validate Address Update` |
| Dữ liệu Sheet | — | Đơn test U4: đổi `status=cancelled` (không xóa dòng) |

Code trong `qa/v26-wsc/nodes/*.4740251a.js` và `*.93cf227a.js` được chép từ diff phiên bản n8n ngày 22/11 (khi bản cũ còn trong lịch sử) và đã chạy qua 50 test offline.

## 5. Bảng ghi kết quả (điền khi chạy)

| ID | Thời điểm (UTC) | Execution id | Kết quả | Người xác nhận |
|---|---|---|---|---|
| G0 | | | NOT RUN | |
| U1 | | | NOT RUN | |
| U2 | | | NOT RUN | |
| U3 | | | NOT RUN | |
| U4 | | | NOT RUN | |
| U5 | | | NOT RUN | |
| U6 | | | NOT RUN | |
| U7 | | | NOT RUN | |
| U8 | | | NOT RUN | |
| U9 | | | NOT RUN | |
| S1 | | | NOT RUN | |
| S2 | | | NOT RUN | |
| S3 | | | NOT RUN | |
| S4 | | | NOT RUN | |

Ghi chú bằng chứng: `saveDataSuccessExecution=none` trên Z7Fd/KrSn/BkAi nên execution thành công **không lưu dữ liệu node**. Bằng chứng gồm: execution id + trạng thái, ảnh chụp Messenger của chủ dự án, dòng Sheet. Muốn lưu dữ liệu node trong lúc UAT phải bật tạm setting này (🔒, có PII) rồi tắt lại.

## 6. Việc còn mở sau go-live (PROPOSED)

- Create Order: thêm hậu tố `vnđ` vào parser; số lượng chỉ nhận `/^\d{1,4}$/` (đang nhận `"1e2"`, `"0x10"`, `true`).
- Thống nhất 1 hàm chuẩn hóa SĐT cho Create/Update/Manage (Create đang nhận số bàn 02x, Update thì từ chối).
- Xoay verify token GET của webhook Messenger, chuyển khỏi node IF.
- Bật lại lưu lịch sử phiên bản đủ dài cho KrSn/BkAi (hoặc lưu snapshot JSON riêng tư) để rollback bằng versionId luôn khả dụng.
