// TIEN404 V27 Context Card Planner (pure, no I/O, NOT wired into n8n).
// Picks the native UI kind per conversation context, Page industry (via its PUBLISHED menu) and
// channel capability, then degrades step by step to something the channel surely supports:
//   content_card -> button_card -> quick_replies -> text
// Kinds (Tiến's mock-ups 2026-11-24):
//   01 quick_replies  nút ngang phía dưới  — lựa chọn nhanh (greeting, follow-up)
//   02 carousel       thẻ vuốt ngang        — nhiều sản phẩm/dịch vụ đã xác minh
//   03 button_card    nút dọc gắn tin nhắn  — hành động quan trọng (chi tiết 1 mẫu)
//   04 content_card   thẻ nội dung theo ngành — nghệ sĩ/dịch vụ, có thể mở link
// Actions only ever come from visibleItems(config, channel): a Page without SHOW_CATALOG never
// gets sales buttons. Prices/stock only come from caller-supplied, already-validated rows.

import { visibleItems, PAYLOAD_PREFIX } from './channel-render.mjs';

export const MESSENGER_LIMITS = Object.freeze({
  quickMax: 13, quickTitle: 20, buttonMax: 3, buttonTitle: 20, buttonText: 640,
  genericMax: 10, genericTitle: 80, genericSubtitle: 80, text: 2000, payload: 1000,
});
// What each channel can natively show. Anything else falls back to text.
export const CARD_CAPS = Object.freeze({
  messenger: { quick_replies: true, carousel: true, button_card: true, content_card: true, links: true },
  web: { quick_replies: true, carousel: true, button_card: true, content_card: true, links: true },
  zalo_bot: { links: true }, zalo_oa: { links: true }, telegram: { links: true },
});
const UX_FIRST_SCREEN = 3;
const LINK_TYPES = new Set(['OPEN_LINK', 'SHOW_PLAYLIST']);

// Clip by code points so an emoji is never cut in half (fixes F-V27-1 for planner output).
export function clipCp(s, n) {
  const cps = [...String(s ?? '')];
  return cps.length <= n ? cps.join('') : cps.slice(0, n - 1).join('') + '…';
}
const len = (s) => [...s].length;

export function imageAllowed(url, allowHosts = []) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && allowHosts.includes(u.hostname);
  } catch { return false; }
}

function itemButton(it) {
  const url = it.action_config?.url;
  return LINK_TYPES.has(it.action_type) && url
    ? { type: 'web_url', title: clipCp(it.label, MESSENGER_LIMITS.buttonTitle), url }
    : { type: 'postback', title: clipCp(it.label, MESSENGER_LIMITS.buttonTitle), payload: PAYLOAD_PREFIX + it.id };
}
const qrFor = (items) => items.filter((it) => !LINK_TYPES.has(it.action_type)).slice(0, UX_FIRST_SCREEN)
  .map((it) => ({ content_type: 'text', title: clipCp(it.label, MESSENGER_LIMITS.quickTitle), payload: PAYLOAD_PREFIX + it.id }));
const numbered = (text, labels) => text + (labels.length ? '\n\n' + labels.map((l, i) => (i + 1) + '. ' + l).join('\n') + '\n\nBạn gõ số để chọn nhé.' : '');

// Every message must satisfy Meta limits; otherwise the planner degrades instead of sending it.
export function validMessage(m) {
  const L = MESSENGER_LIMITS;
  const okBtn = (b) => b && len(b.title ?? '') >= 1 && len(b.title) <= L.buttonTitle &&
    (b.type === 'postback' ? typeof b.payload === 'string' && b.payload.length <= L.payload
      : b.type === 'web_url' ? /^https:\/\//.test(b.url ?? '') : false);
  if (m.quick_replies && !(m.quick_replies.length <= L.quickMax && m.quick_replies.every((q) =>
    q.content_type === 'text' && len(q.title) >= 1 && len(q.title) <= L.quickTitle && q.payload.length <= L.payload))) return false;
  if (typeof m.text === 'string') return len(m.text) >= 1 && len(m.text) <= L.text;
  const p = m.attachment?.payload;
  if (p?.template_type === 'button') return len(p.text ?? '') >= 1 && len(p.text) <= L.buttonText &&
    p.buttons.length >= 1 && p.buttons.length <= L.buttonMax && p.buttons.every(okBtn);
  if (p?.template_type === 'generic') return p.elements.length >= 1 && p.elements.length <= L.genericMax &&
    p.elements.every((e) => len(e.title ?? '') >= 1 && len(e.title) <= L.genericTitle &&
      (e.subtitle === undefined || len(e.subtitle) <= L.genericSubtitle) &&
      (e.image_url === undefined || /^https:\/\//.test(e.image_url)) &&
      Array.isArray(e.buttons) && e.buttons.length >= 1 && e.buttons.length <= L.buttonMax && e.buttons.every(okBtn));
  return false;
}

/**
 * @param {object} a
 * @param {'messenger'|'web'|'zalo_bot'|'zalo_oa'|'telegram'} a.channel
 * @param {'greeting'|'browse'|'detail'|'order_inquiry'|'handoff'} a.context
 * @param {object} a.config      PUBLISHED Assistant config resolved server-side for this Page
 * @param {string} [a.text]      lead text (deterministic, never AI prices)
 * @param {Array}  [a.rows]      browse: validated rows {key,title,subtitle,payload,image_url?}
 * @param {Array}  [a.actions]   detail: [{title,payload}] already authorised by the caller
 * @param {Array}  [a.pageControls] quick replies for paging, e.g. Trang trước/Trang tiếp
 * @param {string[]} [a.imageHosts] https hosts allowed for card images
 * @returns {{kind:string, messages:object[], degraded:string[]}}
 */
export function planCards({ channel, context, config, text = '', rows = [], actions = [], pageControls = [], imageHosts = [] }) {
  const caps = CARD_CAPS[channel] ?? {};
  const items = visibleItems(config, channel);
  const degraded = [];
  const out = (kind, messages) => {
    if (messages.length > 3) { degraded.push('too_many_messages'); messages = messages.slice(0, 3); }
    if (messages.every(validMessage)) return { kind, messages, degraded };
    degraded.push(kind + ':invalid');
    return null;
  };
  const textOnly = (labels = []) => ({ kind: 'text', messages: [{ text: clipCp(numbered(text || config.greeting || 'Mình có thể giúp gì cho bạn?', labels), MESSENGER_LIMITS.text) }], degraded });

  // Text-only channels (Zalo Bot/OA, Telegram): numbered list, same actions, no buttons.
  if (!caps.quick_replies && !caps.button_card) {
    if (context === 'browse') return textOnly(rows.map((r) => r.title + (r.subtitle ? ' — ' + r.subtitle : '')));
    if (context === 'handoff') return textOnly();
    return textOnly(items.slice(0, 9).map((it) => it.label + (LINK_TYPES.has(it.action_type) && it.action_config?.url ? ': ' + it.action_config.url : '')));
  }

  if (context === 'handoff') return textOnly(); // no bot CTA while staff owns the thread

  if (context === 'order_inquiry') {
    // At most one action; never order details before ownership verification.
    const one = actions.slice(0, 1);
    if (one.length && caps.button_card) {
      const r = out('button_card', [{ attachment: { type: 'template', payload: { template_type: 'button', text: clipCp(text, MESSENGER_LIMITS.buttonText), buttons: one.map((b) => ({ type: 'postback', title: clipCp(b.title, 20), payload: b.payload })) } } }]);
      if (r) return r;
    }
    return textOnly();
  }

  if (context === 'greeting') {
    const top = items.slice(0, UX_FIRST_SCREEN);
    // 04: a link-bearing industry menu (artist playlist, docs) needs buttons that open URLs:
    // quick replies cannot, so use one content card with up to 3 buttons.
    if (caps.content_card && top.some((it) => LINK_TYPES.has(it.action_type) && it.action_config?.url)) {
      const hero = config.profile?.cover_image_url;
      const el = { title: clipCp(config.profile?.card_title || text || config.greeting, MESSENGER_LIMITS.genericTitle), buttons: top.map(itemButton) };
      if (hero && imageAllowed(hero, imageHosts)) el.image_url = hero; else if (hero) degraded.push('image_dropped');
      const r = out('content_card', [
        ...(text && text !== el.title ? [{ text: clipCp(text, MESSENGER_LIMITS.text) }] : []),
        { attachment: { type: 'template', payload: { template_type: 'generic', elements: [el] } } }]);
      if (r) return r;
    }
    // 01: quick replies above the composer.
    const qr = qrFor(items);
    if (caps.quick_replies && qr.length) {
      const r = out('quick_replies', [{ text: clipCp(text || config.greeting, MESSENGER_LIMITS.text), quick_replies: qr }]);
      if (r) return r;
    }
    return textOnly(items.map((it) => it.label));
  }

  if (context === 'browse') {
    if (!items.some((it) => it.action_type === 'SHOW_CATALOG' || it.action_type === 'SHOW_SERVICES')) {
      degraded.push('no_catalog_action');
      return textOnly(); // e.g. artist Page: never show shop cards
    }
    const valid = rows.filter((r) => r && r.title && typeof r.payload === 'string');
    const controls = pageControls.slice(0, 2);
    // 02: carousel for 2..10 verified rows, then lead text carrying the page controls.
    if (caps.carousel && valid.length >= 2) {
      const elements = valid.slice(0, MESSENGER_LIMITS.genericMax).map((r) => {
        const e = { title: clipCp(r.title, 80), buttons: [{ type: 'postback', title: clipCp('Xem ' + (r.key ?? ''), 20), payload: r.payload }] };
        if (r.subtitle) e.subtitle = clipCp(r.subtitle, 80);
        if (r.image_url && imageAllowed(r.image_url, imageHosts)) e.image_url = r.image_url;
        else if (r.image_url) degraded.push('image_dropped:' + r.key);
        return e;
      });
      const r = out('carousel', [
        { attachment: { type: 'template', payload: { template_type: 'generic', elements } } },
        { text: clipCp(text || 'Bấm thẻ ở trên hoặc nhắn mã để xem chi tiết.', MESSENGER_LIMITS.text), ...(controls.length ? { quick_replies: controls } : {}) }]);
      if (r) return r;
    }
    // 03 fallback: up to 3 vertical buttons on one message (old V21 layout).
    if (caps.button_card && valid.length >= 1) {
      const lines = valid.slice(0, 3).map((r) => '• ' + r.title + (r.subtitle ? ' | ' + r.subtitle : '')).join('\n');
      const r = out('button_card', [{ attachment: { type: 'template', payload: { template_type: 'button',
        text: clipCp((text ? text + '\n' : '') + lines, MESSENGER_LIMITS.buttonText),
        buttons: valid.slice(0, 3).map((x) => ({ type: 'postback', title: clipCp('Xem ' + (x.key ?? ''), 20), payload: x.payload })) } },
        ...(controls.length ? { quick_replies: controls } : {}) }]);
      if (r) return r;
    }
    return textOnly(valid.map((r) => r.title));
  }

  if (context === 'detail') {
    // 03: important actions attached to the message (Đặt sản phẩm / Xem mẫu tương tự).
    const btns = actions.slice(0, 3).map((b) => ({ type: 'postback', title: clipCp(b.title, 20), payload: b.payload }));
    if (caps.button_card && btns.length) {
      const msgs = len(text) <= MESSENGER_LIMITS.buttonText
        ? [{ attachment: { type: 'template', payload: { template_type: 'button', text, buttons: btns } } }]
        : [{ text: clipCp(text, MESSENGER_LIMITS.text) }, { attachment: { type: 'template', payload: { template_type: 'button', text: 'Bạn muốn làm gì tiếp?', buttons: btns } } }];
      const r = out('button_card', msgs);
      if (r) return r;
    }
    if (caps.quick_replies && btns.length) {
      const r = out('quick_replies', [{ text: clipCp(text, MESSENGER_LIMITS.text), quick_replies: btns.map((b) => ({ content_type: 'text', title: b.title, payload: b.payload })) }]);
      if (r) return r;
    }
    return textOnly(actions.map((a) => a.title));
  }
  degraded.push('context_unknown');
  return textOnly();
}
