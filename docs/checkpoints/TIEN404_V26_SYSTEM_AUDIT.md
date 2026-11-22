# TIEN404 AI — V26 SYSTEM AUDIT (Phase 0, read-only)

- Thời điểm kiểm toán: 2026-11-22 15:50–16:20 UTC
- Phạm vi: GitHub (PR/nhánh/CI/gh-pages), n8n Cloud (Draft vs Published), Supabase staging (schema/RLS/RPC/backup), Render/Cloudflare (khả năng truy cập).
- Chế độ: **chỉ đọc**. Không merge, không publish n8n, không migration, không gửi tin, không đổi credential/RLS.
- Repo public: tài liệu này **không** chứa token, mật khẩu, URL webhook, dump hay PII.

Nhãn dùng trong tài liệu: **VERIFIED** (đã đối chiếu nguồn sơ cấp trong lần audit này) · **IMPLEMENTED** (có code, chưa chứng minh chạy đúng ở môi trường đích) · **TESTED** (có test/CI PASS, ghi rõ môi trường) · **PROPOSED** · **BLOCKED** · **RELEASED** (đang phục vụ người dùng thật).

---

## 1. Kết luận nhanh

1. **Không có bot nào đang chạy.** n8n Cloud hết hạn dùng thử khoảng 11:30Z ngày 22/11; không có execution nào sau 10:11:41Z (VERIFIED: `search_workflow_executions` từ 10:30Z = 0 kết quả). Mọi kiểm thử live Messenger/Zalo/Telegram hiện là **BLOCKED** cho tới khi chủ dự án nâng gói.
2. **Bí ẩn 1f4069a5 vs 41bcea84 đã rõ** (mục 3.1): `1f4069a5` là bản **Published/đang hoạt động** (V21 menu, publish lại 11:47Z sau rollback chẩn đoán). `41bcea84` là **Draft** chồng 7 phiên bản draft-only lên trên `1f4069a5`. Các báo cáo cũ ghi “Published 47b48f6d” là **đúng tại thời điểm viết (08:29–10:06Z)**, đã lỗi thời từ ~11:06Z.
3. **Cấu trúc nhánh:** `main` và `develop` đã phân kỳ (develop hơn main 447 commit, main hơn develop 1 commit = B-00 #485). Chuỗi #487 → #489 → (#491 → #493) và #489 → #496 chồng lên nhau; #488 nằm trên `main`, không trùng file với chuỗi develop. **#493 đang đỏ CI** (`site`: bản build `app/` commit trong nhánh lệch nguồn).
4. **Website công khai đang chạy = PR #496 @ 7a70fa54** (gh-pages `8d3f88f`, VERIFIED bằng so sánh file). Đây là bản Draft PR đã được chủ dự án duyệt đưa lên gh-pages; code nguồn **chưa merge** vào develop/main.
5. **Supabase staging:** 29 bảng public đều bật RLS, 0 grant bảng cho `anon`, PG 17.11 (VERIFIED). Còn 3 hàm SECURITY DEFINER cho `anon` gọi được, trong đó **`qa_shop_b_zalo_claim` là P0 còn mở** (PR #481 chưa áp). Lịch sử `supabase_migrations` thiếu V23 web + Config Core (áp bằng psql).
6. **Backup:** B-00 VERIFIED ngày 21/11 (run 44904780877), nhưng **chưa có lần backup+restore toàn phần nào sau các thay đổi V20 bước 3–4, V23, Config Core**. Lần chạy định kỳ đầu tiên dự kiến Chủ nhật 22/11 19:00 UTC.
7. **Commerce live (khi n8n chạy lại) vẫn có rủi ro P0 dữ liệu:** Create Order và Update Order đang chạy bản **Published cũ** (4740251a, 93cf227a); bản sửa “parse VND chặt + tổng an toàn” và “kiểm tra SĐT/địa chỉ” chỉ nằm ở Draft từ 09/11. Đơn ghi vào Google Sheet AI_SALES_DEMO, chưa vào DB tenant.

---

## 2. GitHub — PR, nhánh, CI

### 2.1 Nhánh chính (VERIFIED, `git fetch` 2026-11-22 ~15:55Z)

| Nhánh | HEAD | Ghi chú |
|---|---|---|
| `main` | `78ba605` | B-00 backup/restore (#485). Cây thư mục tối giản (docs, ops, index.html). Hơn develop 1 commit. |
| `develop` | `0e12f4c` | Merge #486. Gồm #482 (V20 Store Authority), #483, #486. Hơn main 447 commit. |
| `gh-pages` | `8d3f88f` (14:20Z) | “Deploy V25 Universal”, build từ PR #496 @ `7a70fa54`. Rollback: revert commit này. |

Không tìm thấy `AGENTS.md`/`CLAUDE.md` ở `main`, `develop` và mọi nhánh PR được audit → **thiếu tài liệu điều phối** (ghi nhận, không tự tạo nội dung giả định). Checkpoint kỹ thuật hiện nằm rải rác ở `docs/ai-handoff/` và `docs/qa/full-acceptance/` (develop).

### 2.2 Bảng PR

“Ahead/behind” tính so với `origin/develop` trừ khi ghi khác.

| PR | Tiêu đề rút gọn | Base → Head (SHA) | Draft | CI head | Quan hệ |
|---|---|---|---|---|---|
| #496 | V25 Universal SaaS | `claude/project-thread-xv1r63` (#489) → `7a70fa5` | Có | 6/6 PASS | Chứa toàn bộ #489 **và** #487 (+5 commit riêng). Đang chạy trên gh-pages. |
| #493 | V21 AI Social Reactions no-send | `work/v21-phase2-…` @ `59911ce` → `5be7cf6` | Có | **6/7, `site` FAIL** | Rẽ nhánh từ #491 tại `59911ce`; #491 sau đó đi thêm 105 commit mà #493 chưa có. Trùng file với #496: `apps/owner/src/Shell.tsx`, `apps/owner/src/app.css`, `config-core/lib/reaction-profiles.mjs`, `config-core/lib/social-reactions.mjs`, `config-core/test/social-reactions.test.mjs`. |
| #491 | Menu fallback + role-aware handoff | #489 → `89d65fb` | Có | 5/5 PASS (15:53Z) | Chồng trên #489; +133 commit so với develop (đang được một phiên khác cập nhật liên tục). |
| #490 | V21 Round 3b docs | develop → `f90ae04` | Có | không có check | Chỉ 5 file docs, độc lập. |
| #489 | Config Core Phase 0–2 | develop → `886f1f2` | Có | 6/6 PASS | Chứa #487 trừ 2 commit cuối của #487. DB đã áp staging. |
| #488 | V24 Shared Bot Core + adapters | **main** → `3d6382b` | Có | 1/1 PASS (`build`) | Base là `main`, không phải develop; 0 file trùng với chuỗi develop (thư mục `channels/`). |
| #487 | V23 web + Owner App | develop → `48059c9` | Có | 7/7 PASS | Nền của #489/#496. |
| #482 | V20 Store Authority | develop | — | — | **MERGED** vào develop 2026-11-22 01:13Z (`868b9325`). |
| #481 | Phương án A: tắt Zalo Shadow rồi REVOKE anon `qa_shop_b_zalo_claim` | main → `a7f6261` | Có | 1/1 PASS | **Chưa áp.** Cần duyệt (đổi quyền DB + tắt workflow). |
| #480 | V19.8.20 backup inventory… | `work/v19819-…` → `b46bf8a` | Có | — | Chuỗi stack cũ (V19.8.x); đã bị B-00 #485 và V20 #482 vượt qua. |
| #479 | V20.1-P0-S3 Render/backup/Zalo UAT | `work/v201-p0-s2-…` → `174e834` | Có | — | Chuỗi stack cũ; tương tự #480. |
| #477 | develop → main | develop → main | Có | — | Không tự merge (quy tắc chủ dự án). Cần đồng bộ #485 về develop trước. |

### 2.3 Thứ tự hợp nhất an toàn (PROPOSED — mọi merge cần chủ dự án duyệt)

Nguyên tắc: merge theo đúng chiều stack, mỗi bước retarget PR kế tiếp về `develop` và chạy lại CI; **không cherry-pick**.

| Bước | Hành động | Điều kiện vào | Rollback |
|---|---|---|---|
| M0 | Đồng bộ `main` → `develop` (đưa B-00 #485 về develop) bằng PR merge thường | CI develop xanh | revert merge commit |
| M1 | #490 (docs) → develop | — | revert |
| M2 | #487 → develop | CI xanh; xác nhận lại App V23 không phá gh-pages (gh-pages build từ #496, không từ develop) | revert merge |
| M3 | Retarget #489 → develop, merge develop vào nhánh #489, CI xanh, rồi merge | M2 | revert; DB không đổi (đã áp từ trước) |
| M4 | Retarget #496 → develop, merge | M3; so khớp build với gh-pages `8d3f88f` | revert; gh-pages độc lập |
| M5 | Retarget #491 → develop, merge | M3; đóng băng push từ phiên đang sửa #491 trong lúc merge | revert |
| M6 | #493: merge #491 mới nhất + develop (sau M4) vào nhánh #493, giải xung đột 5 file với #496, **build lại `app/`** để `site` xanh, rồi merge | M4, M5 | revert |
| M7 | #488: rebase/merge lên develop (không trùng file), cân nhắc gom vào Shared AI Core workstream | Thiết kế tích hợp Phase 4 | revert |
| M8 | #479, #480: **đề xuất đóng** (superseded bởi #482/#485), giữ nhánh làm lưu trữ | Chủ dự án đồng ý | reopen |
| M9 | #481: quyết định riêng về Zalo Shadow (mục 4) | Duyệt bảo mật | `rollback.sql` trong PR |
| M10 | #477 develop → main | Gate A + Gate F | revert |

---

## 3. n8n Cloud — Draft vs Published (VERIFIED qua n8n MCP, 16:00Z)

### 3.1 Messenger DEMO `Z7FdV7uDvApfbURQ` (tên hiện tại: TIEN404_MESSENGER_TEST)

- `active=true`, 68 node, `versionId` (Draft) = `41bcea84`, `activeVersionId` (Published) = `1f4069a5`. Webhook production GET+POST **không cấu hình credential ở node Webhook** → cần xác minh kiểm chữ ký Meta (HMAC) trong luồng live (backlog B-P0-05).
- `saveDataSuccessExecution=none` (đã đặt 22/11 11:05Z để không lưu PII). Execution cũ có PII **chưa xóa**.

Dòng thời gian (từ `get_workflow_history`):

| Thời điểm (UTC) | Version | Ý nghĩa |
|---|---|---|
| 04:46 | `d1ec9147` | Gắn nhãn handoff (đã từng là bản live) |
| 06:45 (tạo) → publish lại 11:45 | `47b48f6d` | Bản khôi phục voice; làm Published trong khoảng sáng → ~11:06 |
| 08:27 (tạo) | `1f4069a5` | “V21 menu” = 47b48f6d + 5 node menu + Config Bridge |
| 08:29–10:06 | `abd98c7e` → `c7696472` → `b967d427` → `9c08fdd3` → `18125761` → `9a705cbe` → `9342025c` → `41bcea84` | 8 bản **DRAFT ONLY** (handoff theo vai trò, menu theo Page/sender, phân trang danh mục, reaction shadow ALL OFF, chặn trang danh mục cũ, khớp số tin gửi Meta). Mô tả ghi “Published 47b48f6d unchanged” — đúng lúc viết. |
| ~11:06 | publish `1f4069a5` | Chủ dự án duyệt gắn menu (08:24Z) |
| 11:40–11:46 | `47b48f6d` ↔ `1f4069a5` | Bot không trả lời “Xin chào” → rollback chẩn đoán → publish lại `1f4069a5` lúc 11:47. Nguyên nhân thật: **n8n hết hạn dùng thử ~11:30Z**, không phải menu. |

Khác biệt Draft `41bcea84` so với Published `1f4069a5` (`get_workflow_versions_diff`, đã đọc hết phần tóm tắt cấu trúc):

- Thêm 4 node: `Danh mục Messenger cần phân trang?`, `Đọc danh mục Products DEMO`, `Trình bày trang danh mục Messenger`, `V21 Social Reactions Shadow (ALL OFF)`.
- Sửa 6 node: `Extract Messenger Text`, `Prepare Messenger Reply`, `Verify Messenger Send Result`, `Notify customer and Inbox of handoff request`, `Tìm nút menu`, `Áp quyết định menu`.
- +7 / −2 kết nối. Không xóa node.

Kết luận: Draft chứa công việc của ít nhất 3 luồng (#491 handoff/menu, #493 reactions, catalog pagination). **Không được publish nguyên khối**; khi publish cần tách thành từng gói có UAT riêng và rollback = publish lại `1f4069a5`.

### 3.2 Các workflow còn lại

| Workflow | ID | active | Published | Draft | Nhận xét |
|---|---|---|---|---|---|
| AI_SALES_DEMO – Main Agent | `v6PBwcqSapVzACMW` | true | `c0f04eb1` | `c0f04eb1` | Khớp. Chat trigger, cập nhật lần cuối 09/11. Legacy, ghi Sheet. |
| Create Order Tool | `KrSn4DNR9ALX5ng4` | true | **`4740251a`** (09/11 02:02) | `af9ee686` | **Drift P0**: bản sửa parse VND chặt/tổng an toàn chỉ ở Draft. |
| Manage Order | `fDB9dvs1qPPVt9Sp` | true | `03384201` | `03384201` | Khớp; S-18/S-19 đã publish 22/11 11:05Z. |
| Update Order | `BkAi6TVUKAjCnI7v` | true | **`93cf227a`** | `3bd7043f` | **Drift**: kiểm tra SĐT/địa chỉ chỉ ở Draft. |
| BOT CORE (DRAFT) | `A7XYwSqZwr9T7841` | **true** | `37af7677` | `37af7677` | Tên ghi DRAFT nhưng **đang active** (sub-workflow, chỉ chạy khi được gọi). Bản sao agent Z7Fd, ghi Sheet. |
| CONFIG MENU BRIDGE (DRAFT) | `9HXjjJ5ghPKUu43b` | **true** | `0d04c978` | `0d04c978` | Tên ghi DRAFT nhưng **đã publish** (phục vụ Z7Fd `1f4069a5`). Đề nghị đổi tên/ghi chú cho đúng. |
| TELEGRAM → lõi (DRAFT) | `fffBRIDD7wWIQnXr` | **true** | — | — | Mô tả “chưa publish… cần duyệt” nhưng `active=true` (có trigger). Cần xác minh webhook Telegram có đăng ký không. |
| VOICE → chữ (DRAFT) | `F7EhVGWIALKWg8Y6` | true | — | — | Sub-workflow, dùng bởi Messenger. |
| ZALO V2 SHADOW STAGING | `OgDZNSAvKEvhnAvn` | true | — | — | Gọi RPC `qa_shop_b_zalo_claim` bằng publishable key → gắn với P0 ở mục 4. |

Nhãn trong tên workflow (“DRAFT”) **không phản ánh trạng thái vận hành**; dùng `active` + `activeVersionId` làm nguồn sự thật.

---

## 4. Supabase staging `ifxlvrhyjhbzbrkdsida` (VERIFIED, read-only SQL + advisors 16:03Z)

| Hạng mục | Kết quả |
|---|---|
| Phiên bản | PostgreSQL 17.11 |
| Bảng `public` | 29, **100% bật RLS**, 0 grant bảng cho `anon` |
| Policies | 46 (toàn DB) |
| Hàm `public` | 24 |
| Dữ liệu | 3 tenant, 3 store, 4 auth user, 2 order, 2 assistant, 1 published config, 1 channel_connection (Page demo) |
| `supabase_migrations` | 25 bản ghi, mới nhất `20261122003621 v20_store_sku_contract`. **Thiếu** V23 web (`store_bot_settings`, `store_faqs`, `register_shop`, `set_product_stock`, `submit_lead`) và Config Core 10/20 — áp bằng psql qua Actions (S-22). |

Security advisors:

| Mức | Phát hiện | Phân loại |
|---|---|---|
| WARN | `anon` gọi được SECURITY DEFINER `qa_shop_b_zalo_claim` | **P0 mở** — PR #481 (Phương án A) chưa áp; workflow `OgDZNSAvKEvhnAvn` còn active gọi hàm này. |
| WARN | `anon` gọi được `submit_lead` | Có chủ đích (form lead), giới hạn toàn cục 300/giờ (S-20) → P1: thêm chống spam theo nguồn (Turnstile/IP hash). |
| WARN | `anon` gọi được `get_channel_menu` | Có chủ đích (chỉ trả menu published, không id nội bộ) → chấp nhận, ghi rõ trong threat model. |
| WARN | 17 hàm SECURITY DEFINER cho `authenticated` (create_store, set_store_member, save_*…) | Có chủ đích; an toàn phụ thuộc kiểm tra quyền **bên trong** hàm. UAT owner A/B 37/37 và 49/49 đã PASS trên staging ngày 21/11 cho nhóm V20; **nhóm V23 + Config Core chưa có negative test cross-store độc lập** → P0 kiểm thử. |
| WARN | Leaked password protection tắt | P1 (bật trong Auth settings, cần duyệt vì đổi cấu hình bảo mật). |
| INFO | 25 bảng private RLS bật, không policy | Đúng thiết kế deny-all (chỉ service_role/SECDEF). |

Backup/restore:

- B-00 **VERIFIED** 21/11 12:44Z (run 44904780877, fingerprint 113/113). Workflow `supabase-backup-restore-test.yml` trên `main`, lịch Chủ nhật 19:00 UTC; **chưa chạy theo lịch lần nào** (9 run, tất cả là push 21/11).
- Sau đó staging đã đổi nhiều lần (V20 bước 3–4, V23, Config Core 10/20). Có artifact backup mã hóa trước mỗi lần áp (90 ngày), nhưng **chưa có restore test nào trên trạng thái hiện tại**. Fingerprint V20 **không bao phủ hàm public** → cần mở rộng.
- Lần chạy 19:00Z hôm nay sẽ **reset restore-test về trạng thái staging** (xóa trạng thái UAT trên restore-test).

---

## 5. Render / Cloudflare / Website

| Hệ thống | Kết quả | Nhãn |
|---|---|---|
| Render `tien404-auth-staging` | Proxy container từ chối kết nối (HTTP 403 ở egress) | **BLOCKED** (môi trường audit), không phải bằng chứng hệ thống hỏng |
| GitHub Pages | Proxy từ chối; nội dung xác minh gián tiếp qua nhánh `gh-pages` = PR #496 | VERIFIED (nguồn), BLOCKED (HTTP live) |
| Cloudflare API | Gọi `/accounts` trả `9109 Invalid access token` dù host được đánh dấu có credential tiêm qua proxy | **BLOCKED** — cần kiểm tra lại kết nối Cloudflare |
| Control Hub | Không truy cập trong lần này | BLOCKED |

---

## 6. Integration Matrix

| Feature | Current Version | Environment | Status | Evidence | Blocker | Owner | Next Action |
|---|---|---|---|---|---|---|---|
| Public website V25 | PR #496 @ 7a70fa5 | gh-pages (public) | RELEASED (site tĩnh) | gh-pages `8d3f88f`; CI 6/6 | Code chưa merge develop | Worker B | M2–M4; QA viewport 360–1280 + reduced-motion |
| Owner Workspace (App) | `/app/` từ #496 | gh-pages + Supabase staging | IMPLEMENTED | CI `public-login-browser` PASS | Một số trang chưa có backend thật cần đánh dấu rõ | Worker B | Rà các nút “mô phỏng lưu” |
| Đăng ký tự phục vụ | `register_shop` | Staging | IMPLEMENTED | Hàm có trên staging; cap 50/giờ (S-21) | Chưa có trong migrations history; chưa negative test | A + E | Đưa vào migrations, test cross-tenant |
| Store Authority (tenant/store RBAC) | V20 10–40 | Staging + restore-test | TESTED (hosted) | UAT 49/49, 53/53, 37/37, 20/20 (21–22/11) | JWT GoTrue thật cho V23/Config Core chưa test | Worker A | Negative suite cho 17 RPC |
| Config Core (assistants, versions, menu, action registry) | db/config-core 10+20 | Staging | TESTED (hosted 21/21, 9/9) | run 44996262167, 44998110645 | Không trong migrations history | Worker D | Studio UI draft/preview/publish |
| Config Menu Bridge | n8n `0d04c978` | n8n (published) | RELEASED → **dừng** (n8n hết hạn) | history | n8n plan | C/D | Đổi tên bỏ “DRAFT” |
| Messenger live bot | Z7Fd `1f4069a5` | n8n prod | RELEASED → **dừng** | history, 0 execution sau 10:11Z | n8n plan; webhook HMAC chưa xác minh | Worker C | Sau khi nâng gói: smoke “Xin chào” + menu |
| Messenger Draft V21 (catalog, handoff, reaction shadow) | Z7Fd `41bcea84` | n8n draft | IMPLEMENTED | diff 4 node mới/6 sửa | Trộn nhiều luồng; chưa UAT | C + D | Tách gói, UAT từng gói |
| Shared AI Core | n8n `A7XY` `37af7677` + PR #488 | n8n (active sub-wf) + repo main-based | IMPLEMENTED | CI build PASS | Vẫn ghi Sheet DEMO; chưa tenant-aware | Worker C | Thiết kế contract tenant-aware |
| Telegram adapter | `fffBRIDD7` | n8n active | IMPLEMENTED (trạng thái mơ hồ) | active=true | Cần xác minh webhook đã đăng ký | Worker C | Read-only kiểm tra |
| Web widget | `jkMNMEFz` | n8n inactive | IMPLEMENTED | — | Chưa chống spam | Worker C | Turnstile/rate limit |
| Zalo Bot (owner, V22) | nhiều workflow staging | n8n | IMPLEMENTED/QA | memory zalo-v22 | Cross-channel chưa làm; P0 RPC anon | A + C | Quyết định #481 |
| Commerce: tạo/sửa đơn | KrSn `4740251a`, BkAi `93cf227a`, fDB9 `03384201` | n8n prod → Google Sheet | RELEASED (demo) → dừng | history | Drift P0 parse VND; ghi Sheet, không phải DB tenant | C + E | Publish bản Draft đã test, hoặc tạm khóa tạo đơn |
| Order ownership (OTP, chống replay) | QA schema `tien404_v175_qa` | Staging (QA) | PROPOSED/TESTED offline | V17.5 QA | Chưa nối luồng thật | Worker A | Thiết kế gateway trên Store Authority |
| Reactions | PR #493 | Offline/QA n8n | TESTED offline; CI đỏ `site` | check runs | Xung đột 5 file với #496 | Worker D | M6 |
| Backup/restore | B-00 | GitHub Actions + restore-test | VERIFIED (21/11) | run 44904780877 | Chưa test trên trạng thái hiện tại | Worker A | Theo dõi run 19:00Z hôm nay |
| Billing/Entitlements | — | — | PROPOSED | — | — | — | Thiết kế (P1 pilot) |
| Monitoring | — | — | PROPOSED | — | `saveDataSuccessExecution=none` làm mất dấu vết thành công | Worker E | Outbox + log redacted |

---

## 7. Backlog có phụ thuộc

Mức ưu tiên theo PHẦN V. “Duyệt?” = cần chủ dự án duyệt trước khi thực hiện phần có tác động.

| ID | P | Việc | Phụ thuộc | Tiêu chí nghiệm thu | Owner | Bằng chứng cần có | Rollback | Duyệt? |
|---|---|---|---|---|---|---|---|---|
| B-P0-01 | P0 | Khôi phục n8n (nâng gói) | — | Execution mới xuất hiện cho Z7Fd; “Xin chào” có trả lời | Chủ dự án | execution id + ảnh Messenger | — | **Có (chi phí)** |
| B-P0-02 | P0 | Đóng `qa_shop_b_zalo_claim` cho anon (#481) | Tắt `OgDZNSAvKEvhnAvn` trước | Advisor không còn finding; anon gọi → 42501 | Worker A | advisor + SQL test | `rollback.sql` #481 | **Có** |
| B-P0-03 | P0 | Create Order: publish bản parse VND chặt `af9ee686` (hoặc tạm tắt tạo đơn) | B-P0-01 | 0 đơn sai giá với bộ ca “12abc”, “1.2tr”, số âm; idempotency | Worker C/E | QA offline + 1 UAT có duyệt | publish lại `4740251a` | **Có** |
| B-P0-04 | P0 | Update Order: publish kiểm tra SĐT/địa chỉ `3bd7043f` | B-P0-01 | Ca SĐT sai bị từ chối | Worker C | QA offline | publish `93cf227a` | **Có** |
| B-P0-05 | P0 | Xác minh chữ ký Meta (HMAC) trên webhook live Z7Fd | — | Request không chữ ký/chữ ký sai bị loại trước AI/tool | Worker C/E | đọc node + test synthetic | — | Không (read-only) |
| B-P0-06 | P0 | Negative test cross-store cho 17 RPC SECDEF (V23 + Config Core) bằng JWT thật trên restore-test | Backup B-P0-07 | 0 truy cập chéo; mọi ca có rollback | Worker A/E | script SQL + run Actions | transaction rollback | Có (hosted QA) |
| B-P0-07 | P0 | Backup+restore trên trạng thái hiện tại; mở rộng fingerprint gồm hàm public | — | Run định kỳ 19:00Z xanh, fp khớp | Worker A | run id | — | Không |
| B-P0-08 | P0 | Ghi V23/Config Core vào `supabase_migrations` (pointer rows) + đưa SQL vào repo theo thứ tự | — | `list_migrations` có đủ | Worker A | list_migrations | xóa row pointer | Có (ghi hosted) |
| B-P0-09 | P0 | Xóa execution cũ chứa PII trên n8n | B-P0-01 | 0 execution có PII | Chủ dự án/C | đếm execution | không hoàn tác | **Có (xóa dữ liệu)** |
| B-P0-10 | P0 | Xác nhận đã xoay mật khẩu DB sau sự cố log (S-17) | — | Chủ dự án xác nhận | Chủ dự án | — | — | Có |
| B-P1-01 | P1 | Hợp nhất nhánh M0–M7 | CI xanh từng bước | develop chứa #487/#489/#496/#491/#493; CI xanh | Orchestrator | CI run | revert merge | **Có (merge)** |
| B-P1-02 | P1 | Sửa CI đỏ #493 (build lại `app/`) + giải xung đột với #496 | M4/M5 | `site` PASS | Worker D | check run | — | Không |
| B-P1-03 | P1 | Tách Draft Z7Fd `41bcea84` thành gói publish nhỏ | B-P0-01 | Mỗi gói có UAT live riêng | C + D | execution + ảnh | publish `1f4069a5` | **Có (publish)** |
| B-P1-04 | P1 | Shared AI Core tenant-aware (gộp #488 + A7XY), nguồn dữ liệu DB thay Sheet | B-P0-06 | 1 assistant chạy ≥2 kênh, 0 lộ chéo | Worker C | contract test | giữ Z7Fd | Có khi publish |
| B-P1-05 | P1 | Order Ownership Gateway (OTP 6 số, TTL, giới hạn thử, chống replay) | Store Authority | Khách B biết mã đơn vẫn bị từ chối | Worker A | PG17 test + UAT | rollback SQL | Có (migration) |
| B-P1-06 | P1 | Studio cấu hình Assistant (draft/preview/publish/rollback) trên Config Core | M3 | Hành trình đăng ký→tạo→lưu nháp→preview trên staging | Worker B/D | Playwright | — | Không |
| B-P1-07 | P1 | Chống spam `submit_lead`/`register_shop`; bật leaked password protection | — | Rate limit theo nguồn | Worker A | test | revert | Có |
| B-P1-08 | P1 | Đổi tên/ghi chú workflow “DRAFT” đang active cho đúng trạng thái; xác minh Telegram webhook | — | Tên = trạng thái thật | Worker C | n8n details | đổi lại tên | Có (ghi n8n) |
| B-P1-09 | P1 | Thêm `AGENTS.md` + quy trình checkpoint thống nhất | — | File có trên develop | Orchestrator | PR | revert | Không |
| B-P2-01 | P2 | Reactions live UAT có kiểm soát | B-P1-03 | 1 live UAT theo policy | Worker D | ảnh + log | OFF | **Có (gửi thật)** |
| B-P2-02 | P2 | Zalo OA chính thức, cross-channel | B-P1-05 | Owner consent + webhook xác thực | A + C | — | — | Có |
| B-P2-03 | P2 | Billing/Entitlements (Plan Registry, trial, hết hạn) phía backend | M3 | Gói hết hạn chặn ở backend | Worker A/B | test | — | Có (thanh toán) |
| B-P3-01 | P3 | Dọn ~150 workflow QA cũ trên n8n (archive) | — | — | Worker C | — | unarchive | Có |

---

## 8. Đề xuất tách workstream (cho Orchestrator)

Thứ tự để tránh đụng file/migration:

1. **WS-A (Worker A, P0 bảo mật DB)**: B-P0-02, B-P0-06, B-P0-07, B-P0-08, B-P1-05. Sở hữu duy nhất `db/**`, `qa/v20-*`, `supabase/**`.
2. **WS-C (Worker C, n8n Commerce + Messenger)**: B-P0-03/04/05, B-P1-03, B-P1-08 — **bắt đầu ngay phần read-only/offline**, phần publish chờ n8n + duyệt. Sở hữu duy nhất workflow Z7Fd/KrSn/BkAi/fDB9.
3. **WS-INT (Orchestrator, hợp nhất nhánh)**: B-P1-01, B-P1-02 — một luồng duy nhất được push vào các nhánh #489/#491/#493/#496 trong lúc merge.
4. **WS-B/D (Website + Studio)** chỉ bắt đầu sau M4 để không xung đột `apps/owner/**`.
5. **WS-E (QA/Release)** chạy song song: dataset AI_SALES_*.csv **không tìm thấy** ở repo/Drive (báo cáo 21/11) → cần chủ dự án cung cấp.

---

## 9. Phương pháp và giới hạn

- GitHub: `git fetch` các ref `pull/N/head`, `git merge-base --is-ancestor`, `git rev-list --left-right --count`, check runs qua GitHub MCP.
- n8n: `get_workflow_details`, `get_workflow_history`, `get_workflow_versions_diff`, `search_workflow_executions` (read-only).
- Supabase: `get_advisors(security)`, `list_migrations`, 1 câu SELECT tổng hợp (không ghi).
- Không đọc nội dung node chứa credential; không export JSON workflow hay schema đầy đủ vào repo public.
- Không chạy live test nào: n8n hết hạn, và gửi tin thật cần duyệt.
