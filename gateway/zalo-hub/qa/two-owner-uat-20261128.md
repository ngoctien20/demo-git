# Hai chủ shop tự cài Zalo · 28/11/2026 JST

Base PR #518, 984f5629c264206be7b5fd0f7131c7c2ea2e8677. PR #517 5bf4f50b, #516 190a1c0e, #515 f0935b04, #507 a3b9f2d7. Thay đổi chỉ gồm QA.

VERIFIED trực tiếp: Worker tien404-zalo-hub-staging phục vụ 100% version 18044a91-b9c2-43cf-96f9-cff0ae96fe0a, deployment cf49a8dd-494c-46f9-b6c8-308b91f71bbc. Đã kiểm tra version bindings, D1 và Supabase bằng truy vấn đọc. Allowlist một bot qa-zalo-bot, flow own, active, có catalog. Workspace cấu hình khớp Hoa Mai (UUID đuôi 2848), một chủ active; trong zh_web_stores chưa có dòng cho workspace này. Đây là Zalo. Ghép Page Messenger và hộp đơn của chủ vẫn là việc riêng.

| Môi trường | Chủ web / chủ bot | Workspace / bot | Catalog / kênh nhận |
|---|---|---|---|
| Offline A | tài khoản A / ownerA | A / bot A | 5 SKU, SP01 12.000→18.000→19.000đ, shop A trả đúng chat |
| Offline B | tài khoản B / ownerB | B / bot B | 5 SKU, SP01 23.000đ khi A đổi giá hoặc tạm dừng, shop B trả đúng chat |
| Hosted pilot | một chủ active / chưa nghiệm thu trên thiết bị | Hoa Mai …2848 / qa-zalo-bot | catalog bot có mặt; chưa liên kết hai phía |
| Bot nền tảng | TIEN404 | hỗ trợ đăng ký | tách khỏi hai đích trả lời khách mô phỏng |

TESTED Node 24, SQLite/D1 shim và provider mô phỏng. Test so sánh hai session Dashboard riêng, A không đọc được B, B chỉ là staff ở A không thể đổi giá A. Kiểm cả token bot và chat đích trên tin gửi mô phỏng để tránh đọc nhầm tin trước. Chủ A dừng rồi bật lại, cả hai shop dùng cùng năm SKU. Chạy node --test gateway/zalo-hub/test/*.test.mjs: 75 đạt, 0 lỗi, 12 bỏ qua do thiếu module legacy riêng đúng hash. Test riêng: node --test --test-name-pattern='web link: both owners' gateway/zalo-hub/test/hub.test.mjs.

BLOCKED UAT thiết bị, QR/link Zalo từ tài khoản khách độc lập, thời gian thao tác và chờ quyền của người thật, số lần cần hỗ trợ. Bật lại sau tạm dừng đã thử offline; phục hồi khi token mất hiệu lực cần đúng chủ nối lại qua luồng owner và kiểm tra lại cặp bot/shop. Hai bot thật ngoài phạm vi pilot hiện hành. Đầu việc cho chủ Hoa Mai: trong dashboard QA của Hoa Mai bấm “Liên kết bot đang dùng”; dấu hiệu thành công là lệnh ghép xuất hiện, có hạn 10 phút. Không ghi lệnh ghép vào bằng chứng công khai.

Rollback bằng revert commit QA; không có thay đổi Cloudflare, Supabase, webhook, allowlist hoặc lưu lượng từ lượt kiểm tra này.
