import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Where Supabase should send people back after e-mail confirmation / password reset. */
export const appUrl = () => `${location.origin}${location.pathname}`;

const MESSAGES: Record<string, string> = {
  access_denied: 'Bạn không có quyền làm việc này ở cửa hàng này.',
  sku_taken: 'Mã SKU này đã có trong cửa hàng của bạn.',
  product_changed_or_missing: 'Sản phẩm vừa được người khác sửa. Hãy tải lại rồi thử lại.',
  settings_changed: 'Cài đặt vừa được người khác sửa. Hãy tải lại rồi thử lại.',
  invalid_product: 'Thông tin sản phẩm chưa hợp lệ.',
  invalid_initial_stock: 'Tồn kho ban đầu phải là số từ 0 trở lên.',
  invalid_stock: 'Tồn kho phải là số từ 0 trở lên.',
  invalid_settings: 'Cài đặt chưa hợp lệ.',
  invalid_email: 'Có email nhận thông báo chưa đúng định dạng.',
  invalid_faq: 'Câu hỏi và câu trả lời không được để trống.',
  faq_limit_reached: 'Mỗi cửa hàng tối đa 200 câu hỏi đáp.',
  invalid_stage: 'Giai đoạn khách hàng chưa hợp lệ.',
  invalid_shop: 'Tên shop cần từ 2 đến 150 ký tự.',
  shop_already_registered: 'Tài khoản này đã đăng ký một shop.',
  rate_limited: 'Hệ thống đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
  draft_changed: 'Bản nháp vừa được người khác sửa. Hãy tải lại rồi thử lại.',
  template_unknown: 'Mẫu ngành này không còn dùng được.',
  assistant_limit: 'Mỗi cửa hàng tối đa 10 trợ lý.',
  version_not_found: 'Không tìm thấy phiên bản này.',
  invalid_name: 'Tên trợ lý cần 1–80 ký tự.',
  config_too_large: 'Cấu hình quá lớn.',
  invalid_store: 'Mã cửa hàng chỉ gồm chữ thường, số và dấu gạch ngang.',
  store_key_taken: 'Mã cửa hàng này đã được dùng.',
  store_limit_reached: 'Đã đạt số cửa hàng tối đa.',
  'Invalid login credentials': 'Email hoặc mật khẩu không đúng.',
  'Email not confirmed': 'Email chưa được xác nhận. Hãy mở thư xác nhận trong hộp thư của bạn.',
  'User already registered': 'Email này đã có tài khoản. Hãy đăng nhập.',
};

export function friendlyError(err: unknown): string {
  const msg = (err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)) || '';
  for (const [k, v] of Object.entries(MESSAGES)) if (msg.includes(k)) return v;
  if (/Could not find the function|schema cache/i.test(msg)) return 'Chức năng này chưa được bật trên máy chủ. Vui lòng liên hệ TIEN404.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  if (/Password should be/i.test(msg)) return 'Mật khẩu cần ít nhất 8 ký tự.';
  return 'Có lỗi xảy ra. Vui lòng thử lại.';
}
