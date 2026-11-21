# CHANNEL_ACCEPTANCE_CHECKPOINT — Messenger → đơn → Zalo (2026-11-21, ~14:00 UTC)

Nhánh `claude/project-thread-q1rpmb` (xếp trên #483 `bf1853a`). Không có thay đổi nào trên n8n, Supabase, Sheet hay Meta trong vòng này: chỉ đọc + test offline. Không cần rollback runtime.

## 1. Bản đang chạy (đã đọc trực tiếp)

| Thành phần | ID | Published | Draft | Nguồn dữ liệu |
|---|---|---|---|---|
| Messenger bot `TIEN404_MESSENGER_TEST` | Z7FdV7uDvApfbURQ | `e1f62ebc` (publish 13:45Z, "Nhớ mẫu vừa bấm" = bản sửa F-01); trước đó `f8c23034` (13:14Z) | = published | Catalog: Google Sheet **AI_SALES_DEMO/Products**; đơn: **AI_SALES_DEMO/Orders** |
| Create order tool | KrSn4DNR9ALX5ng4 | `4740251a` | `af9ee686` (khác) | AI_SALES_DEMO/Orders (append), không trừ kho |
| Manage order (sửa SKU/SL/tên/SĐT) | fDB9dvs1qPPVt9Sp | `137d5689` (còn lỗi S-18) | `2e8786fd` (khác) | AI_SALES_DEMO/Orders |
| Update address | BkAi6TVUKAjCnI7v | `93cf227a` (theo checkpoint #483 12:00Z) | khác | AI_SALES_DEMO/Orders |
| Order status (tra cứu) | 4DFFCk60exrzaIl6 | `1faaa1ee` | = published | AI_SALES_DEMO/Orders, chỉ đọc |
| Commerce AI Core | iyfGUiEsZlNTBWOR | `456862c9` (theo checkpoint #483 12:00Z) | khác | Chỉ gọi khi tin bắt đầu `QA_CORE:`; DEMO chỉ đọc |
| Zalo Bot staging | yIJk8LvJoLF40Z62 | `2d912cb0` | = published | Không lưu execution; chỉ nhận + ghi marker không PII; **không gửi trả lời, không tra đơn** |
| Supabase staging | ifxlvrhyjhbzbrkdsida | 21 migration (max 20261117074559) + Store V20 | — | `tien404_qa_sandbox_orders` 1 dòng, `orders` 2 dòng; **không workflow nào ghi** |

Kết luận: Messenger **vẫn dùng công cụ DEMO** (Sheet AI_SALES_DEMO) cho catalog và đơn. Commerce Core chỉ chạy ở nhánh `QA_CORE:` và trả lời mô phỏng. Hệ thống truy cập được: GitHub, n8n, Supabase (SQL), Google Sheets. Không truy cập: Meta Business/App, Zalo console, Render, Cloudflare (proxy chặn).

## 2. Kết quả nghiệm thu

Mức bằng chứng: **L** = local/mock, **API** = staging/production qua API (đọc execution, SQL, Sheet), **E2E** = đầu-cuối qua giao diện khách. PSID khách che thành `…4451`.

| Chức năng | Kênh / môi trường | Phiên bản | Ca đã chạy | Kỳ vọng | Kết quả thực tế | Bằng chứng (đã che) | Trạng thái |
|---|---|---|---|---|---|---|---|
| Nhận tin "Xem A003" | Messenger, Page …9912 (live) | Z7Fd f8c23034 | Tin text 13:39:26Z của chủ dự án | Webhook nhận, HMAC đúng, đúng Page | `verified:true`, `chatInput:"Xem A003"` | exec 5832 (API) | PASS |
| Trả lời A003 đúng catalog | Messenger live | f8c23034 + Sheet | Cùng ca | 159.000đ, tồn 18 (Sheet lúc 13:50Z) | "A003 — Áo thun nam đen basic (size L) · 159.000₫ · tồn 18" + nút "Xem A003" | exec 5832; Sheet Products r3 (API) | PASS |
| Meta nhận tin gửi đi | Messenger live | f8c23034 | Cùng ca | Graph API trả message_id cho đúng người nhận | `recipient_id` = …4451, có `metaMessageId` | exec 5832 node Verify Messenger Send Result (API) | PASS |
| Khách nhìn thấy phản hồi | Messenger app | — | — | Chủ dự án thấy tin trên điện thoại | Gián tiếp: 13:39:47 chủ dự án bấm đúng nút "Xem A003" có trong tin trả lời | exec 5836 (postback sinh từ nút) | PASS (gián tiếp) |
| Nút "Xem A003" / "Xem A002" | Messenger live | f8c23034 | Postback 13:39:47, 13:42:28 | Đọc Sheet theo SKU, không qua AI | A003 159.000đ còn 18; A002 159.000đ còn 25 | exec 5836, 5838 (API) | PASS |
| Giữ ngữ cảnh khi đổi mẫu | Messenger live | f8c23034 | Bấm "Xem A002" → hỏi "Mẫu mình vừa bấm là mẫu nào…2 cái bao nhiêu?" | Trả lời A002 | **Trả lời A003**, 318.000₫ (sai mẫu; giá tình cờ bằng nhau) | exec 5838 → 5840 (API); test `messenger-postback-context` 3/3 (L) | **FAIL (F-01)** trên f8c23034; e1f62ebc chờ ca A002 |
| Hỏi giá không tạo đơn | Messenger live | f8c23034 | 5 tin hỏi giá 13:08–13:44 | Không gọi create_order | Không execution nào của KrSn; Orders vẫn 6 dòng | Sheet Orders A2:A7 (API) | PASS |
| Giữ số lượng qua lượt | Messenger live | f8c23034 | "2 cái bao nhiêu?" → "Còn mẫu đen, số lượng như trên" | Dùng lại SL 2 | Đúng 2 cái | exec 5816, 5820 (API) | PASS |
| Không báo giá hàng hết | Messenger live | f8c23034 | "Còn mẫu đen…" | A011 (tồn 0) phải ghi hết hàng | Liệt kê "A011 … 2 cái = 578.000₫", không nói hết hàng | exec 5820 (API) | **FAIL (F-02)** |
| Tài khoản QA không phải admin | Messenger | — | — | Kết quả riêng cho khách thường | Hôm nay chỉ có 1 PSID (…4451). Không đọc được vai trò Meta từ phiên này | — | NOT RUN |
| Tạo đơn: thiếu thông tin / SL sai / vượt tồn / hết hàng / SKU lạ | Logic published KrSn | 4740251a | 8 ca | rejected, không ghi | Đúng cả 8 | `published-order-tools.test.mjs` (L) | PASS (L) |
| Tạo đơn hợp lệ A003×2 | Logic published KrSn | 4740251a | 1 ca | pending, 159.000×2=318.000, không trừ kho | Đúng | cùng file (L) | PASS (L) |
| Xử lý lại cùng yêu cầu | Logic published KrSn | 4740251a | replay < 30 phút | duplicate, cùng mã đơn | Đúng | cùng file (L) | PASS (L) |
| Tạo đơn qua Messenger thật | Messenger → Sheet DEMO | f8c23034 + 4740251a | — | Mã đơn + dòng mới trong Orders | Chưa chạy: đích ghi là Sheet AI_SALES_DEMO dùng chung với bot live, chưa có kho QA riêng | — | BLOCKED (chờ chủ dự án) |
| Sửa SKU/SL đơn | Logic fDB9 | 137d5689 | S-18 (đã tái hiện ở #483) | Sửa được khi Sheet có nhiều đơn | Từ chối mọi lần sửa khi Orders ≥2 dòng (hiện 6) | `manage-order-s18-fix.test.mjs` 4/4 (L) | FAIL (S-18, chưa publish bản sửa) |
| Tra cứu đơn: đúng mã + SĐT | Logic 4DFF | 1faaa1ee | 1 ca | found, đúng tổng | Đúng | `published-order-tools.test.mjs` (L) | PASS (L) |
| Khách B biết mã đơn | Logic 4DFF | 1faaa1ee | sai SĐT; mã không tồn tại | Phản hồi chung, không lộ dữ liệu, không lộ đơn có tồn tại | Đúng; hai thông báo giống hệt | cùng file (L) | PASS (L) |
| Zalo Bot nhận sự kiện | Zalo Bot staging | yIJk 2d912cb0 | — (lần cuối) | Marker cập nhật | `v1_ingress_any=ACCEPTED` lúc 2026-11-18 02:42Z; không có sự kiện hôm nay | data table TIEN404_QA_SHOP_B_PAIRING_TRACE (API) | PASS cũ / NOT RUN hôm nay |
| Zalo Bot trả lời khách | Zalo Bot | 2d912cb0 | — | — | Không có node gửi trong workflow | đọc workflow (API) | NOT IMPLEMENTED |
| Zalo xác minh chủ đơn + xem đơn Messenger | Zalo | — | — | — | Không workflow nào nối Zalo với Orders/Commerce | đọc yIJk, OgDZ (API) | NOT IMPLEMENTED |
| Zalo OA | — | — | — | — | Không có webhook OA đang hoạt động | search_workflows (API) | NOT IMPLEMENTED |
| Quyền chủ Shop A/B | Supabase staging | Store V20 | UAT JWT giả lập (thread #483) | Mỗi chủ chỉ thấy shop mình | PASS (tái sử dụng E-30, không chạy lại) | `store-owner-ab-uat.sql` (API) | PASS (tái sử dụng) |
| Widget/website | GitHub Pages | gh-pages ff2daf9 | Thread #483 E-29 | Mở/thu gọn, mobile | PASS giao diện; adapter commerce khóa | E-29 (E2E) | PASS UI (tái sử dụng) |
| Dashboard/admin/subscription | Render | — | — | — | Không truy cập Render; Super Admin chỉ là backend SQLite local (68/68 ở #483) | — | BLOCKED |
| Thông báo chủ shop / Outbox | — | — | — | — | Không có bảng outbox, đơn không báo chủ shop | SQL list bảng (API) | NOT IMPLEMENTED |
| Bộ CSV 96 + 36 ca | — | — | — | — | Không tìm thấy trong repo/Drive (đã tìm ở #483); Supabase có 137 tester_cases | — | NOT RUN |

Tổng test offline vòng này: 17 + 3 = **20/20 PASS** (cộng 14/14 tái chạy của #483). Lệnh: `node --test qa/v21-channel-acceptance/*.test.mjs qa/v21-full-acceptance/*.test.mjs`.

## 3. Lỗi mới

- **F-01 (P1, sai sản phẩm)**: nút "Xem SKU" trả lời qua nhánh Sheet, không ghi vào bộ nhớ hội thoại; câu hỏi tiếp theo AI vẫn hiểu mẫu cũ. Hậu quả: khách có thể chốt nhầm mẫu. Bản sửa đề xuất `qa/v21-channel-acceptance/F01-postback-memory.patch.json`.
  - Cập nhật 13:55Z: chủ dự án duyệt publish. Khi kiểm tra thì Z7Fd đã có bản sửa tương đương `e1f62ebc`, publish 13:45Z từ một phiên MCP khác trong tài khoản chủ dự án (node "Remember selected Messenger product" ghi vào chính `Messenger Memory`, rồi mới gửi). Phiên này KHÔNG publish thêm để tránh ghi đè. Exec 5845 (13:49Z): node ghi bộ nhớ `success:true` (API). Exec 5847 trả lời đúng A003, nhưng A003 cũng là mẫu cũ nên chưa phân biệt được → nghiệm thu lại cần bấm **A002** rồi hỏi. Rollback: `restore_workflow_version` → `f8c23034-df7b-4229-8a55-0418f518fb08` rồi publish.
- **F-02 (P1, sai tồn)**: AI liệt kê A011 (tồn 0) kèm tổng tiền như còn hàng. Sửa bằng prompt ("chỉ báo giá mẫu còn hàng; mẫu tồn 0 phải ghi hết hàng") — cần publish Z7Fd, chưa làm.
- **F-03 (P2)**: verify token Meta GET nằm thẳng trong tham số node `If` của Z7Fd (đọc được bởi ai xem workflow). Nên chuyển vào credential khi được duyệt.

## 4. Cần chủ dự án

1. F-01: đã duyệt, bản sửa đang chạy (`e1f62ebc`); cần chạy ca 1 ở mục 5. F-02 vẫn cần duyệt riêng.
2. Quyết định Sheet AI_SALES_DEMO có được dùng làm kho đơn QA không. Nếu có, chủ dự án tự gửi kịch bản đặt đơn (mục 5) trên Messenger.
3. S-18 + Draft KrSn/fDB9/BkAi: thẻ duyệt đang chờ ở thread #483.

## 5. Kịch bản chủ dự án tự chạy (Messenger, Page TIEN404)

| # | Gửi | Phải thấy |
|---|---|---|
| 1 | Bấm nút "Xem A002" rồi gõ `Mẫu mình vừa bấm là mã gì?` | A002, áo thun trắng size M, 159.000đ, còn 25 (bản `e1f62ebc`) |
| 2 | `Cho mình đặt 0 cái A003` | Bot hỏi lại số lượng, không ra mã đơn |
| 3 | `Đặt 19 cái A003` | Báo không đủ hàng (còn 18) |
| 4 | `Đặt 2 cái A003, tên QA Khach A, SĐT 0900000001, địa chỉ QA 1 Q1 HCM` → khi bot tóm tắt, gõ `Xác nhận` | Mã `ORD-…`, tổng 318.000đ, trạng thái chờ xử lý; Sheet Orders thêm đúng 1 dòng; tồn A003 vẫn 18 |
| 5 | Gõ lại y hệt tin 4 và xác nhận | "Đã có đơn tương tự", không thêm dòng |
| 6 | `Kiểm tra đơn <mã> SĐT 0900000002` | Phản hồi chung "không tìm thấy đơn khớp" |

Bước 4–5 ghi vào Sheet AI_SALES_DEMO (dữ liệu giả, SĐT 0900000001). Xóa dòng QA sau khi xong.
