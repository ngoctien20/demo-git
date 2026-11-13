# TIEN404 AI · Work V11.6 · 13/11/2026 JST

## 1. System audit — VERIFIED

WORK tiếp tục Draft [PR #32](https://github.com/ngoctien20/demo-git/pull/32) từ 595a3b95. Bằng chứng V11.5 tại [43320445914](https://github.com/ngoctien20/demo-git/actions/runs/43320445914). Đã đối chiếu nhánh điều phối 6541ca12, gồm bản bàn giao 6025072 và cập nhật riêng về Super Admin. Bản V11.5 ghi thiếu secrets A/B đã lỗi thời. #31 vẫn draft. Chỉ cập nhật nhánh work/v11-5-zalo-first-notifications-20261113.

| Hệ thống | Kết quả đối chiếu |
|---|---|
| Render Auth | LIVE 219dd086, dep-dbqjagd6e07s73fcpasg |
| Render Data | LIVE ab940a95, dep-dbqj9plg1s2s73egr30g |
| Cloudflare Pages | Project Git staging, canonical deployment success tại gh-pages 6bb57e63. Đầu phiên thấy preview 7f09cee4-7332-4d51-8db4-64760ac4d88a ở idle cho 595a3b95. |
| Supabase | Staging ifxlvrhyjhbzbrkdsida có đủ 9 bảng phạm vi, cả 9 bật RLS. Có 6 migration được liệt kê, có PT409. Outbox V5 chưa có trên staging. |
| n8n | Năm workflow Notification V4.5 và workflow Zalo policy đang inactive. Main Agent và Messenger đang active. Danh sách phiên bản ở mục 6. |

## 2. P0 Security & Tenant Isolation — VERIFIED / TESTED / BLOCKED

Owner A/B đã qua signed Auth, refresh, revoke, chặn đọc chéo qua gateway/PostgREST và reopen Chromium. [Hai shop trên host](https://github.com/ngoctien20/demo-git/actions/runs/43194528530).
Kiểm trên Supabase xác nhận save_merchant_product dùng SECURITY DEFINER, search_path rỗng, authenticated có EXECUTE, anon không có EXECUTE, authenticated thiếu quyền ghi trực tiếp; thân hàm không có dynamic EXECUTE. Quyền dựa vào auth.uid, membership active owner/manager, ID và slug của đúng hai shop. Audit tạo/sửa và rollback staging có bằng chứng tại 6025072.

Nghiệm thu mới trên host: mỗi owner dùng một SKU ngẫu nhiên xác nhận chưa tồn tại, gửi một RPC update với version cũ, nhận HTTP 409 / SQLSTATE PT409 và xác nhận lại không có hàng. Cả hai logout local thành công. [Run 43324089893](https://github.com/ngoctien20/demo-git/actions/runs/43324089893). Phép thử quan sát request/response phía client. Số lần thực thi nội bộ dưới tải cần log/metric riêng.

Còn mở: JWT thật cho staff/nonmember, access token hết hạn theo thời gian, ghi hợp lệ/đồng thời trên hosted API, security review hai hàm inbox và hàm channel mới, hosted Super Admin MFA/403. Security Advisor vẫn báo authenticated_security_definer_function_executable, auth_leaked_password_protection và rls_enabled_no_policy. Giữ editor tắt. Không đổi grant, migration hoặc credential trên staging.

## 3. Commerce Order Engine — TESTED trong PostgreSQL cô lập

CI checkout code Data tại ab940a95. Gọi checkout thực bằng kết nối PostgreSQL riêng từ hai thread. Hai request trùng khóa cùng shop trả cùng order ID. Cùng khóa ở shop khác tạo đơn độc lập. Giá server 200 × 2 cho tổng 400. Hai đơn ở pending; đánh dấu đã xem không đổi trạng thái. Hủy trả tồn về 4. Khi transaction bên ngoài thất bại thì checkout và notification cùng rollback. Đầu vào khác tenant giả danh audit bị từ chối. Public orders dùng UUID primary key toàn cục; bài thử trùng giữa tenant dùng cùng khóa nghiệp vụ, không tạo hai dòng cùng UUID.
Chưa nghiệm thu giá sỉ/lẻ, đơn vị đóng gói, thông tin khách bắt buộc theo ngành hoặc ghi đơn từ kênh thật. Messenger Demo tiếp tục độc lập.

## 4. Notification Engine V5 — IMPLEMENTED / TESTED, CANDIDATE

qa/notification/outbox_v5.sql mở rộng candidate V11.5. Trigger đọc audit checkout, order pending, idempotency receipt và tổng order_items trong cùng transaction. Quyền worker nằm trong schema private. Mỗi tenant hiện ánh xạ một store. Đích gửi là tham chiếu phiên bản route, cấu hình gắn merchant membership. Claim dùng FOR UPDATE SKIP LOCKED, khóa một lần cho mỗi attempt. Chỉ retry kết quả chắc chắn chưa dispatch; timeout mơ hồ hoặc hết lease sang needs_review. Receipt muộn hoặc sai claim token không được chấp nhận. Đổi quyền nhận hoặc thu hồi consent chặn hàng đang xếp, cần đối soát riêng nếu đã gửi. Inbox nội bộ được ghi nhận ngay trong giao dịch. SQL candidate chỉ cho phép ba kênh dashboard/Telegram/Gmail; chưa có sender trong CI.

Còn thiếu worker tích hợp n8n V5, lưu/giải mã recipient ở backend, xác minh provider response qua runner thật, rate limit/quota, retention, chọn primary/backup và fallback sau lỗi xác định trên database. Cần recheck quyền ngay tại ranh giới gọi provider, đối soát các claim đã bắt đầu và giới hạn quyền DB cho worker trước khi nối gửi. Không cam kết exactly-once ngoài hệ thống.

## 5. Dashboard & Channel Integration — IMPLEMENTED / TESTED

merchant/notification-center.mjs nhận client Supabase của merchant và shop; huỷ view khi đổi phiên/tenant. Các RPC candidate trả cấu hình theo membership, inbox 100 sự kiện gần nhất, từng trạng thái và lỗi, số lần thử, thời gian và xác nhận đã xem theo người dùng. Zalo xếp đầu với trạng thái chờ. Đánh dấu đã xem có tính lặp an toàn. UI chỉ hiện chi tiết đơn khi host cung cấp hàm điều hướng. Chromium 360×780 chạy với RPC giả cho các ca hiển thị, đánh dấu, lỗi, từ chối, tháo view. SQL test riêng có hai shop. Chưa mount vào bản Merchant đang LIVE và chưa có E2E cho UI này với JWT thật. Chưa bật cài đặt gửi; onboarding và thay đổi lựa chọn kênh qua API còn mở.

## 6. AI SALES / Messenger Stability — VERIFIED inventory, TESTED offline

| Workflow | ID | Draft / Published, tiền tố phiên bản |
|---|---|---|
| Main Agent | v6PBwcqSapVzACMW | c0f04eb1 / c0f04eb1 |
| Messenger TEST | Z7FdV7uDvApfbURQ | d5c96b6b / d5c96b6b |
| Create Order | KrSn4DNR9ALX5ng4 | af9ee686 / 4740251a |
| Manage Order | fDB9dvs1qPPVt9Sp | 2e8786fd / 137d5689 |
| Update Order | BkAi6TVUKAjCnI7v | 3bd7043f / 93cf227a |
| Outbox Prepare | E7qjDGggThLpktjL | 93b0e828 / chưa publish |
| Telegram | spk9Cs62YidlQ1vu | 102a3a89 / chưa publish |
| Gmail | Zswbbml4W1WkkxYe | 606bb838 / chưa publish |
| Messenger Policy | raprJAvUy9ovDm3Q | 300ad938 / chưa publish |
| Reconcile | a37OOBI9T4chqVgm | 5674308a / chưa publish |
| Zalo Policy QA | hkZzAmv86NoiTFHh | e5d17c5b / chưa publish |

Đã kiểm metadata success cho Telegram 2686, Gmail 2687, reconcile 2691 và Zalo 2693. Bằng chứng provider V4.5 giữ ở V11_5_NOTIFICATION_QA_REPORT.md. Không gửi lại. Kiểm corpus 96 case đơn, 97 dòng lịch sử với một bản lặp; 36 case xếp multi-turn còn NOT_RUN, trong đó 9 case có một lượt. 10 unit lab đạt. Chưa có phiên đánh giá AI live mới hoặc regression multi-turn mới.

## 7. Zalo pending integration — BLOCKED — WAITING FOR OWNER

Mock server kiểm tra OAuth state dùng một lần, hết hạn, đúng tenant, đúng user và role cả khi callback. Callback luôn trả chưa xác minh và chưa bật. Mock không chứa token, không gọi Zalo.
Khi có OA: xác minh chủ thể/trạng thái và loại OA → kiểm App và quyền → đối chiếu loại tin/template, consent và điều kiện người nhận → xác nhận quota/chi phí → cấu hình callback allowlist, code exchange server-side và token storage mã hóa theo OA → refresh bằng khóa chống tranh chấp, vô hiệu hóa khi revoke, yêu cầu kết nối lại khi hết hạn → test người nhận được phép → đối soát ACK và chi phí → regression → duyệt phát hành. OAuth live, token vault và luân chuyển token mới ở mức PROPOSED. Không nhập credential vào chat.

## 8. Legal & Commercial — PROPOSED / BLOCKED

Kế thừa V11_5_LEGAL_COMPLIANCE_READINESS.md. Hồ sơ trước thu phí phải xác định chủ thể ký hợp đồng, đăng ký kinh doanh, cách phân loại SaaS và nghĩa vụ thuế/hóa đơn, phân loại website, privacy/retention, quyền truy xuất/xóa dữ liệu, điều khoản hủy và hoàn tiền. Với hoạt động có doanh thu khi còn ở Nhật, đối chiếu tư cách lưu trú và loại hoạt động với 入管; cần xác minh riêng cư trú thuế. Chưa xác lập quyền kinh doanh hoặc kết luận thuế, chưa mở billing. Nguồn: [Luật Bảo vệ dữ liệu cá nhân](https://vanban.chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroup=), [Luật Thương mại điện tử](https://vanban.chinhphu.vn/?docid=216503&pageid=27160), [ISA Nhật](https://www.moj.go.jp/isa/applications/procedures/16-8.html).

Super Admin kế thừa bản sửa dọn dữ liệu phiên #12 (aeb31938, CI 43245448320). Chưa nghiệm thu đổi quyền trong cùng trình duyệt trên host. Trial, active, expired, suspended, cancelled, entitlement và quota cần nối server-side và kiểm bypass trước pilot. Chưa triển khai phần thu phí hoặc usage thương mại trong phiên này.

## 9. QA Evidence

| Suite | Loại bằng chứng | Kết quả |
|---|---|---|
| Signed PT409 | Supabase staging, hai owner qua HTTP | PASS, link ở mục 2 |
| Commerce + outbox | Checkout và transaction PostgreSQL 16 cô lập, hai worker độc lập, ACK giả | PASS |
| Inbox & route | Hai danh tính qua claim SQL, đọc/đánh dấu, từ chối chéo, consent, retry và crash | PASS |
| Policy V5 | 28 regressions + 1 bài callback Zalo gồm nhiều assertion | PASS |
| Restore | pg_dump/pg_restore sang database thứ hai; so fingerprint toàn bộ dòng, 6 outbox rows và grant riêng | PASS dữ liệu tổng hợp. Restore backup Supabase thực còn mở. |
| Merchant mobile | Chromium 360×780, RPC tổng hợp | PASS; chưa phải E2E của trang inbox đã host |
| AI lab | Corpus audit, 10 unit tests | PASS cấu trúc và unit. Multi-turn chưa thực thi. |

[CI bao gồm restore và browser](https://github.com/ngoctien20/demo-git/actions/runs/43324392970). Không ghi thông tin đăng nhập, nội dung người nhận, payload khách hàng hay provider secret vào checkpoint.

## 10. Master checkpoint, rollback & next

Mốc trước sửa 595a3b95, nhánh work/v11-5-zalo-first-notifications-20261113, Draft PR #32. Mã nhận diện kết quả test ở links Actions; phiên bản kế tiếp cần fetch lại cả nhánh này và docs/cto-coordination-v2. Toàn bộ SQL mới chỉ đưa vào service PostgreSQL CI dùng một lần. Rollback candidate bằng revert thay đổi của PR. Nếu đề xuất staging migration, chuẩn bị SQL rollback riêng, diễn tập restore ở đích cô lập và kiểm quyền worker/RPC trước khi áp dụng.

Thứ tự tiếp quản: (1) signed staff/nonmember và hosted Admin MFA/403, (2) restore Supabase staging và review migration outbox, (3) kết nối adapter Telegram/Gmail vào provider mock có recipient vault, giới hạn chi phí, đối soát timeout, (4) mount inbox vào dashboard staging và kiểm JWT thật, (5) subscription/usage và onboarding. Zalo live chờ owner; các việc còn lại độc lập.

**PILOT READINESS: NOT READY. PRODUCTION CHANGED: NO.**

Commit mã cuối 946000cb70018b4089d2b7b85b7438c93a322b03. [CI trên đúng commit cuối](https://github.com/ngoctien20/demo-git/actions/runs/43324604957) SUCCESS, gồm thu hồi consent, restore và Chromium. Commit checkpoint tiếp theo chỉ thêm tài liệu.
