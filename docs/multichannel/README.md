# V24 — Nối bot AI chính sang nhiều kênh

Ngày: 2026-11-22 · Nhánh: `claude/project-thread-srmvl4` · Trạng thái: **bản nháp, chưa publish kênh nào mới**

## 1. Kiến trúc

```
 Messenger (live, Z7Fd) ─┐
 Instagram   (chưa có) ──┤   adapter kênh: xác thực nguồn, chuẩn hoá,      ┌──────────────────────────────┐
 Telegram    (nháp)   ───┼─► chặn tin lạ, gõ "đang trả lời" ─────────────► │ TIEN404 BOT CORE (nháp)       │
 Web widget  (nháp)   ───┤                                                 │ • fast path "Xem A003" (Sheet)│
 Zalo        (Worker) ───┤   ◄─ hiển thị theo kênh, tối đa 3 tin ───────── │ • AI agent + 5 tool đơn hàng  │
 TikTok Shop (bị chặn) ──┘                                                 │ • bộ nhớ theo kênh:tk:người   │
                                                                           └──────────────────────────────┘
```

Hợp đồng chung (giống nhau cho mọi kênh):

| Bước | Dữ liệu |
|---|---|
| Adapter → lõi | `channel, accountId, senderId, messageId, text, mediaType, selectedSku?, memoryUserText?` |
| Lõi → adapter | `replyText, skus[], source (fast_path / ai / timeout), channel, accountId, senderId, messageId` |
| Adapter → khách | 1 tin mặc định, 2 khi thật cần, **tối đa 3** (quy tắc số tin của chủ dự án) |

Phiên hội thoại = `kênh:tài khoản:người gửi`, nên khách Telegram và khách web không bao giờ thấy lịch sử của nhau.
Lõi gắn thêm dòng `[Kênh: Telegram]` vào đầu tin để AI biết kênh, prompt cấm nhắc lại dòng này cho khách.

## 2. Cái gì ở đâu

| Thành phần | Vị trí |
|---|---|
| Hàm adapter thuần (Telegram, web, Instagram, chia tin, HTML Telegram, định dạng mẫu) | `channels/lib/channel-adapters.mjs` |
| Unit test (13) | `qa/multichannel/channel-adapters.test.mjs` |
| Widget nhúng website (không thư viện ngoài, sáng/tối, màn hình điện thoại) | `channels/widget/tien404-chat-widget.js`, `channels/widget/demo.html` |
| Kiểm tra widget trên trình duyệt (endpoint giả) | `qa/multichannel/widget-browser.cjs` |
| Workflow n8n (ID + code SDK) | `channels/n8n/` |

## 3. Kết quả kiểm thử (2026-11-22, giờ UTC)

| Test | Kết quả | Bằng chứng |
|---|---|---|
| Unit test adapter | 13/13 PASS | `node --test qa/multichannel/channel-adapters.test.mjs` |
| Web: "Xem A003" → fast path đọc Sheet thật | PASS, 3,9 s, trả đúng giá/tồn | n8n exec 6320 (lõi 6321) |
| Web: hỏi tiếp "mẫu này 2 cái bao nhiêu" cùng phiên | PASS, AI nhớ A003, tính 318.000đ | exec 6322 |
| Web: origin lạ | PASS, bị chặn 400, không gọi lõi | exec 6324 |
| Web: phiên khác hỏi "mẫu này" | PASS, không lộ ngữ cảnh phiên khác | exec 6325 |
| Telegram: tin riêng (gửi giả, chặn ở node gửi) | PASS, 8,8 s, 1 tin | exec 6327 (lõi 6328) |
| Widget trên Chromium 390px | PASS: cùng phiên 2 lượt, nút "Xem A002", chặn chèn HTML, không tràn ngang | `qa/multichannel/widget-browser.cjs` |

Không gửi tin Telegram/Messenger thật, không ghi đơn, chỉ đọc Sheet AI_SALES_DEMO. AI chạy qua n8n AI Gateway như bot Messenger hiện tại.

## 4. Tình trạng từng kênh

| Kênh | Nhãn | Ghi chú |
|---|---|---|
| Web widget | IMPLEMENTED + TESTED (nháp) | Cần chủ dự án duyệt publish. Trước khi mở công khai nên thêm chống spam (Cloudflare Turnstile hoặc giới hạn tần suất), vì endpoint công khai có thể bị gọi liên tục làm tốn credit AI và tạo đơn rác vào Sheet demo. |
| Telegram | IMPLEMENTED + TESTED (nháp) | Dùng credential n8n "Telegram account" có sẵn, chưa xác minh đó là bot nào. Publish = đăng ký webhook Telegram. Bản đầu gửi chữ thường, chưa có nút "Xem A002" (node Telegram của n8n không tạo nút động; cần node HTTP với token bot). |
| Messenger | PROPOSED | Z7Fd vẫn chạy bản riêng. Đề xuất: thay khối AI trong Z7Fd bằng lời gọi lõi chung để chỉ còn một nơi sửa prompt. Đây là thay đổi live, cần duyệt riêng. Hiện lõi là **bản sao** prompt + tool của Z7Fd 4b0fe018, nên sửa prompt Messenger phải sửa cả lõi cho tới khi gộp. |
| Instagram | PROPOSED / BLOCKED | Adapter `normalizeInstagram` + `composeInstagram` đã có và có test. Cần: tài khoản Instagram chuyên nghiệp nối với Page, quyền nhắn tin Instagram trên Meta app và App Review (Advanced Access) mới trả lời được khách ngoài nhóm thử. |
| TikTok Shop | BLOCKED | Cần đăng ký TikTok Shop Partner Center (ứng dụng đối tác), shop uỷ quyền và được cấp quyền API chăm sóc khách hàng. Chưa có tài khoản/ứng dụng nào. Chưa viết adapter vì chưa xác minh được định dạng webhook thực tế. |
| Zalo | PROPOSED | Đường Zalo hiện tại (Worker + n8n yIJk/OgDZ) trả lời theo luật cố định, không qua AI. Có thể gọi lõi chung sau khi các kênh trên ổn định. |

## 4b. Tin nhắn thoại dùng chung (V24.1)

Cách làm lấy từ Zalo V22.5 (PR #486), mở rộng cho cả danh mục AI_SALES_DEMO và mọi kênh:

```
adapter kênh ─ tải file thoại → base64 ─► TIEN404 VOICE (F7EhVGWIALKWg8Y6)
                                            1. đọc mã + tên SP từ Sheet → gợi ý cho Gemini
                                            2. Gemini 3.5 Flash Lite (miễn phí): transcript + ý định + mã + số lượng (JSON)
                                            3. luật đọc transcript đối chiếu mã/số lượng
                                            ├─ chắc  → lõi chung (hỏi giá có mã → fast path; còn lại → AI kèm "mã nghe được")
                                            └─ không chắc → 1 tin hỏi lại khách, không gọi AI bán hàng
```

Chặn sai (từ test thật): Gemini nghe giọng khó thường "bịa" ra đúng tên sản phẩm trong danh mục (exec 6379-6381) → transcript trùng tên SP bị coi là không rõ; khách đọc mã mà luật không khớp mã nào nhưng Gemini vẫn đoán mã (exec 6385: "đê không không hai" → A002) → hỏi lại mã. Trả lời Telegram mở đầu bằng `🎤 Shop nghe: "..."` để khách thấy bot hiểu gì, vẫn 1 tin.

| Test tin thoại | Kết quả | Bằng chứng |
|---|---|---|
| Unit test hàm hiểu thoại | 12/12 PASS (tổng 25/25 cả adapter) | `node --test qa/multichannel/*.test.mjs` |
| s1 "giá a không không ba bao nhiêu" (giọng máy) | PASS: A003, luật + Gemini khớp → fast path | VOICE exec 6395 |
| s2 "mua bê không không hai, hai cái" (giọng máy, Gemini nghe "mô đen") | PASS an toàn: hỏi lại, không báo sai mẫu | exec 6396 |
| s3 "quần jean nam dưới bốn trăm nghìn" | PASS: chuyển nguyên câu cho AI | exec 6397 |
| s4 tiếng ồn | PASS: hỏi lại | exec 6398 |
| Telegram đầu-cuối (tin thoại giả lập, chặn ở node gửi) | PASS 7,3 s, 1 tin: "🎤 Shop nghe … A003 — Áo thun nam đen basic size L, 159.000đ, còn 18" | exec 6405 (VOICE + lõi 6407) |
| **Telegram LIVE, giọng thật của chủ shop** | PASS 10,5 s, 1 tin: nghe "Áo A không không ba bao nhiêu?" → A003 159.000đ, còn 18 | exec 6427 (VOICE 6428) |
| Messenger bản nháp: tin thoại + tin chữ cùng lúc | PASS: tin thoại → A003 có quick reply; tin chữ A002 như cũ | Z7Fd exec 6433 (gửi bị chặn) |
| Messenger bản nháp: chỉ tin chữ (hồi quy) | PASS: "Xem A004" → A004 như bản live | exec 6438 |
| Messenger bản nháp: thoại không rõ | PASS: 1 tin hỏi lại, không gọi AI | exec 6440 |

**Messenger giọng thật (01:45Z, cả 3 tin đều nói A003)**: exec 6450/6453/6456 nghe thành "A000 bo gió", "Áo thun form boy", "Xem lại A000" → bot hỏi lại 2 tin, 1 tin chuyển AI (không báo sai giá). Thử lại cùng file trên Gemini Flash Lite và Flash (QA tạm, đã archive): cả hai nghe "ba" thành "bo/bò/boy", "giá" thành "gió"; có lần ra **A002** (exec 6477) → bản live V24.1 sẽ báo giá A002 sai mẫu.

**V24.2 (VOICE LIVE bản 36006c21, Tiến duyệt 02:04Z; rollback b26706ca)**: mã có tiếng giống "ba" ngay sau (bo/bò/boy, cả "áo không không bo") → hỏi "Dạ shop nghe chưa chắc mã, mình hỏi mã A002 hay A003 ạ?"; mã chỉ do luật đọc ra hoặc Gemini chưa chắc → hỏi xác nhận 1 mã; chỉ trả lời thẳng khi Gemini + luật cùng 1 mã và Gemini "high". Test: 26/26 unit; 3 file thật (exec 6493): hỏi lại / chuyển AI / "có phải A003?"; 4 mẫu cũ (6503): A003 vẫn trả lời thẳng, 3 mẫu còn lại vẫn hỏi lại an toàn. Áp cho mọi kênh vì chỉ sửa VOICE.

Đã bật (Tiến duyệt 01:33Z 22/11): VOICE `F7Eh` bản b26706ca, Telegram `fffB` bản fb6e283c. Rollback Telegram = publish lại 008afb65 (chỉ chữ).

Messenger (Z7Fd, live): nhánh thoại đã làm và test ở bản nháp, lưu trong lịch sử n8n là bản **b2245495** (và `channels/n8n/messenger-voice.ops.json`). Bản nháp đã được trả về 8f7dcb4f (= bản live) để không ai publish nhầm. Bật = publish b2245495 khi Tiến duyệt; rollback = publish 8f7dcb4f. Tin thoại Messenger tới từ CDN của Meta (`*.fbcdn.net`, `*.fbsbx.com`), thường là mp4/aac; chưa thử Gemini với file Messenger thật. Web widget chưa nối (cần nút ghi âm).

## 5. Rủi ro còn lại

- R1: Lõi và Z7Fd là hai bản prompt riêng cho tới khi gộp (lệch nội dung).
- R2: Web endpoint công khai chưa có chống spam (xem trên).
- R3: AI đôi khi mời đặt hàng sớm dù prompt cấm (thấy ở exec 6327); vấn đề của prompt chung, Messenger cũng có.
- R4: Bộ nhớ hội thoại là bộ nhớ tạm của n8n (Window Buffer), mất khi n8n khởi động lại, giống Messenger hiện tại.
- R6: Giọng thật dễ nghe hơn giọng máy dùng để test, nhưng Gemini Flash Lite vẫn có thể nghe sai; bot luôn nhắc lại câu nghe được và hỏi lại khi không chắc. Gói miễn phí Gemini có giới hạn số lần gọi/phút.
- R5: Lõi đang ghi đơn/phiếu hỗ trợ vào cùng Sheet demo với Messenger. Phiếu hỗ trợ có `sender_id` dạng `telegram:<id>` / `web:<phiên>` để phân biệt kênh.

## 6. Rollback

- Telegram: publish lại `fffB` bản 008afb65 (chỉ chữ), hoặc unpublish `fffB` để tắt kênh.
- VOICE: không có trigger công khai; tắt Telegram là đủ.
- Messenger Z7Fd: (lịch sử) LIVE bản b2245495 (có nhánh thoại, Tiến duyệt 01:44Z 22/11). Rollback = publish 8f7dcb4f.

## 7. Messenger: nhánh thoại bị mất khi bàn giao Page Inbox (22/11 ~06:40Z)

Bản live d1ec9147 (bàn giao Page Inbox, thread khác) được dựng từ bản nháp 8f7dcb4f mà em đã trả về sau khi test, nên không có nhánh thoại b2245495. Bài học: sau khi publish, để bản nháp = bản live, không trả nháp về bản cũ.

Bản nháp gộp **47b48f6d** = d1ec9147 + nhánh thoại (Extract giữ sticker/referral V26 và thêm audioUrl; "Human handoff request?" nhánh false → "Tin thoại Messenger?" → VOICE → "Gộp tin chữ + thoại" → Loop; Shadow và Seen giữ nguyên). Thao tác ở `channels/n8n/messenger-voice.ops.json`.

| Test (gửi bị chặn, PSID giả) | Kết quả | Exec |
|---|---|---|
| Thoại A003 + chữ "Xem A004" | PASS: "🎤 Shop nghe … A003 … còn 18" + A004 như cũ | 6680 |
| "gặp nhân viên" | PASS: đi nhánh bàn giao, không vào vòng trả lời | 6677 |
| Thoại nghe lệch (A002 bo) | PASS: hỏi "A002 hay A003" | 6678 |

Bật = publish 47b48f6d (cần Tiến duyệt); rollback = publish d1ec9147.
