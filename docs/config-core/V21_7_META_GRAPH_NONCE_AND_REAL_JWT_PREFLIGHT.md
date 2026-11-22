# TIEN404 AI V21.7 — Meta GET Evidence × One-Time OAuth Nonce × Real Owner A/B JWT Read-Only Preflight

**Ngày:** 2026-11-22 (JST). **Nhánh:** work/v21-ai-social-reactions-qa-20261122 · Draft PR #493.
**Mặc định:** NO-GO HOSTED MIGRATION / NO-META-AUTO-REACTION / NO-PUBLISH. Không thay credential, Page permissions, Supabase hosted, Messenger Published.

## Mục tiêu

Giảm khoảng trống của V21.6: receipt HMAC đã kiểm tenant/store/app/Page nhưng chưa ràng buộc nonce OAuth và installation ID với challenge đang chờ; kiểm toán Meta mới ở mức đề xuất chứ chưa có normalized read-only GET contract; không có bộ UAT thật dùng hai phiên Supabase Auth tách biệt.

## 1. Implemented, no provider side effects

1. \`config-core/lib/meta-page-installation-authority.mjs\`: xác minh receipt giờ **bắt buộc** so sánh \`installationId\` và \`oauthNonceSha256\` với giá trị tin cậy của một pending challenge. Output thêm \`requiresAtomicOneTimeNonceClaim:true\`. Chỉ xác minh MAC vẫn có thể chạy nhiều lần với cùng receipt; đây **không phải nonce consume**, không được xem là chống replay đầy đủ.
2. \`config-core/lib/meta-page-graph-evidence.mjs\`: phân tích dữ liệu do **server-side Meta Graph GET** cung cấp (\`debug_token\`, \`me/accounts\`, \`/{page_id}/subscribed_apps\`) mà không tự gọi API. Bắt buộc User OAuth token valid + đúng App ID + Meta actor + scopes, Page nằm đúng phạm vi granular khi có thông tin, \`MESSAGING\` task và ứng dụng hiện diện trong Page subscriptions với field \`messages\`. Không in, lưu hoặc trả bearer token. Kết quả duy nhất khi đạt là \`attestable_candidate\`, \`sendAllowed:false\`, chưa phải chứng thực ký.
3. \`db/reactions/40_meta_oauth_nonce_claim_V217_CANDIDATE.sql\`: tạo private nonce ledger có challenge hết hạn tối đa **10 phút**. Hàm \`t404_reaction_consume_meta_oauth_nonce\` dùng \`UPDATE ... WHERE consumed_at IS NULL\` và kiểm app/Page/store/owner. Hàm là SECURITY INVOKER chỉ grant cho \`service_role\`, không cho \`authenticated/anon\`. Mở rộng predicate Page proof để chỉ công nhận khi unique nonce đã consume, receipt digest + installation ID + owner + tenant/store + Page + App khớp.
4. \`qa/reactions/owner-page-draft-pg17-uat.sh\`: chỉ dùng PostgreSQL 17 disposable, bổ sung negative kiểm owner không đọc/consume nonce, sai cửa hàng, sai owner, receipt không khớp, sequential replay; kiểm thử hai phiên PostgreSQL dùng chung nonce (CI phụ thuộc kết quả lượt mới), rollback tách riêng không chạm Config Core. Bước \`bash -n\` bổ sung trong CI để bắt lỗi cú pháp.
5. \`qa/reactions/owner-auth-jwt-readonly-uat.mjs\`: runner GET-only với hai phiên **Supabase Auth JWT thật** (chưa chạy do không có hai phiên owner được cấp phép). Được khóa bởi biến \`TIEN404_REAL_OWNER_JWT_READONLY_UAT=YES\`, cho phép duy nhất host staging \`ifxlvrhyjhbzbrkdsida.supabase.co\`, cấm service-role/database/Meta keys, không in JWT, user ID, store ID hay raw responses. Kiểm \`/auth/v1/user\`, owner memberships, các GET channel_connections của Store A/B và anon denial.
6. \`config-core/test/meta-page-graph-evidence.test.mjs\` và \`qa/reactions/owner-auth-jwt-readonly-uat.test.mjs\`: tất cả dùng dữ liệu synthetic/response mock, không chạm Meta/Supabase thật.

## 2. Bằng chứng và giới hạn

- **Đã TESTED:** CI Social Reactions [#45028671807](https://github.com/ngoctien20/demo-git/actions/runs/45028671807) PostgreSQL 17 **72/72 PASS** (nonce tuần tự + quyền + rollback) trước bổ sung bài cạnh tranh hai phiên. Unit Meta Graph và signed receipt chạy trong CI riêng. Tổng hợp mới phải kiểm tra trạng thái job trước khi kết luận.
- **Cần kiểm tra thêm:** nonce concurrent two-session UAT ở revision mới sau khi sửa script shell; không tăng số ca PASS cho tới khi log hoàn chỉnh.
- **Trước đó:** V21.6 Social Reactions PG17 59/59, V21.5 Owner UI Chromium 40/40.
- **Không có:** real Meta App Graph GET attestation, Page OAuth callback/nonce issuer, private trusted proof writer, real JWT Owner A/B UAT, hosted reaction tables, Meta auto-send.
- **Không có quyền thực thi trên hosted:** migration 10/20/30/40/rollback chỉ được chạy trong disposable CI cho tới khi owner duyệt backup+restore và security review. Không tự tạo record proof \`verified\` bằng dữ liệu synthetic.
- **Owner/JWT test không thể kết luận đạt khi chỉ mô phỏng role qua psql**: cần hai tài khoản owner thực không chồng quyền store, lấy JWT qua chính login Supabase; tuyệt đối không gửi JWT/token trong chat hoặc commit.

## 3. Meta evidence UAT sequence khi được phê duyệt

- Tạo approved Meta Test App, xác nhận Page role/permission đúng tài khoản và đúng Store; chỉ đọc cấu hình/Graph.
- Xác nhận callback state/nonce và pending installation ID server-side (anti-CSRF, one-time).
- Debug OAuth User token ở backend: app_id, is_valid, expiry, granted scopes; GET /me/accounts lấy Page ID và MESSAGING task; GET /{PAGE}/subscribed_apps kiểm đúng App ID và trường messages. Ghi bằng chứng đã redacted, không chứa token.
- Chỉ trusted gateway có thể tạo signed attestation và write private ledger; owner phải duyệt độc lập industry/profile policy trước khi dự thảo được publish.
- Kiểm tra owner bị gỡ quyền, app revoked, token hết hạn, Page khác hoặc replay nonce đều fail-closed.

Meta tham chiếu:
- https://developers.facebook.com/docs/graph-api/reference/debug_token/
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/
- https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/

## 4. Cổng chưa đạt và bước sau

| Gate | Kết quả |
|---|---|
| Signed receipt + pending nonce/install binding | IMPLEMENTED + unit QA |
| Disposable nonce ledger + one-time receipt binding | IMPLEMENTED + tested; concurrent test cần kết quả CI mới |
| Meta Graph GET shape assessment | IMPLEMENTED + offline mock tests; live GET NOT DONE |
| Real A/B JWT harness | IMPLEMENTED offline, **NOT EXECUTED REAL** |
| Hosted Store Authority RLS | VERIFIED READ ONLY (V21.6) |
| Meta OAuth token/Owner consent thật | BLOCKED |
| Config Core migration history reconciliation and latest hosted backup/restore proof | BLOCKED |
| V23 web aggregate | Known source-to-committed app/ asset sync gate; keep gate, no auto-deploy |
| Supabase hosted schema/credentials/Meta send | UNCHANGED / OFF |

**Checkpoint:** [Draft PR #493](https://github.com/ngoctien20/demo-git/pull/493). Rollback candidate trong \`db/reactions/90_page_reaction_drafts_ROLLBACK_CANDIDATE.sql\`; sau khi có dữ liệu hosted phải có approval và backup riêng trước khi xóa. Không tự merge PR, không đổi Messenger menu Draft/Published của nhóm khác.
