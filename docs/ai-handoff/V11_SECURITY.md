# Phát hiện bảo mật

1. Luồng khôi phục từng có thể giữ biểu mẫu khi đổi user. #17 gắn recovery với user ID, xóa trạng thái và kiểm lại getUser trước update. Email khôi phục staging vẫn khóa, chưa nghiệm thu email thật.
2. Super Admin có thể phản chiếu password/TOTP qua lỗi validation. #15 đã có hồi quy ở prototype; cần kiểm tra bên ngoài sau khi có host đúng quyền.
3. Supabase có hai QA tenant có owner active. Kiểm quyền DB và HTTP ẩn danh xem QA. Thiếu signed HTTP ở hai chiều và role âm. Giữ form ghi sản phẩm tắt. Quyền thử QA đã được chủ dự án cấp trong V10.
4. Nút chat có thể mất tác dụng khi CDN lỗi. #19 cho phép mở fallback và đóng bằng bàn phím. Tin thật, webhook Meta và credentials ngoài phạm vi smoke.
5. Bốn draft n8n khác Published. Create Order 4740251a → af9ee686, Manage 137d5689 → 2e8786fd, Update 93cf227a → 3bd7043f, Revenue 978b5a8d → e4e16b90 (Published → Draft). Cần kiểm tra riêng giá trị tiền, quyền chủ đơn và hoàn kho trước promote.


## 12/11/2026 — Commerce stale-error safety correction

- PostgREST transaction retry abuse / reliability defect: merchant optimistic-lock `40001` replaced by `PT409` on staging two-QA-shop allowlisted RPC. Verified actual 409 in disposable PostgREST and SQLSTATE PT409 on staging DB. This prevents the observed error loop; it does NOT eliminate all DoS/rate-limit risks.
- Current staging privilege check: `anon` cannot EXECUTE the product RPC; `authenticated` cannot directly UPDATE products; only owner/manager of two fixed QA tenants may call the SECURITY DEFINER function. Cross-shop owner A→B denied in live PostgreSQL transaction.
- Supabase Security Advisor still flags `authenticated_security_definer_function_executable` for this intentionally privileged QA RPC and `auth_leaked_password_protection`. **Neither warning is resolved** by PT409; no production-grade merchant writing until independent full review and signed JWT acceptance.
- No service-role key, customer payload or Auth token was written into source/logs. No changes to Messenger credentials or production traffic.
