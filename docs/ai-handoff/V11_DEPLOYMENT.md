# Triển khai và rollback

| Môi trường | Deployment / commit | Xác minh |
|---|---|---|
| [Render Auth](https://tien404-auth-staging.onrender.com/login.html) | dep-dbq7q5mgekts73em32e0 / 32669aba3c7e7f86c1be7dc9f5599da4cc59ce99 | LIVE; 19 file khớp build; Chromium ẩn danh đạt |
| [Cloudflare widget](https://eb7edbed.tien404-ai-git-staging.pages.dev/) | eb7edbed-294f-4e74-9ca7-52d2685d790e / 61cf82f222e70f0a32a15e5e1ccc9f7913d95e57 | success, preview |
| Cloudflare canonical | 2715c6e2-edc1-4a5d-9ceb-5953311b752d / 6bb57e6 | gh-pages; preview tự động none |
| Render Data | dep-dbq30a2jnfac73euucsg / 3c29f70 | LIVE; /health trả CONFIGURED_NOT_VERIFIED |
| Messenger | Z7FdV7uDvApfbURQ, Published = Draft d5c96b6b | Chỉ đọc cấu hình trong V11 |

Rollback Auth: xác nhận SHA đang phục vụ, chọn deployment trước dep-dbq33krl550s739e1vfg (c728f15) trên Render, kiểm login/denial/asset theo đúng build, sau đó đồng bộ nhánh staging bằng revert có kiểm SHA. Chưa diễn tập rollback trên bản đang phục vụ. Widget preview cũ 5727518f vẫn là mốc so sánh; chia sẻ URL cũ nếu preview mới lỗi. Không cần đổi DNS.


## 12/11/2026 — deployment reality after continuation

| Component | Current actual evidence | Note |
|---|---|---|
| Cloudflare main Git Pages | `2715c6e2-edc1-4a5d-9ceb-5953311b752d` SUCCESS, `6bb57e631709cb0be8d3b2b02c299d5915638df8` | production branch gh-pages unchanged |
| Cloudflare newest overall event | `70e34d43-a9ea-4755-9369-612af0f8b360` SKIPPED preview | Preview disabled; event is not a published version |
| Render Auth staging | `dep-dbqeqgafngtc73fcpf9g` LIVE, `deaa5e1c6193a7861f6f3d1b55448a1ce1c05624` | static auth preview; no auto-deploy |
| Render Data staging | `dep-dbq30a2jnfac73euucsg` LIVE, `3c29f70eae00edd6572756c91c4a4bfa43e77d2c` | staging read gateway; not production |
| Supabase PostgreSQL staging | migration `20261111225128 v11_qa_merchant_product_stale_conflict_pt409` applied | Only QA two-shop product-RPC error semantics; versioned source in Draft PR #26 |

No Cloudflare Pages deploy or Render service redeploy was triggered by this continuation. No DNS/domain/production change. Prior V11 Auth deploy row above remains historical, not the latest release.
