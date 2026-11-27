import { supabase } from './supabase';
import { ZALO_HUB_URL } from './config';

const ERR: Record<string, string> = {
  INVALID_SYNC: 'Hai danh mục chưa đủ dữ liệu để áp dụng lựa chọn này.',
  BOT_PRODUCT_LIMIT: 'Sản phẩm vượt giới hạn mã, tên, giá, tồn hoặc dung lượng của Bot Lite.',
  WEB_CATALOG_UNAVAILABLE: 'Chưa đọc được danh mục web. Hãy tải lại.',
  WEB_WRITE_FAILED: 'Web chưa xác nhận đã lưu. Hãy tải lại để đối chiếu trước khi thử lại.',
  LINK_CHANGED: 'Liên kết hoặc danh mục đã thay đổi. Tải lại trang để xem dữ liệu mới.',
  BOT_DRAFT_OPEN: 'Chủ bot đang nhập sản phẩm trên Zalo. Hãy lưu hoặc hủy bản nháp trước khi sửa giá.',
  TOKEN_NOT_FOUND: 'Không thấy mã bot trong nội dung vừa dán. Hãy dán nguyên tin nhắn Zalo gửi mã bot.',
  TOKEN_REJECTED: 'Zalo báo mã bot không đúng hoặc đã bị đổi. Mở Zalo Bot Creator để lấy mã mới.',
  BOT_OWNED_BY_OTHER_STORE: 'Bot này đang nối với cửa hàng khác.',
  BOT_ALREADY_CONNECTED: 'Bot này đã nối với cửa hàng của bạn.',
  STORE_HAS_LIVE_BOT: 'Cửa hàng đã có một bot Zalo. Ngắt bot cũ trước khi nối bot khác.',
  STORE_MANAGED_BY_TIEN404: 'Bot Zalo của cửa hàng này do đội TIEN404 nối hộ. Liên hệ TIEN404 nếu muốn đổi.',
  SET_WEBHOOK_FAILED: 'Zalo chưa nhận kết nối. Thử lại sau ít phút.',
  NOT_STORE_MANAGER: 'Chỉ chủ shop hoặc quản lý mới nối được bot.',
  SIGN_IN_AGAIN: 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.',
  OWNER_CONNECT_DISABLED: 'Tính năng tự nối bot Zalo chưa được bật.',
  HUB_DISABLED: 'Cổng Zalo đang tạm dừng.',
  SHARED_FLOW_NOT_CONFIGURED: 'Cổng Zalo chưa sẵn sàng nhận shop mới.',
  AUTH_NOT_CONFIGURED: 'Cổng Zalo chưa sẵn sàng nhận shop mới.',
};
export async function hub(method: 'GET' | 'POST', path: string, body?: object) {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error(ERR.SIGN_IN_AGAIN);
  let res: Response;
  try {
    res = await fetch(ZALO_HUB_URL + path, {
      method, headers: { authorization: 'Bearer ' + jwt, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error('Không kết nối được cổng Zalo. Kiểm tra mạng rồi thử lại.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(ERR[j.error] ?? 'Có lỗi xảy ra. Vui lòng thử lại.');
  return j;
}

