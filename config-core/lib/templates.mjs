// TIEN404 Industry Templates (version 1). A template is only a starting config: creating an
// Assistant copies it into a DRAFT that the owner edits. Templates never contain prices, stock,
// biographies, schedules or other facts about a real business: missing data stays missing and the
// bot must say so. Links are placeholders (PLACEHOLDER_MARK) and the item is disabled until the
// owner enters a real link. Seeded identically in db/config-core/10_config_core.sql (checked by QA).

export const TEMPLATE_VERSION = 1;

const base = (greeting, menu) => ({
  schema_version: 1,
  greeting,
  addressing: { self: 'mình', customer: 'bạn' },
  menu: menu.map((m, i) => ({ enabled: true, sort_order: (i + 1) * 10, action_config: {}, ...m })),
});

export const TEMPLATES = Object.freeze({
  shop: {
    name: 'Cửa hàng', industry: 'retail',
    config: base('Chào bạn! Mình là trợ lý của shop. Bạn muốn xem sản phẩm hay tra cứu đơn hàng?', [
      { id: 'catalog', action_type: 'SHOW_CATALOG', label: 'Xem sản phẩm' },
      { id: 'order_lookup', action_type: 'ORDER_LOOKUP', label: 'Tra cứu đơn hàng' },
      { id: 'website', action_type: 'OPEN_LINK', label: 'Xem website', enabled: false,
        action_config: { url: 'https://example.com/THAY-LINK-WEBSITE', link_kind: 'website' } },
      { id: 'handoff', action_type: 'HUMAN_HANDOFF', label: 'Gặp nhân viên', action_config: { team: 'sales' } },
    ]),
  },
  artist: {
    name: 'Nghệ sĩ / Nhà sáng tạo', industry: 'creator',
    config: base('Chào bạn! Mình là trợ lý của trang. Bạn muốn nghe nhạc, xem thông tin hay liên hệ đội ngũ quản lý?', [
      { id: 'music', action_type: 'SHOW_PLAYLIST', label: 'Nghe nhạc', enabled: false,
        action_config: { url: 'https://www.youtube.com/@THAY-LINK-PLAYLIST' } },
      { id: 'profile', action_type: 'SHOW_PROFILE', label: 'Thông tin nghệ sĩ' },
      { id: 'youtube', action_type: 'OPEN_LINK', label: 'Kênh YouTube', enabled: false,
        action_config: { url: 'https://www.youtube.com/@THAY-LINK-KENH', link_kind: 'youtube' } },
      { id: 'manager', action_type: 'HUMAN_HANDOFF', label: 'Liên hệ quản lý', action_config: { team: 'manager' } },
    ]),
  },
  service: {
    name: 'Dịch vụ', industry: 'service',
    config: base('Chào bạn! Mình có thể giới thiệu dịch vụ, bảng giá hoặc chuyển bạn tới chuyên viên tư vấn.', [
      { id: 'services', action_type: 'SHOW_SERVICES', label: 'Xem dịch vụ' },
      { id: 'price_list', action_type: 'SHOW_SERVICES', label: 'Xem bảng giá' },
      { id: 'booking', action_type: 'BOOKING_REQUEST', label: 'Đặt lịch tư vấn', enabled: false },
      { id: 'handoff', action_type: 'HUMAN_HANDOFF', label: 'Liên hệ nhân viên', action_config: { team: 'consultant' } },
    ]),
  },
  education: {
    name: 'Nội dung / Giáo dục', industry: 'education',
    config: base('Chào bạn! Mình có thể giới thiệu khóa học, tài liệu và lịch hoạt động.', [
      { id: 'courses', action_type: 'SHOW_SERVICES', label: 'Xem khóa học' },
      { id: 'free_docs', action_type: 'OPEN_LINK', label: 'Tài liệu miễn phí', enabled: false,
        action_config: { url: 'https://example.com/THAY-LINK-TAI-LIEU', link_kind: 'website' } },
      { id: 'schedule', action_type: 'FAQ', label: 'Lịch hoạt động', action_config: { topic: 'lịch hoạt động' } },
      { id: 'manager', action_type: 'HUMAN_HANDOFF', label: 'Liên hệ quản lý', action_config: { team: 'manager' } },
    ]),
  },
});

export function templateConfig(key) {
  if (!Object.hasOwn(TEMPLATES, key)) throw new Error('template_unknown');
  return structuredClone(TEMPLATES[key].config);
}
