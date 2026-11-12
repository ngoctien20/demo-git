# TIEN404 AI — Website V10.2: UI, Super Admin, Auth & Production Launch

**Ngày lập:** 2026-11-11 JST  
**Trạng thái:** PLANNED — NO PRODUCTION CHANGES; KHÔNG PHẢI BÁO CÁO ĐÃ TRIỂN KHAI  
**Phạm vi chủ dự án yêu cầu:** (1) chat/widget chưa chuyên nghiệp; (2) chưa thấy Super Admin; (3) hoàn thiện giao diện Login/Account staging trước khi đưa lên web; (4) báo cáo triển khai web thật và domain riêng.  
**Nguồn audit:** GitHub `ngoctien20/demo-git` các nhánh `gh-pages`, `work/supabase-auth-staging-v1`, `ops/tenant-data-platform-v1-staging-20261110`, checkpoint `docs/cto-coordination-v2`, Supabase project staging `ifxlvrhyjhbzbrkdsida`.  
**Giới hạn xác minh:** Đã kiểm mã nguồn và hồ sơ; **chưa có đánh giá trực quan screenshot thực tế** các URL Render vì công cụ web không tải được. Render connector đã liệt kê workspace nhưng `list_services` bị chặn bởi yêu cầu workspace do người dùng xác nhận; do đó **chưa đọc metadata deploy mới nhất của Render**. Không được ghi “deployed” từ việc file chỉ tồn tại trên branch.

## 0. Bằng chứng và hiện trạng

1. Website công khai `https://ngoctien20.github.io/demo-git/` phục vụ frontend từ nhánh `gh-pages`; `index.html` dùng `assets/style.css`, `assets/live-chat.css`, n8n chat stylesheet CDN. Tập tin `assets/ai-consultant.js` gọi `@n8n/chat` từ CDN và một webhook chat n8n trực tiếp, dùng MutationObserver và style overrides. `assets/site-config.js` có `apiBase:''` nên frontend công khai không được mặc nhiên coi là API sản phẩm có xác thực.
2. Auth branch có `login.html`, `account.html`, `assets/auth.css`, `assets/auth-login.js`, `assets/auth-account.js` với Supabase Auth, recovery, tenant-scoped merchant listings. `assets/merchant-product.mjs` vẫn `PRODUCT_EDITOR_ENABLED=false`; không bật khi thiếu signed HTTP JWT/tenant-isolation QA. Link staging: `https://tien404-auth-staging.onrender.com/login.html` và `/account.html`.
3. `ops/super-admin/README.md` mô tả FastAPI/SQLite staging prototype, UI `/admin`, password+TOTP, RBAC và audit. **Không được triển khai như trang Super Admin chính**; chưa kết nối Auth Merchant, Supabase production, hiện chưa có đường dẫn public admin đã nghiệm thu. Không nhập trực tiếp SQLite prototype vào site công khai.
4. Supabase `tien404-staging` đang ACTIVE_HEALTHY. Security Advisor staging có WARN: `authenticated_security_definer_function_executable` cho RPC save_merchant_product (chủ ý trong hai QA shop nhưng cần review) và `auth_leaked_password_protection` disabled. Cần signed HTTP JWT A/B, staff/nonmember/cross-tenant tests.
5. Workflow Messenger V10.1 đang Published riêng trên n8n, không thuộc widget website (web chat dùng một webhook khác). **Không được làm lẫn AI_SALES_DEMO Google Sheets với TIEN404 Commerce tenant**, không đổi Messenger Meta credential khi nâng cấp frontend.

## 1. Sơ đồ kiến trúc V10.2 đề xuất

```text
Người truy cập          Merchant Shop Owner/Staff           TIEN404 Platform Admin
      |                            |                                  |
 www.<domain>                app.<domain>                     admin.<domain>
 (marketing + widget)        (Auth + Account)                 (MFA + Admin RBAC)
      |                            |                                  |
      +--------- HTTPS ------------+--------------- HTTPS ------------+
                                   |
                             api.<domain>
                         Render HTTPS API gateway
                                   |
               +-------------------+-----------------------+
               |                                           |
      Supabase Auth + Postgres                    n8n tenant-scoped execution
      RLS, Storage, Audit                         channel verified, idempotent
               |                                           |
      Tenant/store data                               Messenger / supported apps
```

- GitHub là **source control, pull requests và CI**, không là nơi lưu dữ liệu khách hàng.
- Render Static Site/CDN phục vụ frontend; Render Web Service phục vụ API xác thực/ủy quyền và các tác vụ cần mã máy chủ. Supabase là nguồn dữ liệu chuẩn cho tenant, sản phẩm, đơn, membership, bot config và nhật ký (có RLS); Storage cho ảnh/file với policy.
- Backend phải xác minh JWT, lấy tenant từ membership/server-side channel mapping, không tin tenant_id hoặc vai trò do browser/AI cung cấp. Business transaction dùng kiểm kho + idempotency + audit trong DB, không ghi trực tiếp vào Google Sheets DEMO.
- `admin.<domain>` là cổng nội bộ tách biệt với `app.<domain>`, cần MFA, RBAC phía máy chủ, phân quyền theo hành động, audit append-only. Frontend che nút không có nghĩa là phân quyền.
- Website public widget không gọi trực tiếp một webhook có khả năng ghi đơn/thông tin khách nếu không có gateway chống lạm dụng, rate limits, input validation, tracing, secret management và abuse controls.

## 2. Sprint W1 — Widget & Design System (P0 UI)

**Bối cảnh:** `assets/live-chat.css` nhiều override, một số `!important` và `ai-consultant.js` can thiệp DOM của thư viện chat; dễ lệch UI khi thư viện đổi.

**Tasks**
- W1.1 Audit desktop 1440×900, mobile 390×844 và 360×800 trên bản Render/GitHub; lưu screenshot baseline; đo CLS/LCP, focus, contrast, keyboard.
- W1.2 Chuẩn hóa token nền `--bg`, `--surface`, `--violet`, `--cyan`, typography, radius, shadow, spacing; thêm states riêng cho chat card, composer, message, action bar, typing, error, empty, offline, busy.
- W1.3 Thiết kế wrapper widget chuyên nghiệp: header tên/trạng thái rõ; phân biệt user/AI messages; lời chào, quick prompts, trạng thái chờ, nút thu gọn/đóng; không làm méo bố cục mobile và không che CTA.
- W1.4 Ưu tiên loại bỏ CSS selector xung đột; cố định version thư viện n8n chat nếu vẫn dùng; tránh MutationObserver chỉnh inline DOM bên thứ ba; nếu không thể tùy biến vững thì làm UI chat riêng + backend chat adapter, giữ nguyên workflow business.
- W1.5 Không thay n8n workflow Meta Messenger trong sprint UI. Với widget web, endpoint phải được kiểm tra lại trước khi release, vì webhook web chat khác Messenger.
- W1.6 Visual regression và accessibility smoke; no broken send/retry/session behavior.

**ACCEPTANCE:** thiết kế nhất quán toàn trang, không overflow ở 360px, focus và Esc hoạt động, có loading/error state, 0 console errors, cùng bộ 10 hội thoại QA không hồi quy, không lộ khóa/token.

## 3. Sprint W2 — Login & Account staging (P0 UI/UX)

**Tasks**
- W2.1 `login.html`: cùng header, type scale, màu, component với website; form email/password đẹp hơn, show/hide password, Caps Lock, validation theo trường, loading/disabled, recovery request/update, lỗi mạng/session; no staging jargon trên bản production.
- W2.2 `account.html`: layout dashboard merchant chuyên nghiệp gồm global header, shop switcher, quyền user, tổng quan, danh mục, đơn, khách, hội thoại và trạng thái kênh AI (chỉ cho đúng dữ liệu đã có backend). Mọi card phải có loading/empty/error; ưu tiên bảng mobile responsive.
- W2.3 Không hiển thị tính năng giả (doanh thu thật, nút thu tiền, quyền admin nếu backend chưa có). Cờ `PRODUCT_EDITOR_ENABLED=false` giữ nguyên trước signed-JWT QA; không bật nhầm trong đợt trang trí UI.
- W2.4 Test Supabase Auth login/logout/refresh/recovery, 2 tài khoản QA Shop A/B, staff/nonmember, cross-tenant read/write denied, mobile reload/session expiration; xác minh service đang phục vụ đúng commit SHA.
- W2.5 Chỉ khi UI visual QA và permission QA đều PASS mới đề xuất promote sang main customer website, có rollback SHA.

**ACCEPTANCE:** cùng design system ở homepage/login/account, mobile 360px; auth không bị ảnh hưởng, 2-session tenant-isolation PASS; source/deploy hash trùng; thay đổi UI không cấp quyền trái phép.

## 4. Sprint W3 — Super Admin staging (P0 functionality)

**Định hướng:** hiện có `ops/super-admin/app/ui/index.html` nhưng chỉ là nguyên mẫu độc lập. Không đưa nguyên SQLite/demo password/TOTP trực tiếp lên sản phẩm.

**Tasks**
- W3.1 Quyết định tích hợp identity: dùng Auth và server-side role mapping của platform, hay adaptor admin identity MFA riêng có mapping/audit rõ; không giả định Super Admin = merchant owner.
- W3.2 Thiết kế route `/admin` trên môi trường nội bộ hoặc `admin-staging.<domain>`; chưa gắn vào menu công khai. Tài khoản không được phân quyền phải nhận HTTP 403 từ API.
- W3.3 Màn hình tối thiểu: overview tenants, merchant status, plan/quota, user roles read-only, channel connections status (không show token), AI usage & errors, audit events. Ban đầu READ-ONLY.
- W3.4 Sau khi có quyền server-side và audit/rollback, mở từng thao tác quản trị có kiểm soát: khóa/mở shop, quota, tạm dừng bot, support ticket triage. Yêu cầu confirm + MFA/re-auth cho tác vụ nhạy cảm.
- W3.5 Test anonymous/store owner/staff/support admin/tech admin/super admin; authorization bypass, CSRF/session, replay, log secrecy, cross-tenant scope, rollback.

**ACCEPTANCE:** được cấp một URL staging mở được; chỉ Admin thực được vào; 403 với shop owner; dữ liệu từ nguồn đã xác minh; audit các thao tác; không làm thay đổi Messenger live mặc định.

## 5. Sprint W4 — Trang web thật & custom domain (P0 Launch)

### Hai cấp phát hành

**Cấp A — branding nhanh:** trỏ custom domain tới GitHub Pages hoặc Render Static Site cho marketing, widget tư vấn demo. Chỉ thay hostname, không biến mock dashboard/auth/payments thành sản phẩm thật. GitHub Pages hỗ trợ custom domain; phương án này chưa phù hợp cung cấp SaaS thanh toán và tenant thực.

**Cấp B — SaaS thật (đề xuất):**
1. Mua domain mà bạn sở hữu, ví dụ `<domain>`; xác nhận quyền DNS và tên miền không xung đột.
2. Tạo `release/website-v10.2` hoặc PR từ staging; chọn một nguồn chuẩn cho frontend; không copy gh-pages đè auth branch. Build static (Sass/JS) trong CI, pin dependencies và CSP.
3. Deploy frontend Render Static Site ở `www.<domain>`; gắn `<domain>` và redirect apex/www. `app.<domain>` cho Merchant, `api.<domain>` cho FastAPI backend, `admin.<domain>` cho console có MFA; có thể gộp frontend nguồn để giảm chi phí nhưng phân quyền phải giữ nguyên.
4. Tách Supabase production project từ staging. Chạy migration review + seed metadata không chứa khách QA; kiểm RLS/Auth sign-in recovery; bật emailed auth, password protection, rate limits, backup/restore, monitoring, storage policies.
5. Render Web Service API phải có HTTPS, `PORT`, health checks, restricted CORS, server env secrets, audit logging. Không sử dụng free sleep tier làm API SLA cho khách thật. Tách queue/worker nếu chạy tác vụ lâu.
6. Gắn Meta Messenger/Zalo qua webhook gateway verify signature, mapping Page/Channel → tenant server-side; entitlement/quota; idempotent order transactions, record consumption, retry and observability; test isolated channel trước.
7. Domain: Add Custom Domain trên Render → thêm DNS CNAME/ALIAS theo hướng dẫn **đúng service thực** → Verify → TLS auto → kiểm HTTP→HTTPS, CSP, cookies, OAuth/Auth redirect allowlist; cập nhật canonical, sitemap, robots.
8. CI: branch → unit/security/lint → Playwright UI + visual snapshot → signed JWT tenant acceptance → staging deploy → signoff → prod release → smoke → monitoring/rollback; yêu cầu bảo vệ branch, tuyệt đối không đẩy secret.
9. Tenant/customer readiness: onboarding, invitation, subscription trials, approved pricing, billing provider test mode, privacy/terms/support, data retention, export and deletion policy.

### Kịch bản chi phí vận hành tham khảo (USD, cập nhật theo giá nhà cung cấp trước khi trả tiền)

- Marketing static: Render Static Site có gói free phụ thuộc hạn mức; trả tiền khi vượt quota. Render Web Service paid thường bắt đầu từ ~$7/tháng/mỗi instance; 2 API services ~$14/tháng (chưa bao gồm tăng quy mô, workers). Tham khảo: https://render.com/pricing và https://render.com/docs/static-sites .
- Supabase Pro: từ $25/tháng cho một project Micro có compute credit; production + staging hoặc tăng compute/storage có thể cộng phí. https://supabase.com/pricing .
- Domain: phụ thuộc TLD/nhà đăng ký. Ví dụ .com tại Cloudflare Registrar ~$11.17/năm tại thời điểm tra cứu; chưa xác minh tên cụ thể còn trống. https://pricing.registrar.cloudflare.com/ .
- Chưa tính **n8n Cloud plan hiện có**, AI model tokens, SMTP email, Meta messaging/channel charges (nếu có), monitoring, media storage, backup và thuế. Nếu một API paid ~$7 + Supabase Pro ~$25, **mốc thấp tham khảo ~$32/tháng + domain + các dịch vụ còn lại**. Nếu Auth/Data là hai web service trả phí, mốc ~$39/tháng + phí khác. Đây là **ví dụ ngân sách**, không phải hóa đơn tài khoản.

### Production NO-GO conditions

- Super Admin chưa có backend RBAC audit thực/không có domain staging đã nghiệm thu.
- Supabase signed HTTP JWT A/B/anonymous/nonmember/staff/cross-tenant test chưa PASS.
- Security Advisor WARN về privileged RPC `save_merchant_product` chưa được review; leaked password protection chưa xử lý.
- Nghiệp vụ tạo/sửa đơn đang dùng AI_SALES_DEMO Sheets hoặc chưa có transaction idempotent, stock+order consistency.
- Không có backup verified restore, rollback, logs/alerts, rate limits hoặc bảo vệ secret.
- Chưa có phản hồi từ UI visual regression và mobile/browser/keyboard testing.

## 6. Backlog ưu tiên & điều kiện hoàn thành

| ID | Priority | Deliverable | Gate |
|---|---|---|---|
| W10.2-01 | P0 | Widget design system + visual regression | UI QA desktop/mobile + chat behavior PASS |
| W10.2-02 | P0 | Auth Login staging UI polish | Auth/recovery/mobile PASS |
| W10.2-03 | P0 | Account merchant dashboard staging polish | signed JWT A/B & RLS PASS |
| W10.2-04 | P0 | Super Admin read-only staging UI + URL | Admin-only backend RBAC PASS |
| W10.2-05 | P0 | Hosting + domain + HTTPS + CI staging/prod | smoke & rollback PASS |
| W10.2-06 | P0 | Production Supabase hardening / restore | Security Advisor review + negative auth PASS |
| W10.2-07 | P1 | Admin actions: quotas/pause/support tickets | Audit/re-auth/idempotent PASS |
| W10.2-08 | P1 | Website widget safe backend gateway | rate-limit/abuse/tenant isolation PASS |
| W10.2-09 | P1 | Merchant product edit after JWT E2E | RPC allowlist verified, editor controlled |

## 7. Release discipline & ownership

- **No direct merge to `gh-pages` / production** during planning; UI updates stage first, old website and Messenger continue.
- Each PR must document start/end SHA, changed assets, screenshots, test IDs, target URL, monitored errors, rollback instructions.
- User approval required for **paid deployment, domain purchase, changing security grants, publishing production workflows, or launching with customer data**.
- Update `docs/ai-handoff/MASTER_STATE.md`, `ACTIVE_WORK.md`, `QA_EVIDENCE.md`, `RELEASE_GATES.md` when concrete sprint tasks change state (not when merely proposed).
- **Next action:** first ship widget + login/account unified design in isolated preview; separately implement Super Admin staging URL; do signed JWT/RLS and restore tests before a commercial domain launch.

## Official deployment references

- Render Static Sites: https://render.com/docs/static-sites
- Render Custom Domains: https://render.com/docs/custom-domains
- Render Web Services: https://render.com/docs/web-services
- Supabase Production Checklist: https://supabase.com/docs/guides/deployment/going-into-prod
- Supabase Security Checklist: https://supabase.com/docs/guides/security/production-checklist
- GitHub Pages Custom Domains: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages


## Quyết định của chủ dự án — GitHub-first / domain-deferred (2026-11-11)

**Owner decision overrides W4 timing in the original roadmap:**

- Chủ dự án **tự mua tên miền** khi thấy phù hợp. **Không mua, không trỏ DNS, không thêm custom domain, không tạo hoặc chuyển sang website thương mại ở thời điểm này.**
- V10.2 **tiếp tục phát triển trên GitHub** `ngoctien20/demo-git`, ưu tiên feature branches/PR và GitHub Actions. `gh-pages` / `https://ngoctien20.github.io/demo-git/` là **website demo/preview hiện tại**, không phải production SaaS. Sau khi UI/code QA đạt, có thể cập nhật bản preview GitHub Pages theo quy trình bảo vệ branch, nhưng **không tự biến demo thành website có giao dịch/dữ liệu khách thật**.
- V10.2 trước mắt gồm W1 Widget UI, W2 Login/Account UI trên Auth staging, W3 Super Admin staged read-only với phân quyền thực. Mục W4 **chỉ soạn hướng dẫn** cho hosting, domain, TLS, cấu hình Auth redirect, CI/CD và migration; mọi hành động cắt chuyển chỉ sau **phê duyệt mới bằng lời rõ ràng** của chủ dự án.
- Không tự thay `ngoctien20.github.io/demo-git/` bằng domain ước đoán trong mã nguồn/canonical/OAuth redirects, không đổi Render production service, không tạo Supabase production project hay gói trả phí, không bật giao dịch khách thật.
- **Điều kiện chuyển sau này:** (1) Chủ dự án sở hữu tên miền và cung cấp tên + nhà đăng ký, (2) được trình bày kế hoạch DNS và hạ tầng/cost/backup/rollback, (3) signed JWT A/B, RLS, bảo mật, Super Admin và E2E QA PASS, (4) **chủ dự án phê duyệt cutover bằng một yêu cầu riêng**. Khi đó mới hướng dẫn/cấu hình từng DNS record, xác nhận chứng chỉ HTTPS, redirect, cookies, CORS, callback, canonical/sitemap.
- Để báo cáo tiến độ, phải tách **CODE_COMMITTED (GitHub)**, **PREVIEW_DEPLOYED (GitHub Pages/isolated staging)**, **PRODUCTION_DEPLOYED (domain/hosting thật)**. Hiện chỉ cập nhật tài liệu kế hoạch; không được xem V10.2 UI đã code/deploy vì vừa thêm kế hoạch này.

**Quy trình release GitHub-first:** `feature/v10.2-*` → review/test → PR → staging/preview → nghiệm thu UI → cập nhật `gh-pages` demo có kiểm soát → *STOP* trước production migration. Mọi thay đổi vào preview phải tránh lộ secrets và dữ liệu khách; nhánh GitHub Pages chỉ dùng frontend.
