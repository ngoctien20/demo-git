# V21.3 — Owner App: Xem trước biểu cảm theo Fanpage

**Trạng thái:** IMPLEMENTED ở Draft PR #493, NO DEPLOY / NO LIVE SAVE. Ngày 22/11/2026 (JST).

## Mục tiêu

Chủ Fanpage có thể hiểu trước các phong cách reaction phù hợp ngành nghề mà không bật nhầm bot, thay đổi Meta, đơn hàng, thanh toán hoặc tenant. Đây là **bản xem trước có tương tác**, **không phải màn hình lưu chính sách** và chưa có Fanpage nào được xác thực/liên kết trong màn hình.

## Đã thực hiện

- Owner App: thêm route `#/bieu-cam-fanpage` trong mục **Trợ lý AI → Biểu cảm Fanpage**, giữ nguyên các route Cài đặt bot, Menu, Kênh bán.
- Source: `apps/owner/src/pages/ReactionSettings.tsx`, CSS `apps/owner/src/app.css`, navigation `apps/owner/src/Shell.tsx`.
- UI dùng **chính bộ profile an toàn** `config-core/lib/reaction-profiles.mjs`, không sao chép logic ngành trong React. Dữ liệu labels/ngành là ví dụ để thử, không đại diện ngành thực tế đã xác minh.
- Profile: silent / restrained / friendly / expressive; ngành nhạy cảm chỉ được chọn silent. Danh sách ngành được nhóm để dùng trên điện thoại.
- Mô phỏng mặc định **OFF**, tự OFF lại khi đổi ngành hoặc phong cách; chỉ hiển thị gợi ý ❤️ / 👍 cho câu được allowlist. Tin về giá, đơn hàng, duyệt, chuyển nhân viên vẫn đi luồng bình thường.
- Cho xem thử lựa chọn lời cảm ơn/khen, giãn cách và số reaction/hội thoại/giờ, trong giới hạn của profile; không mở rộng quota vượt preset.
- Không `supabase`, `fetch`, gọi Graph API, `localStorage` hay phương thức persist trong module này. Không tạo policy `enabled=true` nào. Không có nút Lưu/Kích hoạt để tránh hiểu nhầm.
- Responsive: radio profile, giới hạn/ý định, bong bóng tin nhắn kèm biểu cảm đề xuất.

## Kiểm thử

- GitHub workflow `.github/workflows/tien404-owner-reaction-preview-qa.yml`: TypeScript + Vite compile từ nguồn nhánh Draft, không deploy / không cập nhật `app/`, sau đó Playwright Chromium 1280px desktop và 390px mobile.
- Browser QA `qa/reactions/owner-preview-browser.cjs` dùng phiên đăng nhập & dữ liệu cửa hàng **giả lập**, chặn mọi truy cập Supabase thật, không có token Meta. Kiểm tra:
  1. Màn hình gắn nhãn preview-only rõ ràng.
  2. Mặc định OFF và tắt sau reload/chuyển ngành.
  3. Retail chỉ gợi ý ❤️ nếu chủ động bật mô phỏng.
  4. Legal bị khóa reaction; không chọn được expressive.
  5. Artist có thể gợi ý 👍 với lời khen xã hội, không react câu hỏi giá.
  6. Wholesale chỉ gợi ý ❤️, không khen 👍.
  7. Không có HTTP write/RPC/publish và không tràn màn hình điện thoại.
- **TESTED:** GitHub Actions [run #45012456765](https://github.com/ngoctien20/demo-git/actions/runs/45012456765) **SUCCESS**: TypeScript + Vite build PASS và browser Chromium **33/33 assertions PASS** trên 1280px + 390px. Mock kiểm tra ngành legal không reaction, artist 👍, wholesale ❤️, tắt sau reload, không tràn ngang, 0 mutation / 0 reaction RPC / 0 console errors.
- Browser screenshots artifact: `v21-reaction-owner-preview-screens` (artifact #14749864928; trong run #45012456765), gồm `reaction_owner_1280.png` và `reaction_owner_390.png`. Ảnh chỉ có **dữ liệu giả lập Shop QA**, không chứa khách hàng thật.
- QA đã mở và đối chiếu cả 2 ảnh: bố cục rõ, không có tràn ngang, trường điều khiển theo ngành hiển thị đầy đủ. Chưa kiểm chứng trình duyệt Safari/iOS hoặc người dùng thật.
- V23 aggregate CI hiện kiểm tra **file build trong `app/` đã commit khớp nguồn**. Vì đây là PR Draft không publish, source thay đổi nhưng `app/` vẫn giữ bản release cũ, nên kiểm tra đồng bộ assets của V23 sẽ FAIL cho đến khi đồng bộ bản build ở bước tích hợp được duyệt. Không hạ chuẩn check này và không tự đưa assets mới lên Pages trong giai đoạn preview.

## Khoảng trống và điều kiện phát hành

- **BLOCKED:** không có trusted listing Page installations / owner A/B scope trong Owner App; chưa có owner consent persistence, revision/approval, audit log, RPC isolation và policy read-only provider adapter.
- Có tính năng preview không có nghĩa đã có data-binding Fanpage hay AI reaction thực tế. Tuyệt đối không lấy `industryId` từ selector UI để cấp quyền Meta; backend phải resolve từ registry đáng tin cậy.
- Nghiệm thu tiếp theo: đọc Fanpage của cửa hàng **read-only**, policy từng Page, owner-only draft save; kiểm thử cross-tenant negative, xác nhận publish riêng, sau đó mới xét Messenger auto send.
- Published Messenger `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac` và shadow gate ALL OFF không bị sửa ở V21.3.

## Rollback

Revert độc lập 3 file Owner App, browser QA + workflow CI trên PR #493; không cần rollback database hay Messenger Published. Không được merge PR hoặc triển khai web cho khách mà chưa có phê duyệt.
