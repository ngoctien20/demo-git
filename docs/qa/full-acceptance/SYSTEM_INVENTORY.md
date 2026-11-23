# SYSTEM_INVENTORY — TIEN404 V21.0 (Round 1)

Thời điểm: 2026-11-21 ~11:15–12:00 UTC. Chỉ đọc. Không thay đổi runtime nào.

## 1. GitHub `ngoctien20/demo-git`

| Hạng mục | Giá trị thực tế | Nhãn |
|---|---|---|
| Visibility | **public** | VERIFIED (`GET /repos`) |
| Default branch | `main` = `2ddf013` (demo 2024) | VERIFIED |
| `develop` | `00aff9b` = #474 + #475, 331 commit hơn `gh-pages` | VERIFIED |
| `gh-pages` | `ff2daf9` (V13.4), là tổ tiên của `develop` | VERIFIED |
| Branch protection `main`, `develop` | **Không có** (HTTP 404 "Branch not protected") | VERIFIED |
| Dependabot alerts | **Tắt** (HTTP 403 "disabled for this repository") | VERIFIED |
| Remote heads | 502 nhánh (`checkpoint/*`, `work/*`, `qa/*`, `ops/*`) | VERIFIED |
| Check runs trên `00aff9b` | 46 check, không có failure | VERIFIED |
| Workflows trên `develop` | 37 file, 0 file tham chiếu `secrets.*` | VERIFIED (grep) |
| Secret scanning / Pages API | Không đọc được qua proxy | BLOCKED |

### PR liên quan (trạng thái 11:20 UTC)

| PR | Head → Base | Draft | Mergeable | Ghi chú |
|---|---|---|---|---|
| #468 Messenger M3-H7 | `work/v1876cm7…` → `work/v1876cm6…` | Có | clean | Không nằm trong `develop` |
| #472–#475 | stack V19.8.18 → V20.1-S2 | Có | — | Đã nằm trong `develop` |
| #476 revoke anon | → main | Có | clean | Đã bị #481 thay thế; không áp dụng đơn lẻ |
| #477 develop → main | | Có | | Chủ dự án giữ, không merge |
| #478 GPT Worker | → main | **Không** | clean | Xung đột nội dung với `develop` (`jekyll-docker.yml`) theo audit trước |
| #479 V20.1-P0-S3 | → #474 | Có | clean | Không nằm trong `develop` |
| #480 V19.8.20 | → #475 | Có | clean | Không nằm trong `develop` |
| #481 Phương án A Zalo | → main | Có | clean | Chờ phê duyệt |
| #482 Store Authority V20 | → develop | Có | clean | Thread khác phụ trách |

### Mã nguồn thực sự nằm ở đâu

| Thành phần | Nhánh chứa source | Có trong `develop`? |
|---|---|---|
| Website tĩnh (26 trang) + widget | `develop`, `gh-pages` | Có |
| Trang đăng nhập Supabase Auth, Merchant Portal, Tester Portal (Render `tien404-auth-staging`) | `checkpoint/render-auth-staging-pre-v12-2-admin-csv-20261114` (`6324b778`) và các checkpoint 14/11 | **Không** |
| Super Admin (Python) + Control Hub | `ops/super-admin-v4-staging-20261110` | **Không** |
| Supabase migrations của staging | Không có thư mục `supabase/migrations` trong `develop`; 21 migration chỉ tồn tại trên hosted | **Không** |
| Cloudflare Worker / Durable Object | Chỉ có candidate trong `qa/channel-v1855/*` | Chỉ ở dạng QA |
| n8n workflow | Chỉ trên n8n Cloud; repo có vài file `*.sdk.ts` ở nhánh khác | **Không** (không có export đồng bộ) |

Hệ quả: merge #477 vào `main` sẽ **không** đưa code đang chạy trên Render, Super Admin hay n8n vào nhánh chính. `main` không thể là nguồn sự thật cho runtime.

## 2. Supabase staging `ifxlvrhyjhbzbrkdsida` (PG 17, Free plan)

| Hạng mục | Giá trị |
|---|---|
| Migrations | 21, mới nhất `20261117074559` (không đổi từ 17/11) |
| Bảng ứng dụng | 46 bảng trong 6 schema (`public` 19, `app_private` 3, `factory_private` 5, `tien404_dialogue_private` 2, `tien404_r1_qa` 8, `tien404_v175_qa` 8) |
| Bảng Store / `store_id` | 0 bảng `stores`/`store_memberships`, 0 cột `store_id` |
| Dữ liệu Commerce | 2 tenants, 3 memberships, 2 products, 2 orders, 0 order_items, 0 customers, 0 conversations, 0 messages, 0 order_idempotency, 0 audit_events |
| Bảng subscription / billing / outbox ở `public` | **Không có** (chỉ `tien404_r1_qa.owner_outbox`) |
| Grant `authenticated` lên bảng Commerce | Chỉ `SELECT`; ghi Commerce chỉ qua RPC `save_merchant_product` |
| Grant `anon` lên bảng `public` | Không có |
| Schema riêng tư | `anon`/`authenticated` không có USAGE trên `app_private`, `factory_private`, `tien404_*` |
| SECURITY DEFINER trong `public` | `qa_shop_b_zalo_claim` (anon), `qa_owner_pairing` (authenticated), `save_merchant_product` (authenticated), `tien404_tester_track_change` (service_role) |
| Policies `public` | 31 |
| Auth users | 3 |
| Advisors security | 1 WARN anon SECDEF, 2 WARN authenticated SECDEF, 1 WARN leaked-password protection tắt, 23 INFO RLS không policy (bảng private) |
| Tester case bank | `tien404_tester_cases` 137 case, `tien404_tester_runs` 2 lượt, 6 module, 1 staff |
| Project restore-test `cunxxzxaboazbszsfneo` | Rỗng (theo audit 10:36 UTC) |

## 3. n8n `ngoctien20.app.n8n.cloud`

174 workflow, **23 active**. Các workflow có trigger thật:

| ID | Tên | Trigger | Ghi chú |
|---|---|---|---|
| `Z7FdV7uDvApfbURQ` | TIEN404_MESSENGER_TEST | Webhook GET + POST `/webhook/tien404-messenger-qa` | **Bot Messenger LIVE**, gửi trả lời thật, gọi tool tạo/sửa đơn trên Google Sheet DEMO |
| `v6PBwcqSapVzACMW` | AI_SALES_DEMO - Main Agent | Chat trigger | Agent demo trên Google Sheet |
| `wgkkmT7q4lm4HyuA` | TIEN404 WEBSITE — DEMO & MARKETING AI | Chat webhook public, không auth | Widget tư vấn website, chỉ đọc |
| `U2DJsxzSYPH5hRop` | AI SALES - Revenue Report | Schedule 21:00 Asia/Ho_Chi_Minh | Gửi Gmail hằng ngày |
| `jy7vCmt8LH6BSqGh` | TIEN404_ZALO_V19_7I_PROTECTED_WEBHOOK… | Webhook header-auth | Receipt-only, không gửi |
| `yIJk8LvJoLF40Z62` | TIEN404_ZALO_BOT_LAB_V1_STAGING | Webhook header-auth | Mô tả ghi "Inactive" nhưng đang active |

17 workflow active còn lại là sub-workflow (Execute Workflow Trigger). Danh sách đầy đủ và độ lệch Draft/Published: xem `EVIDENCE_MANIFEST.md` mục N8N.

**Draft ≠ Published (versionId ≠ activeVersionId):** `KrSn4DNR9ALX5ng4` Create Order Tool, `fDB9dvs1qPPVt9Sp` Manage Order, `BkAi6TVUKAjCnI7v` Update Order, `U2DJsxzSYPH5hRop` Revenue Report, `iyfGUiEsZlNTBWOR` Commerce AI Agent Sandbox. Ba workflow đầu là tool ghi đơn mà bot Messenger live đang gọi.

Executions: 2.389 lượt từ 07/11; 46 lượt lỗi từ 01/11 (hầu hết manual QA; 1 lỗi webhook Messenger 17/11).

## 4. Render, Cloudflare, Google

| Thành phần | Trạng thái kiểm tra |
|---|---|
| Render `tien404-auth-staging.onrender.com` | BLOCKED: proxy container chặn host; connector Render lỗi kết nối; chưa chọn workspace |
| Cloudflare Pages `tien404-ai-git-staging.pages.dev`, Worker `tien404-widget-gateway-v144-staging…workers.dev` | BLOCKED: proxy chặn; không có connector Cloudflare |
| GitHub Pages `ngoctien20.github.io/demo-git` | BLOCKED (proxy) |
| Google Sheet `AI_SALES_DEMO` | Tồn tại, sửa lần cuối 17/11 04:30 UTC; là kho dữ liệu đơn của bot Messenger live |

## 5. Bản đồ phụ thuộc (rút gọn)

```
Website tĩnh ──► widget ai-consultant.js ──► n8n wgkk (public chat, LLM, chỉ đọc) ──► 4ycm shadow (no-send)
login.html ──► Render auth (Supabase Auth GoTrue) ──► Supabase staging (RLS tenant) ──► save_merchant_product
Meta Page ──► n8n Z7Fd (HMAC, allowlist 1 page, dedup) ──► AI Agent (gpt-5-mini)
                 ├─► Google Sheet AI_SALES_DEMO (Products đọc) 
                 ├─► KrSn create_order / fDB9 manage / BkAi update / 4DFF status / KqSu ticket  ──► Google Sheet (ghi)
                 ├─► Graph API send (thật)
                 └─► dw1J shadow → iyfG Commerce sandbox (QA_CORE, chỉ đọc)
Zalo Bot ──► n8n yIJk (header auth) ──► OgDZ shadow ──► RPC qa_shop_b_zalo_claim (anon key + Vault header)
                                    └─► sIPs / 4ycm (no-send)
Zalo QA ──► n8n jy7v (receipt only, data table marker)
Schedule 21:00 ──► U2DJ ──► Google Sheet Orders ──► Gmail
Store Authority (#482) ──► (chưa áp) Supabase
Subscription/Billing ──► (không có backend)
```

Phụ thuộc chặn: Store Authority hosted ⇐ B-00 backup/restore; mọi kênh bán thật ⇐ Store Authority + Commerce ghi trên Supabase; cutover Zalo #481 ⇐ quyết định chủ dự án; Commerce production ⇐ chuyển khỏi Google Sheet DEMO.
