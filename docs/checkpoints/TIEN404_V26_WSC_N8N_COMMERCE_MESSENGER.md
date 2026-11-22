# TIEN404 V26 — WS-C: n8n Commerce + Messenger (offline)

- Thời điểm: 2026-11-22 16:10–16:50 UTC
- Nguồn đầu vào: `docs/checkpoints/TIEN404_V26_SYSTEM_AUDIT.md` (Draft PR #497), mục 3 và backlog B-P0-03/04/05, B-P1-03.
- Chế độ: **chỉ đọc trên n8n và Supabase**. Không publish, không gửi tin, không ghi đơn, không sửa Draft n8n.
- n8n Cloud đang hết hạn gói → mọi kiểm thử live là **NOT RUN / BLOCKED**. Không có PASS mô phỏng nào được tính là PASS production.
- Repo public: tài liệu và test **không** chứa token, verify token, ID Google Sheet, PSID khách hay URL webhook.

Nhãn: **VERIFIED** (đối chiếu nguồn sơ cấp trong lần này) · **TESTED** (test offline chạy PASS, ghi rõ phạm vi) · **PROPOSED** · **BLOCKED** · **NOT RUN**.

---

## 1. Kết luận nhanh

1. **Create Order (KrSn4DNR9ALX5ng4):** Published `4740251a` có lỗi P0 tái hiện được: giá rác `"12abc"` thành 12đ, `"1.2tr"` thành 1,2đ, giá số lẻ được nhận, tổng vượt `MAX_SAFE_INTEGER` vẫn tạo đơn. Draft `af9ee686` sửa đúng các lỗi này, chỉ đổi **1 node** (`Validate Order`), giữ nguyên schema đầu ra. **TESTED** offline. Sẵn sàng publish khi được duyệt.
2. **Update Order (BkAi6TVUKAjCnI7v):** Draft `3bd7043f` chỉ đổi 2 dòng trong `Validate Address Update`: SĐT phải là di động `0[35789]xxxxxxxx`, địa chỉ phải có ít nhất 1 chữ cái. **TESTED** offline. Rủi ro thấp; có 1 hệ quả phụ (đơn tạo bằng số bàn 02x không tự đổi địa chỉ được nữa).
3. **HMAC webhook Messenger (Z7Fd):** **VERIFIED có kiểm chữ ký, fail-closed.** `Webhook1` (rawBody) → `Crypto` HMAC trên body thô → `Verify Signature Timing-Safe` (`crypto.timingSafeEqual`, bắt buộc header `x-hub-signature-256` dạng `sha256=<64 hex>`) → IF → sai thì trả 403 trước mọi xử lý. Execution thật 6712 (09:32Z) ghi `verified=true`. B-P0-05 đóng ở mức cấu hình; còn 2 điểm phụ (mục 4.3).
4. **Phát hiện mới — lệch live (P1):** Bridge menu **đã publish** `0d04c978` trả `mode: "catalog"` cho nút “catalog” (đang bật trong menu published version 1), nhưng Z7Fd Published `1f4069a5` **không xử lý** mode này. Khi n8n chạy lại, khách bấm nút danh mục trong persistent menu sẽ nhận **lời chào** thay vì danh mục; bấm quick reply thì rơi vào AI. **TESTED** offline bằng chính code node. Gói P4 (catalog) sửa lỗi này.
5. **Draft Messenger `41bcea84`** tách được thành **6 gói** (mục 5). Mỗi gói trùng khớp với 1 phiên bản đã lưu trong lịch sử n8n, nên có thể publish từng bước bằng `versionId` có sẵn, **không phải dựng lại workflow**, và rollback từng bước bằng phiên bản liền trước.

---

## 2. Create Order — `KrSn4DNR9ALX5ng4`

### 2.1 Phiên bản (VERIFIED, `get_workflow_history`)

| Version | Vai trò | Thời điểm | Ghi chú |
|---|---|---|---|
| `af9ee686` | **Draft** | 2026-11-09 21:29Z | “P0 STAGING: strict VND parsing and safe totals”. Backup ghi ở `TIEN404_AI_SALES_CONFIG_BACKUP_20261110`. “DO NOT PUBLISH until approved.” |
| `4740251a` | **Published** | 2026-11-09 02:02Z | Bản đang active. |

Chỉ có 2 phiên bản → không có thay đổi ẩn nào khác.

### 2.2 Diff (VERIFIED, `get_workflow_versions_diff`)

- 0 node thêm, 0 node xóa, 0 kết nối đổi. **1 node sửa: `Validate Order` (Code).**
- Thay đổi trong node:

| Hạng mục | Published `4740251a` | Draft `af9ee686` |
|---|---|---|
| Parse giá/tồn | Xóa mọi ký tự không phải số/`.,-`, rồi `parseFloat` → `"12abc"`→12, `"1.2tr"`→1.2 | Chỉ nhận số nguyên an toàn ≥0; định dạng hợp lệ: `159000`, `159.000đ`, `159,000`, `1,234,000.00`, `1.234.000,00`, hậu tố `đ`/`₫`/`vnd`. Còn lại → `NaN` → từ chối |
| Kiểm số lượng | `Number.isInteger` | `Number.isSafeInteger` |
| Kiểm giá | `Number.isFinite && > 0` | `Number.isSafeInteger && > 0` |
| Tổng tiền | `unitPrice * qty`, không kiểm | Từ chối nếu tổng không phải số nguyên an toàn |
| Mã đơn | `ORD-<giây>-<4 số ngẫu nhiên>` | `ORD-<giây>-<execution id>-<6 số>` (giảm trùng, **không** thay ràng buộc unique) |
| Schema đầu ra | 13 trường | Giống hệt (test so khóa) → `Append Order` không phải đổi |

### 2.3 Kết quả test offline (TESTED, `qa/v26-wsc/commerce-validate.test.mjs`, Node 22)

| Ca | Published | Draft |
|---|---|---|
| `159000`, `"159.000đ"`, `"159,000"`, `"1,234,000.00"`, `"1.234.000,00"`, `"159000 VND"` | đúng | đúng |
| `"12abc"` | **tạo đơn 12đ** | từ chối |
| `"1.2tr"` | **tạo đơn 1,2đ** | từ chối |
| `159.5` (số lẻ) | **tạo đơn** | từ chối |
| `"-159000"`, `""`, `"abc"`, `"đ159.000"` | từ chối | từ chối |
| giá × SL > `MAX_SAFE_INTEGER` | **tạo đơn tổng sai** | từ chối |
| SL `0, -1, 1.5, "", "abc", null` | từ chối | từ chối |
| Trùng đơn 30 phút | duplicate | duplicate |

Dữ liệu thật hiện tại (đọc Products, 19 SKU): giá dạng `159.000đ`/số, tồn là số nguyên → **cả hai bản đều tính đúng với dữ liệu hiện có**. Lỗi P0 chỉ xảy ra khi ai đó nhập giá sai định dạng vào Sheet, nhưng khi xảy ra thì đơn sai giá được ghi mà không ai biết.

### 2.4 Rủi ro khi publish Draft

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Giá dạng `"159.000 VNĐ"` bị từ chối (Published thì nhận) | Thấp (fail-safe, không ghi sai) | Dữ liệu hiện tại không có dạng này. Nếu cần, thêm `vnđ` vào regex hậu tố (PROPOSED). |
| `Number()` vẫn nhận SL `"1e2"`→100, `"0x10"`→16, `true`→1 | Thấp (AI gửi kiểu `number`) | Có sẵn trong Published; PROPOSED: SL chỉ nhận `/^\d{1,4}$/`. TESTED (ca GAP). |
| Không có idempotency thật: Sheet không có transaction; chống trùng chỉ là đọc-rồi-ghi trong 30 phút | Trung bình | Không đổi so với Published. Giải quyết ở DB tenant (B-P1-05), không ở n8n. |
| Tồn kho không bị trừ khi tạo đơn | Đã biết | Không đổi. Thông báo trả về đã ghi rõ “Tồn kho chưa bị trừ”. |

### 2.5 Gói publish B-P0-03 (PROPOSED — **chưa thực hiện, cần duyệt**)

- Điều kiện vào: n8n đã nâng gói (B-P0-01); có execution mới bất kỳ chứng minh n8n chạy.
- Thao tác: `publish_workflow(workflowId=KrSn4DNR9ALX5ng4, versionId=af9ee686-2a9f-483e-9622-6e449500ac5e)`.
- Kiểm sau publish (không ghi Sheet): `get_workflow_details` xác nhận `activeVersionId=af9ee686`; chạy `test_workflow` với pin data cho `Read Products` (giá `"12abc"`) và **pin `Append Order`** để không ghi gì → kỳ vọng `action=rejected`.
- UAT live (cần duyệt riêng vì ghi 1 dòng Sheet DEMO): đặt 1 đơn QA qua Messenger → kiểm `unit_price`, `total`, mã đơn dạng mới; đánh dấu đơn `cancelled` sau test.
- Rollback: `publish_workflow(KrSn4DNR9ALX5ng4, versionId=4740251a-cd01-4f7f-b8e1-e300a8393151)`. Không có dữ liệu cần hoàn tác (Draft không đổi cột Sheet).

---

## 3. Update Order — `BkAi6TVUKAjCnI7v`

### 3.1 Phiên bản (VERIFIED)

| Version | Vai trò | Thời điểm |
|---|---|---|
| `3bd7043f` | **Draft** “MCP draft: address and phone validation” | 2026-11-09 09:27Z |
| `93cf227a` | **Published** | 2026-11-08 18:05Z |

### 3.2 Diff (VERIFIED) — 1 node sửa: `Validate Address Update`, 2 dòng

```diff
-if (phone.length !== 10) {
+if (!/^0[35789]\d{8}$/.test(phone)) {
...
-if (newAddress.length < 10) {
+if (newAddress.length < 10 || !/[\p{L}]/u.test(newAddress)) {
```

### 3.3 Test offline (TESTED)

- SĐT `012…`, `021…`, `041…`, `061…`, `123…`: Draft từ chối, Published nhận. SĐT `03/05/07/08/09`, `+84 9…`: Draft nhận.
- Địa chỉ `"1234567890"`: Draft từ chối, Published nhận.
- Chống dò mã đơn (sai SĐT và không có đơn cùng một câu trả lời): giữ nguyên.
- Đơn không ở trạng thái `pending`: từ chối như cũ.

### 3.4 Rủi ro

- Đơn đã tạo bằng số bàn `02x` (Create Order vẫn nhận) sẽ **không tự đổi địa chỉ** được, phải qua nhân viên. TESTED (ca GAP). Chấp nhận được cho DEMO; PROPOSED: thống nhất 1 hàm chuẩn hóa SĐT cho cả Create/Update/Manage.
- Lời báo khi địa chỉ không có chữ vẫn là “quá ngắn” → hơi sai nghĩa (nhỏ).

### 3.5 Gói publish B-P0-04 (PROPOSED — chưa thực hiện, cần duyệt)

- Thao tác: `publish_workflow(BkAi6TVUKAjCnI7v, versionId=3bd7043f-78e7-4a1c-93e5-2bc9d60ac767)`.
- Kiểm sau publish: `test_workflow` pin `Lookup`/`Update` với SĐT `0123456789` → `invalid_phone`, không ghi Sheet.
- Rollback: `publish_workflow(BkAi6TVUKAjCnI7v, versionId=93cf227a-ab8a-42c6-9185-7ec44f7aeb00)`.
- Có thể publish cùng lượt với B-P0-03 (khác workflow, không phụ thuộc nhau).

---

## 4. HMAC / chữ ký webhook Messenger — B-P0-05

### 4.1 Luồng (VERIFIED từ Published `1f4069a5`, đọc cấu hình, không đọc secret)

```
GET  Webhook  → If(hub.mode=subscribe && hub.verify_token khớp) → 200 challenge | 403
POST Webhook1 (rawBody=true)
     → Crypto (HMAC, binaryData=true, credential "crypto")
     → Verify Signature Timing-Safe (Code)
     → Verify Meta Signature (IF verified===true)
          ├ true  → Respond 200 "EVENT_RECEIVED" → Extract Messenger Text / Extract Page Comments → …
          └ false → Respond 403 "Forbidden" (dừng)
```

- Node Code: chỉ chấp nhận digest 64 hex và header `sha256=<64 hex>`; so bằng `crypto.timingSafeEqual`. Thiếu header, sai thuật toán, sai độ dài, chữ hoa → `verified=false`.
- Mọi nhánh xử lý (tin nhắn, comment, voice, menu, đơn hàng) đều nằm **sau** IF chữ ký. Trigger còn lại duy nhất là Manual Trigger.
- Bằng chứng chạy thật: execution 6712 (2026-11-22 09:32Z, mode webhook) có `Verify Signature Timing-Safe → {verified:true}` và đi tiếp vào nhánh true. Vậy credential HMAC khớp App Secret và thuật toán là SHA-256 (ít nhất tại thời điểm đó). **VERIFIED.**
- Test offline (TESTED, `messenger-packages.test.mjs`, 6 ca): đúng chữ ký → true; thiếu header, sai secret, body bị sửa, header sha1/chữ hoa/thiếu 1 ký tự/mảng, digest MD5 → false, không ném lỗi.
- Draft `41bcea84` **không đổi** bất kỳ node nào trong chuỗi chữ ký (VERIFIED qua 8 diff).

### 4.2 Kết luận B-P0-05

**Đóng ở mức cấu hình + test offline.** Kiểm synthetic trên endpoint live (gửi POST không chữ ký, kỳ vọng 403) là **NOT RUN** vì n8n đang dừng; đề xuất chạy sau khi nâng gói (không gửi tin cho khách, chỉ gọi webhook).

### 4.3 Điểm phụ (PROPOSED)

| # | Phát hiện | Mức | Đề xuất |
|---|---|---|---|
| H-1 | Verify token cho GET nằm dạng chữ thường trong node IF (không phải credential). Ai có JSON workflow/export đều thấy. | Thấp–TB (chỉ cho phép đăng ký lại webhook khi biết cả URL; không vượt được HMAC của POST) | Xoay token, chuyển sang biến môi trường/credential; không export JSON Z7Fd ra repo public. Cần duyệt vì đổi cấu hình Meta. |
| H-2 | Chữ ký Meta không có timestamp → body đã ký có thể bị phát lại. | Thấp | Đã có giảm thiểu: `Skip Duplicate Message ID` (data table), cửa sổ thời gian 23h trong `Extract`, `Skip Duplicate Comment`. Giữ nguyên. |
| H-3 | `Verify Signature Timing-Safe` mất ~1,6 s mỗi lần (exec 6712). | Hiệu năng | Không phải lỗi bảo mật; có thể gộp Crypto+so sánh vào 1 node sau này. |

---

## 5. Tách Draft Messenger `41bcea84` thành gói độc lập — B-P1-03

### 5.1 Chuỗi phiên bản (VERIFIED, `get_workflow_history` + 8 lần `get_workflow_versions_diff` nối tiếp)

`1f4069a5` (Published) → `abd98c7e` → `c7696472` → `b967d427` → `9c08fdd3` → `18125761` → `9a705cbe` → `9342025c` → `41bcea84` (Draft hiện tại)

Mỗi bước chỉ đổi đúng các node ghi trong bảng dưới; không node nào bị xóa; không bước nào chạm vào chuỗi chữ ký, AI Agent, tool đơn hàng, voice hay handoff transfer.

### 5.2 Các gói

| Gói | Version(s) | Node đổi | Hành vi thay đổi | Phụ thuộc | Rủi ro | Test offline |
|---|---|---|---|---|---|---|
| **P1 Handoff theo vai trò** | `abd98c7e` | `Áp quyết định menu` (+1 dòng `menuHandoffTeam` theo allowlist 6 team), `Notify customer and Inbox of handoff request` (câu báo) | Câu báo khi chuyển nhân viên nêu đúng bộ phận; không còn hứa “nhân viên hỗ trợ ngay tại đây”. Áp cho **mọi** handoff, không chỉ nút menu (handoff gõ chữ dùng “nhân viên hỗ trợ”). | Bridge published đã trả `team` (VERIFIED) | Thấp: chỉ đổi văn bản | TESTED (allowlist, team lạ bị bỏ) |
| **P2 Khớp nút menu theo Page+người gửi** | `c7696472` + `b967d427` | `Tìm nút menu` | Khóa ghép `(pageId, senderId, mid)` thay vì chỉ `mid`; thêm fallback `attachment_<sender>_<ts>` cho quick reply không có `mid` (khớp `Extract`). | Không | Thấp | TESTED (Published bị lẫn payload giữa 2 người gửi trùng `mid`, Draft thì không) |
| **P3 Nút SKU khi AI liệt kê ≥4 mẫu** | `9c08fdd3` | `Prepare Messenger Reply` | AI trả danh sách 4+ SKU (gạch đầu dòng hoặc `1.`/`1)`) vẫn có 3 nút “Xem SKU” đầu tiên; giữ giới hạn 1–3 tin. | Không | Thấp | Không có test riêng (logic regex đơn giản; PROPOSED thêm) |
| **P4 Danh mục phân trang** | `18125761` + `9342025c` (**phải đi cùng nhau**) | +3 node (`Danh mục Messenger cần phân trang?`, `Đọc danh mục Products DEMO`, `Trình bày trang danh mục Messenger`); sửa `Extract Messenger Text` (nhận `T404:C:`), `Prepare Messenger Reply` (nhánh `catalog_page`), `Tìm nút menu` (nhận `T404:C:`, giới hạn 100 ký tự), `Áp quyết định menu` (xử lý `mode:catalog` + digest) | Nút “catalog” hiện 3 SKU/trang với giá/tồn từ Sheet, nút Xem SKU, quick reply Trang trước/tiếp; con trỏ gắn version menu + checksum danh mục, từ chối trang cũ. Chỉ cho Page DEMO. **Sửa lệch live ở mục 1.4.** | P2 (cùng node `Tìm nút menu`); bridge published `0d04c978` (đã có cú pháp con trỏ có digest) | TB: thêm 1 lần đọc Sheet mỗi lần bấm trang; khách bấm trang khi danh mục vừa đổi sẽ nhận câu “mở lại danh mục” | TESTED: con trỏ `18125761` (không digest) **bị bridge published từ chối** → không được publish riêng `18125761`; con trỏ `9342025c` khớp cả Prepare và bridge; độ dài tối đa 61 ký tự (>40 cũ, ≤100 mới); Apply Draft biến quyết định bridge thành `catalog_page`, từ chối `configVersion` dạng chuỗi |
| **P5 Reaction shadow ALL OFF** | `9a705cbe` | +1 node `V21 Social Reactions Shadow (ALL OFF)` chèn giữa `Classify explicit human request` và `Human handoff request?` | Không đổi hành vi: `PAGE_POLICIES` rỗng → trả nguyên item. Không gửi Meta, không credential. | Không | Thấp (thêm 1 node Code trên đường chính; nếu node lỗi cú pháp thì chặn mọi tin) | Không test riêng; PR #493 có test logic |
| **P6 Đối soát số tin Meta đã nhận** | `41bcea84` | `Verify Messenger Send Result` | Chỉ ghi “đã trả lời” khi Meta xác nhận **đủ đúng** số tin đã lên kế hoạch và `message_id` không trùng; thiếu → lỗi, không ghi, không tự gửi lại. | Không | TB: lỗi giữa chừng tạo execution lỗi (được lưu, có thể chứa PII); khách có thể đã nhận 1–2 tin | TESTED (kế hoạch 3, Meta xác nhận 2: Published vẫn ghi đã trả lời, Draft ném lỗi; trùng `message_id` → lỗi) |

### 5.3 Thứ tự publish đề xuất (PROPOSED — mỗi bước cần duyệt riêng, sau khi n8n chạy lại)

Vì các bước nối tiếp nhau trong lịch sử, publish theo thứ tự dưới đây dùng **đúng snapshot đã lưu**, không phải sửa Draft:

| Bước | `publish_workflow(Z7FdV7uDvApfbURQ, versionId=…)` | Gồm gói | UAT live (cần duyệt, NOT RUN) | Rollback |
|---|---|---|---|---|
| S0 | (không publish) | — | Smoke trên `1f4069a5`: “Xin chào” có trả lời; xác nhận n8n chạy lại | — |
| S1 | `b967d427-62e6-40aa-90f4-60d222bb6e03` | P1 + P2 | Bấm nút “Gặp nhân viên” trong menu → câu báo đúng bộ phận, chuyển Inbox thành công; bấm quick reply menu → đúng mục | publish `1f4069a5-5e74-4c79-935b-40f02b3582d8` |
| S2 | `9c08fdd3-7583-49e5-adb4-8b4d9e0c0688` | + P3 | Hỏi “shop có áo nào” → tin có 3 nút Xem SKU | publish `b967d427` |
| S3 | `9342025c-ea16-4965-97ac-bc4b98591996` | + P4 + P5 | Bấm “catalog” → trang 1/N có 3 nút; “Trang tiếp” → trang 2; đổi giá 1 SKU rồi bấm trang cũ → câu “Danh mục đã thay đổi” | publish `9c08fdd3` |
| S4 | `41bcea84-703d-40bc-be2a-71f84ca4e2d8` | + P6 | 1 tin dài (2 tin trả lời) → bản ghi “đã trả lời” có 2 `message_id` | publish `9342025c` |

Ghi chú:
- Có thể gộp S1–S3 nếu chủ dự án muốn sửa lỗi lệch catalog nhanh; rollback vẫn là `1f4069a5`.
- P5 (shadow, không hành vi) đi kèm S3 vì nằm giữa `18125761` và `9342025c` trong lịch sử. Muốn bỏ P5 thì phải dựng phiên bản mới (sửa Draft) — **không làm** trong lượt này để không đè Draft của phiên khác.
- Không publish `18125761` riêng (con trỏ không digest bị bridge từ chối, TESTED).
- Rollback khẩn cấp của toàn bộ Messenger: publish `1f4069a5` (bản live hiện tại). `47b48f6d` là bản trước menu, chỉ dùng nếu chính menu/bridge gây lỗi.

### 5.4 Việc không thuộc gói nào, cần quyết định riêng

- **Lệch live catalog** (mục 1.4): nếu chưa muốn publish P4, có thể tạm **tắt mục `catalog` trong menu published** (Config Core) để nút không xuất hiện. Đây là ghi DB → cần duyệt.
- `saveDataSuccessExecution=none` giúp không lưu PII nhưng làm UAT khó chứng minh; khi UAT, cần bật tạm hoặc dùng bằng chứng phía Meta/ảnh chụp (cần duyệt).

---

## 6. Trạng thái nhãn

| Hạng mục | Nhãn |
|---|---|
| Diff Create/Update Order | VERIFIED |
| Lỗi parse giá Published, bản sửa Draft | TESTED (offline, 50 ca) |
| HMAC Messenger fail-closed | VERIFIED (cấu hình + exec 6712) + TESTED (offline 6 ca) |
| Kiểm HMAC trên endpoint live | NOT RUN (n8n hết hạn) |
| Lệch live catalog (bridge vs Z7Fd) | VERIFIED (code + menu published) + TESTED (offline); hành vi live NOT RUN |
| Tách 6 gói Messenger, thứ tự publish | PROPOSED |
| Publish bất kỳ workflow | BLOCKED (chờ nâng gói n8n + duyệt) |
| UAT live Messenger / ghi đơn thật | NOT RUN / BLOCKED |

Tổng test offline: **68/68 PASS** (`node --test qa/v26-wsc/*.test.mjs`, Node 22.23). Code node trong `qa/v26-wsc/nodes/` được chép nguyên văn từ lịch sử phiên bản n8n (read-only), tên file ghi version.

## 7. Phương pháp

- n8n MCP: `get_workflow_history`, `get_workflow_versions_diff` (10 lần), `get_workflow_version` (Z7Fd `1f4069a5`, KrSn `af9ee686`), `get_workflow_execution` (6712, chỉ 2 node chữ ký), `search_workflow_executions`.
- Supabase staging: 3 câu `SELECT` đọc `get_channel_menu` (cấu trúc menu, kiểu `version_no`). Không ghi.
- Google Sheet AI_SALES_DEMO: đọc tab Products (không có PII) để kiểm định dạng giá.
- Không đọc secret/credential; không export JSON workflow vào repo.
