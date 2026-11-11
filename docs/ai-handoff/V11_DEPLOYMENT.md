# Triển khai và rollback

| Môi trường | Deployment / commit | Xác minh |
|---|---|---|
| [Render Auth](https://tien404-auth-staging.onrender.com/login.html) | dep-dbq7q5mgekts73em32e0 / 32669aba3c7e7f86c1be7dc9f5599da4cc59ce99 | LIVE; 19 file khớp build; Chromium ẩn danh đạt |
| [Cloudflare widget](https://eb7edbed.tien404-ai-git-staging.pages.dev/) | eb7edbed-294f-4e74-9ca7-52d2685d790e / 61cf82f222e70f0a32a15e5e1ccc9f7913d95e57 | success, preview |
| Cloudflare canonical | 2715c6e2-edc1-4a5d-9ceb-5953311b752d / 6bb57e6 | gh-pages; preview tự động none |
| Render Data | dep-dbq30a2jnfac73euucsg / 3c29f70 | LIVE; /health trả CONFIGURED_NOT_VERIFIED |
| Messenger | Z7FdV7uDvApfbURQ, Published = Draft d5c96b6b | Chỉ đọc cấu hình trong V11 |

Rollback Auth: xác nhận SHA đang phục vụ, chọn deployment trước dep-dbq33krl550s739e1vfg (c728f15) trên Render, kiểm login/denial/asset theo đúng build, sau đó đồng bộ nhánh staging bằng revert có kiểm SHA. Chưa diễn tập rollback trên bản đang phục vụ. Widget preview cũ 5727518f vẫn là mốc so sánh; chia sẻ URL cũ nếu preview mới lỗi. Không cần đổi DNS.
