# V21.6 — Meta Page Installation Authority × Owner A/B × Staging Readiness

**Ngày 2026-11-22 (JST). Checkpoint: Draft PR #493.** Giữ trạng thái NO-GO cho Meta reaction tự động, migration hosted và phát hành chính sách Page.

## 1. Trạng thái thực tế

- **VERIFIED Supabase staging:** tien404-staging (ifxlvrhyjhbzbrkdsida) PostgreSQL 17.11; đã có Store Authority, Config Core, 1 Messenger DEMO connection active gắn assistant/store active; 4 owner users trên 3 store/tenant.
- **VERIFIED RLS/GRANT:** channel_connections FORCE RLS, authenticated SELECT chỉ theo active store/tenant membership, anon SELECT denied, direct authenticated INSERT/UPDATE denied.
- **MISSING:** private Meta Page proof registry, reaction draft table, owner Page-list/save RPC chưa tồn tại trên hosted. Config Core hiện có nhưng không hiện trong migration history được liệt kê; cần đối soát.
- **Meta UI ONLY:** Meta Business Suite tab đang mở cho thấy hộp thư Page; đây KHÔNG phải bằng chứng TIEN404 app đã được cài qua OAuth, token ràng buộc với Meta app, Page MESSAGING task hoặc Page subscribed-app.
- **NO WRITES:** không gọi Meta Graph API có token, không sửa Supabase staging, Messenger Published, consent, channel permissions hoặc dữ liệu khách.

## 2. Meta Page installation authority: bằng chứng bắt buộc

Trusted server-side OAuth/Business Login flow **CHƯA ĐƯỢC THỰC HIỆN**:

1. Người dùng đăng nhập Supabase và là owner active của tenant/store. Backend phát hành state/nonce chống CSRF, one-time và có thời hạn, ràng buộc với owner, tenant/store, installation, expected Meta app.
2. Nhận OAuth callback HTTPS, xác thực nonce/state trước khi đổi code phía server. Dùng Meta /debug_token để xác thực is_valid/app_id/scopes/expiry. Không đưa code, token, app secret vào URL log, public database hoặc browser storage.
3. Dùng Meta /me/accounts hoặc endpoint tương ứng được phép để đọc Page IDs + tasks; Page được chọn phải là đúng connection_id thuộc Store và đúng external_account_id. Người cấp quyền phải có Page MESSAGING task. Kiểm các scope tối thiểu pages_show_list, pages_manage_metadata, pages_messaging. Endpoint đọc conversations có thể còn yêu cầu pages_read_engagement riêng; không tự yêu cầu thêm.
4. Kiểm tra read-only subscribed_apps cho Page/app, quyền App Review và các hạn chế Meta testing. Không xem thành công trong nhóm tester là approval cho khách ngoài.
5. Kiểm owner còn có quyền Store, độc quyền Page/tenant, approved Meta app. Nếu bất kỳ dữ kiện nào thiếu/hết hạn/bị thu hồi -> từ chối; không tự chuyển trạng thái active thành verified.
6. Chỉ trusted gateway mới ký attestation HMAC với secret tối thiểu 256-bit ở backend; chỉ private writer đã duyệt được lưu proof digest và metadata vào database. Owner consent xác nhận policy ngành/profile/revision là bước riêng, không suy ra từ Meta installation.
7. Định kỳ xác minh lại: mất Page task/subscription/app permission, đổi chủ/tenant, token revoked hay bằng chứng hết hạn -> fail closed.

**Giới hạn bằng chứng:** HMAC bảo đảm tính toàn vẹn của dữ liệu từ trusted issuer, nhưng không tự chứng minh gateway đã kiểm Meta. Gateway/OAuth issuer và private writer chưa triển khai thật; dữ liệu Meta trong CI chỉ là synthetic.

Nguồn Meta (đối chiếu 22/11/2026):
- https://developers.facebook.com/docs/graph-api/reference/debug_token
- https://developers.facebook.com/docs/graph-api/reference/user/accounts/
- https://developers.facebook.com/docs/graph-api/reference/page/conversations/
- https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/
- https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start

## 3. Đã implement trong Draft (NO HOSTED)

- config-core/lib/meta-page-installation-authority.mjs: verify HMAC trước khi parse JSON; schema/audience/issuer, scope tenant/store/owner/Page/app/connection; nonce hash; callback state; token app binding; Page token và Page MESSAGING task; subscribed app; permissions tối thiểu; hạn dùng. Kết quả luôn sendAllowed:false và requiresIndependentOwnerConsent:true.
- config-core/test/meta-page-installation-authority.test.mjs: negative test chữ ký giả, token issuer giả, thiếu task/scope, stale/future proof, copy sang Page/tenant khác, thừa field chứa token.
- db/reactions/30_meta_page_installation_authority_V216_CANDIDATE.sql: chỉ áp sau 10 và 20 và CHỈ khi registry proof rỗng; từ chối grandfather generic proof_kind cũ. Thêm approved Meta app allowlist RLS private mặc định rỗng, proof metadata bắt buộc, unique Meta Page/installation/proof digest, và function private kiểm Page ID khớp channel_connections, quyền app, owner membership, token, subscription, expiry.
- Hai RPC candidate save_page_reaction_draft và list_verified_reaction_pages được siết qua private authority function, vẫn giữ owner-only, store/tenant, ngành, version-CAS và không có publisher/send flag.
- db/reactions/90_page_reaction_drafts_ROLLBACK_CANDIDATE.sql: rollback có cả authority private function và app allowlist, không xóa bảng Config Core. Chỉ chạy sau approval khi hosted có dữ liệu.
- **TESTED disposable PG17:** [GitHub Actions #45023238699](https://github.com/ngoctien20/demo-git/actions/runs/45023238699) **59/59 PASS**. Bao gồm revoked Meta app, missing MESSAGING task/scope, OAuth state false, subscription false, wrong Page ID, proof expired, Owner A/B, draft CAS race, rollback. Đây KHÔNG phải Meta Graph live UAT hay Auth JWT thật.

**Lưu ý bảo mật:** PostgreSQL chỉ thực hiện kiểm tra toàn vẹn metadata và quyền; không thể chứng minh bên phát hành nhận được response Meta thật. Service_role bypass RLS; không được đưa vào Owner App. Chưa có trusted gateway issuer thì không có hàng proof đáng tin cậy được phép phát hành.

## 4. Hosted Owner A/B — quyền DB chỉ-đọc, không phải Auth JWT

Dùng SELECT-only transaction trên Supabase staging:
- Thiết lập ROLE authenticated + request.jwt.claims từ 1 Owner thực có membership tại Store của Messenger: SELECT channel_connections trả 1.
- Đối chiếu membership Owner của một store khác: trả 0.
- Dùng user ID giả không có membership: trả 0.
- SET LOCAL ROLE anon: bị SQL từ chối SELECT.

Không thay đổi tenant, membership, session hoặc dữ liệu. Đây là **RLS role simulation bằng claims trong READ ONLY transaction**; không chứng minh login thực, chữ ký JWT, session ownership hay cross-tenant Auth E2E. Muốn nghiệm thu thật phải có hai account Owner A/B đã consent và truy cập API qua client auth token của chính mỗi account, chỉ-đọc.

## 5. Staging readiness và cổng phê duyệt

| Điều kiện | Trạng thái |
|---|---|
| Hosted PG17, Store/Config Core, channel registry RLS/GRANT | VERIFIED |
| Owner A/B hosted DB role-simulation | TESTED, READ ONLY |
| Real Meta Page OAuth / token and task verification | BLOCKED |
| Real Auth JWT Owner A/B UAT | BLOCKED |
| Reconciled Config Core migration history | BLOCKED — current schema exists but migration inventory is incomplete |
| New backup/restore attestation for this candidate hosted migration | BLOCKED — chưa có bằng chứng mới đã kiểm chứng ở V21.6 |
| Private approved Meta app and installation gateway | PROPOSED, missing hosted |
| Candidate SQL + disposable PG17 rollback | TESTED — 59/59 |
| Trusted owner consent + reaction sender release | OFF / NO-GO |

**CI ngoài phạm vi cần tách nhóm:** Config Core tổng hợp fail ở QA Messenger send-ledger với lỗi thiếu cột tenant_id trong messenger_send_parts; chưa sửa vì thuộc nhánh Messenger đang làm song song. V23 web aggregate fail yêu cầu đồng bộ committed app/ bundles sau build; không được tắt gate hoặc tự deploy. Dedicated reaction QA PASS.

## 6. Checkpoint / bước tiếp theo

PR: https://github.com/ngoctien20/demo-git/pull/493 (Draft, không merge). Không thay Messenger Published hay Draft, không gửi Meta, không ghi hosted, không đổi token/quyền.

Cần phê duyệt trước: (1) Trusted Meta OAuth owner installation + server-side read-only verification UAT; (2) đối soát migration/backup/restore; (3) hosted staging schema migration và quyền private writer; (4) real Owner A/B JWT negative; (5) kết nối Owner App save Draft; (6) publish/reaction send approval là quyết định sau cùng riêng biệt.
