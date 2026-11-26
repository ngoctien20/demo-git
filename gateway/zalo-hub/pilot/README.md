# Pilot chỉ dành cho Bot QA

Entry `pilot/worker.mjs` dùng trên Hub hiện hữu, chỉ chọn candidate khi connection tra từ D1 có `store_id=qa-zalo-bot` và `flow_mode=own`. Merchant, các route Lite và Bot TIEN404 AI dùng nguyên module legacy đã phát hành. Không chuyển credential sang Worker QA riêng và không đổi webhook của bot.

**Đã triển khai pilot ngày 26/11/2026:** source `7d94ecb06de4a69fbaf04ce70df0536926149cd3`, Worker version `0d6b4b5e-8999-4096-a275-acfb32b4b997`, deployment `a2693793-24f9-4100-942d-1d961ea9708d`. CI source SUCCESS; 85/85 bài cục bộ gồm parity riêng. Health HTTP 200, admin pairing và send không có khóa trả 401. Receipt đầy đủ: [latest-pilot-deployment.json](../qa/latest-pilot-deployment.json). Chưa có catalog QA hoặc tin thật được quan sát ở thời điểm kiểm tra; cần chủ QA chạy wizard trên Zalo.

## Checkpoint và bản gốc

- Worker gốc: `tien404-zalo-hub-staging`.
- Version trước pilot: `ae2cd33c-03c9-43b1-9403-81f72513f748`.
- Phần `worker.js` lấy nguyên từ API download Worker của version này và giữ trong bản sao riêng bên ngoài repository, không sửa nội dung và không xuất bản lên GitHub.
- SHA-256 của module: `4b367bb483f7bd2cbde17d92180b8b0f3574754a98d5a1b7726263e34c57e012`. Kiểm thử trước triển khai phải kiểm tra hash này.
- D1 Time Travel bookmark ngay trước migration: `0000001e-00000000-0000512f-e10d8a9f30f00e0e6a53a9cef0b4bfa1`.
- Mốc đọc trước thay đổi: một kết nối QA active, một kết nối khác active; QA đã ghép chủ, owner chat đã xuất hiện trong danh sách người gửi. Không suy diễn/backfill owner_user_id.

## Phạm vi và cấu hình

Webhook chọn bằng path ID; `/v1/send` chọn bằng connection header; admin pairing/enable/disable/disconnect/rotate-keys chọn bằng connection ID sau kiểm tra admin key. Payload khách không chọn shop. Lookup lỗi trả 503, không rơi về legacy.

Phạm vi QA độc lập với cờ gửi. Tắt `ZH_LITE_COMMERCE_ENABLED` làm QA dừng; `/v1/send` cũ của QA vẫn bị chặn. Không tự chuyển QA về n8n. Allowlist rộng hơn trong biến môi trường không mở thêm merchant vì entrypoint ghim chính xác QA.

Trước upload cần migration `0004_lite_private_catalog.sql`. Đây là schema cộng thêm, không thay các cột dữ liệu cũ. Legacy chọn danh sách cột tường minh và tiếp tục dùng `zh_seen_users` của luồng cũ. Kiểm tra lại version, schema và bindings ngay trước upload để tránh ghi đè việc khác.

Upload phải giữ toàn bộ secret bindings và các cấu hình cũ, giữ compatibility date 2026-11-01. Bổ sung binding AI và biến commerce/AI chỉ dùng bởi candidate QA. Hạn mức inference pilot nhỏ; không đổi gói Cloudflare.

## QA và rollback

Repository chỉ chứa bộ định tuyến mới, entrypoint ghép module và test. `router.mjs` nhận hai handler qua `createPilot`; `worker.mjs` tham chiếu `pilot/private/legacy.mjs`, module chỉ được đưa vào gói upload về chính Worker gốc. Đường dẫn `private/` bị loại khỏi Git. Không lấy bundle live để đưa vào tree, commit, artifact CI hay PR.

CI công khai chạy `test/pilot-scope.test.mjs` với handler tổng hợp, xác minh phạm vi QA, xác thực admin, bảo toàn request và nhánh đóng khi lỗi. Bộ tích hợp `test/pilot.test.mjs` được bỏ qua nếu không có bản sao riêng. Trước deploy bắt buộc chạy:

```sh
ZH_PILOT_LEGACY_MODULE=/absolute/private/path/legacy-ae2cd33c.mjs \
  node --test gateway/zalo-hub/test/*.test.mjs
```

Biến này chỉ trỏ tới bản sao riêng; test xác minh SHA-256 trước khi import. Bộ tích hợp xác minh payload/header merchant khớp byte với legacy, người nhận cũ vẫn dùng được khi bảng chat mới trống, API Lite/system/pairing cũ không đổi, và QA nhận wizard mới. Người gửi thiếu vẫn giữ hành vi legacy ở merchant. Pilot giữ các hạn chế đã có của legacy; không quảng bá như phát hành commerce cho mọi shop.

Đóng gói multipart upload gồm `pilot/worker.mjs`, `pilot/router.mjs`, `pilot/private/legacy.mjs` từ bản sao đã kiểm tra, và sáu module `src/worker.mjs`, `src/store.mjs`, `src/crypto.mjs`, `src/zalo-api.mjs`, `src/lite-commerce.mjs`, `src/lite-intent.mjs`. Bản sao live chỉ quay về Cloudflare Worker đã sở hữu mã này. Lưu manifest hash và deployment ID; không lưu nội dung bundle riêng trong bằng chứng công khai.

Rollback vận hành ưu tiên tắt commerce/AI của QA, giữ router và catalog. Merchant tiếp tục legacy. Nếu cần phục hồi version cũ toàn Hub, cần đối chiếu các lượt gửi QA đang chờ trước; không DROP bảng hoặc phục hồi toàn DB khi có dữ liệu mới của merchant. Time Travel bookmark là checkpoint khẩn cấp, không phải lệnh tự động restore.

Sau pilot, chủ Bot QA nhắn **Bắt đầu**, nhập dữ liệu, **Thử SP01**, rồi **Bật bot**. Nghiệm thu gửi/nhận trên thiết bị thật phải được ghi riêng với kết quả API/CI. Pilot chưa có bằng chứng khách thật chỉ vì code đã deploy.
