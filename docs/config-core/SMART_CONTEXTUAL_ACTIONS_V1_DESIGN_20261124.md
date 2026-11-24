# TIEN404 AI — Smart Contextual Actions V1 (DESIGN CANDIDATE)

Date: 2026-11-24  
Scope: native Meta Messenger, optional Website Widget preview.  
Status: **PROPOSED only; NOT wired into production; NO_SEND / NO_WRITE**.

## Baseline (read-only attestation — re-verified 2026-11-24 14:35Z)
- Messenger workflow: `Z7FdV7uDvApfbURQ` (`TIEN404_MESSENGER_TEST`), active.
- ~~Published `1f4069a5`~~ **stale**: S1→S3 were published 2026-11-24 13:44Z. **Active/published now = `9342025c-ea16-4965-97ac-bc4b98591996`** (rollback `9c08fdd3`, emergency `1f4069a5`).
- Draft head = **`18c0473d-432d-460a-afd8-fa697fb2eb64` "V27 native Messenger catalog layout — draft"** (13:36Z), parent `41bcea84` (= S4 "exact Meta send count", **not yet approved**).
- Lineage: `9342025c` (live) → `41bcea84` (S4, Verify node only) → `18c0473d` (V27, 2 Code nodes). Publishing `18c0473d` therefore ships **S4 + V27 together**.
- Published `Prepare Messenger Reply` includes Meta Button Templates and Quick Replies. Config Core `config-core/lib/channel-render.mjs` already provides `render/visibleItems`, Page-published action IDs and capability fallbacks. Use this; do **not** build a duplicate menu database.
- The menu bridge `9HXjjJ5ghPKUu43b` has a separate version lifecycle. Coordinate before any live wiring.
- Note: "v27" in older PRs (#453, #456 …) is the **Graph API version v27.0**, unrelated to this UX V27.

## Hard platform constraints (Meta)
Native Messenger does **not** expose application-controlled CSS positioning, button background, hover states, border radius or center-screen floating components.

Use the delivery mechanism to choose *where a native UI component appears*:
- **Quick Replies**: above the input composer, appear for the current reply; do not treat them as permanent navigation.
- **Button Template**: up to 3 action buttons attached to a specific message in the conversation.
- **Generic Template / carousel**: content cards with their own actions, inside the message stream; only show verified items/media.
- **Persistent Menu**: repeatable Page navigation near composer/menu entry; not a movable top bar.
- **Website Widget**: own HTML/CSS; may use sticky footer, centered modal/drawer, colored CTA and responsive layouts. Never claim equivalent Meta support.
- The UI cannot arbitrarily move previously sent native Messenger messages or reorder buttons inside messages already delivered.

## Meta Send API limits used by V27 (corrected)

| Component | Count limit | Text limits | Notes |
|---|---|---|---|
| Quick Replies | ≤13 | title ≤20, payload ≤1000 | Disappear after tap or next message; only on the **last** message of a turn |
| Button Template | ≤3 buttons | text ≤640, button title ≤20 | postback / web_url |
| Generic Template (carousel) | ≤10 elements, ≤3 buttons each | title ≤80, subtitle ≤80 | `image_url` optional; image ratio horizontal 1.91:1 or square |
| Persistent Menu | ≤20 items (no nesting) | title ≤30 | Page-level, needs Get Started; changing it is a Meta Page change (approval) |
| Text | — | ≤2000 | |
| Postback payload | — | ≤1000 | Keep `T404:M:<id>` / `TIEN404:VIEW:<SKU>` |

Lengths are UTF-16 units in JS: clip on code points, not `String.slice` (see F-V27-1).

## Context → action-slot contract

| Conversation state | Main placement | Actions (examples only, conditional on *published* Page config) | Secondary |
|---|---|---|---|
| New greeting | Quick Replies above composer | Xem sản phẩm / Tra cứu đơn / Gặp nhân viên | Persistent Menu |
| Browse catalog | Message carousel/cards or button template | Xem SKU on its card; category paging | Quick Replies Trang trước/tiếp |
| Product detail | Inline actions on product card | Xem tương tự / Hỏi thêm | Quick Reply Xem mẫu khác |
| Order inquiry | Plain text + one context action | Xác minh quyền sở hữu first, otherwise Gặp nhân viên | No order details before trusted verification |
| Human handoff | Minimal plain-text acknowledgement | No misleading bot CTA until provider success/owner returns thread | No repeated sales prompts |
| Artist / creator *(later — multi-industry moves to its own repo, plan 2kjjssd1)* | Playlist/profile cards | Nghe nhạc / Thông tin / Liên hệ quản lý | No shop-only items |
| Service / professional Page *(later)* | Service card / one contextual CTA | Xem dịch vụ / Liên hệ chuyên viên | Avoid unsolicited emoji/reactions |

**Rule:** Put 1–3 immediately relevant actions in the transient slot, rank by current intent, then Page-owner order. Do not show unrelated buttons under every message. For 4+ items prefer paging/vertical category navigation; do not hide inaccessible actions after a 3-button truncation. Allow users to type normally.

## Security / API invariants

1. Account/Page/tenant authority comes from the signed/validated inbound channel and server-resolved published config; never from a button label or a client-supplied store ID.
2. Keep the action ID and `T404:M:<id>` semantics; do not replace with index-only quick reply values that can change meaning between states. Retain and safely resolve old `TIEN404:*` postbacks.
3. A catalogue SKU, current unit price and stock must be read from the right authorized DEMO/merchant source. Never let styling make an unverified order/stock/payment commitment.
4. Action renderers must support `quick_replies`, `attachment`, plain text and safe fallback. No unsupported JSON should reach the Send API.
5. Respect Meta limits (see table below). UX target <=3 actions for the first screen.
6. Zero writes, sends or Meta changes from this design. Release requires approval, independent checkpoint and rollback plan.
7. Multi-turn state and button payload routing must resist cross-Page/cross-sender collisions, replay and stale menu versions.
8. Staff handoff: keep standby/return-to-bot behavior; do not assert transfer success before a provider-confirmed response.

## Acceptance (all pending real device QA)
- C-01: greeting → 2–3 contextual quick replies visible on Messenger Android/iOS and Web desktop.
- C-02: catalog → first card and page navigation tappable on mobile; no 4+ SKU dead ends.
- C-03: product card → correct SKU when tapped, no false stock/price or order write.
- C-04: 4+ items → paging/category behavior, no silently dropped items.
- C-05: order lookup → unauthorized customer sees no other person's order; ownership verification required.
- C-06: artist Page → artist actions, **no** shop SKU/checkout actions.
- C-07: Page A/B isolation and stale/disabled action IDs both fail closed.
- C-08: Meta failed handoff / standby / staff completes → state recovers accurately.
- C-09: web widget preview may use custom CSS; native Meta still obeys capability limits.
- C-10: accessible labels, keyboard/touch, narrow mobile, no horizontal clipping of essential CTA.
- C-11: existing published behavior and old payload handling unchanged unless approved and regression-tested.
- C-12: output message cap and idempotent delivery confirmations preserved.

## Rollout gates
1. Build a **pure** context-action planner on top of Config Core `visibleItems`, not new business actions. Context inputs must be server-validated.
2. Generate preview/snapshots and deterministic fixture-based offline QA for each Page/intent.
3. Integrate on a **staging fork** or versioned Messenger draft with external Send API and business writes stubbed. Preserve exact rollback version and diff.
4. Compare Meta mobile vs web screenshots during a separately approved live QA window.
5. Request explicit approval of published workflow ID/version and Meta menu setup before promotion.

## Checkpoint / rollback
No n8n, Meta Page, product, Commerce, Supabase, payment or customer records changed by this **design-only PR**. Published version at the 14:35Z re-check is `9342025c` (see Baseline); re-read it before any subsequent change.


---

## V27 review (2026-11-24, thread "Hoàn thiện thiết kế V27") 

### What the n8n draft `18c0473d` actually does — VERIFIED (version diff `41bcea84`→`18c0473d`)
Only 2 Code nodes change, no nodes/connections added:
1. `Trình bày trang danh mục Messenger` adds `catalogCards` (title `SKU — name` ≤80, subtitle `price | Còn n/Hết hàng` ≤80, one `Xem SKU` postback) from the same validated DEMO rows.
2. `Prepare Messenger Reply`, catalog branch only: if 2–3 cards **exactly match** the button template (same order, payload, title, `SKU — ` prefix) → send **2 messages**: generic carousel, then the page text + Trang trước/Trang tiếp quick replies. Otherwise (1 item, malformed, mismatch, safe-text) → original 1-message button template. All other branches are byte-identical.

Send node `Send Messenger Reply` uses batch size 1 / 300 ms → messages go out in order (carousel before text). VERIFIED in draft JSON.

### Offline QA — TESTED (synthetic, exact node sources exported to `config-core/n8n/`)
`config-core/test/messenger-v27-carousel.test.mjs`, 10 cases renderer → Prepare → Verify(S4) PASS; whole `config-core/test` 252/252 PASS. Covers: 3-card page, S4 partial/duplicate MID reject, middle page controls, 1 item / 1 leftover fallback, 5 tamper cases, wrong Page / stale digest / empty, long names, non-catalog paths unchanged. **Not** tested: real Meta render on Android/iOS/Web (needs live window).

### Findings
| ID | Mức | Phát hiện | Đề xuất |
|---|---|---|---|
| F-V27-0 | Cao (quy trình) | Draft `18c0473d` dựng trên S4 `41bcea84` (chưa duyệt). Publish V27 = publish luôn S4. | Duyệt S4 trước (hoặc cùng lúc, ghi rõ), rồi V27. Không dựng lại V27 trên `9342025c` trừ khi Tiến muốn bỏ S4. |
| F-V27-1 | Thấp | `slice(0,80)` có thể cắt đôi emoji → ký tự hỏng trong tiêu đề thẻ (test V27-09 tái hiện). | Cắt theo code point: `[...s].slice(0,79).join('')+'…'` khi dài. |
| F-V27-2 | Trung bình | Lần đầu Page gửi **generic template**. Nếu Meta từ chối (lỗi 100/2018…), node Send `stopWorkflow` → khách **không nhận gì** (không tự lùi về button template). | Live QA trước khi bật; hoặc thêm nhánh lỗi: gửi lại `catalogMessage` button template 1 lần (vẫn ≤3 tin). |
| F-V27-3 | Thấp | Carousel gửi xong mà tin text lỗi → khách thấy thẻ nhưng mất nút Trang tiếp; inbound không được ghi (S4 đúng: không ghi "đã trả lời"). Không gửi trùng vì webhook đã trả 200. | Chấp nhận; khách bấm lại "Xem sản phẩm". Ghi vào runbook. |
| F-V27-4 | UX | Tin text lặp lại đủ danh sách giá/tồn đã có trên thẻ → dài, trùng. | Giữ text (dự phòng cho client không hiện carousel) nhưng rút gọn: "Trang 1/7 · Bấm thẻ ở trên hoặc nhắn mã mẫu". PROPOSED, cần Tiến chọn. |
| F-V27-5 | UX | Thẻ không có ảnh → carousel nhìn "trống". | V27.1: chỉ thêm `image_url` khi URL https thuộc host cho phép (Drive/CDN của shop) đọc từ cột ảnh đã xác minh; ảnh lỗi → bỏ ảnh, không bỏ thẻ. |
| F-V27-6 | Quy tắc | Bấm danh mục giờ = **2 tin**. Đúng quy tắc "1 mặc định, 2 khi cần, tối đa 3" nhưng nên ghi nhận là ngoại lệ có chủ đích. | Ghi vào acceptance C-12. |
| F-V27-7 | Phạm vi | Các dòng Artist/Service trong bảng ngữ cảnh chưa có code; DEMO Page bị khoá cứng `2379295362359912`. | Để sau, theo dự án đa ngành riêng. |

### Edge cases to keep fail-closed
Wrong Page → no output; stale digest → plain text; 0 hợp lệ → plain text; 1 item → button template; tồn = 0 vẫn hiện thẻ "Hết hàng" (bấm Xem đọc lại tồn hiện tại); SKU trùng trong Sheet → loại; đang ở trạng thái handoff (thread ở Page Inbox) → bot không được gửi carousel (đường handoff hiện có giữ nguyên, cần 1 ca live U-H).

### Live UAT plan (chỉ chạy khi Tiến duyệt cửa sổ thử; cần publish)
| Ca | Thao tác | Kỳ vọng |
|---|---|---|
| U27-1 | Android: bấm "Xem sản phẩm" | Carousel 3 thẻ A001–A003 + text "trang 1/7" + "Trang tiếp" |
| U27-2 | iOS + messenger.com desktop: lặp U27-1 | Hiện giống; ghi ảnh chụp |
| U27-3 | Bấm "Xem A003" trên thẻ | Chi tiết A003 159.000đ, còn đúng tồn Sheet |
| U27-4 | Trang tiếp đến trang 7 | 21 SKU, không trùng, trang cuối 3 thẻ |
| U27-5 | Sửa giá 1 SKU trong Sheet rồi bấm Trang tiếp cũ | "Danh mục đã thay đổi…" |
| U27-6 | Xem áo / Xem quần | Chỉ đúng nhóm |
| U27-7 | Bấm thẻ cũ sau khi Gặp nhân viên | Theo luồng handoff, không spam |
| U27-8 | Nhắn chữ thường, sticker, voice | Không đổi so với `9342025c` |

### Checkpoint / rollback
- Hiện tại: live `9342025c`, không đổi. Draft `18c0473d` không chạy.
- Publish đề xuất: `41bcea84` (S4) → kiểm 1 tin thường → `18c0473d` (V27).
- Rollback V27: publish lại `41bcea84` (giữ S4) hoặc `9342025c` (bỏ cả S4); khẩn cấp `1f4069a5`. Nút cũ trong hội thoại khách vẫn chạy vì payload `TIEN404:VIEW:*` và `T404:C:*` không đổi.
- Không có migration, Meta Page profile, Persistent Menu hay dữ liệu nào bị đổi bởi V27.

---

## V27 — Bảng chọn kiểu thẻ theo ngữ cảnh, ngành và khả năng kênh (theo mẫu của Tiến 14:27Z)

Bộ chọn thuần: `config-core/lib/context-card-planner.mjs` (`planCards`), test `config-core/test/context-card-planner.test.mjs` (13 ca). **Chưa nối vào n8n, chưa publish.**

### 4 kiểu thẻ
| Mẫu | Kiểu | Messenger dùng | Khi nào |
|---|---|---|---|
| 01 | Nút ngang phía dưới | Quick Replies (≤3 hiển thị đầu, tối đa 13) | Lựa chọn nhanh: chào hỏi, hỏi tiếp. Không mở được link |
| 02 | Thẻ vuốt ngang | Generic template 2–10 thẻ, + 1 tin chữ mang "Trang trước/Trang tiếp" | Nhiều sản phẩm/dịch vụ **đã xác minh** |
| 03 | Nút dọc gắn tin nhắn | Button template ≤3 nút | Hành động quan trọng của 1 mục (Đặt sản phẩm, Xem mẫu tương tự) |
| 04 | Thẻ nội dung theo ngành | Generic 1 thẻ, ≤3 nút, được mở link, ảnh bìa nếu host được phép | Page nghệ sĩ/giáo dục có mục cần mở link (Nghe nhạc) |

Ghi chú mẫu 02: "Trang tiếp ›" trong mẫu nằm dưới carousel. Messenger không cho đặt nút tự do ở đó, nên nó là Quick Reply trên tin chữ ngay sau carousel (giống draft `18c0473d`).

### Bảng chọn
| Ngữ cảnh | Shop (có SHOW_CATALOG) | Nghệ sĩ (có link nhạc) | Dịch vụ / giáo dục | Kênh chỉ có chữ (Zalo Bot/OA, Telegram) |
|---|---|---|---|---|
| Chào hỏi | 01 | 04 (Nghe nhạc mở link · Thông tin · Liên hệ quản lý) | 01, hoặc 04 nếu có mục link | Danh sách đánh số |
| Xem nhiều mục | 02; 1 mục → 03; 0 mục → chữ | **Chữ, không bao giờ thẻ bán hàng** | 02 (khi có SHOW_SERVICES) | Danh sách đánh số |
| Xem chi tiết | 03; text >640 → chữ + 03 | 03 với hành động của Page | 03 | Danh sách đánh số |
| Tra cứu đơn | Chữ + tối đa 1 nút (xác minh trước) | — | — | Chữ |
| Đang chuyển nhân viên | Chỉ chữ, không nút | Chỉ chữ | Chỉ chữ | Chỉ chữ |

### Tự quay về khi không hỗ trợ
`04 → 03 → 01 → chữ` và `02 → 03 → chữ`. Mỗi tin được kiểm theo giới hạn Meta (`validMessage`) **trước** khi trả ra; sai là bỏ kiểu đó và ghi lý do vào `degraded` (vd `carousel:invalid`, `image_dropped`, `no_catalog_action`). Luôn ≤3 tin, Quick Reply chỉ ở tin cuối, cắt chữ theo code point (không vỡ emoji).

### Quy tắc an toàn
- Nút chỉ lấy từ menu **đã publish** của chính Page (`visibleItems`); Page nghệ sĩ không có SHOW_CATALOG thì không thể ra nút bán hàng (P-04, P-05).
- Giá/tồn chỉ từ dòng đã xác minh do bên gọi truyền vào; planner không tự tạo.
- Ảnh chỉ khi `https` và host nằm trong danh sách cho phép; ảnh sai thì bỏ ảnh, giữ thẻ (P-06).

### Bước nối vào bot (PROPOSED, cần duyệt)
1. Dùng planner trong node `Prepare Messenger Reply` của một bản nháp mới, dựng trên `18c0473d`.
2. Chạy lại các test offline, sau đó chạy UAT U27-1..8 và thêm U27-9 (Page nghệ sĩ thử) khi có Page nghệ sĩ.
3. Publish theo từng phiên bản đã duyệt. Rollback giống mục trên.

---

## V27.1: nối vào bản nháp n8n (Tiến duyệt nối 14:30Z, **chưa duyệt publish**)

**IMPLEMENTED:** Z7Fd có bản nháp **`f6d33dab`** "V27.1 Messenger carousel polish — draft, NO_PUBLISH", dựng trên `18c0473d`. Bản live vẫn là `9342025c` (đã kiểm `activeVersionId` sau khi lưu). Bản nháp chỉ sửa 2 node Code, không thêm node hay đường nối nào. Mã trong repo được xuất lại từ chính bản nháp nên khớp với n8n.

Những gì đã làm đẹp:
- Tiêu đề thẻ có dạng `A002 · Áo thun nam trắng basic size M`. Dòng phụ có dạng `159.000đ · Còn 25`, hoặc `Hết hàng`.
- **Ảnh sản phẩm:** chỉ hiện ảnh khi Sheet Products có cột `image_url` chứa link `https` thuộc host được phép (`lh3.googleusercontent.com`, `i.imgur.com`, `ngoctien20.github.io`), và khi đó thẻ là khung vuông. Link sai hoặc không có ảnh thì thẻ vẫn hiện, chỉ không có ảnh. Ảnh không làm thay đổi mã trang (digest), nên các nút "Trang tiếp" cũ vẫn dùng được. **Sheet hiện chưa có cột ảnh**, cần Tiến thêm.
- Tin chữ sau thẻ được rút gọn còn: `Sản phẩm · trang 1/7 · 21 mẫu` / `Bấm "Xem" trên thẻ hoặc nhắn mã mẫu (vd A001) để xem chi tiết.`, kèm nút Trang trước/Trang tiếp. Cách này sửa F-V27-4.
- Chữ được cắt theo code point, nên không còn vỡ emoji. Cách này sửa F-V27-1.
- Dò link ảnh bằng regex chứ không dùng `URL()`, vì sandbox của Code node có thể không có `URL`.

**TESTED (offline):** chạy đúng mã của bản nháp, toàn bộ 267/267 test qua, trong đó có V27-11 (ảnh hợp lệ thì giữ, ảnh sai thì bỏ) và V27-12 (ảnh không đổi digest). Chưa chạy trong n8n, vì chạy thử ở đó có thể gửi tin Meta thật.

**Còn mở:** F-V27-2 (nếu Meta từ chối thẻ vuốt thì khách không nhận được tin nào) chưa được sửa trong n8n. Muốn sửa phải đổi cách xử lý lỗi của node Send, mà node này dùng chung cho mọi câu trả lời, nên rủi ro cao hơn lợi ích. Thay vào đó, bước kiểm tra là ca U27-1 khi thử thật; nếu thẻ không hiện thì rollback ngay.

### Thứ tự publish đề xuất (mỗi bước cần Tiến duyệt cụ thể)
1. `41bcea84` (S4): nhắn 1 câu "xin chào" để kiểm, phải thấy bot trả lời bình thường.
2. `f6d33dab` (V27.1, đã gồm S4 và V27): chạy U27-1..8 trên Android, iOS và messenger.com.
3. Rollback: `41bcea84`, rồi `9342025c`, khẩn cấp thì `1f4069a5`.

---

## Live 2026-11-24 + V27.2

- 14:50Z: S4 `41bcea84` được publish (Tiến duyệt). Tiến nhắn "xin chào" lúc 14:50:13 và tin được ghi nhận trong EVENT_KEYS lúc 14:50:17, không có lượt chạy lỗi: **PASS**.
- 14:52Z: V27.1 `f6d33dab` được publish. Tiến thử lúc 14:52:06, tin được ghi nhận nhưng đi vào **luồng AI** (chỉ có 3 nút dọc, không có thẻ vuốt). Không phải lỗi. **VERIFIED:** hiện chỉ payload `T404:M:catalog` (nút "Xem sản phẩm" của menu đã publish, sau "Bắt đầu") mới mở được danh mục. Các chip chào hỏi "Xem áo"/"Xem quần" (`TIEN404:QR:n`) và ☰ menu cũ của Page (`TIEN404:ASK:catalog`) vẫn đi sang AI.
- Z7Fd đặt `saveDataSuccessExecution=none`, nên không xem được lượt chạy thành công. Kiểm tra bằng dòng EVENT_KEYS kết hợp danh sách lượt chạy lỗi.
- **V27.2 bản nháp `a256a7df`** (dựng trên `f6d33dab`, chưa publish): chip chào đổi thành `Xem sản phẩm` (`T404:M:catalog`) · `Tra cứu đơn` · `Gặp nhân viên`, đúng mẫu 01. `TIEN404:ASK:catalog` được đổi thành `T404:M:catalog` ở node "Tìm nút menu". Các payload Áo/Quần/đơn/nhân viên giữ nguyên, vì con trỏ trang `T404:C` chưa mang nhóm hàng (muốn hỗ trợ thì phải sửa bridge `9HXj`). Test V27-13..15 qua, toàn bộ 270/270. Rollback: `f6d33dab`.
- 14:57Z: **V27.2 `a256a7df` PUBLISHED** (Tiến duyệt trên thẻ). Rollback lần lượt `f6d33dab` → `41bcea84` → `9342025c`.
- **U27-1 PASS (TESTED live, 14:58Z):** Tiến nhắn "xin chào" (14:58:26, được ghi nhận). Bấm chip "Xem sản phẩm" (14:58:34) thì thấy carousel: thẻ `A001 · Áo polo nam xanh navy size S` / `245.000đ · Còn 5` / nút "Xem A001", có mũi tên vuốt sang thẻ sau, tiếp theo là tin "Sản phẩm · trang 1/7 · 21 mẫu" kèm "Trang tiếp". Lượt bấm được ghi nhận lúc 14:58:39, nghĩa là bước kiểm S4 đã xác nhận đủ 2 tin Meta trả về. Không có lượt chạy lỗi. Ảnh chụp do Tiến gửi trong thread.
- Còn chờ thử: U27-3 (bấm Xem trên thẻ), U27-4 (Trang tiếp), U27-2 (iOS/desktop).
- **U27-3 PASS (live, 15:00Z):** bấm "Xem A001" trên thẻ → "A001 — Áo polo nam xanh navy size S | 245.000đ/cái. Còn 5 cái." + chip "Đặt A001" / "Xem mẫu khác" (đúng Sheet). Thẻ A003 hiển thị "·59.000đ" là do mũi tên ‹ của Messenger web che chữ số "1"; Sheet A003 = 159.000đ, còn 18 (VERIFIED), dữ liệu gửi đúng. UX ghi nhận: Messenger web đặt mũi tên đè lên mép trái thẻ, không chỉnh được từ phía bot.
- Còn chờ: U27-4 (Trang tiếp), U27-2 (iOS/Android app).
