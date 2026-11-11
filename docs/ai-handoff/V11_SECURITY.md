# Phát hiện bảo mật

1. Luồng khôi phục từng có thể giữ biểu mẫu khi đổi user. #17 gắn recovery với user ID, xóa trạng thái và kiểm lại getUser trước update. Email khôi phục staging vẫn khóa, chưa nghiệm thu email thật.
2. Super Admin có thể phản chiếu password/TOTP qua lỗi validation. #15 đã có hồi quy ở prototype; cần kiểm tra bên ngoài sau khi có host đúng quyền.
3. Supabase có hai QA tenant có owner active. Kiểm quyền DB và HTTP ẩn danh xem QA. Thiếu signed HTTP ở hai chiều và role âm. Giữ form ghi sản phẩm tắt. Quyền thử QA đã được chủ dự án cấp trong V10.
4. Nút chat có thể mất tác dụng khi CDN lỗi. #19 cho phép mở fallback và đóng bằng bàn phím. Tin thật, webhook Meta và credentials ngoài phạm vi smoke.
5. Bốn draft n8n khác Published. Create Order 4740251a → af9ee686, Manage 137d5689 → 2e8786fd, Update 93cf227a → 3bd7043f, Revenue 978b5a8d → e4e16b90 (Published → Draft). Cần kiểm tra riêng giá trị tiền, quyền chủ đơn và hoàn kho trước promote.
