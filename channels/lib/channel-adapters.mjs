// TIEN404 multi-channel adapters — one shared AI sales core, thin adapters per channel.
// Every function here is pure (no I/O) so it can be unit-tested and pasted into n8n Code nodes.
// Contract (see docs/multichannel/README.md):
//   inbound  adapter: provider payload -> CoreRequest[]  { channel, accountId, senderId, messageId, text, mediaType, selectedSku?, fastPath?, sessionId }
//   core            : CoreRequest -> CoreReply           { replyText, skus[], source }
//   outbound adapter: CoreReply   -> provider messages (1 by default, 2 when it helps, hard max 3)

export const MAX_MESSAGES = 3;
export const MAX_INPUT_CHARS = 1800;
export const CHANNELS = ['messenger', 'instagram', 'telegram', 'web', 'zalo', 'tiktok_shop'];

const fold = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

// Same rule as the live Messenger fast path (Z7Fd "Extract Messenger Text", V22):
// only a clear single-SKU question skips the AI.
export function detectSku(text) {
  const norm = fold(text).replace(/[?!.,~…]+/g, ' ').replace(/\s+/g, ' ').trim();
  const all = norm.match(/\b[a-z]\d{3}\b/g) || [];
  if (new Set(all).size !== 1) return null;
  const re = /^(?:(?:cho (?:em|minh|toi|chi|anh|e|m) )?(?:xem|check|coi|hoi|tu van|xin) )?(?:(?:thong tin|gia) )?(?:(?:mau|ma|sp|san pham) )?([a-z]\d{3})(?: (?:gia bao nhieu|bao nhieu tien|bao nhieu|gia sao|gia|con hang khong|con hang ko|con khong|con ko|con k|con hang|con|thong tin|the nao|sao|nhe|nha|a|ah|voi|di|shop|ad))*$/;
  const m = re.exec(norm);
  return m ? m[1].toUpperCase() : null;
}

const VIEW_PAYLOAD = /^TIEN404:VIEW:([A-Z][0-9]{3})$/;
const MEDIA_PROMPT = {
  image: 'ảnh', video: 'video', audio: 'tin nhắn thoại', file: 'tệp', sticker: 'nhãn dán',
};
const mediaText = (kind) => 'Khách vừa gửi ' + (MEDIA_PROMPT[kind] || 'tệp') +
  '. Hệ thống chưa phân tích được nội dung tệp, hãy lịch sự xin khách mô tả sản phẩm hoặc yêu cầu bằng chữ. Không giả vờ đã xem/nghe.';

function finish(base, rawText, { postbackSku } = {}) {
  let text = typeof rawText === 'string' ? rawText.trim() : '';
  const out = { ...base, mediaType: base.mediaType || 'text' };
  if (postbackSku) {
    out.mediaType = 'product_detail'; out.selectedSku = postbackSku; out.fastPath = 'postback';
    out.memoryUserText = 'Tôi vừa bấm nút Xem ' + postbackSku;
    text = 'Xem thông tin mẫu ' + postbackSku;
  } else if (out.mediaType === 'text' && text && text.length <= 80 && !text.startsWith('QA_CORE:')) {
    const sku = detectSku(text);
    if (sku) { out.mediaType = 'product_detail'; out.selectedSku = sku; out.fastPath = 'text'; out.memoryUserText = text; }
  }
  if (!text || text.length > MAX_INPUT_CHARS) return null;
  out.text = text;
  out.sessionId = [out.channel, out.accountId, out.senderId].join(':');
  return out;
}

// ---------- Telegram (Bot API Update) ----------
// cfg: { botId: '123456', now?: ms }
export function normalizeTelegram(update, cfg = {}) {
  const now = cfg.now ?? Date.now();
  if (!update || typeof update !== 'object') return [];
  const updateId = Number(update.update_id);
  if (!Number.isSafeInteger(updateId)) return [];
  const accountId = String(cfg.botId ?? 'telegram');
  if (update.callback_query) {
    const cq = update.callback_query;
    const chat = cq.message?.chat;
    if (!chat || chat.type !== 'private' || cq.from?.is_bot) return [];
    const m = VIEW_PAYLOAD.exec(String(cq.data ?? ''));
    if (!m) return [];
    const r = finish({ channel: 'telegram', accountId, senderId: String(chat.id), messageId: 'tgcb_' + cq.id,
      callbackQueryId: String(cq.id) }, '', { postbackSku: m[1] });
    return r ? [r] : [];
  }
  const msg = update.message;
  if (!msg || msg.chat?.type !== 'private' || msg.from?.is_bot) return []; // groups/channels ignored on purpose
  const ts = Number(msg.date) * 1000;
  if (ts > 0 && (ts > now + 300000 || now - ts > 23 * 3600000)) return [];
  const senderId = String(msg.chat.id);
  if (!/^-?\d{1,20}$/.test(senderId)) return [];
  let text = typeof msg.text === 'string' ? msg.text : (typeof msg.caption === 'string' ? msg.caption : '');
  let mediaType = 'text';
  if (/^\/start\b/.test(text)) {
    mediaType = 'postback';
    text = 'Khách vừa nhấn Bắt đầu trò chuyện. Chào khách và hỏi muốn tư vấn sản phẩm hay hỗ trợ đơn hàng.';
  } else if (!text.trim()) {
    const kind = msg.photo ? 'image' : msg.video ? 'video' : (msg.voice || msg.audio) ? 'audio' : msg.sticker ? 'sticker' : msg.document ? 'file' : null;
    if (!kind) return [];
    mediaType = kind; text = mediaText(kind);
  }
  const r = finish({ channel: 'telegram', accountId, senderId, messageId: 'tg_' + updateId, mediaType }, text);
  return r ? [r] : [];
}

// ---------- Website widget ----------
// body: { action:'sendMessage', sessionId, chatInput, messageId? }  (same shape as @n8n/chat and PR #487 site.js)
// cfg: { siteId, allowedOrigins: [...], origin }
export function normalizeWeb(body, cfg = {}) {
  const errors = [];
  const origin = String(cfg.origin ?? '');
  if (Array.isArray(cfg.allowedOrigins) && cfg.allowedOrigins.length && !cfg.allowedOrigins.includes(origin)) errors.push('origin_not_allowed');
  if (!body || typeof body !== 'object') return { ok: false, errors: ['bad_body'] };
  const sessionId = String(body.sessionId ?? '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(sessionId)) errors.push('bad_session');
  const text = typeof body.chatInput === 'string' ? body.chatInput.trim() : '';
  if (!text) errors.push('empty_text');
  if (text.length > 500) errors.push('text_too_long'); // widget input is capped at 500 chars
  if (errors.length) return { ok: false, errors };
  const messageId = /^[A-Za-z0-9_-]{8,64}$/.test(String(body.messageId ?? '')) ? 'web_' + body.messageId : 'web_' + sessionId + '_' + (cfg.now ?? Date.now());
  const r = finish({ channel: 'web', accountId: String(cfg.siteId ?? 'web'), senderId: sessionId, messageId }, text);
  return r ? { ok: true, request: r } : { ok: false, errors: ['rejected'] };
}

// ---------- Instagram (Messenger Platform for Instagram webhook: object='instagram') ----------
// cfg: { igAccountId }
export function normalizeInstagram(payload, cfg = {}) {
  const now = cfg.now ?? Date.now();
  if (payload?.object !== 'instagram' || !Array.isArray(payload.entry)) return [];
  const own = String(cfg.igAccountId ?? '');
  const out = []; const seen = new Set();
  for (const entry of payload.entry) {
    if (String(entry.id ?? '') !== own || !Array.isArray(entry.messaging)) continue;
    for (const e of entry.messaging) {
      const m = e.message ?? {};
      if (!e.message && !e.postback) continue;
      if (m.is_echo || m.is_deleted || m.is_unsupported) continue;
      const senderId = String(e.sender?.id ?? '');
      if (!/^\d{5,30}$/.test(senderId) || String(e.recipient?.id ?? '') !== own) continue;
      const ts = Number(e.timestamp ?? 0);
      if (ts > 0 && (ts > now + 300000 || now - ts > 23 * 3600000)) continue;
      const messageId = String(m.mid ?? e.postback?.mid ?? '');
      if (!messageId || seen.has(messageId)) continue;
      seen.add(messageId);
      let r = null;
      if (e.postback) {
        const v = VIEW_PAYLOAD.exec(String(e.postback.payload ?? ''));
        if (v) r = finish({ channel: 'instagram', accountId: own, senderId, messageId }, '', { postbackSku: v[1] });
      } else if (typeof m.text === 'string' && m.text.trim()) {
        r = finish({ channel: 'instagram', accountId: own, senderId, messageId }, m.text);
      } else if (Array.isArray(m.attachments) && m.attachments.length) {
        const t = String(m.attachments[0]?.type ?? 'file').toLowerCase();
        const kind = ['image', 'video', 'audio'].includes(t) ? t : 'file';
        r = finish({ channel: 'instagram', accountId: own, senderId, messageId, mediaType: kind }, mediaText(kind));
      }
      if (r) out.push(r);
    }
  }
  return out;
}

// ---------- Core reply helpers ----------
// SKUs listed at the start of a line in the AI reply (same rule as Messenger button cards).
export function listedSkus(reply) {
  return [...new Set(Array.from(String(reply).matchAll(/^\s*(?:[-•*]\s*)?(?:\*\*)?([A-Z]\d{3})\b/gm), (m) => m[1]))];
}

export function splitText(text, limit, maxChunks) {
  text = String(text ?? '').trim();
  if (!text) return [];
  if (text.length <= limit) return [text];
  const parts = text.split(/(\n\s*\n|\n)/);
  const chunks = []; let cur = '';
  for (const p of parts) {
    if ((cur + p).length <= limit) { cur += p; continue; }
    if (cur.trim()) chunks.push(cur.trim());
    cur = p;
    while (cur.length > limit) { chunks.push(cur.slice(0, limit).trim()); cur = cur.slice(limit); }
  }
  if (cur.trim()) chunks.push(cur.trim());
  if (chunks.length > maxChunks) {
    const kept = chunks.slice(0, maxChunks);
    kept[maxChunks - 1] = kept[maxChunks - 1].slice(0, limit - 1) + '…';
    return kept;
  }
  return chunks;
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// The AI writes light Markdown (**bold**). Telegram HTML mode: escape everything, then restore bold.
export function toTelegramHtml(text) {
  return escapeHtml(text).replace(/\*\*([^*\n]{1,200})\*\*/g, '<b>$1</b>');
}

// Telegram: text limit 4096; inline keyboard "Xem A003" rides on the last message (no extra send).
export function composeTelegram(core, chatId) {
  const reply = String(core?.replyText ?? '').trim();
  if (!reply) return [];
  const chunks = splitText(reply, 3500, MAX_MESSAGES); // headroom for HTML entities
  const skus = (core.skus && core.skus.length ? core.skus : listedSkus(reply)).slice(0, 3);
  return chunks.slice(0, MAX_MESSAGES).map((t, i, arr) => {
    const msg = { chat_id: chatId, text: toTelegramHtml(t), parse_mode: 'HTML', disable_web_page_preview: false };
    if (i === arr.length - 1 && skus.length && core.source !== 'fast_path') {
      msg.reply_markup = { inline_keyboard: [skus.map((s) => ({ text: 'Xem ' + s, callback_data: 'TIEN404:VIEW:' + s }))] };
    }
    return msg;
  });
}

// Website: one JSON response; the widget renders up to 3 bubbles + quick buttons.
export function composeWeb(core) {
  const reply = String(core?.replyText ?? '').trim();
  const messages = splitText(reply, 1200, MAX_MESSAGES);
  const skus = core?.source === 'fast_path' ? [] : (core?.skus?.length ? core.skus : listedSkus(reply)).slice(0, 3);
  return { output: reply, messages, quickReplies: skus.map((s) => ({ label: 'Xem ' + s, text: 'Xem ' + s })) };
}

// Instagram: 1000-char text limit; quick replies max 13 (we use ≤3).
export function composeInstagram(core, recipientId) {
  const reply = String(core?.replyText ?? '').trim();
  if (!reply) return [];
  const chunks = splitText(reply, 1000, MAX_MESSAGES);
  const skus = core.source === 'fast_path' ? [] : (core.skus?.length ? core.skus : listedSkus(reply)).slice(0, 3);
  return chunks.map((t, i, arr) => {
    const message = { text: t };
    if (i === arr.length - 1 && skus.length) message.quick_replies = skus.map((s) => ({ content_type: 'text', title: 'Xem ' + s, payload: 'TIEN404:VIEW:' + s }));
    return { recipient: { id: recipientId }, messaging_type: 'RESPONSE', message };
  });
}

// Fast-path product line (same wording as Messenger "Format selected product").
export function formatProduct(sku, rows) {
  const hits = (rows || []).filter((r) => r && r.sku === sku);
  if (hits.length === 0) return 'Dạ shop chưa tìm thấy mẫu ' + sku + ' ạ. Mình muốn shop gợi ý mẫu tương tự không?';
  if (hits.length > 1) return 'Shop chưa xác minh được thông tin mẫu ' + sku + ', mình chờ shop kiểm tra lại nhé.';
  const { name, price, stock } = hits[0];
  const valid = (n) => typeof n === 'number' ? Number.isSafeInteger(n) && n >= 0 : typeof n === 'string' && /^\d+$/.test(n) && Number.isSafeInteger(Number(n));
  if (!(typeof name === 'string' && name.trim() && valid(price) && valid(stock))) return 'Shop chưa xác minh được thông tin mẫu ' + sku + ', mình chờ shop kiểm tra lại nhé.';
  return sku + ' — ' + name.trim() + ' | ' + Number(price).toLocaleString('vi-VN') + 'đ/cái. ' + (Number(stock) === 0 ? 'Mẫu này đã hết hàng.' : 'Còn ' + Number(stock) + ' cái.');
}
