// TIEN404 Config Core — bot bridge (pure, no I/O). Used by the n8n sub-workflow
// "TIEN404 CONFIG MENU BRIDGE" (see config-core/n8n/) and later by every channel adapter.
//
// Input : the published menu returned by public.get_channel_menu(channel, account)  (or null)
//         + one customer event already verified by the channel adapter: { payload?, text? }.
// Output: a decision the adapter executes with what it ALREADY has:
//   { mode: 'legacy' }                         -> no config / not a config payload: keep today's flow untouched
//   { mode: 'ai', chatInput }                  -> send chatInput to the existing AI agent (catalog, orders, FAQ)
//   { mode: 'handoff', chatInput, ackText }    -> existing human-handoff path, with the configured team wording
//   { mode: 'direct', replyText }              -> deterministic reply from owner-configured data, no AI, no invention
//   { mode: 'greeting', message }              -> greeting + quick replies built from the menu
//   { mode: 'rejected', reason }               -> stale/forged payload: adapter answers with the greeting
// Nothing here can pick a tool, tenant or credential: the menu comes from the server and the
// payload only names an item id (resolveInbound).

import { resolveInbound, render, PAYLOAD_PREFIX } from './channel-render.mjs';
import { HANDOFF_DEFAULT_ACK } from './action-registry.mjs';

const MISSING = 'Hiện mình chưa có thông tin này. Bạn có thể chọn mục khác hoặc nhắn câu hỏi để mình hỗ trợ nhé.';
const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';

export function directReply(action, menu) {
  const c = action.action_config || {};
  switch (action.action_type) {
    case 'SHOW_CONTENT':
      return (c.title ? c.title + '\n' : '') + c.text;
    case 'SHOW_PROFILE': {
      const p = menu.profile || {};
      if (!p.display_name && !p.bio) return MISSING;
      return [p.display_name, p.bio].filter(Boolean).join('\n');
    }
    case 'CONTACT_INFO': {
      const lines = [
        c.phone && 'Điện thoại: ' + c.phone,
        c.email && 'Email: ' + c.email,
        c.address && 'Địa chỉ: ' + c.address,
        c.hours && 'Giờ làm việc: ' + c.hours,
      ].filter(Boolean);
      return lines.length ? lines.join('\n') : MISSING;
    }
    case 'SHOW_SERVICES': {
      const items = Array.isArray(c.items) ? c.items : [];
      if (!items.length) return MISSING;
      return items.map((s) => '• ' + s.name + (Number.isSafeInteger(s.price_vnd) ? ': ' + vnd(s.price_vnd) : '') + (s.note ? ' (' + s.note + ')' : '')).join('\n');
    }
    case 'SHOW_PLAYLIST':
      return (c.title || 'Nghe tại đây') + ': ' + c.url;
    case 'OPEN_LINK':
      return c.url;
    default:
      return null;
  }
}

export function decide(menu, event, channel = 'messenger') {
  if (!menu || !Array.isArray(menu.menu)) {
  if (typeof event?.payload === 'string' && (event.payload.startsWith(PAYLOAD_PREFIX) || event.payload.startsWith('T404:C:'))) {
    return { mode: 'rejected', reason: 'menu_unavailable',
      message: { text: 'Nút này hiện không khả dụng. Bạn có thể nhắn yêu cầu trực tiếp để được hỗ trợ.' } };
  }
  return { mode: 'legacy' };
}
  const payload = typeof event?.payload === 'string' ? event.payload : undefined;
  const isStart = payload === 'TIEN404:START' || payload === 'GET_STARTED';
  if (isStart) return { mode: 'greeting', message: greetingMessage(menu, channel) };
  // V21 Messenger catalogue cursors are only references to a published SHOW_CATALOG item.
  // The cursor never grants access to a tenant, SKU or price. Version mismatch rejects stale buttons.
  if (payload?.startsWith('T404:C:')) {
    const cursor = /^T404:C:([a-z][a-z0-9_]{1,31}):([1-9][0-9]{0,8}):([0-9a-f]{8}):([1-9][0-9]?)$/.exec(payload);
    if (!cursor || channel !== 'messenger') {
      return { mode: 'rejected', reason: 'catalog_cursor_invalid',
        message: { text: 'Nút chuyển trang không hợp lệ. Bạn hãy mở lại danh mục nhé.' } };
    }
    if (String(menu.version_no ?? '') !== cursor[2]) {
      return { mode: 'rejected', reason: 'catalog_version_stale',
        message: { text: 'Danh mục đã được cập nhật. Bạn hãy mở lại mục Xem sản phẩm nhé.' } };
    }
    const it = resolveInbound({ channel, payload: PAYLOAD_PREFIX + cursor[1] }, menu);
    if (it.kind !== 'menu' || it.action_type !== 'SHOW_CATALOG') {
      return { mode: 'rejected', reason: 'catalog_item_inactive',
        message: { text: 'Mục sản phẩm này hiện không khả dụng. Bạn hãy mở lại menu nhé.' } };
    }
    return { mode: 'catalog', itemId: it.item_id, catalogPage: Number(cursor[4]),
      catalogDigest: cursor[3], catalogCategory: it.action_config?.category ?? null };
  }
  if (channel === 'zalo_bot' && !payload && menu.version_no != null &&
      String(event?.shownMenuVersion ?? '') === String(menu.version_no) && /^\s*\d{1,2}\s*$/.test(event?.text || '')) {
    const numberMap = render(menu, channel).number_map;
    const choice = resolveInbound({ channel, text: event.text, numberMap }, menu);
    if (choice.action_type === 'HUMAN_HANDOFF') return { mode: 'handoff', action_type: 'HUMAN_HANDOFF', itemId: choice.item_id };
  }
  if (!payload || !payload.startsWith(PAYLOAD_PREFIX)) return { mode: 'legacy' };
  const r = resolveInbound({ channel, payload }, menu);
  if (r.kind !== 'menu') return { mode: 'rejected', reason: r.reason || r.kind, message: greetingMessage(menu, channel) };
  const c = r.action_config;
  switch (r.action_type) {
    case 'SHOW_CATALOG':
      // Other channel adapters retain the prior AI behavior until independently accepted.
      return channel === 'messenger'
        ? { mode: 'catalog', itemId: r.item_id, catalogPage: 1, catalogCategory: c.category ?? null }
        : { mode: 'ai', itemId: r.item_id, chatInput: c.category ? 'Shop có những mẫu ' + c.category + ' nào?' : 'Shop đang có những sản phẩm nào?' };
    case 'ORDER_LOOKUP':
      return { mode: 'ai', itemId: r.item_id, chatInput: 'Tôi muốn tra cứu đơn hàng của tôi' };
    case 'FAQ':
      return { mode: 'ai', itemId: r.item_id, chatInput: c.topic ? 'Cho mình hỏi về ' + c.topic : 'Cho mình hỏi một số câu hỏi thường gặp' };
    case 'HUMAN_HANDOFF':
      if (channel === 'zalo_bot') return { mode: 'handoff', action_type: 'HUMAN_HANDOFF', itemId: r.item_id };
      // Same sentence the live classifier already treats as an explicit handoff request.
      return { mode: 'handoff', itemId: r.item_id, chatInput: 'Tôi muốn gặp nhân viên tư vấn', team: c.team, ackText: r.ack_text || HANDOFF_DEFAULT_ACK[c.team] };
    default: {
      const text = directReply(r, menu);
      return text ? { mode: 'direct', itemId: r.item_id, replyText: text.slice(0, 1900) } : { mode: 'rejected', reason: 'action_not_supported_here', message: greetingMessage(menu, channel) };
    }
  }
}

export function greetingMessage(menu, channel = 'messenger') {
  const r = render(menu, channel);
  if (channel === 'messenger') return r.greeting_message;
  if (channel === 'web') return { text: r.greeting, buttons: r.buttons };
  return { text: r.text };
}

// Messenger Profile API body (persistent menu). Applying it changes what EVERY customer of the
// Page sees, so it is only ever produced here; sending it is a separate, owner-approved step.
export function messengerProfileBody(menu) {
  const r = render(menu, 'messenger');
  return { persistent_menu: r.persistent_menu, get_started: { payload: 'TIEN404:START' } };
}
