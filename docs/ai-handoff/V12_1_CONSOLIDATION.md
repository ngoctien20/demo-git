# V12.1 · Quyết định hợp nhất staging · 14/11/2026 JST

Đầu nhánh trước sửa e6ddfe39d9f7ce79efc64a086d0d6177f60b7d82, draft PR #34. Phạm vi quyết định là kiến trúc đích cho staging. Chưa promote module live.

| Khả năng | Nguồn tái sử dụng | Phần còn thiếu / quyết định |
|---|---|---|
| Core AI | Main Agent và Messenger Lab, pattern hội thoại, công cụ, QA | Một contract lõi độc lập kênh. Giữ Sheets và credential DEMO riêng. Ba tool Create/Manage/Update có draft khác published. |
| Tenant | Commerce V3 Tenant Resolver | Chỉ nhận route đã xác thực từ adapter. Đối chiếu Bot Registry; cấm prompt chọn shop. |
| Catalog, pricing | Commerce V3 Catalog Query + Rules Extension | Một nơi tra giá/tồn. Fixture hội thoại Zalo chỉ dùng để QA. |
| Cart | Commerce V3 Cart Preview | Giữ preview riêng với lệnh ghi đã xác nhận. |
| Order commit | Commerce V3 điều phối, transaction PostgreSQL R1 làm mẫu nghiệm thu | Một service ghi phía PostgreSQL cho Commerce. Schema QA chỉ giữ fixture. Cần bridge có chứng thực và hợp đồng retry/readback trước rollout. |
| Outbox | V4.5 router/reconcile + outbox PostgreSQL cùng transaction order | Chọn PostgreSQL làm nơi ghi intent chuẩn. Data Tables V4.2/V4.5, SQLite và V3 giữ cho QA. Một writer, không dual-write. |
| Telegram/Gmail | V4.5 dispatchers | Giữ adapter, kiểm recipient/quota trước gửi, unknown delivery cần đối soát. |
| Zalo | Webhook V1, Shadow V2, Gateway và V2.1 memory | Giữ ingress/echo guard/kill switch, chỉ map identity đã xác minh. Adapter chưa nối đường commit. |
| Owner | Pairing V3: challenge, claim pending, confirm bằng Dashboard | Một binding cho đúng người phát mã. Edge preflight chỉ xác minh quyền; test HTTP độc lập với test SQL. |

**Cơ sở lựa chọn.** PostgreSQL cho phép ghi đơn, sự kiện và unique intent trong một transaction theo tenant. Chuỗi nhiều thao tác n8n/Data Tables chưa có bằng chứng rollback nguyên tử giữa các bảng. Dùng chung V3 và dispatcher giảm số workflow, lượt ghi và cấu hình mỗi shop; chưa benchmark throughput hoặc chi phí. Các schema và fixture cũ giữ nguyên. Khi thử bridge cần một shop QA mỗi lần, dừng ingress và giữ HELD để rollback. Không chuyển dữ liệu DEMO.

**QA n8n mới.** Catalog/cart 3069; Business 3063; Extension 3064; Zalo V2.1 3062. Zalo Webhook published 9ef7342b-0623-4921-9969-7d33d112bbef; Shadow published 7f100319-b820-4f02-a52b-85cd8e0c7e25; Agent V2.1 inactive 40faa4ff-93b0-4d40-9d07-7ac6bcb0baf6; Messenger published d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Cloudflare ZALO_SEND_ENABLED=false. Supabase owner-preflight v1 ACTIVE, verify_jwt=true.

**Release gates.** Hosted CI cần chứng minh owner A/B đúng shop 200, chéo shop 403, token sai 401. RLS proof này chỉ bao phủ preflight. Tiếp theo là trusted ingress tới pending claim, Dashboard confirm, một order transaction tới outbox HELD và đối soát giữa V3/V4.5. Production, thanh toán, LLM có phí và gửi thật đều ngoài lần chạy.

**Kết quả HTTP mới.** Actions 43522424943, job 132219761893, commit 5f228a552582a5b5caa63a4be6140c54bb32ea20: A→A 200, A→B 403, B→B 200, B→A 403, JWT sai 401. Hai phiên QA được đăng xuất cục bộ. Scope là endpoint đọc, chưa phải challenge/confirm qua HTTP.

**Adapter đọc Cart V3.** commerce_preview.py nhận tenant tin cậy từ caller, kiểm tenant/cờ quyền, VND/tồn/tổng, chỉ trả preview hoặc yêu cầu báo giá. Hai kết quả synthetic từ execution 3069 được lưu rút gọn trong v3_cart_3069.json. Không có hàm commit, sender hoặc outbox mới. Resolver published hiện chỉ nhận messenger/zalo_oa/website; cần mở rộng riêng cho zalo_bot với route đã xác thực trước khi nối live. Không ánh xạ giả thành OA. Tách kết quả replay contract khỏi E2E webhook. Rollback bằng revert các commit V12.1 trên nhánh PR; không có migration/deploy cần hoàn tác.

**Regression.** Shop-owned 17/17, Actions 43522771634 tại commit 1222e7c5f61dfd6d052ca6575e08d20a88b74a54. Notification/model/ordered 30/30 cục bộ. Bộ PostgreSQL cần psycopg và database dùng riêng cho QA. Dùng lại CI PostgreSQL/restore/mobile hiện có trên nhánh PR. Không chạy bộ fixture này trên Supabase hosting.
