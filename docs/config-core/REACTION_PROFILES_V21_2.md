# TIEN404 V21.2 — Hồ sơ reaction theo từng Fanpage

**Ngày:** 22/11/2026 · **Trạng thái:** CANDIDATE / QA ONLY · **Messenger Published vẫn giữ nguyên**.

## 1. Nguyên tắc

Không phải Fanpage nào cũng nên thả biểu cảm như nhau. Một trang ngành luật, y tế hay tài chính cần giao tiếp trang trọng, không tự động thả reaction. Một cửa hàng bán lẻ có thể dùng biểu cảm nhẹ nhàng, còn Fanpage nghệ sĩ/giải trí/cộng đồng có thể tương tác thường xuyên hơn. **Ngành chỉ là gợi ý mức phản ứng và giới hạn an toàn; chủ trang vẫn phải duyệt và publish riêng từng Fanpage.**

Không suy ra ngành từ nội dung khách nhắn. Chỉ dùng `industryId` đã được xác minh từ **Trusted Tenant / Page Installation Registry** của backend. Cấu hình từ Messenger webhook, AI/LLM, URL hoặc dữ liệu khách không thể tự kích hoạt tính năng.

## 2. Các cấp phản ứng

| Profile | Phù hợp | Câu được cân nhắc reaction | Cooldown tối thiểu | Tối đa/giờ/hội thoại |
|---|---|---|---:|---:|
| `silent` | Y tế, pháp lý, tài chính, bảo hiểm, cơ quan, hỗ trợ khủng hoảng, dịch vụ chuyên môn | Không | — | 0 |
| `restrained` | VLXD, bán sỉ, phần cứng — nghiêm túc và lịch sự | Cảm ơn thuần túy → ❤️ | 600 giây | 1 |
| `friendly` | Tạp hóa, bán lẻ, thời trang, dịch vụ ăn uống | Cảm ơn → ❤️, khen ngợi → 👍 | 300 giây | 2 |
| `expressive` | Fanpage nghệ sĩ, âm nhạc, giải trí, sự kiện, cộng đồng | Mở rộng thêm lời khen/cảm ơn tự nhiên → ❤️ hoặc 👍 | 90 giây | 5 |

Giới hạn là **trần**, không phải chỉ tiêu phải gửi. Owner có thể chọn tần suất **thấp hơn** preset và tắt từng kiểu cảm xúc được cho phép. Chỉ hỗ trợ ❤️/👍 ở candidate vì ❤️ đã được UAT một lần trên Meta; các emoji mới cần UAT riêng. Việc xuất hiện emoji thực tế không đồng nghĩa đã có cơ chế tự động.

### Quy tắc đề xuất ngành

- Y tế/pháp lý/tài chính/bảo hiểm/cơ quan/dịch vụ chuyên môn: **silent bắt buộc**; không thể bật expressive bằng cách sửa policy.
- VLXD/bán sỉ/hardware: mặc định gợi ý restrained, có thể chọn friendly nếu owner muốn và được phép, không cho expressive.
- Tạp hóa/bán lẻ tổng hợp: gợi ý friendly, cho phép silent/ restrained/ friendly.
- Thời trang/làm đẹp/đồ uống/nhà hàng/khách sạn: gợi ý friendly, có thể chọn expressive khi chủ trang duyệt.
- Nghệ sĩ/âm nhạc/giải trí/creator/cộng đồng/sự kiện: gợi ý expressive; chủ trang có thể giảm về friendly/restrained/silent.
- Ngành chưa phân loại: **silent** (fail closed).

**Gợi ý không phải bật mặc định:** `enabledByDefault=false` cho tất cả ngành. Để bật thật phải có owner consent theo revision và expiration, policy `published` và trusted registry.

## 3. Luồng xử lý

`Messenger webhook (HMAC validated)` → Trusted Page installation resolver → Owner published per-Page policy → Industry profile validation → Context + business state + thread ownership → Classify text theo profile → Atomic idempotency ledger → (chỉ sau khi release) Meta reaction sender → Provider attestation → Normal fallback.

Mọi câu **hỏi giá, đặt đơn, xác nhận/duyệt, thanh toán, khiếu nại, chuyển nhân viên, khẩn cấp, tin thoại, sticker, menu, postback** đều tiếp tục luồng văn bản hoặc nghiệp vụ bình thường. Không phải mọi tin nhắn của Fanpage giải trí đều đủ điều kiện được reaction.

## 4. Thực thi kỹ thuật (chưa phát hành)

- `config-core/lib/reaction-profiles.mjs`: danh sách ngành được hỗ trợ, profile, gợi ý UI, cờ an toàn, nhận diện lời cảm ơn/khen ngợi riêng cho trang expressive.
- `config-core/lib/reaction-admission.mjs`: schema owner policy nâng lên **2** (không chấp nhận schema 1); bắt buộc `industryId` ở cả trusted authority và published policy; phải trùng nhau và profile được phép; cooldown/quota không được nới cao hơn preset. Không có owner consent hay atomic receipt → `blocked`.
- `config-core/test/reaction-profiles.test.mjs`: bao phủ silent bắt buộc, phạm vi preset, giới hạn giờ, nội dung nhạy cảm, giả mạo industry, cross-Page, owner consent.
- `config-core/test/reaction-admission.test.mjs` cập nhật fixture lên schema 2.
- Dedicated GitHub CI kiểm tra profile + admission + offline PostgreSQL 17. PostgreSQL disposable QA đã chứng minh khóa nguyên tử, **chưa triển khai migration tại Supabase hosted**.

## 5. Giao diện Owner App (PROPOSED, chưa viết vào giao diện đang phục vụ khách)

Trong **Fanpage → Cài đặt AI → Biểu cảm tương tác**:

- Công tắc **Bật/Tắt reaction** mặc định tắt.
- **Phong cách:** Trang trọng / Chừng mực / Thân thiện / Sôi nổi (chỉ hiện lựa chọn được phép theo ngành đã xác minh).
- Hai lựa chọn **Cảm ơn ❤️** và **Khen ngợi 👍**.
- Giới hạn phản ứng trong giờ và thời gian giãn cách, không được vượt preset.
- Xem trước bằng tin giả lập, hiển thị lý do reaction bị chặn.
- **Lưu bản nháp → Xác nhận chủ trang → Publish revision**. Chức năng Publish yêu cầu phân quyền owner, nhật ký và bảo vệ replay; không thay đổi workflow production trong bước này.

Cần thêm lựa chọn **Chỉ phản hồi bằng chữ** cho tất cả Page. Khi tắt reaction, bot giữ nguyên chức năng hiện tại.

## 6. Những gì không được phép tự động

Không tự điền `enabled=true`, không tạo owner consent giả, không chạy Meta send khi chỉ mới có policy schema, không dùng `rowNotExists` n8n Data Table để chứng minh atomic claim, không phát hành bot hay thay đổi Supabase hosted mà chưa phê duyệt. Không dùng một quy tắc ngành chung để cấp quyền cho Fanpage khác, kể cả khi cùng chủ sở hữu.

**Rollback:** Revert riêng các file reaction-profile/ admission trong Draft PR #493; giữ Shadow Gate Messenger **ALL OFF** và không chạm bản Published.
