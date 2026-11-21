# TIEN404 V23 — public site redesign + owner App

Status: **PROPOSED / Draft PR**. Nothing here is deployed and no migration has been applied to any hosted database.

## What changed

| Area | Before (develop) | V23 |
|---|---|---|
| Public site | 26 static pages, many simulated (register, dashboard, checkout, billing, invoice, onboarding, lab) stored in `sessionStorage` | 11 pages generated from `site-src/` (`node scripts/build-site.mjs`), new design system `assets/site.css`, no demo pages |
| Retired demo pages | — | 15 `noindex` meta-refresh stubs + `_redirects` 301 to their real replacement |
| Login / sign-up | `/login` → Render `tien404-auth-staging` | `/login` → `/app/#/dang-nhap` (Supabase Auth in the owner App) |
| Contact form | Needed `apiBase`, which was empty → never sent | `submit_lead` RPC (anon, validated, rate-limited) → `app_private.web_leads` |
| AI chat | `@n8n/chat` loaded from an unpinned CDN | Same n8n chat webhook, own small client in `assets/site.js` (no CDN) |
| Owner App | Merchant Portal only on a checkpoint branch (Render) | `apps/owner` (Vite + React + TS), built to `app/` |

## Owner App screens (`/app/`)

Đăng nhập · Đăng ký · Quên/đặt lại mật khẩu · Tạo cửa hàng (`register_shop`) · Tổng quan · Sản phẩm & tồn kho
(`save_merchant_product_in_store`, `set_product_stock`) · Đơn hàng (read) · Khách hàng theo giai đoạn (`set_customer_stage`) ·
Cài đặt bot: giọng nói, thông tin shop, điều không được hứa, bật/tắt bot, email báo đơn (`save_store_bot_settings`) ·
Hỏi đáp (`save_store_faq`, `delete_store_faq`) · Kênh bán · Gói dịch vụ · Tài khoản.

All reads go through store-scoped RLS (V20). All writes go through SECURITY DEFINER RPCs that check Store role
(owner/manager); staff are read-only. Only the Supabase *publishable* key is in the code.

## Database (db/v23-web) — apply order and rollback

Requires V20 Store Authority 10 + 20 + **30** (PR #482) on the target first.

| Apply | File | Rollback |
|---|---|---|
| 1 | `10_leads.sql` — `app_private.web_leads`, `submit_lead` | `90_leads_rollback.sql` |
| 2 | `20_self_serve_shop.sql` — `register_shop`, self-service tenants admitted to V20 admin RPCs | `80_self_serve_shop_rollback.sql` |
| 3 | `30_store_bot_settings.sql` — bot settings, FAQ, customer stage, `set_product_stock` | `70_store_bot_settings_rollback.sql` |

Rollback order: 70 → 80 → 90. Offline UAT: `PGHOST=… PGPORT=… bash qa/v23-web/offline-pg-uat.sh` (78 checks).

## Not in this PR (Phase 3)

Bots reading bot settings / FAQ / on-off switch; orders created on Supabase by the Messenger bot; order e-mails;
"bot asks owner to teach unanswered questions"; reports by period; follow-up messages; billing.

## Approvals needed before it is live

1. Apply V20 step 3 then `db/v23-web` 10 → 20 → 30 on restore-test, then staging.
2. Supabase Auth: allow sign-ups with e-mail confirmation; add the App URL(s) to *Redirect URLs*.
3. Merge and deploy the static site (Cloudflare Pages / GitHub Pages) — production change.
